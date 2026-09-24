import { healthTypeFor } from '../../domain/habits';
import { stepGoalFor } from '../../domain/healthMarks';
import type { Strings } from '../../i18n/es';
import { clockText } from '../../lib/format';

/**
 * How a Health sync reads on screen. Pure: epoch ms in, text out. Lives with the
 * health feature because the activity tab and the Health settings page are the only
 * two places that speak of syncs. The words come from the `habits` slice of the
 * dictionary (`useStrings().habits`, ADR-0020); the clock is `lib/format`'s, the same
 * in every language.
 */

/** 'sincronizado 14:30', or what to say before the first read. */
export function syncedText(syncedAt: number | null, t: Strings['habits']): string {
  return syncedAt === null ? t.sync.never : t.sync.at(clockText(syncedAt));
}

/**
 * The goal a steps habit counts against, read from its name (ADR-0042): 'Cuenta los
 * días con 10.000 pasos o más'. Null for any other habit, so the line only shows where
 * a number in the name means something.
 */
export function stepGoalText(name: string, t: Strings['habits']['form'], tag: string): string | null {
  return healthTypeFor(name.trim()) === 'steps' ? t.stepGoal(stepGoalFor(name), tag) : null;
}
