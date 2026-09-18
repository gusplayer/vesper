import { describe, expect, it } from 'vitest';

import { es } from '../i18n/es';

import { HOUR, MINUTE } from './time';
import type { RoutineLike } from './routines';
import {
  appleWeekday,
  routineIdFromActivityName,
  routineIdsFromActivityNames,
  routineWindowPlans,
  windowEnd,
  windowIntervals,
  type WindowLike,
  type WindowModeLike,
} from './routineWindows';

const WEEKDAYS = [true, true, true, true, true, false, false];
const ALL_DAYS = [true, true, true, true, true, true, true];
const NO_DAYS = [false, false, false, false, false, false, false];

const MODE: WindowModeLike = { id: 'mode-1', name: 'Sin redes', behavior: 'block', selectionToken: 'dG9rZW4=' };

function routine(overrides: Partial<RoutineLike> = {}): RoutineLike {
  return {
    id: 'r1',
    modeId: 'mode-1',
    startMinutes: 9 * 60,
    endMinutes: 12 * 60,
    days: WEEKDAYS,
    enabled: true,
    durationMs: null,
    ...overrides,
  };
}

function window(overrides: Partial<WindowLike> = {}): WindowLike {
  return { id: 'r1', startMinute: 9 * 60, endMinute: 12 * 60, capMinutes: 480, days: WEEKDAYS, ...overrides };
}

describe('appleWeekday', () => {
  it('maps Monday-first indexes to Gregorian weekdays', () => {
    expect(appleWeekday(0)).toBe(2); // Monday
    expect(appleWeekday(5)).toBe(7); // Saturday
    expect(appleWeekday(6)).toBe(1); // Sunday
  });
});

describe('windowEnd', () => {
  it('ends the same day when the end is after the start', () => {
    expect(windowEnd(window())).toEqual({ endMinute: 12 * 60, crossesMidnight: false });
  });

  it('ends the next day when the end is at or before the start', () => {
    expect(windowEnd(window({ startMinute: 21 * 60 + 30, endMinute: 6 * 60 + 30 }))).toEqual({
      endMinute: 6 * 60 + 30,
      crossesMidnight: true,
    });
    expect(windowEnd(window({ startMinute: 9 * 60, endMinute: 9 * 60 })).crossesMidnight).toBe(true);
  });

  it('uses the cap for an open end, wrapping past midnight', () => {
    expect(windowEnd(window({ startMinute: 20 * 60, endMinute: null, capMinutes: 480 }))).toEqual({
      endMinute: 4 * 60,
      crossesMidnight: true,
    });
    expect(windowEnd(window({ startMinute: 9 * 60, endMinute: null, capMinutes: 30 }))).toEqual({
      endMinute: 9 * 60 + 30,
      crossesMidnight: false,
    });
  });

  it("stretches a window shorter than Apple's minimum to fifteen minutes", () => {
    expect(windowEnd(window({ startMinute: 9 * 60, endMinute: 9 * 60 + 5 })).endMinute).toBe(9 * 60 + 15);
    expect(windowEnd(window({ startMinute: 23 * 60 + 55, endMinute: null, capMinutes: 5 }))).toEqual({
      endMinute: 10,
      crossesMidnight: true,
    });
  });
});

