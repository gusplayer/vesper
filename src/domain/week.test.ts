import { describe, expect, it } from 'vitest';

import { daysLeftInWeek, isClosingDay, weekProgress } from './week';
import { createSession } from './session';
import type { Session } from './types';

const HOUR = 3_600_000;

function done(ms: number): Session {
  const session = createSession(
    's',
    { activityId: 'a', plannedMs: ms, depth: 'soft', blockProfile: null },
    0,
  );
  return { ...session, outcome: 'completed', actualMs: ms, endedAt: ms };
}

describe('daysLeftInWeek', () => {
  it('is 7 on Monday and 1 on Sunday', () => {
    // 2026-08-17 is a Monday, 2026-08-23 the Sunday of the same week.
    expect(daysLeftInWeek(new Date(2026, 7, 17, 9).getTime())).toBe(7);
    expect(daysLeftInWeek(new Date(2026, 7, 23, 9).getTime())).toBe(1);
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
  it('adds up the focus time served', () => {
    const progress = weekProgress([done(HOUR), done(2 * HOUR)], null, 0);

    expect(progress.focusMs).toBe(3 * HOUR);
  });

  it('is never met without a target', () => {
    const progress = weekProgress([done(HOUR)], null, 0);

    expect(progress.targetMs).toBeNull();
    expect(progress.met).toBe(false);
  });

  it('is met at the target, not before', () => {
    expect(weekProgress([done(9 * HOUR)], 10 * HOUR, 0).met).toBe(false);
    expect(weekProgress([done(10 * HOUR)], 10 * HOUR, 0).met).toBe(true);
  });

  it('treats a zero target as no target', () => {
    const progress = weekProgress([done(HOUR)], 0, 0);

    expect(progress.targetMs).toBeNull();
    expect(progress.met).toBe(false);
  });
});
