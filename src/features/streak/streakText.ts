import { STREAK_DAY_MIN_MS, type StreakState } from '../../domain/streak';
import { MINUTE } from '../../domain/time';
import type { Strings } from '../../i18n/es';

/**
 * The streak in words (ADR-0027). Presentation only: a number, the grace left, and
 * the one line that says a grace day was spent yesterday. No fire, no animation.
 */

/** The minimum a day needs, in minutes, for the copy that explains the rule. */
const MIN_MINUTES = STREAK_DAY_MIN_MS / MINUTE;

export type StreakLineStrings = Pick<Strings, 'focus'>;
export type StreakSectionStrings = Pick<Strings, 'activity'>;

/**
 * The line under the pill on the Focus tab: '12 días seguidos · 2 de gracia'. The
 * morning after a grace day it says so once; without a streak it says what a day needs.
 */
export function streakLineText(streak: StreakState, t: StreakLineStrings): string {
  // Zero wins over the grace line on purpose. Since ADR-0039 a grace day holds the
  // chain without counting itself, so `days: 0` with `graceYesterday` is reachable at
  // the edge of the window: saying "yesterday cost a grace day" over a streak of zero
  // explains nothing, while what a day needs still does.
  if (streak.days === 0) {
    return t.focus.streak.none(MIN_MINUTES);
  }
  if (streak.graceYesterday) {
    return t.focus.streak.graceYesterday(streak.days);
  }
  return t.focus.streak.line(streak.days, streak.graceLeft);
}

/** The heading of the streak card in Actividad: '12 días seguidos'. */
export function streakDaysText(streak: StreakState, t: StreakSectionStrings, tag: string): string {
  return streak.days === 0 ? t.activity.streak.none : t.activity.streak.days(streak.days, tag);
}

/** The label under it: what a day needs and how much grace is left this month. */
export function streakExplainText(streak: StreakState, t: StreakSectionStrings): string {
  return t.activity.streak.explain(MIN_MINUTES, streak.graceLeft);
}
