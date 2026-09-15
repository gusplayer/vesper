import { describe, expect, it } from 'vitest';

import {
  cellSize,
  GRID_COLUMNS,
  projectedWeeksConsumed,
  weekGridRows,
  weeksLived,
  weeksRemaining,
  weeksTotal,
} from './life';
import { WEEK } from './time';

const BIRTH = Date.UTC(1990, 0, 1);

describe('weeksLived', () => {
  it('counts whole weeks only', () => {
    expect(weeksLived(BIRTH, BIRTH + 10 * WEEK + 1)).toBe(10);
    expect(weeksLived(BIRTH, BIRTH + WEEK - 1)).toBe(0);
  });

  it('is 1 after exactly one week', () => {
    expect(weeksLived(BIRTH, BIRTH + WEEK)).toBe(1);
  });

  it('is zero for a date in the future instead of negative', () => {
    expect(weeksLived(BIRTH, BIRTH - 5 * WEEK)).toBe(0);
  });
});

describe('weeksTotal', () => {
  it('uses 365.25 days a year so leap years do not drift', () => {
    expect(weeksTotal(77.6)).toBe(Math.round((77.6 * 365.25) / 7));
  });

  it('rounds rather than floors', () => {
    // 3 years is 156.54 weeks.
    expect(weeksTotal(3)).toBe(157);
  });

  it('is zero for no expectancy and for a negative one', () => {
    expect(weeksTotal(0)).toBe(0);
    expect(weeksTotal(-10)).toBe(0);
  });
});

describe('weeksRemaining', () => {
  it('is the total minus what is lived', () => {
    const now = BIRTH + 1000 * WEEK;

    expect(weeksRemaining(BIRTH, 77.6, now)).toBe(weeksTotal(77.6) - 1000);
  });

  it('is the whole total for a birth date in the future', () => {
    expect(weeksRemaining(BIRTH, 77.6, BIRTH - WEEK)).toBe(weeksTotal(77.6));
  });

  it('stops at zero past the expectancy, it does not go negative', () => {
    const now = BIRTH + 6000 * WEEK;

    expect(weeksRemaining(BIRTH, 77.6, now)).toBe(0);
  });
});

describe('projectedWeeksConsumed', () => {
  it('turns a weekly pace into weeks of the time left', () => {
    // 16.8h a week is a tenth of a week.
    expect(projectedWeeksConsumed(WEEK / 10, 1000)).toBeCloseTo(100);
  });

  it('is zero with no pace and zero with no time left', () => {
    expect(projectedWeeksConsumed(0, 1000)).toBe(0);
    expect(projectedWeeksConsumed(WEEK / 10, 0)).toBe(0);
  });

  it('is zero for a negative pace', () => {
    expect(projectedWeeksConsumed(-WEEK, 1000)).toBe(0);
  });

  it('consumes every remaining week at a full-week pace', () => {
    expect(projectedWeeksConsumed(WEEK, 100)).toBe(100);
  });
});

describe('weekGridRows', () => {
  it('is empty for a zero or negative total', () => {
    expect(weekGridRows(0, 0)).toEqual([]);
    expect(weekGridRows(10, -5)).toEqual([]);
  });

  it('fills one row of 52 exactly', () => {
    expect(weekGridRows(52, 52)).toEqual([{ cells: 52, filled: 52 }]);
  });

  it('spills the 53rd week onto a second row', () => {
    expect(weekGridRows(0, 53).map((row) => row.cells)).toEqual([52, 1]);
  });

  it('fills rows in order: 60 of 100 is a full row and 8 more', () => {
    expect(weekGridRows(60, 100)).toEqual([
      { cells: 52, filled: 52 },
      { cells: 48, filled: 8 },
    ]);
  });

  it('clamps lived to the grid in both directions', () => {
    expect(weekGridRows(500, 100).map((row) => row.filled)).toEqual([52, 48]);
    expect(weekGridRows(-3, 100).map((row) => row.filled)).toEqual([0, 0]);
  });
});

describe('cellSize', () => {
  it('is zero without width', () => {
    expect(cellSize(0)).toBe(0);
  });

  it('fills the width with 52 cells and their gaps', () => {
    expect(GRID_COLUMNS).toBe(52);
    expect(cellSize(105, 52, 1)).toBe(1);
    expect(cellSize(343)).toBe(Math.floor((343 - 51) / 52));
  });

  it('never goes below 1pt', () => {
    expect(cellSize(10)).toBe(1);
  });
});
