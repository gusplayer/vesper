import { DAY, HOUR, MINUTE } from '../../domain/time';

/**
 * Whether the previous Vesper the welcome screen found is still in use on another device
 * (ADR-0050 §8–§9), pure so vitest can hold it. `useFoundVesper` does the asking; this
 * does the deciding.
 *
 * A Vesper is one active device at a time. An iPad on the same Apple account finds the
 * iPhone's key in iCloud Keychain, and the two old choices — restore, which rotates the
 * secret under the iPhone, and start over, which deletes it — were made for a phone that
 * replaces a lost one, not for one that lives next to another. So the server says when it
 * last saw that Vesper, and a use within 30 days changes the offer.
 *
 * Only a request that changes something counts as a use on the server: the welcome
 * screen's two reads (`GET /account`, `GET /backup/meta`) never move `lastSeenAt`, so
 * looking again after a relaunch does not read this very screen as "another device, a
 * minute ago". Nothing on the welcome screen may write before it has read it.
 */

/** A use within this window means another device still has that Vesper (§9). */
export const IN_USE_WINDOW_MS = 30 * DAY;

/**
 * - `loading`: the server is being asked.
 * - `unknown`: it could not be asked (no connection, a server error). Nothing
 *   destructive is offered on an unknown.
 * - `inUse`: another device used it within 30 days, at `lastSeenAt`.
 * - `idle`: not used in 30 days, or never.
 */
export type FoundUse =
  | { kind: 'loading' }
  | { kind: 'unknown' }
  | { kind: 'inUse'; lastSeenAt: number }
  | { kind: 'idle' };

/** The use, from when the server last saw it. */
export function foundUseOf(lastSeenAt: number | null, now: number): FoundUse {
  // A clock behind the server's reads a fresh use as a moment in the future: in use.
  return lastSeenAt !== null && now - lastSeenAt < IN_USE_WINDOW_MS ? { kind: 'inUse', lastSeenAt } : { kind: 'idle' };
}

/**
 * The welcome screen's two buttons for each answer.
 *
 * - `inUse`: "Traerlo aquí" (restore, after a confirmation) and "Empezar aparte".
 * - `idle`: "Restaurar" and "Empezar de cero", which deletes after a confirmation.
 * - `unknown`: "Restaurar" and "Empezar aparte". Deleting a Vesper nobody could check
 *   on is how an iPad that opens offline would delete the iPhone's.
 * - `loading`: "Restaurar", waiting; nothing else until the answer is in.
 */
export type WelcomeChoices = {
  primary: 'restore' | 'bringHere';
  secondary: 'startFresh' | 'startApart' | null;
  ready: boolean;
};

export function welcomeChoices(use: FoundUse): WelcomeChoices {
  switch (use.kind) {
    case 'loading':
      return { primary: 'restore', secondary: null, ready: false };
    case 'unknown':
      return { primary: 'restore', secondary: 'startApart', ready: true };
    case 'inUse':
      return { primary: 'bringHere', secondary: 'startApart', ready: true };
    case 'idle':
      return { primary: 'restore', secondary: 'startFresh', ready: true };
  }
}

/**
 * "hace 2 horas", "3 days ago": how long ago `at` was, for the line "Este Vesper se usó
 * por última vez {when}". The words come from i18n because Hermes has no
 * Intl.RelativeTimeFormat. Numeric always: "ayer" by the clock would be wrong for a use
 * 30 hours ago, and never "0 minutes" — anything under a minute (or a clock a little
 * ahead) is one minute.
 */
export function lastUseWhen(
  at: number,
  now: number,
  ago: (count: number, unit: 'minute' | 'hour' | 'day') => string,
): string {
  const elapsed = Math.max(0, now - at);
  if (elapsed < HOUR) {
    return ago(Math.max(1, Math.floor(elapsed / MINUTE)), 'minute');
  }
  if (elapsed < DAY) {
    return ago(Math.floor(elapsed / HOUR), 'hour');
  }
  return ago(Math.floor(elapsed / DAY), 'day');
}
