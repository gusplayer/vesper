import { describe, expect, it } from 'vitest';

import type { DayStat } from '../../data/types';
import { dayKeyOf } from '../../domain/day';
import { DAY, HOUR, MINUTE } from '../../domain/time';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { DEFAULT_TAG } from '../../i18n/locale';
import { dayLabel, monthLabel } from './dates';
import { deltaVsPrevious, weekAverage, weekBars, weekDayCards, weekFocusedDays, weekdayRhythm } from './selectors';
import { chartSummary, dayCardSummary, deltaText, hoursText } from './text';

// 2026-09-16 is a Wednesday; the week started Monday the 14th.
const NOW = new Date(2026, 8, 16, 12).getTime();
const MONDAY = new Date(2026, 8, 14, 12).getTime();

const ES = { t: es.activity, tag: DEFAULT_TAG.es };
const EN = { t: en.activity, tag: DEFAULT_TAG.en };

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
    expect(deltaText({ percent: 30, direction: 'up' }, ES.t, ES.tag)).toBe('30 % más que la semana anterior');
    expect(deltaText({ percent: 30, direction: 'down' }, ES.t, ES.tag)).toBe('30 % menos que la semana anterior');
    expect(deltaText({ percent: 0, direction: 'flat' }, ES.t, ES.tag)).toBe('Igual que la semana anterior');
  });

  it('speaks English with the English dictionary', () => {
    expect(deltaText({ percent: 30, direction: 'up' }, EN.t, EN.tag)).toBe('30% more than last week');
    expect(deltaText({ percent: 0, direction: 'flat' }, EN.t, EN.tag)).toBe('Same as last week');
  });
});

describe('chartSummary', () => {
  it('reads each bar as a full weekday, its date and its duration', () => {
    const stats = [day(MONDAY, 3 * HOUR + 10 * MINUTE), day(MONDAY + DAY, 2 * HOUR)];
    const bars = weekBars(stats, NOW, 0, ES.tag).slice(0, 3);
    expect(chartSummary(bars, ES.t, ES.tag)).toBe('Lunes 14: 3h 10m, martes 15: 2h, miércoles 16: sin foco');
  });

  it('names the weekdays in English with the English tag', () => {
    const stats = [day(MONDAY, 3 * HOUR + 10 * MINUTE)];
    const bars = weekBars(stats, NOW, 0, EN.tag).slice(0, 2);
    expect(chartSummary(bars, EN.t, EN.tag)).toBe('Monday 14: 3h 10m, Tuesday 15: no focus');
  });
});

describe('dayCardSummary', () => {
  it('says Hoy for today and the full date otherwise', () => {
    const stats = [day(NOW, 6 * HOUR + 12 * MINUTE, 3), day(MONDAY, 45 * MINUTE, 1)];
    const cards = weekDayCards(stats, NOW, 0);
    expect(cards.map((card) => dayCardSummary(card, ES.t, ES.tag))).toEqual([
      'Hoy, 6h 12m, 3 sesiones',
      'Martes 15 de septiembre, 0m, Sin sesiones',
      'Lunes 14 de septiembre, 45m, 1 sesión',
    ]);
  });

  it('says Today and the English date otherwise', () => {
    const stats = [day(NOW, 6 * HOUR + 12 * MINUTE, 3), day(MONDAY, 45 * MINUTE, 1)];
    const cards = weekDayCards(stats, NOW, 0);
    expect(cards.map((card) => dayCardSummary(card, EN.t, EN.tag))).toEqual([
      'Today, 6h 12m, 3 sessions',
      'Tuesday, September 15, 0m, No sessions',
      'Monday, September 14, 45m, 1 session',
    ]);
  });
});

describe('labels', () => {
  it('spell the short weekday from Intl and the short month from the dictionary', () => {
    expect(weekBars([], NOW, 0, ES.tag).map((bar) => bar.label)).toEqual(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']);
    expect(weekBars([], NOW, 0, EN.tag).map((bar) => bar.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(weekdayRhythm([], ES.tag).map((row) => row.label)).toEqual(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']);
    expect(monthLabel(NOW, ES.t)).toBe('sep 2026');
    expect(monthLabel(NOW, EN.t)).toBe('Sep 2026');
    expect(dayLabel(NOW, ES.t, ES.tag)).toBe('mié, 16 sep');
    expect(dayLabel(NOW, EN.t, EN.tag)).toBe('Wed, Sep 16');
  });

  it('format big numbers with the tag of the language', () => {
    expect(hoursText(1234 * HOUR, ES.t, ES.tag)).toBe('1.234 horas');
    expect(hoursText(1234 * HOUR, EN.t, EN.tag)).toBe('1,234 hours');
    expect(hoursText(HOUR, EN.t, EN.tag)).toBe('1 hour');
  });
});
