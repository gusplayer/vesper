import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data/stores/app';
import { useCircleStore } from '../../data/stores/circle';
import { useFocusStore } from '../../data/stores/focus';
import { dayBounds } from '../../domain/day';
import {
  noticeId,
  planNotice,
  silencedBySession,
  type PushKind,
  type PushNotice,
} from '../../domain/nudgeNotice';
import { getStrings } from '../../i18n';
import { loadCredentials } from '../circle';
import { putDevice } from '../circleApi';
import {
  addNoticeTapListener,
  addPushListener,
  cancelNotice,
  getPushToken,
  hasPermission,
  presentNotice,
  registerBackgroundNotifications,
  scheduleNotice,
  setPushHandler,
  setSessionSilence,
  spentToday,
  status,
} from '../notifications';

/**
 * The phone's half of ADR-0037: the token goes up, the silent push comes down, and
 * the sentence is written here — never on the server.
 *
 * Three jobs, in the shape every platform hook has (a function that talks to the
 * outside, a hook that decides when, stores that know none of it exists):
 *
 * 1. **Registering.** `POST /device` with the Expo token, the phone's IANA zone and
 *    the nudges switch, **only once there is an account and a permission**
 *    (ADR-0044 §6). Nothing is asked for here: the permission is requested in its own
 *    flow (rule 8), and a phone without one registers nothing anywhere. When the
 *    permission goes away the token is withdrawn — `pushToken: null` — rather than
 *    left up there pointing at a phone that will not show anything.
 *
 * 2. **Receiving.** A data-only push carries `kind`, `from`, `fromHandle`, `at` and
 *    maybe `challengeId`, and **no words**. It lands in `pending`, keyed so a repeat
 *    replaces itself rather than queueing twice.
 *
 * 3. **Deciding.** `planNotice` is the whole gate, and it is pure: two notices a day,
 *    nothing between 22:00 and 8:00, silence during a session or a pause, and nothing
 *    at all for a push older than a day. A notice that has to wait stays in `pending`
 *    and is re-planned when the session closes — with a fresh `now`, so a nudge that
 *    outlived its day while it waited is dropped instead of ringing late.
 *
 * `pending` is memory, not a table. A process that dies forgets what it was holding,
 * and that is allowed: the nudge is already a row on the server and appears on the
 * circle screen at the next sync (ADR-0037 §4). It is never compensated with an alert.
 */

/** Notices waiting for a session to close, by their stable id. */
const pending = new Map<string, PushNotice>();

/**
 * Notices the OS is holding for the morning, and the instant it will draw them. They
 * are tracked because a session that starts before that instant has to take them back:
 * the OS draws a scheduled notification whether or not the app is in front, and
 * "silencio absoluto en sesión" is not a rule the foreground handler alone can keep.
 */
const held = new Map<string, { notice: PushNotice; at: number }>();

/** What was last sent to `POST /device`, so an unchanged device is not re-registered. */
let registered: string | null = null;

let flushing = false;
/** Something arrived while a flush was running: run once more when it finishes. */
let flushAgain = false;

/** Tests and "Borrar todo y reiniciar": forget what was held and what was registered. */
export function forgetPushSync(): void {
  pending.clear();
  held.clear();
  registered = null;
  flushAgain = false;
}

// --- Registering the token ----------------------------------------------------------------

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Tells the server where a push goes. Silent about everything: no account, no
 * permission and no token are all ordinary answers, and none of them shows anything.
 *
 * The key of what was registered carries the token, the zone and the switch, so a
 * phone that travels or a user who flips the switch re-registers, and nothing else does.
 */
export async function registerDevice(): Promise<void> {
  const circle = useCircleStore.getState();
  const profile = circle.profile;
  if (profile === null || circle.account === null || circle.account.id !== profile.id) {
    return;
  }
  const app = useAppStore.getState();
  const allowed = app.settings.notificationsAllowed && (await hasPermission());
  const token = allowed ? await getPushToken() : null;
  if (token === null && registered === null) {
    // No permission and nothing registered before: there is nothing to say, and
    // saying it would be this phone telling a server about itself for no reason
    // (ADR-0044 §6). A permission granted later re-runs this.
    return;
  }
  const zone = timeZone();
  const nudgesOn = app.settings.notifications.nudges;
  const key = `${token ?? 'none'}|${zone}|${nudgesOn ? 'on' : 'off'}`;
  if (key === registered) {
    return;
  }
  const credentials = await loadCredentials(profile.id);
  if (credentials === null) {
    return;
  }
  const result = await putDevice(credentials, { pushToken: token, timeZone: zone, nudgesOn });
  if (result.ok) {
    registered = key;
  }
}

// --- Deciding what a push turns into --------------------------------------------------------

/** The circle's people by account id, so `from` becomes the name the user gave them. */
function namesOf(): ReadonlyMap<string, string> {
  return new Map(useCircleStore.getState().members.map((member) => [member.id, member.name] as const));
}

