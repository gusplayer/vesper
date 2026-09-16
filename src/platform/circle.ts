import { getStrings } from '../i18n';

/**
 * Circle sync (ADR-0021). There is no server yet, so nothing here talks to the network:
 * `member_weeks` is filled by the demo seed and, one day, by a sync that writes that
 * table and nothing else. Like every capability (ADR-0017), the module exposes a
 * synchronous `status()` the screens read to say, in one line, why what they show is
 * not real. The reason comes from the dictionary at call time (ADR-0020).
 *
 * No side effects: nothing is imported that touches a native module, and calling
 * `status()` changes nothing.
 */

export type CircleSyncStatus = {
  /** False until a backend exists (a later ADR decides which). */
  available: false;
  /** Why, in the app's current language. */
  reason: string;
};

export function status(): CircleSyncStatus {
  return { available: false, reason: getStrings().circle.sync.unavailable };
}
