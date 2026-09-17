import { describe, expect, it } from 'vitest';

import {
  OPEN_END_CAP_MS,
  activeWindow,
  dueRoutine,
  manualDurationMs,
  nextStart,
  routineDecision,
  routineStatus,
  sortRoutines,
  type RoutineLike,
} from './routines';
import { HOUR, MINUTE } from './time';

// 2026-09-16 is a Wednesday.
const WED_9 = new Date(2026, 8, 16, 9).getTime();
const WED_10 = new Date(2026, 8, 16, 10).getTime();
const WED_22 = new Date(2026, 8, 16, 22).getTime();
const THU_2 = new Date(2026, 8, 17, 2).getTime();
const THU_7 = new Date(2026, 8, 17, 7).getTime();
const THU_9 = new Date(2026, 8, 17, 9).getTime();
const THU_10 = new Date(2026, 8, 17, 10).getTime();
const SAT_10 = new Date(2026, 8, 19, 10).getTime();

const weekdays = [true, true, true, true, true, false, false];
const everyDay = [true, true, true, true, true, true, true];

function routine(overrides: Partial<RoutineLike> = {}): RoutineLike {
  return {
    id: 'r-work',
    modeId: 'mode-deep-work',
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    days: weekdays,
    enabled: true,
    durationMs: null,
    ...overrides,
  };
}

describe('activeWindow', () => {
  it('is the window containing now on a scheduled day', () => {
    const window = activeWindow(routine(), WED_10);
    expect(window).toEqual({ start: WED_9, end: new Date(2026, 8, 16, 18).getTime() });
  });

  it('is null outside the window, on an unscheduled day, when off, and for manual routines', () => {
    expect(activeWindow(routine(), WED_22)).toBeNull();
    expect(activeWindow(routine(), SAT_10)).toBeNull();
    expect(activeWindow(routine({ enabled: false }), WED_10)).toBeNull();
    expect(activeWindow(routine({ startMinutes: null }), WED_10)).toBeNull();
  });

  it('crosses midnight: a 21:30 to 06:30 routine is active at 2 am the next day', () => {
    const sleep = routine({ id: 'r-sleep', startMinutes: 21 * 60 + 30, endMinutes: 6 * 60 + 30, days: everyDay });
    const window = activeWindow(sleep, THU_2);
    expect(window?.start).toBe(new Date(2026, 8, 16, 21, 30).getTime());
    expect(window?.end).toBe(new Date(2026, 8, 17, 6, 30).getTime());
    expect(activeWindow(sleep, THU_7)).toBeNull();
  });

  it('caps an open-ended window at eight hours, or at its duration', () => {
    const open = routine({ endMinutes: null });
    expect(activeWindow(open, WED_10)?.end).toBe(WED_9 + OPEN_END_CAP_MS);
    const timed = routine({ endMinutes: null, durationMs: 2 * HOUR });
    expect(activeWindow(timed, WED_10)?.end).toBe(WED_9 + 2 * HOUR);
  });

  it('ignores a window that was already open when the routine was saved', () => {
    const savedInside = routine({ updatedAt: WED_9 + 30 * MINUTE });
    expect(activeWindow(savedInside, WED_10)).toBeNull();
    // The next day's window opened after the save: it counts.
    expect(activeWindow(savedInside, THU_10)?.start).toBe(THU_9);
    // Saved exactly at the start, or before it: the window counts.
    expect(activeWindow(routine({ updatedAt: WED_9 }), WED_10)?.start).toBe(WED_9);
    expect(activeWindow(routine({ updatedAt: WED_9 - HOUR }), WED_10)?.start).toBe(WED_9);
  });

  it('ignores a midnight-crossing window saved after it opened, too', () => {
    const sleep = routine({
      id: 'r-sleep',
      startMinutes: 21 * 60 + 30,
      endMinutes: 6 * 60 + 30,
      days: everyDay,
      updatedAt: WED_22,
    });
    expect(activeWindow(sleep, THU_2)).toBeNull();
  });
});

