import { describe, expect, it } from 'vitest';

import { dayBounds, dayKeyOf, weekStart } from './day';
import { HOUR } from './time';

describe('dayBounds', () => {
  it('starts at local midnight and ends at the next one', () => {
    const noon = new Date(2026, 7, 23, 12, 30).getTime();
    const { dayStart, dayEnd } = dayBounds(noon);

    expect(new Date(dayStart).getHours()).toBe(0);
    expect(new Date(dayStart).getDate()).toBe(23);
    expect(new Date(dayEnd).getDate()).toBe(24);
  });

  it('gives exactly 24h in Bogotá, a zone without DST', () => {
    const { dayStart, dayEnd } = dayBounds(new Date(2026, 7, 23, 12).getTime());

    expect(dayEnd - dayStart).toBe(24 * HOUR);
  });

  it('is stable for any instant inside the same day', () => {
    const morning = dayBounds(new Date(2026, 7, 23, 1).getTime());
    const night = dayBounds(new Date(2026, 7, 23, 23, 59).getTime());

    expect(morning).toEqual(night);
  });

  it('keeps the last millisecond of the day inside it', () => {
    const { dayStart, dayEnd } = dayBounds(new Date(2026, 7, 23, 23, 59, 59, 999).getTime());

    expect(dayStart).toBe(new Date(2026, 7, 23).getTime());
    expect(dayEnd).toBe(new Date(2026, 7, 24).getTime());
  });

  it('starts a new day at exact midnight', () => {
    const midnight = new Date(2026, 7, 23).getTime();
    const { dayStart, dayEnd } = dayBounds(midnight);

    expect(dayStart).toBe(midnight);
    expect(dayEnd).toBe(new Date(2026, 7, 24).getTime());
  });

  it('treats dayEnd as the start of the next day', () => {
    const today = dayBounds(new Date(2026, 7, 23, 12).getTime());
    const tomorrow = dayBounds(today.dayEnd);

    expect(tomorrow.dayStart).toBe(today.dayEnd);
    expect(tomorrow.dayEnd).toBe(new Date(2026, 7, 25).getTime());
  });

  it('rolls over months and years', () => {
    expect(dayBounds(new Date(2026, 7, 31, 12).getTime()).dayEnd).toBe(
      new Date(2026, 8, 1).getTime(),
    );
    expect(dayBounds(new Date(2026, 11, 31, 12).getTime()).dayEnd).toBe(
      new Date(2027, 0, 1).getTime(),
    );
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

  it('agrees with dayBounds at both edges of the day', () => {
    const noon = new Date(2026, 7, 23, 12).getTime();
    const { dayStart, dayEnd } = dayBounds(noon);

    expect(dayKeyOf(dayStart)).toBe('2026-08-23');
    expect(dayKeyOf(dayEnd - 1)).toBe('2026-08-23');
    expect(dayKeyOf(dayEnd)).toBe('2026-08-24');
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

  it('crosses a month boundary', () => {
    // 2026-09-02 is a Wednesday; its Monday is 2026-08-31.
    expect(weekStart(new Date(2026, 8, 2, 12).getTime())).toBe(new Date(2026, 7, 31).getTime());
  });

  it('crosses a year boundary', () => {
    // 2027-01-01 is a Friday; its Monday is 2026-12-28.
    expect(weekStart(new Date(2027, 0, 1, 12).getTime())).toBe(new Date(2026, 11, 28).getTime());
  });

  it('is idempotent and never after the day start', () => {
    const now = new Date(2026, 7, 21, 18).getTime();
    const monday = weekStart(now);

    expect(weekStart(monday)).toBe(monday);
    expect(monday).toBeLessThanOrEqual(dayBounds(now).dayStart);
  });

  it('is a Monday at 00:00:00.000', () => {
    const monday = new Date(weekStart(new Date(2026, 7, 21, 18).getTime()));

    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(monday.getSeconds()).toBe(0);
    expect(monday.getMilliseconds()).toBe(0);
  });
});
