import type { Account } from './store.ts';

/**
 * Delivery of what another person did (ADR-0027 §5): a nudge, someone asking to enter a
 * circle, someone accepting. Nothing the app could have said by itself goes through
 * here — the streak, the day without focus and the challenge at risk are planned on the
 * phone and stay there (ADR-0031).
 *
 * ## Why every message that leaves here is silent (ADR-0037)
 *
 * Rule 11 and ADR-0027 §1 say the circle never notifies during a session. A message
 * with `title` or `body` is a visible alert: **the operating system draws it before the
 * app ever sees it**, so no amount of client code can hold it back. A nudge sent at
 * 10:40 would ring in the middle of a deep focus session, which is exactly what the
 * rule forbids. ADR-0033 claimed the client held those pushes; it never did, and its
 * footnote now says so.
 *
 * So the server sends a **fact**, not a sentence: who did it, what kind of thing it
 * was, and when. Data only, `contentAvailable` for iOS, normal priority. The phone
 * wakes up, composes the wording in the language of the device, and runs it through the
 * ADR-0027 budget — two notices a day outside a session, nothing between 22:00 and
 * 8:00, absolute silence during a session or a pause, and nothing at all for a nudge
 * that already expired (ADR-0037 §3).
 *
 * **Do not put `title` or `body` back.** Doing so does not "fix" a notification that
 * looks empty; it breaks rule 11 in a way the phone cannot repair. If a push fails to
 * wake the app, the row is already in the database and the phone sees it on its next
 * sync (ADR-0037 §4). That is the fallback — never a visible alert.
 *
 * The budget, the quiet hours and the silence during a session stay the phone's rules.
 * The server respects one thing: the receiver's `nudges` switch.
 */

/** What happened. The phone maps this to a sentence in its own dictionary. */
export type PushKind = 'nudge' | 'invite' | 'accepted';

/**
 * Everything that travels, and nothing else. It is enough for the phone to write the
 * line itself: who, what kind, when — plus, for a nudge, which challenge to open when
 * the notification is tapped (ADR-0027 §5).
 *
 * The sender goes out as an id **and** a handle, never as their name. The id is what
 * the phone looks up to use the name it already synced; the handle is the fallback for
 * a person it has never seen, which is the whole case of an invite. A handle is
 * `[a-z0-9_]{3,20}` and unique (ADR-0033 §3), while a name is free text its owner
 * chose: sending the name would hand a stranger who guesses an invite code a line of
 * their own writing in someone's notification shade, which is the vector ADR-0037 set
 * out to close.
 *
 * Values are strings because this rides in an FCM data message, where everything is a
 * string on the way out anyway. `at` is epoch ms, like every instant in this project.
 */
export type PushData = {
  kind: PushKind;
  /** The account id of whoever did it. */
  from: string;
  /** Their unique handle, for a phone that does not know them yet. */
  fromHandle: string;
  /** When it happened, epoch ms as a decimal string. */
  at: string;
  /** Only for a nudge: the challenge the notification opens. */
  challengeId?: string;
};

export type PushMessage = {
  data: PushData;
  /** True for a nudge, which the receiver can switch off in Ajustes › Círculo. */
  requiresNudges?: boolean;
};

export type Push = {
  send(to: Account, message: PushMessage): Promise<void>;
};

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/**
 * The body Expo takes for a headless background notification: `data` and nothing that
 * presents anything. No `title`, no `body`, no `sound`, no `badge`, no `channelId` —
 * every one of those turns it into an alert the system draws on its own.
 *
 * `contentAvailable` is the current spelling of the iOS flag; `_contentAvailable` is
 * the deprecated one Expo still accepts, and is what ADR-0037 §1 names. Both are sent
 * so this keeps working whichever spelling the service honours; Expo documents that
 * `contentAvailable` wins when both are present, and both say the same thing here.
 *
 * `priority: 'normal'` is ADR-0037 §1 as well, and it is also what Apple asks for: a
 * background push is not an interruption, and a high-priority one spends the budget
 * Apple throttles. On Android a normal-priority data message may wait for the device to
 * wake, which is fine — the nudge is on the phone at the next sync either way.
 */
function expoBody(token: string, data: PushData): string {
  return JSON.stringify({
    to: token,
    data,
    contentAvailable: true,
    _contentAvailable: true,
    priority: 'normal',
  });
}

/** The real one. A phone with no token registered simply gets nothing. */
export function createExpoPush(fetchImpl: typeof fetch = fetch): Push {
  return {
    async send(to, message) {
      if (to.pushToken === null) {
        return;
      }
      if (message.requiresNudges === true && !to.nudgesOn) {
        return;
      }
      const response = await fetchImpl(EXPO_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: expoBody(to.pushToken, message.data),
      });
      if (!response.ok) {
        // A push that does not arrive is not worth failing the request it rode on: the
        // row is already stored and the phone will see it on its next sync.
        console.warn(`push to ${to.id} failed: ${response.status}`);
      }
    },
  };
}

/** For tests and for running the server with no network. Records instead of sending. */
export function createRecordingPush(): Push & { sent: { to: string; message: PushMessage }[] } {
  const sent: { to: string; message: PushMessage }[] = [];
  return {
    sent,
    async send(to, message) {
      if (to.pushToken === null || (message.requiresNudges === true && !to.nudgesOn)) {
        return;
      }
      sent.push({ to: to.id, message });
    },
  };
}
