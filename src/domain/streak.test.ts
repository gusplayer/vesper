import { describe, expect, it } from 'vitest';

import { shiftDayKey } from './day';
import {
  computeStreak,
  dayCounts,
  GRACE_DAYS_PER_MONTH,
  graceDaysToApply,
  graceLeftIn,
  monthKeyOf,
  STREAK_DAY_MIN_MS,
  type DayFocus,
} from './streak';
import { MINUTE } from './time';
import type { DayKey, GraceDay } from './types';

const TODAY: DayKey = '2026-08-19';

/** A window ending today, every day empty except the ones listed, oldest first. */
function windowOf(length: number, focused: Record<DayKey, number>, today: DayKey = TODAY): DayFocus[] {
  return Array.from({ length }, (_, i) => {
    const dayKey = shiftDayKey(today, -(length - 1 - i));
    return { dayKey, focusMs: focused[dayKey] ?? 0 };
  });
}

/** `count` days of focus ending on `last`, inclusive. */
function focusedRun(last: DayKey, count: number, ms = 25 * MINUTE): Record<DayKey, number> {
  const run: Record<DayKey, number> = {};
  for (let i = 0; i < count; i += 1) {
    run[shiftDayKey(last, -i)] = ms;
  }
  return run;
}

function graceOn(...dayKeys: DayKey[]): GraceDay[] {
  return dayKeys.map((dayKey) => ({ dayKey, monthKey: monthKeyOf(dayKey), createdAt: 0 }));
}

describe('monthKeyOf', () => {
  it('keeps the year and month of a day key', () => {
    expect(monthKeyOf('2026-08-19')).toBe('2026-08');
    expect(monthKeyOf('2026-12-01')).toBe('2026-12');
  });
});

describe('dayCounts', () => {
  it('needs the minimum, and the minimum is ten minutes', () => {
    expect(STREAK_DAY_MIN_MS).toBe(10 * MINUTE);
    expect(dayCounts(STREAK_DAY_MIN_MS)).toBe(true);
    expect(dayCounts(STREAK_DAY_MIN_MS - 1)).toBe(false);
    expect(dayCounts(0)).toBe(false);
  });
});

describe('graceLeftIn', () => {
  it('counts down from the monthly budget, never below zero', () => {
    expect(GRACE_DAYS_PER_MONTH).toBe(3);
    expect(graceLeftIn('2026-08', [])).toBe(3);
    expect(graceLeftIn('2026-08', graceOn('2026-08-03', '2026-08-10'))).toBe(1);
    expect(graceLeftIn('2026-08', graceOn('2026-08-03', '2026-08-10', '2026-08-11', '2026-08-12'))).toBe(0);
  });

  it('only counts the month asked for', () => {
    expect(graceLeftIn('2026-08', graceOn('2026-07-30', '2026-07-31'))).toBe(3);
  });
});

