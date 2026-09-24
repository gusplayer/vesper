import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  countsAgainstBudget,
  foregroundPresentation,
  NOTICE_ID_PREFIX,
  parsePushNotice,
  type NoticeMessage,
  type PushNotice,
} from '../domain/nudgeNotice';
import type { NotificationSpec } from '../domain/reminders';
import { getStrings } from '../i18n';
import { isAndroid, isIos, type CapabilityStatus } from './capabilities';

/**
 * Local notifications through expo-notifications. This is the only file that talks to
 * the module; everything above it deals in `NotificationSpec` from the domain.
 *
 * Every native call is wrapped: a failure here is logged and swallowed, never thrown
 * into a screen. When the capability is not available, each function is a no-op that
 * resolves to the "nothing happened" value.
 *
 * Words are read from the dictionary at call time (`getStrings()`, ADR-0020), never
 * cached: the language can change while the app runs.
 *
 * ## The push half (ADR-0037)
 *
 * Since ADR-0037 this file also receives. What arrives from the circle's server is a
 * **silent, data-only message**: no title, no body, nothing the system can draw on its
 * own. It is handed to `pushHandler` — set by `usePushSync` — which composes the
 * sentence and decides, through `domain/nudgeNotice.ts`, whether it rings now, later
 * or never. Two rules hold that together:
 *
 * - **Nothing without words of its own is ever presented.** `foregroundPresentation`
 *   shows nothing for a notification with no `kind`, which is exactly what a remote
 *   data message is, and shows nothing at all during a session or a pause but the
 *   session's own two notices. Before this, the handler said "banner, always", and a
 *   nudge would have drawn itself in the middle of deep focus (rule 11).
 * - **Notices the circle pushes are not part of the plan.** They carry the
 *   `NOTICE_ID_PREFIX` and `applyPlan` leaves them alone, so the next reminder sync
 *   does not cancel a notice that is waiting for the morning.
 */

/** Android 8+ routes every notification through a channel; one is enough for us. */
const ANDROID_CHANNEL_ID = 'reminders';

/** Stored in `content.data` so the diff can tell a changed spec from an unchanged one. */
const DATA_KIND = 'kind';
const DATA_FINGERPRINT = 'fingerprint';
/** On a circle notice: the challenge a tap opens (ADR-0027 §5). */
const DATA_CHALLENGE = 'challengeId';

const available = (isIos || isAndroid) && typeof Notifications.scheduleNotificationAsync === 'function';

export function status(): CapabilityStatus {
  return available
    ? { available: true, reason: null }
    : { available: false, reason: getStrings().notifications.unavailable };
}

function report(where: string, error: unknown): void {
  console.warn(`[notifications] ${where} failed`, error);
}

function readString(data: unknown, key: string): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Creates the Android channel, or renames it: the name is what the system settings
 * show and it follows the app's language. Called before anything is scheduled or
 * presented, so a language change reaches the channel with the next sync.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (!isAndroid) {
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: getStrings().notifications.channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch (error) {
    report('setNotificationChannelAsync', error);
  }
}

/**
 * True while a session runs or is paused. Set by `usePushSync` from the focus store,
 * so this file keeps knowing nothing about the stores. The foreground handler has to
 * answer within three seconds and cannot await anything, which is why this is a flag
 * and not a lookup.
 */
let inSession = false;

export function setSessionSilence(on: boolean): void {
  inSession = on;
}

// Runs once at module load: how a notification shows while the app is in the
// foreground. The rules live in the domain (`foregroundPresentation`): nothing at all
// for a data-only push, nothing but the session's own notices during a session, and
// sound only for the end of a session.
if (available) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) =>
        foregroundPresentation(readString(notification.request.content.data, DATA_KIND), inSession),
    });
  } catch (error) {
    report('setNotificationHandler', error);
  }
  void ensureAndroidChannel();
}

export async function hasPermission(): Promise<boolean> {
  if (!available) {
    return false;
  }
  try {
    const response = await Notifications.getPermissionsAsync();
    return response.granted;
  } catch (error) {
    report('getPermissionsAsync', error);
    return false;
  }
}

/** Shows the system prompt the first time; afterwards only reports what the OS says. */
export async function requestPermission(): Promise<boolean> {
  if (!available) {
    return false;
  }
  try {
    const response = await Notifications.requestPermissionsAsync();
    return response.granted;
  } catch (error) {
    report('requestPermissionsAsync', error);
    return false;
  }
}

/** Everything that decides when and what a spec shows; when it changes, reschedule. */
function fingerprintOf(spec: NotificationSpec): string {
  const when =
    spec.trigger === 'date'
      ? `date:${spec.at}`
      : `weekly:${spec.weekday}:${spec.hour}:${spec.minute}`;
  return `${when}|${spec.title}|${spec.body}|${spec.sound ? 'sound' : 'silent'}`;
}

