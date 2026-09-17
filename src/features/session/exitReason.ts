import type { Strings } from '../../i18n/es';

/**
 * What a session's `exitReason` holds when the user typed nothing and an emergency
 * unlock ended it. An identifier, not a sentence: the row is read back in whatever
 * language the app speaks then, and a language change does not leave mixed reasons
 * in the ledger.
 */
export const EMERGENCY_EXIT_REASON = 'emergency';

/**
 * The reason as the user reads it. The identifier is translated; anything else is
 * shown as stored: a reason the user typed, or a row from before the identifier
 * existed, which holds the sentence in the language of that day.
 */
export function exitReasonText(reason: string, t: Strings['session']): string {
  return reason === EMERGENCY_EXIT_REASON ? t.emergency.reason : reason;
}
