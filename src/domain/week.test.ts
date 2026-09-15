import { describe, expect, it } from 'vitest';

import { dayKeyOf } from './day';
import { aDoneSession, aRunningSession, T0 } from './fixtures';
import { HOUR, MINUTE } from './time';
import {
  daysLeftInWeek,
  hasTarget,
  isClosingDay,
  isPresetTarget,
  weekProgress,
  weekWindow,
} from './week';

// 2026-08-17 is a Monday, 2026-08-19 a Wednesday, 2026-08-23 the Sunday of the same week.
const MONDAY = new Date(2026, 7, 17, 9).getTime();
const WEDNESDAY = new Date(2026, 7, 19, 15).getTime();
const SUNDAY = new Date(2026, 7, 23, 9).getTime();

describe('weekWindow', () => {
  it('runs from Monday 00:00 to the end of today, exclusive', () => {
    const window = weekWindow(WEDNESDAY);

    expect(window.from).toBe(new Date(2026, 7, 17).getTime());
    expect(window.to).toBe(new Date(2026, 7, 20).getTime());
  });

  it('keys match dayKeyOf at both ends', () => {
    const window = weekWindow(WEDNESDAY);

    expect(window.fromKey).toBe('2026-08-17');
    expect(window.toKey).toBe('2026-08-19');
    expect(window.fromKey).toBe(dayKeyOf(window.from));
    expect(window.toKey).toBe(dayKeyOf(WEDNESDAY));
  });
});

describe('hasTarget', () => {
  it('is false for null, zero and negative', () => {
    expect(hasTarget(null)).toBe(false);
    expect(hasTarget(0)).toBe(false);
    expect(hasTarget(-1)).toBe(false);
  });

  it('is true for any positive target', () => {
    expect(hasTarget(1)).toBe(true);
  });
});

describe('isPresetTarget', () => {
  it('is true for no target and for an offered one', () => {
    expect(isPresetTarget(null)).toBe(true);
    expect(isPresetTarget(5 * HOUR)).toBe(true);
  });

  it('is false for a custom target', () => {
    expect(isPresetTarget(7 * HOUR)).toBe(false);
  });
});

describe('daysLeftInWeek', () => {
  it('is 7 on Monday and 1 on Sunday', () => {
    expect(daysLeftInWeek(MONDAY)).toBe(7);
    expect(daysLeftInWeek(SUNDAY)).toBe(1);
  });

  it('is 5 on Wednesday', () => {
    expect(daysLeftInWeek(WEDNESDAY)).toBe(5);
  });

  it('never reaches zero: today still counts', () => {
    expect(daysLeftInWeek(new Date(2026, 7, 23, 23, 59).getTime())).toBe(1);
  });
});

describe('isClosingDay', () => {
  it('is only Sunday', () => {
    // 2026-08-17 Monday through 2026-08-23 Sunday.
    const days = [17, 18, 19, 20, 21, 22, 23].map((day) =>
      isClosingDay(new Date(2026, 7, day, 12).getTime()),
    );

    expect(days).toEqual([false, false, false, false, false, false, true]);
  });
});

describe('weekProgress', () => {
  it('is zero with no sessions', () => {
    expect(weekProgress([], null, T0).focusMs).toBe(0);
  });

  it('adds up the focus time served', () => {
    const progress = weekProgress([aDoneSession(HOUR), aDoneSession(2 * HOUR)], null, T0);

    expect(progress.focusMs).toBe(3 * HOUR);
  });

  it('counts a running session by what it has served so far', () => {
    const progress = weekProgress([aRunningSession()], null, T0 + 20 * MINUTE);

    expect(progress.focusMs).toBe(20 * MINUTE);
  });

  it('is never met without a target', () => {
    const progress = weekProgress([aDoneSession(HOUR)], null, T0);

    expect(progress.targetMs).toBeNull();
    expect(progress.met).toBe(false);
  });

  it('is met at the target, not before', () => {
    expect(weekProgress([aDoneSession(9 * HOUR)], 10 * HOUR, T0).met).toBe(false);
    expect(weekProgress([aDoneSession(10 * HOUR)], 10 * HOUR, T0).met).toBe(true);
  });

  it('treats a zero target as no target', () => {
    const progress = weekProgress([aDoneSession(HOUR)], 0, T0);

    expect(progress.targetMs).toBeNull();
    expect(progress.met).toBe(false);
  });

  it('treats a negative target as no target', () => {
    const progress = weekProgress([aDoneSession(HOUR)], -HOUR, T0);

    expect(progress.targetMs).toBeNull();
    expect(progress.met).toBe(false);
  });

  it('reports the days left of the week containing now', () => {
    expect(weekProgress([], null, WEDNESDAY).daysLeft).toBe(5);
  });
});
