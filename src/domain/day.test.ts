import { describe, expect, it } from 'vitest';

import {
  atMinuteOfDay,
  dayBounds,
  dayKeyOf,
  dayKeyStart,
  dayStartShifted,
  shiftDayKey,
  weekDayKeys,
  weekKeyOf,
  weekStart,
} from './day';
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

describe('dayStartShifted', () => {
  // Wednesday 2026-08-19, 15:00 local.
  const NOW = new Date(2026, 7, 19, 15).getTime();

  it('is today\'s midnight for zero, whatever the time of day', () => {
    expect(dayStartShifted(NOW, 0)).toBe(dayBounds(NOW).dayStart);
    expect(dayStartShifted(NOW + 8 * HOUR, 0)).toBe(dayBounds(NOW).dayStart);
  });

  it('moves by calendar days in both directions', () => {
    expect(dayStartShifted(NOW, -1)).toBe(new Date(2026, 7, 18).getTime());
    expect(dayStartShifted(NOW, 1)).toBe(dayBounds(NOW).dayEnd);
    expect(dayStartShifted(NOW, 7)).toBe(new Date(2026, 7, 26).getTime());
  });

  it('rolls over months and years', () => {
    expect(dayStartShifted(new Date(2026, 0, 1, 3).getTime(), -1)).toBe(new Date(2025, 11, 31).getTime());
    expect(dayStartShifted(new Date(2026, 1, 28, 3).getTime(), 1)).toBe(new Date(2026, 2, 1).getTime());
  });

  it('agrees with dayKeyOf, so a key shifted n days is the key of the shifted day', () => {
    for (const days of [-400, -31, -1, 0, 1, 31, 400]) {
      expect(dayKeyOf(dayStartShifted(NOW, days))).toBe(shiftDayKey(dayKeyOf(NOW), days));
    }
  });
});

describe('atMinuteOfDay', () => {
  const NOW = new Date(2026, 7, 19, 15).getTime();

  it('is the wall-clock minute of the day containing the instant', () => {
    expect(atMinuteOfDay(NOW, 0)).toBe(dayBounds(NOW).dayStart);
    expect(atMinuteOfDay(NOW, 21 * 60 + 30)).toBe(new Date(2026, 7, 19, 21, 30).getTime());
    expect(atMinuteOfDay(NOW + 8 * HOUR, 9 * 60)).toBe(new Date(2026, 7, 19, 9).getTime());
  });

  it('reads the hour and minute back exactly on a DST day too', () => {
    // A spring-forward Sunday in the US and in Europe; an ordinary Sunday elsewhere.
    for (const sunday of [new Date(2026, 2, 8, 12).getTime(), new Date(2026, 2, 29, 12).getTime()]) {
      const at = new Date(atMinuteOfDay(sunday, 21 * 60 + 30));
      expect([at.getHours(), at.getMinutes()]).toEqual([21, 30]);
      expect(at.getDate()).toBe(new Date(sunday).getDate());
    }
  });
});

describe('day keys', () => {
  it('dayKeyStart inverts dayKeyOf at local midnight', () => {
    const midnight = new Date(2026, 7, 19).getTime();

    expect(dayKeyStart('2026-08-19')).toBe(midnight);
    expect(dayKeyOf(dayKeyStart('2026-08-19'))).toBe('2026-08-19');
  });

  it('shiftDayKey moves by calendar days across month and year ends', () => {
    expect(shiftDayKey('2026-08-19', 0)).toBe('2026-08-19');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('weekKeyOf is the Monday of the week, and weekDayKeys lists Monday to Sunday', () => {
    const wednesday = new Date(2026, 7, 19, 15).getTime();
    const sunday = new Date(2026, 7, 23, 23).getTime();

    expect(weekKeyOf(wednesday)).toBe('2026-08-17');
    expect(weekKeyOf(sunday)).toBe('2026-08-17');
    expect(weekDayKeys('2026-08-17')).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
    expect(weekDayKeys(weekKeyOf(wednesday))).toContain(dayKeyOf(wednesday));
  });
});
