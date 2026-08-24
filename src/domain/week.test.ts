import { describe, expect, it } from 'vitest';

import { daysLeftInWeek, weekProgress } from './week';
import { createSession } from './session';
import type { Session } from './types';

const HOUR = 3_600_000;

function done(ms: number): Session {
  const session = createSession(
    's',
    { activityId: 'a', plannedMs: ms, depth: 'soft', intention: null, blockProfile: null },
    0,
  );
  return { ...session, outcome: 'completed', actualMs: ms, endedAt: ms };
}

const served = (session: Session): number => session.actualMs;

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

describe('weekProgress', () => {
  it('adds up the focus time served', () => {
    const progress = weekProgress([done(HOUR), done(2 * HOUR)], served, null, 0);

    expect(progress.focusMs).toBe(3 * HOUR);
  });

  it('has no ratio and is never met without a target', () => {
    const progress = weekProgress([done(HOUR)], served, null, 0);

    expect(progress.ratio).toBeNull();
    expect(progress.met).toBe(false);
  });

  it('is met at the target, not before', () => {
    expect(weekProgress([done(9 * HOUR)], served, 10 * HOUR, 0).met).toBe(false);
    expect(weekProgress([done(10 * HOUR)], served, 10 * HOUR, 0).met).toBe(true);
  });

  it('clamps the ratio at 1 so a good week does not overflow the bar', () => {
    expect(weekProgress([done(30 * HOUR)], served, 10 * HOUR, 0).ratio).toBe(1);
  });

  it('treats a zero target as no target instead of dividing by it', () => {
    const progress = weekProgress([done(HOUR)], served, 0, 0);

    expect(progress.ratio).toBeNull();
    expect(progress.met).toBe(false);
  });
});
