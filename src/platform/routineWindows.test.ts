import { describe, expect, it } from 'vitest';

import { activeWindow, nextWindow, nextWindowInstants, skippedWindow, windowOnDay, type WindowTiming } from './routineWindows';
import { activeWindow as domainActive, nextStart as domainNextStart, type RoutineLike } from '../domain/routines';
import { HOUR, MINUTE } from '../domain/time';

/** Wednesday 2026-09-16 at 10:00 local (America/Bogota, pinned by vitest.config). */
const WED_10 = new Date(2026, 8, 16, 10, 0).getTime();

const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).getTime();

const ALL_DAYS = [true, true, true, true, true, true, true];
const WEEKDAYS = [true, true, true, true, true, false, false];

function spec(overrides: Partial<WindowTiming> = {}): WindowTiming {
  return { startMinute: 9 * 60, endMinute: 17 * 60, capMinutes: 8 * 60, days: ALL_DAYS, notBefore: 0, ...overrides };
}

/** The same window in the domain's vocabulary, to check the two agree. */
function asRoutine(timing: WindowTiming): RoutineLike {
  return {
    id: 'r',
    modeId: 'm',
    startMinutes: timing.startMinute,
    endMinutes: timing.endMinute,
    days: timing.days,
    enabled: true,
    durationMs: timing.capMinutes * MINUTE,
    updatedAt: timing.notBefore,
  };
}

describe('windowOnDay', () => {
  it('is null on a day that is off', () => {
    expect(windowOnDay(spec({ days: WEEKDAYS }), at(19, 12))).toBeNull(); // Saturday
    expect(windowOnDay(spec({ days: WEEKDAYS }), at(20, 12))).toBeNull(); // Sunday
  });

  it('counts days from Monday', () => {
    const mondayOnly = spec({ days: [true, false, false, false, false, false, false] });
    expect(windowOnDay(mondayOnly, at(14, 12))).not.toBeNull(); // Monday 14th
    expect(windowOnDay(mondayOnly, at(15, 12))).toBeNull();
  });

  it('ends the same day when end is after start', () => {
    expect(windowOnDay(spec(), WED_10)).toEqual({ start: at(16, 9), end: at(16, 17) });
  });

  it('crosses midnight when end is at or before start', () => {
    expect(windowOnDay(spec({ startMinute: 21 * 60 + 30, endMinute: 6 * 60 + 30 }), WED_10)).toEqual({
      start: at(16, 21, 30),
      end: at(17, 6, 30),
    });
    expect(windowOnDay(spec({ startMinute: 9 * 60, endMinute: 9 * 60 }), WED_10)).toEqual({
      start: at(16, 9),
      end: at(17, 9),
    });
  });

  it('caps an open end at start + capMinutes', () => {
    expect(windowOnDay(spec({ endMinute: null, capMinutes: 90 }), WED_10)).toEqual({
      start: at(16, 9),
      end: at(16, 9) + 90 * MINUTE,
    });
  });
});