function triggerOf(spec: NotificationSpec): Notifications.SchedulableNotificationTriggerInput {
  const channelId = isAndroid ? ANDROID_CHANNEL_ID : undefined;
  if (spec.trigger === 'date') {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: spec.at, channelId };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: spec.weekday,
    hour: spec.hour,
    minute: spec.minute,
    channelId,
  };
}

function requestOf(spec: NotificationSpec): Notifications.NotificationRequestInput {
  return {
    identifier: spec.id,
    content: {
      title: spec.title,
      body: spec.body,
      sound: spec.sound ? 'default' : false,
      data: { [DATA_KIND]: spec.kind, [DATA_FINGERPRINT]: fingerprintOf(spec) },
    },
    trigger: triggerOf(spec),
  };
}

// Syncs run one after another: two debounced runs interleaving could cancel what the
// other just scheduled.
let queue: Promise<void> = Promise.resolve();

/**
 * Makes what the OS holds equal to `specs`, by identifier. Specs already scheduled
 * with the same fingerprint are left alone; changed ones are rescheduled; anything the
 * OS holds that is not in the plan is cancelled. An empty plan clears everything.
 */
export function syncScheduled(specs: readonly NotificationSpec[]): Promise<void> {
  if (!available) {
    return Promise.resolve();
  }
  queue = queue.then(() => applyPlan(specs)).catch((error: unknown) => report('syncScheduled', error));
  return queue;
}

async function applyPlan(specs: readonly NotificationSpec[]): Promise<void> {
  await ensureAndroidChannel();
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const held = new Map<string, string | null>();
  for (const request of existing) {
    held.set(request.identifier, readString(request.content.data, DATA_FINGERPRINT));
  }
  const wanted = new Map(specs.map((spec) => [spec.id, spec] as const));

  for (const [identifier] of held) {
    // A circle notice waiting for the morning is not part of the plan and is not the
    // plan's to cancel (ADR-0037 §2). Its own id is what takes it away.
    if (identifier.startsWith(NOTICE_ID_PREFIX)) {
      continue;
    }
    if (!wanted.has(identifier)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch (error) {
        report(`cancel ${identifier}`, error);
      }
    }
  }

  for (const spec of specs) {
    if (held.has(spec.id) && held.get(spec.id) === fingerprintOf(spec)) {
      continue;
    }
    try {
      // Same identifier replaces the previous request on both platforms.
      await Notifications.scheduleNotificationAsync(requestOf(spec));
    } catch (error) {
      report(`schedule ${spec.id}`, error);
    }
  }
}

/** Shows a notification right away. For the "Probar ahora" button, nothing else. */
export async function presentNow(title: string, body: string): Promise<void> {
  if (!available) {
    return;
  }
  await ensureAndroidChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false, data: { [DATA_KIND]: 'test' } },
      trigger: isAndroid ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
  } catch (error) {
    report('presentNow', error);
  }
}

// --- The push half (ADR-0037) -------------------------------------------------------------

/**
 * The Expo push token for this phone, or null. **It never asks for anything.** The
 * permission is requested in its own flow (rule 8) and the caller checks both it and
 * the account before calling: a phone with no permission, or with no circle account,
 * registers nothing anywhere (ADR-0044 §6).
 *
 * `projectId` is the EAS project the token is minted for. Expo defaults it to
 * `expoConfig.extra.eas.projectId`, but only when that value survives into the
 * runtime config; passing it explicitly is what the SDK 57 docs ask for, and a build
 * without it answers null instead of throwing into a hook.
 */
export async function getPushToken(): Promise<string | null> {
  if (!available || !(await hasPermission())) {
    return null;
  }
  const extra = Constants.expoConfig?.extra;
  const eas = typeof extra === 'object' && extra !== null ? (extra as Record<string, unknown>).eas : undefined;
  const projectId =
    typeof eas === 'object' && eas !== null ? (eas as Record<string, unknown>).projectId : undefined;
  if (typeof projectId !== 'string' || projectId.length === 0) {
    report('getExpoPushTokenAsync', new Error('no EAS projectId in app config'));
    return null;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    report('getExpoPushTokenAsync', error);
    return null;
  }
}

function contentOf(message: NoticeMessage): Notifications.NotificationContentInput {
  return {
    title: message.title,
    body: message.body,
    sound: false,
    data: {
      [DATA_KIND]: message.kind,
      ...(message.challengeId === null ? {} : { [DATA_CHALLENGE]: message.challengeId }),
    },
  };
}

/** Shows a circle notice right now. Its id is stable, so a repeat replaces it. */
export async function presentNotice(message: NoticeMessage): Promise<void> {
  if (!available) {
    return;
  }
  await ensureAndroidChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: message.id,
      content: contentOf(message),
      trigger: isAndroid ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
  } catch (error) {
    report(`presentNotice ${message.id}`, error);
  }
}

/**
 * Hands a circle notice to the OS for `at` — the next 8:00, when the push landed
 * inside quiet hours. The OS keeps the time, so the notice still arrives on a phone
 * that never comes back to the front in between, and `applyPlan` will not cancel it.
 */
