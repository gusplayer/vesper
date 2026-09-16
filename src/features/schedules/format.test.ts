import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { daysText, overlapNames, overlaps, timeText, windowText } from './format';

const WEEKDAYS = [true, true, true, true, true, false, false];

describe('windowText', () => {
  it('joins the range and the days', () => {
    expect(windowText({ startMinutes: 9 * 60, endMinutes: 18 * 60, days: WEEKDAYS }, es.format)).toBe(
      '9:00 – 18:00 · Entre semana',
    );
    expect(windowText({ startMinutes: 9 * 60, endMinutes: 18 * 60, days: WEEKDAYS }, en.format)).toBe(
      '9:00 – 18:00 · Weekdays',
    );
  });

  it('shows only the start when the schedule has no end', () => {
    expect(
      windowText({ startMinutes: 21 * 60 + 30, endMinutes: null, days: [true, true, true, true, false, false, true] }, es.format),
    ).toBe('21:30 · lun, mar, mié, jue, dom');
  });
});

describe('timeText', () => {
  it('reads twenty-four hour time without a leading zero on the hour', () => {
    expect(timeText(9 * 60)).toBe('9:00');
    expect(timeText(21 * 60 + 30)).toBe('21:30');
    expect(timeText(0)).toBe('0:00');
  });

  it('pads the minutes', () => {
    expect(timeText(7 * 60 + 5)).toBe('7:05');
  });
});

describe('daysText', () => {
  it('names the common patterns', () => {
    expect(daysText(WEEKDAYS, es.format)).toBe('Entre semana');
    expect(daysText([false, false, false, false, false, true, true], es.format)).toBe('Fines de semana');
    expect(daysText([true, true, true, true, true, true, true], es.format)).toBe('Todos los días');
  });

  it('spells out anything else, Monday first', () => {
    expect(daysText([true, true, true, true, false, false, true], es.format)).toBe('lun, mar, mié, jue, dom');
    expect(daysText([true, true, true, true, false, false, true], en.format)).toBe('Mon, Tue, Wed, Thu, Sun');
  });

  it('never goes blank', () => {
    expect(daysText([false, false, false, false, false, false, false], es.format)).toBe('Ningún día');
  });
});

describe('overlaps', () => {
  const work = { startMinutes: 9 * 60, endMinutes: 18 * 60, days: WEEKDAYS };

  it('is false when no day is shared', () => {
    const weekend = { ...work, days: [false, false, false, false, false, true, true] };
    expect(overlaps(work, weekend)).toBe(false);
  });

  it('is false when the ranges only touch', () => {
    const evening = { startMinutes: 18 * 60, endMinutes: 22 * 60, days: WEEKDAYS };
    expect(overlaps(work, evening)).toBe(false);
  });

  it('is true when the ranges cross on a shared day', () => {
    const lunch = { startMinutes: 12 * 60, endMinutes: 13 * 60, days: [true, false, false, false, false, false, false] };
    expect(overlaps(work, lunch)).toBe(true);
    expect(overlaps(lunch, work)).toBe(true);
  });

  it('treats a null end as running until midnight', () => {
    const openEnded = { startMinutes: 17 * 60, endMinutes: null, days: WEEKDAYS };
    const late = { startMinutes: 23 * 60, endMinutes: 23 * 60 + 30, days: WEEKDAYS };
    expect(overlaps(work, openEnded)).toBe(true);
    expect(overlaps(openEnded, late)).toBe(true);
  });
});

describe('overlapNames', () => {
  const work = { id: 'work', name: 'Trabajo', enabled: true, startMinutes: 9 * 60, endMinutes: 18 * 60, days: WEEKDAYS };
  const lunch = {
    id: 'lunch',
    name: 'Almuerzo',
    enabled: true,
    startMinutes: 12 * 60,
    endMinutes: 13 * 60,
    days: [true, false, false, false, false, false, false],
  };
  const evening = { id: 'evening', name: 'Tarde', enabled: true, startMinutes: 17 * 60, endMinutes: null, days: WEEKDAYS };
  const weekend = {
    id: 'weekend',
    name: 'Finde',
    enabled: true,
    startMinutes: 10 * 60,
    endMinutes: 12 * 60,
    days: [false, false, false, false, false, true, true],
  };

  it('is empty when nothing crosses', () => {
    expect(overlapNames(work, [work, weekend])).toEqual([]);
  });

  it('names every schedule it crosses, in list order, never itself', () => {
    expect(overlapNames(work, [work, lunch, evening, weekend])).toEqual(['Almuerzo', 'Tarde']);
  });

  it('ignores disabled schedules on either side', () => {
    expect(overlapNames(work, [work, { ...lunch, enabled: false }, evening])).toEqual(['Tarde']);
    expect(overlapNames({ ...work, enabled: false }, [work, lunch, evening])).toEqual([]);
  });
});