describe('nextStart', () => {
  it('is today when the start is still ahead, and skips to the next scheduled day otherwise', () => {
    expect(nextStart(routine(), new Date(2026, 8, 16, 7).getTime())).toBe(WED_9);
    expect(nextStart(routine(), WED_22)).toBe(new Date(2026, 8, 17, 9).getTime());
    expect(nextStart(routine(), SAT_10)).toBe(new Date(2026, 8, 21, 9).getTime());
  });

  it('is null when off, manual, or never scheduled', () => {
    expect(nextStart(routine({ enabled: false }), WED_10)).toBeNull();
    expect(nextStart(routine({ startMinutes: null }), WED_10)).toBeNull();
    expect(nextStart(routine({ days: everyDay.map(() => false) }), WED_10)).toBeNull();
  });
});

describe('routineStatus and sortRoutines', () => {
  it('reports each state', () => {
    expect(routineStatus(routine(), WED_10).kind).toBe('active');
    expect(routineStatus(routine(), WED_22).kind).toBe('next');
    expect(routineStatus(routine({ startMinutes: null }), WED_10).kind).toBe('manual');
    expect(routineStatus(routine({ enabled: false }), WED_10).kind).toBe('off');
    expect(routineStatus(routine({ days: everyDay.map(() => false) }), WED_10).kind).toBe('never');
  });

  it('is started, never active, once the engine started this window', () => {
    const mark = { routineId: 'r-work', windowStart: WED_9 };
    expect(routineStatus(routine(), WED_10, mark)).toEqual({
      kind: 'started',
      until: new Date(2026, 8, 16, 18).getTime(),
      next: THU_9,
    });
    // Another routine's mark, or yesterday's window, leaves it active.
    expect(routineStatus(routine(), WED_10, { routineId: 'other', windowStart: WED_9 }).kind).toBe('active');
    expect(routineStatus(routine(), WED_10, { routineId: 'r-work', windowStart: WED_9 - 24 * HOUR }).kind).toBe(
      'active',
    );
    expect(routineStatus(routine(), WED_10, null).kind).toBe('active');
  });

  it('shows the next start for a routine saved inside its window', () => {
    expect(routineStatus(routine({ updatedAt: WED_10 - MINUTE }), WED_10)).toEqual({ kind: 'next', at: THU_9 });
  });

  it('orders active, then soonest, then manual, then off', () => {
    const active = routine({ id: 'active' });
    const later = routine({ id: 'later', startMinutes: 20 * 60, endMinutes: 21 * 60, days: everyDay });
    const sooner = routine({ id: 'sooner', startMinutes: 12 * 60, endMinutes: 13 * 60, days: everyDay });
    const manual = routine({ id: 'manual', startMinutes: null, durationMs: 20 * MINUTE });
    const off = routine({ id: 'off', enabled: false });
    expect(sortRoutines([off, later, manual, sooner, active], WED_10).map((r) => r.id)).toEqual([
      'active',
      'sooner',
      'later',
      'manual',
      'off',
    ]);
    // A started window keeps its place at the top: it is still today's routine.
    const mark = { routineId: 'active', windowStart: WED_9 };
    expect(sortRoutines([off, later, manual, sooner, active], WED_10, mark)[0]?.id).toBe('active');
  });
});

describe('dueRoutine', () => {
  it('prefers the window that started most recently when two overlap', () => {
    const early = routine({ id: 'early', startMinutes: 8 * 60, endMinutes: 18 * 60 });
    const late = routine({ id: 'late', startMinutes: 9 * 60 + 30, endMinutes: 12 * 60 });
    expect(dueRoutine([early, late], WED_10)?.routine.id).toBe('late');
    expect(dueRoutine([early, late], new Date(2026, 8, 16, 13).getTime())?.routine.id).toBe('early');
  });
});

