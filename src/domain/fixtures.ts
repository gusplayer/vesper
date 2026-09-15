import { createSession } from './session';
import { HOUR } from './time';
import type { Activity, Habit, HabitMark, Session } from './types';

/**
 * Test fixtures for the pure modules. Not a test file itself, so vitest does not
 * collect it; not imported by app code either.
 *
 * Every factory takes a partial override, so a test only spells out what it is about.
 */

/** A stable instant: 2023-11-14 22:13:20 UTC. Any date works, this one is memorable. */
export const T0 = 1_700_000_000_000;

export function anActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-work',
    key: 'trabajo',
    label: 'trabajo',
    isDefault: true,
    archivedAt: null,
    createdAt: 0,
    ...overrides,
  };
}

export function aRunningSession(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession(
      'session-1',
      { activityId: 'activity-work', plannedMs: HOUR, depth: 'soft', blockProfile: null },
      T0,
    ),
    ...overrides,
  };
}

/** A completed session that served exactly `ms` from `startedAt`. */
export function aDoneSession(ms: number, startedAt = T0, overrides: Partial<Session> = {}): Session {
  return aRunningSession({
    plannedMs: ms,
    actualMs: ms,
    outcome: 'completed',
    startedAt,
    endedAt: startedAt + ms,
    ...overrides,
  });
}

export function aHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-read',
    name: 'leer',
    activityId: null,
    weeklyTarget: 4,
    countMode: 'declared',
    healthType: null,
    archivedAt: null,
    createdAt: 0,
    ...overrides,
  };
}

export function aMark(overrides: Partial<HabitMark> = {}): HabitMark {
  const habitId = overrides.habitId ?? 'habit-read';
  const dayKey = overrides.dayKey ?? '2026-08-17';
  const source = overrides.source ?? 'manual';
  return {
    id: `${habitId}-${dayKey}-${source}`,
    habitId,
    dayKey,
    source,
    sourceRef: source === 'manual' ? '' : `ref-${dayKey}`,
    durationMs: null,
    markedAt: 0,
    ...overrides,
  };
}
