import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { daysText, endsNextDay, hourText, overlapNames, overlaps, timeText, windowText } from './format';

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

  it('marks an end on the next day when it is given the words', () => {
    const night = { startMinutes: 22 * 60, endMinutes: 6 * 60, days: WEEKDAYS };
    expect(windowText(night, es.format, es.routines.edit.nextDay)).toBe('22:00 – 6:00 (día siguiente) · Entre semana');
    expect(windowText(night, en.format, en.routines.edit.nextDay)).toBe('22:00 – 6:00 (next day) · Weekdays');
    expect(windowText(night, es.format)).toBe('22:00 – 6:00 · Entre semana');
  });
});

describe('endsNextDay', () => {
  it('is true for an end at or before the start, false otherwise', () => {
    expect(endsNextDay({ startMinutes: 22 * 60, endMinutes: 6 * 60 })).toBe(true);
    expect(endsNextDay({ startMinutes: 18 * 60, endMinutes: 18 * 60 })).toBe(true);
    expect(endsNextDay({ startMinutes: 9 * 60, endMinutes: 18 * 60 })).toBe(false);
    expect(endsNextDay({ startMinutes: 9 * 60, endMinutes: null })).toBe(false);
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

  it('follows the English clock when the language is English', () => {
    expect(timeText(21 * 60 + 30, 'en-US')).toMatch(/^9:30\sPM$/);
    expect(timeText(21 * 60 + 30, 'es-CO')).toBe('21:30');
  });
});

describe('hourText', () => {
  it('is the bare hour in Spanish and a twelve-hour hour in English', () => {
    expect(hourText(21, 'es-CO')).toBe('21');
    expect(hourText(0, null)).toBe('0');
    expect(hourText(21, 'en-US')).toMatch(/^9\sPM$/);
    expect(hourText(0, 'en-US')).toMatch(/^12\sAM$/);
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

  it('runs a null end for the open-end cap, past midnight', () => {
    const openEnded = { startMinutes: 17 * 60, endMinutes: null, days: WEEKDAYS };
    const late = { startMinutes: 23 * 60, endMinutes: 23 * 60 + 30, days: WEEKDAYS };
    // 17:00 + 8 h = 1:00 the next day, like the engine.
    const earlyNextDay = { startMinutes: 0, endMinutes: 30, days: [false, true, false, false, false, false, false] };
    expect(overlaps(work, openEnded)).toBe(true);
    expect(overlaps(openEnded, late)).toBe(true);
    expect(overlaps(openEnded, earlyNextDay)).toBe(true);
  });

  it('follows a window that crosses midnight into the next morning', () => {
    const night = { startMinutes: 22 * 60, endMinutes: 6 * 60, days: [true, false, false, false, false, false, false] };
    const tuesdayDawn = { startMinutes: 5 * 60, endMinutes: 7 * 60, days: [false, true, false, false, false, false, false] };
    const mondayDawn = { startMinutes: 5 * 60, endMinutes: 7 * 60, days: [true, false, false, false, false, false, false] };
    expect(overlaps(night, tuesdayDawn)).toBe(true);
    expect(overlaps(tuesdayDawn, night)).toBe(true);
    expect(overlaps(night, mondayDawn)).toBe(false);
  });

  it('wraps Sunday night into Monday', () => {
    const sundayNight = { startMinutes: 23 * 60, endMinutes: 2 * 60, days: [false, false, false, false, false, false, true] };
    const mondayOne = { startMinutes: 60, endMinutes: 90, days: [true, false, false, false, false, false, false] };
    expect(overlaps(sundayNight, mondayOne)).toBe(true);
  });

  it('reads the same start and end as a whole day, like the engine', () => {
    const allDay = { startMinutes: 18 * 60, endMinutes: 18 * 60, days: [true, false, false, false, false, false, false] };
    const tuesdayMorning = { startMinutes: 9 * 60, endMinutes: 10 * 60, days: [false, true, false, false, false, false, false] };
    expect(overlaps(allDay, tuesdayMorning)).toBe(true);
  });

  it('never counts a routine you start by hand', () => {
    const manual = { startMinutes: null, endMinutes: null, days: WEEKDAYS, durationMs: 20 * 60_000 };
    expect(overlaps(work, manual)).toBe(false);
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