describe('routineDecision', () => {
  const work = routine();

  it('starts a session that ends with the window when nothing runs', () => {
    const decision = routineDecision([work], false, null, WED_10);
    expect(decision.action).toBe('start');
    if (decision.action === 'start') {
      expect(decision.plannedMs).toBe(8 * HOUR);
    }
  });

  it('waits while a session runs, and never interrupts it', () => {
    expect(routineDecision([work], true, null, WED_10).action).toBe('wait');
  });

  it('does nothing when nothing is due, or when this window already started', () => {
    expect(routineDecision([work], false, null, WED_22).action).toBe('none');
    const mark = { routineId: 'r-work', windowStart: WED_9 };
    expect(routineDecision([work], false, mark, WED_10).action).toBe('none');
    const otherDay = { routineId: 'r-work', windowStart: WED_9 - 24 * HOUR };
    expect(routineDecision([work], false, otherDay, WED_10).action).toBe('start');
  });

  it('does not start a routine saved inside its window, and starts it at the next occurrence', () => {
    const savedInside = routine({ updatedAt: WED_10 - 5 * MINUTE });
    expect(routineDecision([savedInside], false, null, WED_10).action).toBe('none');
    expect(routineDecision([savedInside], false, null, new Date(2026, 8, 16, 17).getTime()).action).toBe('none');

    const nextDay = routineDecision([savedInside], false, null, THU_10);
    expect(nextDay.action).toBe('start');
    if (nextDay.action === 'start') {
      expect(nextDay.window.start).toBe(THU_9);
      expect(nextDay.plannedMs).toBe(8 * HOUR);
    }
  });

  it('does not start a routine switched on inside its window either', () => {
    // Toggling stamps the routine like a save does; the engine sees the same field.
    const toggledOn = routine({ enabled: true, updatedAt: WED_10 });
    expect(routineDecision([toggledOn], false, null, WED_10 + MINUTE).action).toBe('none');
  });

  it('never plans less than a minute', () => {
    const almostOver = new Date(2026, 8, 16, 17, 59, 50).getTime();
    const decision = routineDecision([work], false, null, almostOver);
    expect(decision.action === 'start' ? decision.plannedMs : 0).toBe(MINUTE);
  });
});

describe('manualDurationMs', () => {
  it('uses the routine duration or 25 minutes', () => {
    expect(manualDurationMs(routine({ startMinutes: null, durationMs: 20 * MINUTE }))).toBe(20 * MINUTE);
    expect(manualDurationMs(routine({ startMinutes: null }))).toBe(25 * MINUTE);
  });
});

describe('windows on the calendar, not on 24 h arithmetic', () => {
  // 2026-03-08 (US) and 2026-03-29 (EU) are spring-forward Sundays: 23 hour days.
  // In a zone without DST these are ordinary Sundays and the expectations hold too.
  const sundayOnly = [false, false, false, false, false, false, true];
  const night = routine({ id: 'r-night', startMinutes: 21 * 60 + 30, endMinutes: 6 * 60 + 30, days: sundayOnly });

  it.each([
    ['US', new Date(2026, 2, 8), new Date(2026, 2, 9)],
    ['EU', new Date(2026, 2, 29), new Date(2026, 2, 30)],
  ])('keeps a window that crossed a DST midnight active just after it (%s)', (_zone, sunday, monday) => {
    const justAfterMidnight = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 30).getTime();

    expect(activeWindow(night, justAfterMidnight)).toEqual({
      start: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 21, 30).getTime(),
      end: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 6, 30).getTime(),
    });
  });

  it('starts and ends at the wall-clock minute on a DST day', () => {
    const sunday = new Date(2026, 2, 8, 12).getTime();
    const day = routine({ id: 'r-day', startMinutes: 9 * 60, endMinutes: 18 * 60, days: sundayOnly });

    expect(activeWindow(day, sunday)).toEqual({
      start: new Date(2026, 2, 8, 9).getTime(),
      end: new Date(2026, 2, 8, 18).getTime(),
    });
    expect(nextStart(day, new Date(2026, 2, 2, 12).getTime())).toBe(new Date(2026, 2, 8, 9).getTime());
  });

  it('finds the next start on every calendar day of the coming week', () => {
    const daily = routine({ id: 'r-daily', days: everyDay, startMinutes: 9 * 60, endMinutes: 10 * 60 });
    // Saturday 2026-03-07 22:00: the next seven starts are one per calendar day.
    let at = new Date(2026, 2, 7, 22).getTime();
    const starts: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const next = nextStart(daily, at);
      if (next === null) {
        throw new Error('expected a next start');
      }
      starts.push(next);
      at = next + MINUTE;
    }

    expect(starts.map((s) => new Date(s).getDate())).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(starts.every((s) => new Date(s).getHours() === 9 && new Date(s).getMinutes() === 0)).toBe(true);
  });
});
