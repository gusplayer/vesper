import { shiftDayKey } from './day';
import { MINUTE } from './time';
import type { DayKey, GraceDay } from './types';

/**
 * The daily streak with grace days (ADR-0027, amended by ADR-0039). A day counts with
 * ten minutes of verified focus; the streak is the run of counted days ending today or
 * yesterday, because today is still open. When a day fails, one of the month's three
 * grace days bridges it on its own, so the streak survives a sick Tuesday — but the
 * bridged day does not count itself (ADR-0039): the chain holds, the number does not
 * grow on a day with no focus. Pure: the day totals come folded from `sessions`
 * (db/queries/streak) and the grace rows from their table.
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
  /**
   * Days with ten minutes of focus in the run ending today (if today counts) or
   * yesterday. Days a grace row bridged keep the run alive without being counted
   * (ADR-0039), so this is never more than the days the user actually focused. 0 when none.
   */
  days: number;
  /** Today already has the ten minutes. A grace row on today is not focus, so it is false. */
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
  /** Ten minutes of verified focus. The only thing that adds a day to the number. */
  counted: (dayKey: DayKey) => boolean;
  /** The day does not break the chain: it was focused, or a grace row bridges it. */
  holds: (dayKey: DayKey) => boolean;
  hasGrace: (dayKey: DayKey) => boolean;
};

/**
 * The window as two questions per day: did the user focus, and does the day hold the
 * chain? A day the window does not list has no focus. The two questions differ exactly
 * on a bridged day, which holds without being counted (ADR-0039).
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
  const counted = (dayKey: DayKey): boolean => dayCounts(focus.get(dayKey) ?? 0);
  return {
    edge,
    counted,
    holds: (dayKey) => counted(dayKey) || graced.has(dayKey),
    hasGrace: (dayKey) => graced.has(dayKey),
  };
}

function inWindow(ledger: Ledger, dayKey: DayKey): boolean {
  return ledger.edge !== null && dayKey >= ledger.edge;
}

/**
 * Walks back from today: ten minutes today adds one; then yesterday, the day before,
 * and so on until a day that neither focus nor grace holds, or the edge of the window.
 * A bridged day is walked through and adds nothing (ADR-0039), so the walk can end
 * with a number smaller than the days it crossed — never smaller than zero, and never
 * zero because of a bridge, since a bridge only ever continues the walk.
 */
export function computeStreak(
  days: readonly DayFocus[],
  grace: readonly GraceDay[],
  todayKey: DayKey,
): StreakState {
  const ledger = ledgerOf(days, grace);
  const todayCounts = ledger.counted(todayKey);
  let count = todayCounts ? 1 : 0;
  let key = shiftDayKey(todayKey, -1);
  while (inWindow(ledger, key) && ledger.holds(key)) {
    if (ledger.counted(key)) {
      count += 1;
    }
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
 * The days before today that a grace day should bridge right now, newest first: the
 * gap between yesterday and the last day that holds the chain (focused, or already
 * bridged). Unchanged by ADR-0039 — grace is still spent the same way, it just no
 * longer adds to the number. Empty when there is no gap,
 * when nothing held before it (there is no streak to protect), or when any gap
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
  while (inWindow(ledger, key) && !ledger.holds(key)) {
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