describe('activeWindow', () => {
  it('finds the window containing now, end exclusive', () => {
    expect(activeWindow(spec(), at(16, 9))).toEqual({ start: at(16, 9), end: at(16, 17) });
    expect(activeWindow(spec(), at(16, 16, 59))).not.toBeNull();
    expect(activeWindow(spec(), at(16, 17))).toBeNull();
    expect(activeWindow(spec(), at(16, 8, 59))).toBeNull();
  });

  it('finds a window that started yesterday', () => {
    const night = spec({ startMinute: 22 * 60, endMinute: 6 * 60 });
    expect(activeWindow(night, at(17, 2))).toEqual({ start: at(16, 22), end: at(17, 6) });
  });

  it('does not find yesterday’s window on a day that was off', () => {
    const night = spec({ startMinute: 22 * 60, endMinute: 6 * 60, days: [true, false, false, false, false, false, false] });
    expect(activeWindow(night, at(15, 2))).toEqual({ start: at(14, 22), end: at(15, 6) }); // Monday night → Tuesday
    expect(activeWindow(night, at(16, 2))).toBeNull();
  });

  it('ignores the occurrence that was already open at notBefore', () => {
    const saved = spec({ notBefore: at(16, 9, 30) });
    expect(activeWindow(saved, WED_10)).toBeNull();
    expect(activeWindow(saved, at(16, 16, 59))).toBeNull();
    expect(activeWindow(saved, at(17, 10))).toEqual({ start: at(17, 9), end: at(17, 17) });
  });

  it('counts an occurrence that opened exactly at notBefore', () => {
    expect(activeWindow(spec({ notBefore: at(16, 9) }), WED_10)).toEqual({ start: at(16, 9), end: at(16, 17) });
  });

  it('ignores a cross-midnight occurrence saved into from yesterday', () => {
    const night = spec({ startMinute: 22 * 60, endMinute: 6 * 60, notBefore: at(17, 1) });
    expect(activeWindow(night, at(17, 2))).toBeNull();
    expect(activeWindow(night, at(18, 2))).toEqual({ start: at(17, 22), end: at(18, 6) });
  });
});

describe('skippedWindow', () => {
  it('is the occurrence activeWindow rules out, and nothing else', () => {
    const saved = spec({ notBefore: at(16, 9, 30) });
    expect(skippedWindow(saved, WED_10)).toEqual({ start: at(16, 9), end: at(16, 17) });
    expect(skippedWindow(saved, at(16, 8))).toBeNull(); // outside any window
    expect(skippedWindow(saved, at(17, 10))).toBeNull(); // inside one that counts
    expect(skippedWindow(spec(), WED_10)).toBeNull(); // notBefore 0 rules nothing out
  });
});

describe('nextWindow', () => {
  it('returns today’s window when it has not started', () => {
    expect(nextWindow(spec(), at(16, 8))).toEqual({ start: at(16, 9), end: at(16, 17) });
  });

  it('returns a window starting exactly now', () => {
    expect(nextWindow(spec(), at(16, 9))?.start).toBe(at(16, 9));
  });

  it('skips to the next enabled day', () => {
    const friday = at(18, 12);
    expect(nextWindow(spec({ days: WEEKDAYS }), friday)?.start).toBe(at(21, 9)); // Monday 21st
  });

  it('is null when no day is on', () => {
    expect(nextWindow(spec({ days: [false, false, false, false, false, false, false] }), WED_10)).toBeNull();
  });

  it('never returns an occurrence that started before notBefore', () => {
    const saved = spec({ notBefore: at(16, 9, 30) });
    expect(nextWindow(saved, at(16, 8))?.start).toBe(at(17, 9));
    expect(nextWindow(saved, at(16, 9))?.start).toBe(at(17, 9));
  });

  it('looks a week ahead from notBefore when it is later than now', () => {
    const later = spec({ days: [true, false, false, false, false, false, false], notBefore: at(22, 12) });
    expect(nextWindow(later, WED_10)?.start).toBe(at(28, 9)); // Monday 28th, the first after the 22nd
  });
});