describe('windowIntervals', () => {
  it('produces one weekday-pinned interval per selected day', () => {
    const intervals = windowIntervals(window());

    expect(intervals.map((i) => i.activityName)).toEqual([
      'routine-r1-0',
      'routine-r1-1',
      'routine-r1-2',
      'routine-r1-3',
      'routine-r1-4',
    ]);
    expect(intervals[0]?.start).toEqual({ hour: 9, minute: 0, weekday: 2 });
    expect(intervals[0]?.end).toEqual({ hour: 12, minute: 0, weekday: 2 });
    expect(intervals[4]?.start.weekday).toBe(6); // Friday
    expect(intervals.every((i) => !i.crossesMidnight)).toBe(true);
  });

  it('ends a cross-midnight interval on the following weekday', () => {
    const sundayOnly = [false, false, false, false, false, false, true];
    const intervals = windowIntervals(window({ startMinute: 21 * 60 + 30, endMinute: 6 * 60 + 30, days: sundayOnly }));

    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.start).toEqual({ hour: 21, minute: 30, weekday: 1 }); // Sunday
    expect(intervals[0]?.end).toEqual({ hour: 6, minute: 30, weekday: 2 }); // Monday
    expect(intervals[0]?.crossesMidnight).toBe(true);
  });

  it('collapses every day into one daily interval without a weekday', () => {
    const intervals = windowIntervals(window({ days: ALL_DAYS }));

    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.activityName).toBe('routine-r1-daily');
    expect(intervals[0]?.start).toEqual({ hour: 9, minute: 0 });
    expect(intervals[0]?.end).toEqual({ hour: 12, minute: 0 });
  });

  it('is empty without days', () => {
    expect(windowIntervals(window({ days: NO_DAYS }))).toEqual([]);
  });
});

describe('routineIdFromActivityName', () => {
  it('recovers the id from weekday and daily names, dashes in the id included', () => {
    expect(routineIdFromActivityName('routine-0192-abcd-ef-3')).toBe('0192-abcd-ef');
    expect(routineIdFromActivityName('routine-0192-abcd-ef-daily')).toBe('0192-abcd-ef');
  });

  it('ignores names that are not ours', () => {
    expect(routineIdFromActivityName('session-tracking')).toBeNull();
    expect(routineIdFromActivityName('routine-')).toBeNull();
    expect(routineIdFromActivityName('routine-abc')).toBeNull();
    expect(routineIdFromActivityName('routine-abc-')).toBeNull();
  });

  it('lists distinct ids in first-seen order', () => {
    expect(routineIdsFromActivityNames(['routine-a-0', 'other', 'routine-b-daily', 'routine-a-3'])).toEqual(['a', 'b']);
  });
});

describe('routineWindowPlans', () => {
  it('builds a plan for an enabled timed routine whose mode has a selection', () => {
    const plans = routineWindowPlans([routine()], [MODE], es.session.shield);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual({
      id: 'r1',
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      capMinutes: 480,
      days: WEEKDAYS,
      notBefore: 0,
      token: 'dG9rZW4=',
      kind: 'block',
      shieldTitle: 'Vesper · Sin redes',
      shieldSubtitle: 'Estás enfocado. Esta app espera.',
      shieldButton: 'Cerrar',
    });
  });

  it('carries the routine’s updatedAt as notBefore, so the occurrence saved into is skipped', () => {
    const savedAt = new Date(2026, 8, 16, 10, 0).getTime();
    const plans = routineWindowPlans([routine({ updatedAt: savedAt })], [MODE], es.session.shield);

    expect(plans[0]?.notBefore).toBe(savedAt);
  });

  it('caps an open end with the routine duration when it has one', () => {
    const plans = routineWindowPlans([routine({ endMinutes: null, durationMs: 2 * HOUR + 30 * MINUTE })], [MODE], es.session.shield);

    expect(plans[0]?.capMinutes).toBe(150);
  });

  it('skips disabled, manual, dayless and selection-less routines', () => {
    const noToken: WindowModeLike = { ...MODE, id: 'mode-2', selectionToken: '  ' };
    const plans = routineWindowPlans(
      [
        routine({ id: 'off', enabled: false }),
        routine({ id: 'manual', startMinutes: null }),
        routine({ id: 'nodays', days: NO_DAYS }),
        routine({ id: 'blank', modeId: 'mode-2' }),
        routine({ id: 'orphan', modeId: 'missing' }),
        routine({ id: 'ok' }),
      ],
      [MODE, noToken],
      es.session.shield,
    );

    expect(plans.map((p) => p.id)).toEqual(['ok']);
  });

  it('carries the allow behavior', () => {
    const plans = routineWindowPlans([routine()], [{ ...MODE, behavior: 'allow' }], es.session.shield);

    expect(plans[0]?.kind).toBe('allow');
  });
});
