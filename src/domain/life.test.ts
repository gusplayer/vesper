import { describe, expect, it } from 'vitest';

import {
  WEEK_MS,
  projectedWeeksConsumed,
  weeksLived,
  weeksRemaining,
  weeksTotal,
} from './life';

const BIRTH = Date.UTC(1990, 0, 1);

describe('weeksLived', () => {
  it('counts whole weeks only', () => {
    expect(weeksLived(BIRTH, BIRTH + 10 * WEEK_MS + 1)).toBe(10);
    expect(weeksLived(BIRTH, BIRTH + WEEK_MS - 1)).toBe(0);
  });

  it('is zero for a date in the future instead of negative', () => {
    expect(weeksLived(BIRTH, BIRTH - 5 * WEEK_MS)).toBe(0);
  });
});

describe('weeksTotal', () => {
  it('uses 365.25 days a year so leap years do not drift', () => {
    expect(weeksTotal(77.6)).toBe(4049);
  });
});

describe('weeksRemaining', () => {
  it('is the total minus what is lived', () => {
    const now = BIRTH + 1000 * WEEK_MS;

    expect(weeksRemaining(BIRTH, 77.6, now)).toBe(weeksTotal(77.6) - 1000);
  });

  it('stops at zero past the expectancy, it does not go negative', () => {
    const now = BIRTH + 6000 * WEEK_MS;

    expect(weeksRemaining(BIRTH, 77.6, now)).toBe(0);
  });
});

describe('projectedWeeksConsumed', () => {
  it('turns a weekly pace into weeks of the time left', () => {
    // 16.8h a week is a tenth of a week.
    expect(projectedWeeksConsumed(WEEK_MS / 10, 1000)).toBeCloseTo(100);
  });

  it('is zero with no pace and zero with no time left', () => {
    expect(projectedWeeksConsumed(0, 1000)).toBe(0);
    expect(projectedWeeksConsumed(WEEK_MS / 10, 0)).toBe(0);
  });
});