describe('nextWindowInstants', () => {
  it('arms the next start and its end when outside a window', () => {
    expect(nextWindowInstants(spec(), at(16, 8))).toEqual({ nextStart: at(16, 9), nextEnd: at(16, 17) });
    expect(nextWindowInstants(spec(), at(16, 18))).toEqual({ nextStart: at(17, 9), nextEnd: at(17, 17) });
  });

  it('arms this window’s end and the following start when inside', () => {
    expect(nextWindowInstants(spec(), WED_10)).toEqual({ nextStart: at(17, 9), nextEnd: at(16, 17) });
  });

  it('never re-arms the start it is standing on', () => {
    expect(nextWindowInstants(spec(), at(16, 9))).toEqual({ nextStart: at(17, 9), nextEnd: at(16, 17) });
  });

  it('handles a cross-midnight window from inside it', () => {
    const night = spec({ startMinute: 22 * 60, endMinute: 6 * 60 });
    expect(nextWindowInstants(night, at(17, 2))).toEqual({ nextStart: at(17, 22), nextEnd: at(17, 6) });
  });

  it('is empty when no day is on', () => {
    expect(nextWindowInstants(spec({ days: [false, false, false, false, false, false, false] }), WED_10)).toEqual({
      nextStart: null,
      nextEnd: null,
    });
  });

  it('arms nothing of the occurrence the routine was saved into, not even its end', () => {
    const saved = spec({ notBefore: at(16, 9, 30) });
    expect(nextWindowInstants(saved, WED_10)).toEqual({ nextStart: at(17, 9), nextEnd: at(17, 17) });
    expect(nextWindowInstants(saved, at(16, 16, 59))).toEqual({ nextStart: at(17, 9), nextEnd: at(17, 17) });
    // Once past it, the following occurrences are armed as usual.
    expect(nextWindowInstants(saved, at(17, 10))).toEqual({ nextStart: at(18, 9), nextEnd: at(17, 17) });
  });

  it('arms the occurrence that opens exactly at notBefore', () => {
    expect(nextWindowInstants(spec({ notBefore: at(16, 9) }), at(16, 8))).toEqual({ nextStart: at(16, 9), nextEnd: at(16, 17) });
  });

  it('skips the saved-into cross-midnight occurrence and arms tonight’s', () => {
    const night = spec({ startMinute: 22 * 60, endMinute: 6 * 60, notBefore: at(17, 1) });
    expect(nextWindowInstants(night, at(17, 2))).toEqual({ nextStart: at(17, 22), nextEnd: at(18, 6) });
  });

  it('agrees with src/domain/routines.ts', () => {
    const cases: WindowTiming[] = [
      spec(),
      spec({ startMinute: 22 * 60, endMinute: 6 * 60 }),
      spec({ endMinute: null, capMinutes: 45 }),
      spec({ days: WEEKDAYS, startMinute: 7 * 60, endMinute: 7 * 60 }),
      spec({ notBefore: at(14, 0) }),
      spec({ startMinute: 22 * 60, endMinute: 6 * 60, notBefore: at(14, 0) }),
    ];
    const instants = [at(14, 3), at(16, 9), WED_10, at(17, 2), at(18, 23, 59), at(19, 12), at(20, 6)];
    for (const timing of cases) {
      const routine = asRoutine(timing);
      for (const now of instants) {
        expect(activeWindow(timing, now)).toEqual(domainActive(routine, now));
        expect(nextWindow(timing, now)?.start ?? null).toBe(domainNextStart(routine, now));
      }
    }
  });

  it('agrees with src/domain/routines.ts on the occurrence saved into', () => {
    // The domain's nextStart does not know updatedAt; only activeWindow does, and
    // that is the call the engine decides with. Only instants past the stamp count:
    // the clock is never before the last save.
    const cases: WindowTiming[] = [
      spec({ notBefore: at(16, 9, 30) }),
      spec({ startMinute: 22 * 60, endMinute: 6 * 60, notBefore: at(17, 1) }),
      spec({ endMinute: null, capMinutes: 45, notBefore: at(16, 9, 10) }),
    ];
    const instants = [WED_10, at(16, 16, 59), at(17, 2), at(17, 10), at(18, 23, 59), at(19, 12)];
    for (const timing of cases) {
      const routine = asRoutine(timing);
      for (const now of instants.filter((instant) => instant >= timing.notBefore)) {
        expect(activeWindow(timing, now)).toEqual(domainActive(routine, now));
        expect(nextWindow(timing, now)?.start ?? null).toBe(domainNextStart(routine, now));
      }
    }
  });

  it('keeps a whole-day cap inside a day', () => {
    const window = windowOnDay(spec({ endMinute: null, capMinutes: 24 * 60 }), WED_10);
    expect(window).not.toBeNull();
    expect((window as { end: number }).end - (window as { start: number }).start).toBe(24 * HOUR);
  });
});
