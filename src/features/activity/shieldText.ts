import { isQuiet, type ShieldSummary } from '../../domain/shieldTally';
import type { Strings } from '../../i18n/es';
import { durationText } from '../../lib/format';

/**
 * The session's closing line for what the shield saw (ADR-0053): "4 intentos · 2 pausas,
 * 20m", "al menos 3 intentos" on iPhone. Null when there is nothing to say, so the
 * closing screens leave the row out.
 */
export function shieldLineText(summary: ShieldSummary | null, t: Strings['activity']['shield']): string | null {
  if (summary === null || isQuiet(summary)) {
    return null;
  }
  return t.line(summary.attempts, summary.breaks, durationText(summary.breakMs), summary.floor);
}
