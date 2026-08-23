import type { Millis } from './types';

/**
 * Weeks lived, weeks left, and what the current pace projects onto what is left.
 *
 * Framing matters here more than precision: this is time allocation, not a countdown.
 * See the product risk table in docs/PRD.md.
 */

export const WEEK_MS = 604_800_000;

/** 365.25 days a year, so leap years do not drift the count. */
const WEEKS_PER_YEAR = 365.25 / 7;

export function weeksLived(birthDate: Millis, now: Millis): number {
  return Math.max(0, Math.floor((now - birthDate) / WEEK_MS));
}

export function weeksTotal(lifeExpectancyYears: number): number {
  return Math.round(lifeExpectancyYears * WEEKS_PER_YEAR);
}

/** Floored at 0: past the expectancy the number stops, it does not go negative. */
export function weeksRemaining(
  birthDate: Millis,
  lifeExpectancyYears: number,
  now: Millis,
): number {
  return Math.max(0, weeksTotal(lifeExpectancyYears) - weeksLived(birthDate, now));
}

/**
 * "a tu ritmo actual, X de eso en redes" — the remaining weeks, converted into the
 * weeks that the current weekly pace of consumed time would take from them.
 *
 * Fed by the estimate, which is always a floor (ADR-0004), so this projection is a
 * floor too. It never exaggerates.
 */
export function projectedWeeksConsumed(
  weeklyConsumedMs: number,
  remainingWeeks: number,
): number {
  if (weeklyConsumedMs <= 0 || remainingWeeks <= 0) {
    return 0;
  }
  return (weeklyConsumedMs / WEEK_MS) * remainingWeeks;
}
