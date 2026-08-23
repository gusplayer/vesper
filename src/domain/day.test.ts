import { describe, expect, it } from 'vitest';

import { dayBounds, dayKeyOf, weekStart } from './day';

const HOUR = 3_600_000;

describe('dayBounds', () => {
  it('starts at local midnight and ends at the next one', () => {
    const noon = new Date(2026, 7, 23, 12, 30).getTime();
    const { dayStart, dayEnd } = dayBounds(noon);

    expect(new Date(dayStart).getHours()).toBe(0);
    expect(new Date(dayStart).getDate()).toBe(23);
    expect(new Date(dayEnd).getDate()).toBe(24);
  });

  it('gives a 24h day in a zone without DST, and never a 0h day', () => {
    const { dayStart, dayEnd } = dayBounds(new Date(2026, 7, 23, 12).getTime());

    expect(dayEnd - dayStart).toBeGreaterThanOrEqual(23 * HOUR);
    expect(dayEnd - dayStart).toBeLessThanOrEqual(25 * HOUR);
  });

  it('is stable for any instant inside the same day', () => {
    const morning = dayBounds(new Date(2026, 7, 23, 1).getTime());
    const night = dayBounds(new Date(2026, 7, 23, 23, 59).getTime());

    expect(morning).toEqual(night);
  });
});

describe('dayKeyOf', () => {
  it('pads month and day', () => {
    expect(dayKeyOf(new Date(2026, 0, 5, 10).getTime())).toBe('2026-01-05');
  });

  it('sorts lexicographically in chronological order', () => {
    const keys = [
      dayKeyOf(new Date(2026, 11, 31).getTime()),
      dayKeyOf(new Date(2026, 0, 1).getTime()),
      dayKeyOf(new Date(2026, 8, 9).getTime()),
    ];

    expect([...keys].sort()).toEqual(['2026-01-01', '2026-09-09', '2026-12-31']);
  });
});

describe('weekStart', () => {
  it('is Monday for a Wednesday', () => {
    // 2026-08-19 is a Wednesday.
    const monday = weekStart(new Date(2026, 7, 19, 15).getTime());

    expect(new Date(monday).getDay()).toBe(1);
    expect(new Date(monday).getDate()).toBe(17);
  });

  it('puts Sunday at the end of its week, not the start of the next', () => {
    // 2026-08-23 is a Sunday.
    const monday = weekStart(new Date(2026, 7, 23, 15).getTime());

    expect(new Date(monday).getDate()).toBe(17);
  });

  it('is Monday itself when today is Monday', () => {
    const monday = weekStart(new Date(2026, 7, 17, 8).getTime());

    expect(new Date(monday).getDate()).toBe(17);
    expect(new Date(monday).getHours()).toBe(0);
  });
});
