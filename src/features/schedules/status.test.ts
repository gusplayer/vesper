import { describe, expect, it } from 'vitest';

import { MINUTE } from '../../domain/time';
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
    expect(statusText({ kind: 'off' }, WED_10)).toBeNull();
  });

  it('reads the end of an active window, and says it is running when it is', () => {
    expect(statusText({ kind: 'active', until: WED_18 }, WED_10)).toBe('Activa · hasta las 18:00');
    expect(statusText({ kind: 'active', until: WED_18 }, WED_10, { running: true })).toBe(
      'En curso · hasta las 18:00',
    );
  });

  it('names today, tomorrow, and then the weekday', () => {
    expect(statusText({ kind: 'next', at: WED_21_30 }, WED_10)).toBe('Hoy a las 21:30');
    expect(statusText({ kind: 'next', at: THU_9 }, WED_10)).toBe('Mañana a las 9:00');
    expect(statusText({ kind: 'next', at: MON_9 }, WED_10)).toBe('El lunes a las 9:00');
  });

  it('uses the singular article for one o’clock', () => {
    expect(statusText({ kind: 'next', at: THU_1 }, WED_10)).toBe('Mañana a la 1:00');
  });

  it('reads the duration of a hand-started routine, defaulting to 25 minutes', () => {
    expect(statusText({ kind: 'manual' }, WED_10, { durationMs: 20 * MINUTE })).toBe('Cuando quieras · 20 min');
    expect(statusText({ kind: 'manual' }, WED_10)).toBe('Cuando quieras · 25 min');
    expect(statusText({ kind: 'manual' }, WED_10, { durationMs: null })).toBe('Cuando quieras · 25 min');
  });

  it('explains a routine with no days', () => {
    expect(statusText({ kind: 'never' }, WED_10)).toBe('Sin días elegidos');
  });
});
