import type { Account } from './store.ts';

/**
 * Delivery of what another person did (ADR-0027 §5): a nudge, a cheer grouped at the
 * end of the day, someone entering a circle, an invitation to a challenge. Nothing the
 * app could have said by itself goes through here — the streak, the day without focus
 * and the challenge at risk are planned on the phone and stay there (ADR-0031).
 *
 * The budget, the quiet hours and the silence during a session are the phone's rules,
 * not the server's: a push that lands during a session is held and shown at the close.
 */

export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
  /** True for a nudge, which the receiver can switch off in Ajustes › Círculo. */
  requiresNudges?: boolean;
};

export type Push = {
  send(to: Account, message: PushMessage): Promise<void>;
};

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

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
        body: JSON.stringify({
          to: to.pushToken,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: null,
        }),
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
