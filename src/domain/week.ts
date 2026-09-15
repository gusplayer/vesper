import { dayBounds, dayKeyOf, weekStart } from './day';
import { served } from './session';
import { HOUR } from './time';
import type { DayKey, Millis, Session } from './types';

/**
 * The weekly focus goal. One target per week, reset on Monday — daily streaks punish
 * whoever gets sick on a Tuesday (docs/PRD.md).
 *
 * Pure. The target itself lives in settings, written from the flow that uses it.
 */

/** Offered targets, in hours. `null` means no goal, which is a valid answer. */
export const WEEKLY_TARGET_HOURS = [5, 10, 15, 20] as const;

export type WeekProgress = {
  focusMs: number;
  /** Null when there is no goal. Zero is normalised to null before it gets here. */
  targetMs: number | null;
  met: boolean;
  daysLeft: number;
};

/** The window the weekly goal and the habits are counted in: Monday to today. */
export type WeekWindow = {
  from: Millis;
  /** End of today, exclusive. */
  to: Millis;
  fromKey: DayKey;
  toKey: DayKey;
};

export function weekWindow(now: Millis): WeekWindow {
  const from = weekStart(now);
  return {
    from,
    to: dayBounds(now).dayEnd,
    fromKey: dayKeyOf(from),
    toKey: dayKeyOf(now),
  };
}

/** No goal is a valid answer, and so is a stored zero: both mean "none". */
export function hasTarget(targetMs: number | null): targetMs is number {
  return targetMs !== null && targetMs > 0;
}

export function isPresetTarget(targetMs: number | null): boolean {
  return !hasTarget(targetMs) || WEEKLY_TARGET_HOURS.some((hours) => hours * HOUR === targetMs);
}

/**
 * Sunday is closing day: the weekly goal ends and the next one is chosen. See ADR-0013.
 */
export function isClosingDay(now: Millis): boolean {
  return new Date(now).getDay() === 0;
}

/**
 * Days remaining in the week including today, so Monday reads as 7 and Sunday as 1.
 * Counted on the calendar, not in milliseconds: a day is 23 or 25 hours long twice a
 * year and dividing would slip by one that week.
 */
export function daysLeftInWeek(now: Millis): number {
  const daysSinceMonday = (new Date(now).getDay() + 6) % 7;
  return 7 - daysSinceMonday;
}

export function weekProgress(
  sessions: ReadonlyArray<Session>,
  targetMs: number | null,
  now: Millis,
): WeekProgress {
  const focusMs = sessions.reduce((total, session) => total + served(session, now), 0);
  const target = hasTarget(targetMs) ? targetMs : null;

  return {
    focusMs,
    targetMs: target,
    met: target !== null && focusMs >= target,
    daysLeft: daysLeftInWeek(now),
  };
}