export async function scheduleNotice(message: NoticeMessage, at: number): Promise<void> {
  if (!available) {
    return;
  }
  await ensureAndroidChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: message.id,
      content: contentOf(message),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: isAndroid ? ANDROID_CHANNEL_ID : undefined,
      },
    });
  } catch (error) {
    report(`scheduleNotice ${message.id}`, error);
  }
}

export async function cancelNotice(id: string): Promise<void> {
  if (!available) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    report(`cancelNotice ${id}`, error);
  }
}

/**
 * How much of today's budget is already gone (ADR-0027 §2), read from what the OS has
 * actually delivered rather than from what was planned. A notice that was planned for
 * 20:00 and has not fired yet has spent nothing, and the push that arrives at 10:00 is
 * the higher priority of the two anyway.
 *
 * It counts the shade, so a user who swipes their notifications away frees the budget.
 * That is the honest reading of "how many have I been shown today" that the phone can
 * get without a second ledger, and it errs on the side of letting a nudge through —
 * which is what ADR-0027 §2 puts at the top of the order.
 */
export async function spentToday(dayStart: number, dayEnd: number): Promise<number> {
  if (!available || typeof Notifications.getPresentedNotificationsAsync !== 'function') {
    return 0;
  }
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    return presented.filter(
      (notification) =>
        notification.date >= dayStart &&
        notification.date < dayEnd &&
        countsAgainstBudget(readString(notification.request.content.data, DATA_KIND)),
    ).length;
  } catch (error) {
    report('getPresentedNotificationsAsync', error);
    return 0;
  }
}

/**
 * What a silent push turns into. Set by `usePushSync` when it mounts, which is the
 * only moment the app's own state is loaded.
 *
 * While it is null nothing is composed and nothing rings — and that is deliberate.
 * The background task runs the JS bundle with no React root, so the stores are empty:
 * a notice composed there would not know a session is running and would ring straight
 * through rule 11. When the process was already alive (the ordinary case of a phone
 * in someone's pocket) the handler is set and the notice goes through the full gate.
 * When it was not, the nudge is already a row on the server and shows up on the circle
 * screen at the next sync, which is exactly the fallback ADR-0037 §4 allows.
 */
type PushHandler = (notice: PushNotice) => void;

let pushHandler: PushHandler | null = null;

export function setPushHandler(handler: PushHandler | null): void {
  pushHandler = handler;
}

function deliver(payload: unknown): void {
  const notice = parsePushNotice(payload);
  if (notice === null || pushHandler === null) {
    return;
  }
  try {
    pushHandler(notice);
  } catch (error) {
    report('pushHandler', error);
  }
}

/**
 * The task the OS wakes for a headless background notification. Defined at module
 * scope, as expo asks: `expo-task-manager` loads the JS bundle and looks the task up
 * by name, and a task defined inside a component would not exist yet.
 *
 * It is the same door as the foreground listener; `deliver` is what decides whether
 * anything can be done with what came through it.
 */
export const BACKGROUND_NOTIFICATION_TASK = 'vesper-circle-push';

if (available) {
  try {
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(
      BACKGROUND_NOTIFICATION_TASK,
      async ({ data }) => {
        // A tap carries only a `notification`; a headless data message carries `data`.
        if (data !== null && typeof data === 'object' && 'data' in data) {
          deliver((data as { data: unknown }).data);
        }
        return Notifications.BackgroundNotificationTaskResult.NoData;
      },
    );
  } catch (error) {
    report('defineTask', error);
  }
}

/**
 * Asks the OS to wake the app for silent pushes. On iOS this needs
 * `UIBackgroundModes: ["remote-notification"]`, which the expo-notifications config
 * plugin writes from `enableBackgroundRemoteNotifications: true`; without it the task
 * simply never runs and the nudge waits for the next sync (ADR-0037 §4).
 */
export async function registerBackgroundNotifications(): Promise<void> {
  if (!available || typeof Notifications.registerTaskAsync !== 'function') {
    return;
  }
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (error) {
    report('registerTaskAsync', error);
  }
}

/**
 * Listens for notifications that reach the app while it is running. A silent push
 * arrives here too, with its data and nothing else; `foregroundPresentation` makes
 * sure the OS draws none of it.
 */
export function addPushListener(): { remove: () => void } {
  if (!available) {
    return { remove: () => undefined };
  }
  const received = Notifications.addNotificationReceivedListener((notification) => {
    deliver(notification.request.content.data);
  });
  return { remove: () => received.remove() };
}

/**
 * Listens for taps. A nudge is the only notice that leads anywhere — to the challenge
 * it is about (ADR-0027 §5) — so the handler is given that id and nothing else; every
 * other notification answers null and routes nowhere.
 */
export function addNoticeTapListener(handler: (challengeId: string | null) => void): {
  remove: () => void;
} {
  if (!available) {
    return { remove: () => undefined };
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    handler(readString(data, DATA_KIND) === 'nudge' ? readString(data, DATA_CHALLENGE) : null);
  });
  return { remove: () => subscription.remove() };
}
