import { shiftDayKey } from './day';
import { MINUTE } from './time';
import type { DayKey, GraceDay } from './types';

/**
 * The daily streak with grace days (ADR-0027). A day counts with ten minutes of
 * verified focus; the streak is the run of counted days ending today or yesterday,
 * because today is still open. When a day fails, one of the month's three grace days
 * bridges it on its own, so the streak survives a sick Tuesday. Pure: the day totals
 * come folded from `sessions` (db/queries/streak) and the grace rows from their table.
 */

export const STREAK_DAY_MIN_MS = 10 * MINUTE;
export const GRACE_DAYS_PER_MONTH = 3;

/**
 * How many days back the window that feeds `computeStreak` reaches. The walk stops at
 * the edge of what it was given, so every route to the streak has to load the same
 * span or the same phone shows two different numbers: the one Focus draws from the
 * day stats and the one the reminder planner reads from `loadDayFocus`. A year and a
 * bit: cheap to fold, and far past where a daily streak stops being news.
 */
export const STREAK_WINDOW_DAYS = 400;

export type DayFocus = { dayKey: DayKey; focusMs: number };

export type StreakState = {
  /** Consecutive counted days ending today (if today counts) or yesterday. 0 when none. */
  days: number;
  todayCounts: boolean;
  /** Grace days left in today's month. */
  graceLeft: number;
  /** Yesterday was bridged by a grace day: the home line says so once. */
  graceYesterday: boolean;
};

/** 'YYYY-MM-DD' -> 'YYYY-MM'. The key the monthly grace budget is counted by. */
export function monthKeyOf(dayKey: DayKey): string {
  return dayKey.slice(0, 7);
}

export function dayCounts(focusMs: number): boolean {
  return focusMs >= STREAK_DAY_MIN_MS;
}

export function graceLeftIn(monthKey: string, grace: readonly GraceDay[]): number {
  const used = grace.filter((day) => day.monthKey === monthKey).length;
  return Math.max(0, GRACE_DAYS_PER_MONTH - used);
}

type Ledger = {
  /** The oldest day the window knows about. Nothing before it is walked. */
  edge: DayKey | null;
  counts: (dayKey: DayKey) => boolean;
  hasGrace: (dayKey: DayKey) => boolean;
};

/**
 * The window as one question per day: does it count? A day counts when its focus
 * meets the minimum or a grace row exists for it; a day the window does not list has
 * no focus.
 */
function ledgerOf(days: readonly DayFocus[], grace: readonly GraceDay[]): Ledger {
  const focus = new Map<DayKey, number>();
  let edge: DayKey | null = null;
  for (const day of days) {
    focus.set(day.dayKey, day.focusMs);
    if (edge === null || day.dayKey < edge) {
      edge = day.dayKey;
    }
  }
  const graced = new Set(grace.map((day) => day.dayKey));
  return {
    edge,
    counts: (dayKey) => dayCounts(focus.get(dayKey) ?? 0) || graced.has(dayKey),
    hasGrace: (dayKey) => graced.has(dayKey),
  };
}

function inWindow(ledger: Ledger, dayKey: DayKey): boolean {
  return ledger.edge !== null && dayKey >= ledger.edge;
}

/**
 * Walks back from today: today counting adds one; then yesterday, the day before,
 * and so on until a day that does not count or the edge of the window.
 */
export function computeStreak(
  days: readonly DayFocus[],
  grace: readonly GraceDay[],
  todayKey: DayKey,
): StreakState {
  const ledger = ledgerOf(days, grace);
  const todayCounts = ledger.counts(todayKey);
  let count = todayCounts ? 1 : 0;
  let key = shiftDayKey(todayKey, -1);
  while (inWindow(ledger, key) && ledger.counts(key)) {
    count += 1;
    key = shiftDayKey(key, -1);
  }
  return {
    days: count,
    todayCounts,
    graceLeft: graceLeftIn(monthKeyOf(todayKey), grace),
    graceYesterday: ledger.hasGrace(shiftDayKey(todayKey, -1)),
  };
}

/**
 * The days before today that a grace day should bridge right now, newest first:
 * the gap between yesterday and the last counted day. Empty when there is no gap,
 * when nothing counted before it (there is no streak to protect), or when any gap
 * day's month has no grace left once the earlier gap days in that month are counted.
 */
export function graceDaysToApply(
  days: readonly DayFocus[],
  grace: readonly GraceDay[],
  todayKey: DayKey,
): DayKey[] {
  const ledger = ledgerOf(days, grace);
  const gap: DayKey[] = [];
  let key = shiftDayKey(todayKey, -1);
  while (inWindow(ledger, key) && !ledger.counts(key)) {
    gap.push(key);
    key = shiftDayKey(key, -1);
  }
  if (gap.length === 0 || !inWindow(ledger, key)) {
    return [];
  }
  const spent = new Map<string, number>();
  for (const dayKey of gap) {
    const month = monthKeyOf(dayKey);
    const used = spent.get(month) ?? 0;
    if (graceLeftIn(month, grace) - used <= 0) {
      return [];
    }
    spent.set(month, used + 1);
  }
  return gap;
}
