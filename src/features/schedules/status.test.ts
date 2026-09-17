import { describe, expect, it } from 'vitest';

import { MINUTE } from '../../domain/time';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { statusText } from './status';

// 2026-09-16 is a Wednesday.
const WED_10 = new Date(2026, 8, 16, 10).getTime();
const WED_18 = new Date(2026, 8, 16, 18).getTime();
const WED_21_30 = new Date(2026, 8, 16, 21, 30).getTime();
const THU_9 = new Date(2026, 8, 17, 9).getTime();
const THU_1 = new Date(2026, 8, 17, 1).getTime();
const MON_9 = new Date(2026, 8, 21, 9).getTime();

describe('statusText', () => {
  it('says nothing for a routine that is off', () => {
    expect(statusText({ kind: 'off' }, WED_10, es.routines)).toBeNull();
    expect(statusText({ kind: 'off' }, WED_10, en.routines)).toBeNull();
  });

  it('reads the end of an active window, and says it is running when it is', () => {
    expect(statusText({ kind: 'active', until: WED_18 }, WED_10, es.routines)).toBe('Activa · hasta las 18:00');
    expect(statusText({ kind: 'active', until: WED_18 }, WED_10, es.routines, { running: true })).toBe(
      'En curso · hasta las 18:00',
    );
    expect(statusText({ kind: 'active', until: WED_18 }, WED_10, en.routines)).toBe('Active · until 18:00');
    expect(statusText({ kind: 'active', until: WED_18 }, WED_10, en.routines, { running: true })).toBe(
      'Running · until 18:00',
    );
  });

  it('says a started window is in progress while its session runs, and done for today after', () => {
    const started = { kind: 'started' as const, until: WED_18, next: THU_9 };
    expect(statusText(started, WED_10, es.routines, { running: true })).toBe('En curso · hasta las 18:00');
    expect(statusText(started, WED_10, es.routines)).toBe('Hoy ya pasó · mañana a las 9:00');
    expect(statusText(started, WED_10, es.routines, { running: false })).toBe('Hoy ya pasó · mañana a las 9:00');
    expect(statusText({ ...started, next: MON_9 }, WED_10, es.routines)).toBe('Hoy ya pasó · el lunes a las 9:00');
    expect(statusText({ ...started, next: THU_1 }, WED_10, es.routines)).toBe('Hoy ya pasó · mañana a la 1:00');
    expect(statusText({ ...started, next: null }, WED_10, es.routines)).toBe('Hoy ya pasó');

    expect(statusText(started, WED_10, en.routines, { running: true })).toBe('Running · until 18:00');
    expect(statusText(started, WED_10, en.routines)).toBe('Done for today · tomorrow at 9:00');
    expect(statusText({ ...started, next: MON_9 }, WED_10, en.routines)).toBe('Done for today · Monday at 9:00');
    expect(statusText({ ...started, next: null }, WED_10, en.routines)).toBe('Done for today');
  });

  it('names today, tomorrow, and then the weekday', () => {
    expect(statusText({ kind: 'next', at: WED_21_30 }, WED_10, es.routines)).toBe('Hoy a las 21:30');
    expect(statusText({ kind: 'next', at: THU_9 }, WED_10, es.routines)).toBe('Mañana a las 9:00');
    expect(statusText({ kind: 'next', at: MON_9 }, WED_10, es.routines)).toBe('El lunes a las 9:00');
    expect(statusText({ kind: 'next', at: WED_21_30 }, WED_10, en.routines)).toBe('Today at 21:30');
    expect(statusText({ kind: 'next', at: THU_9 }, WED_10, en.routines)).toBe('Tomorrow at 9:00');
    expect(statusText({ kind: 'next', at: MON_9 }, WED_10, en.routines)).toBe('Monday at 9:00');
  });

  it('uses the singular article for one o’clock in Spanish, and none in English', () => {
    expect(statusText({ kind: 'next', at: THU_1 }, WED_10, es.routines)).toBe('Mañana a la 1:00');
    expect(statusText({ kind: 'next', at: THU_1 }, WED_10, en.routines)).toBe('Tomorrow at 1:00');
  });

  it('reads the duration of a hand-started routine, defaulting to 25 minutes', () => {
    expect(statusText({ kind: 'manual' }, WED_10, es.routines, { durationMs: 20 * MINUTE })).toBe(
      'Cuando quieras · 20 min',
    );
    expect(statusText({ kind: 'manual' }, WED_10, es.routines)).toBe('Cuando quieras · 25 min');
    expect(statusText({ kind: 'manual' }, WED_10, es.routines, { durationMs: null })).toBe('Cuando quieras · 25 min');
    expect(statusText({ kind: 'manual' }, WED_10, en.routines, { durationMs: 20 * MINUTE })).toBe(
      'Whenever you want · 20 min',
    );
  });

  it('explains a routine with no days', () => {
    expect(statusText({ kind: 'never' }, WED_10, es.routines)).toBe('Sin días elegidos');
    expect(statusText({ kind: 'never' }, WED_10, en.routines)).toBe('No days chosen');
  });
});