/**
 * Which switch each kind answers to (ADR-0027 §2). The nudge has its own, in Ajustes ›
 * Notificaciones and in Ajustes › Círculo. An invitation and an acceptance are rare
 * and wait for an answer, so ADR-0027 §5 delivers them immediately; they still pass
 * the session, the quiet hours and the budget like everything else, and the master
 * switch still silences them.
 */
function switchesOf(): Record<PushKind, boolean> {
  // One switch for the whole circle group, not three. ADR-0027 §2 asks that every
  // kind be switchable, and the group is the kind the user thinks in: the settings
  // row says so out loud rather than governing only nudges while two more slip past.
  const circle = useAppStore.getState().settings.notifications.nudges;
  return { nudge: circle, invite: circle, accepted: circle };
}

/**
 * Re-plans everything held. Runs after a push arrives, when a session closes, and
 * when the app comes back to the front. One at a time: two overlapping runs would
 * present the same notice twice.
 */
export async function flushNotices(): Promise<void> {
  if (flushing) {
    flushAgain = true;
    return;
  }
  if (pending.size === 0) {
    return;
  }
  flushing = true;
  try {
    const app = useAppStore.getState();
    const now = Date.now();
    const { dayStart, dayEnd } = dayBounds(now);
    const state = {
      now,
      session: useFocusStore.getState().session,
      allowed: app.settings.notificationsAllowed && (await hasPermission()),
      switches: switchesOf(),
      spentToday: await spentToday(dayStart, dayEnd),
      names: namesOf(),
    };
    const words = getStrings().circle.push;

    for (const [id, notice] of [...pending]) {
      const plan = planNotice(notice, state, words);
      if (plan.action === 'wait') {
        continue;
      }
      pending.delete(id);
      if (plan.action === 'show') {
        await presentNotice(plan.message);
        state.spentToday += 1;
      } else if (plan.action === 'schedule') {
        await scheduleNotice(plan.message, plan.at);
        held.set(id, { notice, at: plan.at });
      }
    }
  } finally {
    flushing = false;
  }
  if (flushAgain) {
    flushAgain = false;
    await flushNotices();
  }
}

/**
 * A session just started: everything the OS was holding for the morning comes back,
 * so nothing of the circle's can draw itself while the session runs. What was already
 * due has been delivered and is forgotten instead of queued a second time.
 */
export async function recallHeldNotices(now: number): Promise<void> {
  for (const [id, entry] of [...held]) {
    held.delete(id);
    if (entry.at <= now) {
      continue;
    }
    await cancelNotice(id);
    pending.set(id, entry.notice);
  }
}

/** The door every push comes through, foreground listener and background task alike. */
export function receivePush(notice: PushNotice): void {
  pending.set(noticeId(notice), notice);
  void flushNotices();
}

// --- The hook -------------------------------------------------------------------------------

export function usePushSync(): void {
  useEffect(() => {
    if (!status().available) {
      return;
    }

    setPushHandler(receivePush);
    setSessionSilence(silencedBySession(useFocusStore.getState().session));
    void registerBackgroundNotifications();
    void registerDevice();
    void flushNotices();

    const listener = addPushListener();

    // Tapping a nudge opens the challenge it is about; that is the only thing a
    // circle notice routes to, and an unknown one routes nowhere.
    const taps = addNoticeTapListener((challengeId) => {
      if (challengeId !== null) {
        router.push({ pathname: '/circle/challenge', params: { id: challengeId } });
      }
    });

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void registerDevice();
        void flushNotices();
      }
    });

    // The session is what silences everything, so the flag and the queue both follow
    // it: starting one holds what is waiting, closing one lets it go.
    const unsubscribeFocus = useFocusStore.subscribe((next, previous) => {
      const was = silencedBySession(previous.session);
      const is = silencedBySession(next.session);
      if (was === is) {
        return;
      }
      setSessionSilence(is);
      if (is) {
        void recallHeldNotices(Date.now());
      } else {
        void flushNotices();
      }
    });

    // The account is born late (ADR-0044 §2); the token goes up the moment it does.
    const unsubscribeCircle = useCircleStore.subscribe((next, previous) => {
      if (next.account !== previous.account) {
        void registerDevice();
      }
    });

    const unsubscribeApp = useAppStore.subscribe((next, previous) => {
      if (
        next.settings.notificationsAllowed !== previous.settings.notificationsAllowed ||
        next.settings.notifications.nudges !== previous.settings.notifications.nudges
      ) {
        void registerDevice();
      }
    });

    return () => {
      setPushHandler(null);
      listener.remove();
      taps.remove();
      appState.remove();
      unsubscribeFocus();
      unsubscribeCircle();
      unsubscribeApp();
    };
  }, []);
}

/** Takes a notice that is waiting back off the OS. Leaving the circle, deleting the account. */
export async function dropNotice(id: string): Promise<void> {
  pending.delete(id);
  await cancelNotice(id);
}
