import { WEEK } from './time';
import type { Millis } from './types';

/**
 * Weeks lived, weeks left, and what the current pace projects onto what is left.
 *
 * Framing matters here more than precision: this is time allocation, not a countdown.
 * See the product risk table in docs/PRD.md.
 */

/** 365.25 days a year, so leap years do not drift the count. */
const WEEKS_PER_YEAR = 365.25 / 7;

export function weeksLived(birthDate: Millis, now: Millis): number {
  return Math.max(0, Math.floor((now - birthDate) / WEEK));
}

/** Never negative: a bad expectancy setting yields an empty grid, not an inverted one. */
export function weeksTotal(lifeExpectancyYears: number): number {
  return Math.max(0, Math.round(lifeExpectancyYears * WEEKS_PER_YEAR));
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
 * floor too. It never exaggerates. Unused until phase 3 brings the estimate.
 */
export function projectedWeeksConsumed(
  weeklyConsumedMs: number,
  remainingWeeks: number,
): number {
  if (weeklyConsumedMs <= 0 || remainingWeeks <= 0) {
    return 0;
  }
  return (weeklyConsumedMs / WEEK) * remainingWeeks;
}

/** One square per week, this many per row. */
export const GRID_COLUMNS = 52;

export type GridRow = {
  cells: number;
  /** How many of this row's cells are lived, 0 to cells. */
  filled: number;
};

/** The rows of the week grid. Lived is clamped to the grid: nothing overflows. */
export function weekGridRows(lived: number, total: number, columns = GRID_COLUMNS): GridRow[] {
  const rows: GridRow[] = [];
  const livedClamped = Math.min(Math.max(0, lived), Math.max(0, total));

  for (let start = 0; start < total; start += columns) {
    rows.push({
      cells: Math.min(columns, total - start),
      filled: Math.min(columns, Math.max(0, livedClamped - start)),
    });
  }

  return rows;
}

/** Square size so that `columns` cells and their gaps fill `width`. Never below 1pt. */
export function cellSize(width: number, columns = GRID_COLUMNS, gap = 1): number {
  if (width <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor((width - (columns - 1) * gap) / columns));
}
