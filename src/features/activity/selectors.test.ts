import { describe, expect, it } from 'vitest';

import type { DayStat } from '../../data/types';
import { dayKeyOf } from '../../domain/day';
import { DAY, HOUR, MINUTE } from '../../domain/time';
import { deltaVsPrevious, weekAverage, weekBars, weekDayCards, weekFocusedDays } from './selectors';
import { chartSummary, dayCardSummary, deltaText } from './text';

// 2026-09-16 is a Wednesday; the week started Monday the 14th.
const NOW = new Date(2026, 8, 16, 12).getTime();
const MONDAY = new Date(2026, 8, 14, 12).getTime();

function day(at: number, focusMs: number, sessions = focusMs > 0 ? 1 : 0): DayStat {
  return { dayKey: dayKeyOf(at), focusMs, sessions, segments: [] };
}

describe('weekAverage', () => {
  it('divides by the days elapsed in the current week, days off included', () => {
    // Wednesday: Monday, Tuesday and today have happened. 3h over three days is 1h.
    expect(weekAverage([day(MONDAY, 3 * HOUR)], NOW, 0)).toBe(HOUR);
  });

  it('divides a past week by seven', () => {
    expect(weekAverage([day(MONDAY - 7 * DAY, 7 * HOUR)], NOW, 1)).toBe(HOUR);
  });

  it('is null for a week with no focus at all', () => {
    expect(weekAverage([], NOW, 0)).toBeNull();
    expect(weekAverage([day(MONDAY, 0)], NOW, 1)).toBeNull();
  });

  it('ignores days outside the week', () => {
    const stats = [day(MONDAY, 3 * HOUR), day(MONDAY - DAY, 40 * HOUR), day(NOW + DAY, 40 * HOUR)];
    expect(weekAverage(stats, NOW, 0)).toBe(HOUR);
  });
});

describe('deltaVsPrevious', () => {
  const lastMonday = MONDAY - 7 * DAY;

  it('compares the two averages and keeps the direction', () => {
    const stats = [
      day(MONDAY, 2 * HOUR),
      day(MONDAY + DAY, 2 * HOUR),
      day(NOW, 2 * HOUR),
      ...Array.from({ length: 7 }, (_, i) => day(lastMonday + i * DAY, HOUR)),
    ];
    expect(deltaVsPrevious(stats, NOW, 0)).toEqual({ percent: 100, direction: 'up' });
  });

  it('is null while either week has fewer than two days with focus', () => {
    const oneDayThisWeek = [
      day(MONDAY, 6 * HOUR),
      ...Array.from({ length: 7 }, (_, i) => day(lastMonday + i * DAY, HOUR)),
    ];
    expect(deltaVsPrevious(oneDayThisWeek, NOW, 0)).toBeNull();

    const oneDayLastWeek = [day(MONDAY, HOUR), day(NOW, HOUR), day(lastMonday, 7 * HOUR)];
    expect(deltaVsPrevious(oneDayLastWeek, NOW, 0)).toBeNull();
    expect(weekFocusedDays(oneDayLastWeek, NOW, 1)).toBe(1);
  });

  it('is null with no data', () => {
    expect(deltaVsPrevious([], NOW, 0)).toBeNull();
  });
});

describe('deltaText', () => {
  it('carries the direction in words', () => {
    expect(deltaText({ percent: 30, direction: 'up' })).toBe('30 % más que la semana anterior');
    expect(deltaText({ percent: 30, direction: 'down' })).toBe('30 % menos que la semana anterior');
    expect(deltaText({ percent: 0, direction: 'flat' })).toBe('Igual que la semana anterior');
  });
});

describe('chartSummary', () => {
  it('reads each bar as a full weekday, its date and its duration', () => {
    const stats = [day(MONDAY, 3 * HOUR + 10 * MINUTE), day(MONDAY + DAY, 2 * HOUR)];
    const bars = weekBars(stats, NOW, 0).slice(0, 3);
    expect(chartSummary(bars)).toBe('Lunes 14: 3h 10m, martes 15: 2h, miércoles 16: sin foco');
  });
});

describe('dayCardSummary', () => {
  it('says Hoy for today and the full date otherwise', () => {
    const stats = [day(NOW, 6 * HOUR + 12 * MINUTE, 3), day(MONDAY, 45 * MINUTE, 1)];
    const cards = weekDayCards(stats, NOW, 0);
    expect(cards.map(dayCardSummary)).toEqual([
      'Hoy, 6h 12m, 3 sesiones',
      'Martes 15 de septiembre, 0m, Sin sesiones',
      'Lunes 14 de septiembre, 45m, 1 sesión',
    ]);
  });
});
