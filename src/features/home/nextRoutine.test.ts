import { describe, expect, it } from 'vitest';

import { HOUR } from '../../domain/time';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { nextRoutineText, type NamedRoutine } from './nextRoutine';

const ES = es.focus.nextRoutine;
const EN = en.focus.nextRoutine;

// 2026-09-16 is a Wednesday. Noon, so "today" has hours on both sides.
const NOW = new Date(2026, 8, 16, 12).getTime();

const WEEKDAYS = [true, true, true, true, true, false, false];
const THURSDAY_ONLY = [false, false, false, true, false, false, false];
const FRIDAY_ONLY = [false, false, false, false, true, false, false];

const MODES = [
  { id: 'work', name: 'Trabajo' },
  { id: 'rest', name: 'Descanso' },
];

function routine(overrides: Partial<NamedRoutine> = {}): NamedRoutine {
  return {
    id: 'r1',
    name: 'Mañanas',
    modeId: 'work',
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    days: WEEKDAYS,
    enabled: true,
    durationMs: null,
    ...overrides,
  };
}

describe('nextRoutineText', () => {
  it('says nothing with no routines', () => {
    expect(nextRoutineText([], MODES, NOW, ES)).toBeNull();
  });

  it('names the mode and the end of the window while a routine is active', () => {
    expect(nextRoutineText([routine()], MODES, NOW, ES)).toBe('Trabajo · activa hasta las 18:00');
    expect(nextRoutineText([routine()], MODES, NOW, EN)).toBe('Trabajo · active until 18:00');
  });

  it('moves on to the next start once the engine started this window and its session is over', () => {
    const mark = { routineId: 'r1', windowStart: new Date(2026, 8, 16, 9).getTime() };
    expect(nextRoutineText([routine()], MODES, NOW, ES, { lastMark: mark })).toBe('Trabajo empieza mañana a las 9:00');
    expect(nextRoutineText([routine()], MODES, NOW, EN, { lastMark: mark })).toBe('Trabajo starts tomorrow at 9:00');
    // While its session still runs, the window is active.
    expect(nextRoutineText([routine()], MODES, NOW, ES, { lastMark: mark, running: true })).toBe(
      'Trabajo · activa hasta las 18:00',
    );
    // A mark for another window changes nothing.
    const yesterday = { routineId: 'r1', windowStart: new Date(2026, 8, 15, 9).getTime() };
    expect(nextRoutineText([routine()], MODES, NOW, ES, { lastMark: yesterday })).toBe('Trabajo · activa hasta las 18:00');
    expect(nextRoutineText([routine()], MODES, NOW, ES, { lastMark: null })).toBe('Trabajo · activa hasta las 18:00');
  });

  it('says nothing about a window that was already open when the routine was saved', () => {
    const savedInside = routine({ updatedAt: new Date(2026, 8, 16, 11).getTime() });
    expect(nextRoutineText([savedInside], MODES, NOW, ES)).toBe('Trabajo empieza mañana a las 9:00');
  });

  it('caps an open-ended window at its duration', () => {
    const open = routine({ startMinutes: 11 * 60, endMinutes: null, durationMs: 2 * HOUR });
    expect(nextRoutineText([open], MODES, NOW, ES)).toBe('Trabajo · activa hasta las 13:00');
  });

  it('announces a start later today with minutes padded and no leading zero on the hour', () => {
    const later = routine({ startMinutes: 14 * 60 + 5, endMinutes: 16 * 60 });
    expect(nextRoutineText([later], MODES, NOW, ES)).toBe('Trabajo empieza a las 14:05');
    expect(nextRoutineText([later], MODES, NOW, EN)).toBe('Trabajo starts at 14:05');
  });

  it('says mañana when the next start is tomorrow but less than a day away', () => {
    const morning = routine({ startMinutes: 9 * 60, endMinutes: 11 * 60 });
    expect(nextRoutineText([morning], MODES, NOW, ES)).toBe('Trabajo empieza mañana a las 9:00');
    expect(nextRoutineText([morning], MODES, NOW, EN)).toBe('Trabajo starts tomorrow at 9:00');
  });

  it('says nothing when the next start is a day or more away', () => {
    const friday = routine({ days: FRIDAY_ONLY });
    expect(nextRoutineText([friday], MODES, NOW, ES)).toBeNull();
    // Exactly 24 h ahead is not "within" a day either: Thursday noon, seen from Wednesday noon.
    const sameTimeTomorrow = routine({ startMinutes: 12 * 60, endMinutes: 13 * 60, days: THURSDAY_ONLY });
    expect(nextRoutineText([sameTimeTomorrow], MODES, NOW, ES)).toBeNull();
  });

  it('prefers the active routine over one about to start', () => {
    const active = routine({ id: 'a', modeId: 'work' });
    const soon = routine({ id: 'b', modeId: 'rest', startMinutes: 12 * 60 + 30, endMinutes: 13 * 60 });
    expect(nextRoutineText([soon, active], MODES, NOW, ES)).toBe('Trabajo · activa hasta las 18:00');
  });

  it('picks the soonest of several upcoming starts, whatever the list order', () => {
    const evening = routine({ id: 'a', modeId: 'rest', startMinutes: 20 * 60, endMinutes: 21 * 60 });
    const afternoon = routine({ id: 'b', modeId: 'work', startMinutes: 15 * 60, endMinutes: 16 * 60 });
    expect(nextRoutineText([evening, afternoon], MODES, NOW, ES)).toBe('Trabajo empieza a las 15:00');
  });

  it('ignores routines that are off or started by hand', () => {
    const off = routine({ enabled: false });
    const manual = routine({ id: 'm', startMinutes: null, endMinutes: null, durationMs: HOUR });
    expect(nextRoutineText([off, manual], MODES, NOW, ES)).toBeNull();
  });

  it('falls back to the routine name when its mode is gone', () => {
    const orphan = routine({ modeId: 'deleted' });
    expect(nextRoutineText([orphan], MODES, NOW, ES)).toBe('Mañanas · activa hasta las 18:00');
  });
});
