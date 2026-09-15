import * as Notifications from 'expo-notifications';

import type { NotificationSpec } from '../domain/reminders';
import { isAndroid, isIos, type CapabilityStatus } from './capabilities';

/**
 * Local notifications through expo-notifications. This is the only file that talks to
 * the module; everything above it deals in `NotificationSpec` from the domain.
 *
 * Every native call is wrapped: a failure here is logged and swallowed, never thrown
 * into a screen. When the capability is not available, each function is a no-op that
 * resolves to the "nothing happened" value.
 */

const REASON_UNAVAILABLE = 'Las notificaciones solo existen en el teléfono.';

/** Android 8+ routes every notification through a channel; one is enough for us. */
const ANDROID_CHANNEL_ID = 'reminders';

/** Stored in `content.data` so the diff can tell a changed spec from an unchanged one. */
const DATA_KIND = 'kind';
const DATA_FINGERPRINT = 'fingerprint';

const available = (isIos || isAndroid) && typeof Notifications.scheduleNotificationAsync === 'function';

export function status(): CapabilityStatus {
  return available ? { available: true, reason: null } : { available: false, reason: REASON_UNAVAILABLE };
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

// Runs once at module load: how a notification shows while the app is in the
// foreground. Banner and list always; sound only for the end of a session.
if (available) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: readString(notification.request.content.data, DATA_KIND) === 'sessionEnd',
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    report('setNotificationHandler', error);
  }
  if (isAndroid) {
    Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch((error: unknown) => report('setNotificationChannelAsync', error));
  }
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
export function syncScheduled(specs: ReadonlyArray<NotificationSpec>): Promise<void> {
  if (!available) {
    return Promise.resolve();
  }
  queue = queue.then(() => applyPlan(specs)).catch((error: unknown) => report('syncScheduled', error));
  return queue;
}

async function applyPlan(specs: ReadonlyArray<NotificationSpec>): Promise<void> {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const held = new Map<string, string | null>();
  for (const request of existing) {
    held.set(request.identifier, readString(request.content.data, DATA_FINGERPRINT));
  }
  const wanted = new Map(specs.map((spec) => [spec.id, spec] as const));

  for (const [identifier] of held) {
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
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false, data: { [DATA_KIND]: 'test' } },
      trigger: isAndroid ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
  } catch (error) {
    report('presentNow', error);
  }
}