describe('computeStreak', () => {
  it('is zero with nothing focused', () => {
    expect(computeStreak(windowOf(30, {}), [], TODAY)).toEqual({
      days: 0,
      todayCounts: false,
      graceLeft: 3,
      graceYesterday: false,
    });
  });

  it('counts today when today already has ten minutes', () => {
    const streak = computeStreak(windowOf(30, focusedRun(TODAY, 4)), [], TODAY);

    expect(streak.days).toBe(4);
    expect(streak.todayCounts).toBe(true);
  });

  it('still stands when today is open and the run ended yesterday', () => {
    const streak = computeStreak(windowOf(30, focusedRun(shiftDayKey(TODAY, -1), 4)), [], TODAY);

    expect(streak.days).toBe(4);
    expect(streak.todayCounts).toBe(false);
  });

  it('stops at a day below the minimum', () => {
    const focused = { ...focusedRun(TODAY, 5), [shiftDayKey(TODAY, -2)]: STREAK_DAY_MIN_MS - MINUTE };

    expect(computeStreak(windowOf(30, focused), [], TODAY).days).toBe(2);
  });

  it('walks through a bridged gap without counting it: five focused days, not six (ADR-0039)', () => {
    const focused = { ...focusedRun(TODAY, 2), ...focusedRun(shiftDayKey(TODAY, -3), 3) };
    const grace = graceOn(shiftDayKey(TODAY, -2));

    const streak = computeStreak(windowOf(30, focused), grace, TODAY);

    expect(streak.days).toBe(5);
    expect(streak.graceLeft).toBe(2);
    expect(streak.graceYesterday).toBe(false);
  });

  it('says so when yesterday was the bridged day, and counts the four focused days', () => {
    const focused = { ...focusedRun(TODAY, 1), ...focusedRun(shiftDayKey(TODAY, -2), 3) };
    const grace = graceOn(shiftDayKey(TODAY, -1));

    const streak = computeStreak(windowOf(30, focused), grace, TODAY);

    expect(streak.days).toBe(4);
    expect(streak.graceYesterday).toBe(true);
  });

  it('counts only today when the run behind it is a single bridged day', () => {
    // Nothing before yesterday; grace held the chain, so the number is today alone.
    const streak = computeStreak(
      windowOf(30, focusedRun(TODAY, 1)),
      graceOn(shiftDayKey(TODAY, -1)),
      TODAY,
    );

    expect(streak.days).toBe(1);
    expect(streak.todayCounts).toBe(true);
    expect(streak.graceYesterday).toBe(true);
  });

  it('subtracts every day of a run of bridged days, down to the month’s three', () => {
    const focused = { ...focusedRun(TODAY, 2), ...focusedRun(shiftDayKey(TODAY, -5), 4) };
    const grace = graceOn(shiftDayKey(TODAY, -2), shiftDayKey(TODAY, -3), shiftDayKey(TODAY, -4));

    const streak = computeStreak(windowOf(30, focused), grace, TODAY);

    expect(streak.days).toBe(6);
    expect(streak.graceLeft).toBe(0);
  });

  it('holds the chain when today itself is bridged, without counting today', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -1), 3);
    const streak = computeStreak(windowOf(30, focused), graceOn(TODAY), TODAY);

    expect(streak.days).toBe(3);
    expect(streak.todayCounts).toBe(false);
  });

  it('is zero, never negative, when a bridged day is all there is', () => {
    const today = computeStreak(windowOf(30, {}), graceOn(TODAY), TODAY);
    const yesterday = computeStreak(windowOf(30, {}), graceOn(shiftDayKey(TODAY, -1)), TODAY);

    expect(today.days).toBe(0);
    expect(today.todayCounts).toBe(false);
    expect(yesterday.days).toBe(0);
  });

  it('counts the focused days it can see when a bridged day sits on the window edge', () => {
    // The oldest day in the window is bridged: it holds nothing older into view.
    const focused = focusedRun(TODAY, 2);

    expect(computeStreak(windowOf(3, focused), graceOn(shiftDayKey(TODAY, -2)), TODAY).days).toBe(2);
  });

  it('stops at the edge of the window instead of counting days it cannot see', () => {
    expect(computeStreak(windowOf(3, focusedRun(TODAY, 3)), [], TODAY).days).toBe(3);
    expect(computeStreak([], [], TODAY).days).toBe(0);
  });

  it('reads the grace budget from the month of today', () => {
    const grace = graceOn('2026-07-02', '2026-07-03', '2026-08-04');

    expect(computeStreak(windowOf(30, {}), grace, TODAY).graceLeft).toBe(2);
  });
});

describe('graceDaysToApply', () => {
  it('is empty when the streak is intact', () => {
    expect(graceDaysToApply(windowOf(30, focusedRun(TODAY, 5)), [], TODAY)).toEqual([]);
    expect(graceDaysToApply(windowOf(30, focusedRun(shiftDayKey(TODAY, -1), 5)), [], TODAY)).toEqual([]);
  });

  it('bridges a one-day gap', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -2), 3);

    expect(graceDaysToApply(windowOf(30, focused), [], TODAY)).toEqual([shiftDayKey(TODAY, -1)]);
  });

  it('bridges a two-day gap, newest first', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -3), 3);

    expect(graceDaysToApply(windowOf(30, focused), [], TODAY)).toEqual([
      shiftDayKey(TODAY, -1),
      shiftDayKey(TODAY, -2),
    ]);
  });

  it('ignores today: it is still open', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -1), 3);

    expect(graceDaysToApply(windowOf(30, focused), [], TODAY)).toEqual([]);
  });

  it('gives up on a gap longer than the budget', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -5), 3);

    expect(graceDaysToApply(windowOf(30, focused), [], TODAY)).toEqual([]);
  });

  it('counts grace already spent this month against the gap', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -3), 3);
    const grace = graceOn('2026-08-02', '2026-08-03');

    expect(graceDaysToApply(windowOf(30, focused), grace, TODAY)).toEqual([]);
    expect(graceDaysToApply(windowOf(30, focused), graceOn('2026-08-02'), TODAY)).toHaveLength(2);
  });

  it('bridges nothing when no counted day sits before the gap', () => {
    expect(graceDaysToApply(windowOf(30, {}), [], TODAY)).toEqual([]);
    expect(graceDaysToApply(windowOf(3, focusedRun(TODAY, 1)), [], TODAY)).toEqual([]);
    expect(graceDaysToApply([], [], TODAY)).toEqual([]);
  });

  it('stops at a day already bridged by grace', () => {
    const focused = focusedRun(shiftDayKey(TODAY, -3), 3);
    const grace = graceOn(shiftDayKey(TODAY, -1));

    expect(graceDaysToApply(windowOf(30, focused), grace, TODAY)).toEqual([]);
  });

  it('charges each gap day to its own month across a boundary', () => {
    const today: DayKey = '2026-09-02';
    // Focused through August 30; the 31st and September 1 are the gap.
    const focused = focusedRun('2026-08-30', 3);
    const window = windowOf(30, focused, today);

    expect(graceDaysToApply(window, graceOn('2026-08-10', '2026-08-11'), today)).toEqual([
      '2026-09-01',
      '2026-08-31',
    ]);
    expect(graceDaysToApply(window, graceOn('2026-08-10', '2026-08-11', '2026-08-12'), today)).toEqual([]);
  });
});
