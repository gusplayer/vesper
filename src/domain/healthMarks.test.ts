import { describe, expect, it } from 'vitest';

import { aHabit } from './fixtures';
import {
  DEFAULT_SLEEP_HOURS,
  EMPTY_HEALTH_WEEK,
  MIN_WORKOUT_MS,
  STEP_GOAL,
  marksFromHealth,
  sleepHoursFor,
  type HealthWeek,
} from './healthMarks';
import { HOUR, MINUTE } from './time';
import type { Habit } from './types';

/** Local instants, so the tests read like a calendar. Month is 1-based here. */
function at(day: number, hour: number, minute = 0): number {
  return new Date(2026, 7, day, hour, minute).getTime();
}

/** Wednesday 19 August 2026, noon. The week runs Monday 17 to Sunday 23. */
const NOW = at(19, 12);

const gym: Habit = aHabit({ id: 'h-gym', name: 'gym', countMode: 'verified', healthType: 'workout' });
const walk: Habit = aHabit({ id: 'h-walk', name: 'caminar', countMode: 'verified', healthType: 'steps' });
const sleep: Habit = aHabit({ id: 'h-sleep', name: 'dormir 7h', countMode: 'verified', healthType: 'sleep' });

function week(partial: Partial<HealthWeek>): HealthWeek {
  return { ...EMPTY_HEALTH_WEEK, ...partial };
}

describe('sleepHoursFor', () => {
  it('reads the hours from the name', () => {
    expect(sleepHoursFor('dormir 7h')).toBe(7);
    expect(sleepHoursFor('dormir 8 horas')).toBe(8);
    expect(sleepHoursFor('Dormir 7,5 hs')).toBe(7.5);
  });

  it('defaults when the name says nothing usable', () => {
    expect(sleepHoursFor('dormir')).toBe(DEFAULT_SLEEP_HOURS);
    expect(sleepHoursFor('dormir 40h')).toBe(DEFAULT_SLEEP_HOURS);
    expect(sleepHoursFor('dormir 7 veces')).toBe(DEFAULT_SLEEP_HOURS);
  });
});

describe('marksFromHealth: workouts', () => {
  it('marks a day with a workout and sums the day', () => {
    const marks = marksFromHealth(
      [gym],
      week({
        workouts: [
          { start: at(18, 7), end: at(18, 7, 45) },
          { start: at(18, 18), end: at(18, 18, 30) },
        ],
      }),
      NOW,
    );

    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      habitId: 'h-gym',
      dayKey: '2026-08-18',
      source: 'health',
      sourceRef: 'hk-workout-2026-08-18',
      durationMs: 75 * MINUTE,
      markedAt: NOW,
    });
  });

  it('ignores a day whose only workouts are under the floor', () => {
    const short = week({
      workouts: [
        { start: at(18, 7), end: at(18, 7) + MIN_WORKOUT_MS - 1 },
        { start: at(18, 9), end: at(18, 9, 5) },
      ],
    });
    expect(marksFromHealth([gym], short, NOW)).toHaveLength(0);

    const exact = week({ workouts: [{ start: at(18, 7), end: at(18, 7) + MIN_WORKOUT_MS }] });
    expect(marksFromHealth([gym], exact, NOW)).toHaveLength(1);
  });
});

describe('marksFromHealth: steps', () => {
  it('marks the days at or above the goal, with no duration', () => {
    const marks = marksFromHealth(
      [walk],
      week({
        stepsByDay: {
          '2026-08-17': STEP_GOAL,
          '2026-08-18': STEP_GOAL - 1,
          '2026-08-19': 12_000,
        },
      }),
      NOW,
    );

    expect(marks.map((m) => m.dayKey)).toEqual(['2026-08-17', '2026-08-19']);
    expect(marks[0]?.durationMs).toBeNull();
    expect(marks[0]?.sourceRef).toBe('hk-steps-2026-08-17');
  });
});

describe('marksFromHealth: sleep', () => {
  it('credits the day the sleep ended, across midnight, adding up the stages', () => {
    const marks = marksFromHealth(
      [sleep],
      week({
        sleepSessions: [
          { start: at(17, 23), end: at(18, 1), asleep: true },
          { start: at(18, 1), end: at(18, 1, 20), asleep: false },
          { start: at(18, 1, 20), end: at(18, 6, 30), asleep: true },
        ],
      }),
      NOW,
    );

    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      dayKey: '2026-08-18',
      sourceRef: 'hk-sleep-2026-08-18',
      durationMs: 7 * HOUR + 10 * MINUTE,
    });
  });

  it('leaves a short night unmarked, and does not count time in bed', () => {
    const night = week({
      sleepSessions: [
        { start: at(17, 23), end: at(18, 5, 30), asleep: true },
        { start: at(18, 5, 30), end: at(18, 8), asleep: false },
      ],
    });
    expect(marksFromHealth([sleep], night, NOW)).toHaveLength(0);
  });

  it('takes the hours from the habit name', () => {
    const night = week({ sleepSessions: [{ start: at(17, 23), end: at(18, 5, 30), asleep: true }] });
    const light: Habit = { ...sleep, id: 'h-6', name: 'dormir 6h' };
    const heavy: Habit = { ...sleep, id: 'h-8', name: 'dormir 8h' };

    const marks = marksFromHealth([light, heavy, sleep], night, NOW);
    expect(marks.map((m) => m.habitId)).toEqual(['h-6']);
  });

  it('sleep that ended on Monday morning counts even if it started last week', () => {
    const night = week({ sleepSessions: [{ start: at(16, 23), end: at(17, 7), asleep: true }] });
    expect(marksFromHealth([sleep], night, NOW).map((m) => m.dayKey)).toEqual(['2026-08-17']);
  });
});

describe('marksFromHealth: scope', () => {
  const busy = week({
    workouts: [{ start: at(18, 7), end: at(18, 8) }],
    stepsByDay: { '2026-08-18': 10_000 },
    sleepSessions: [{ start: at(17, 23), end: at(18, 7), asleep: true }],
  });

  it('ignores declared and archived habits', () => {
    const declared: Habit = aHabit({ id: 'h-read', name: 'leer', countMode: 'declared' });
    const declaredGym: Habit = { ...gym, id: 'h-gym-declared', countMode: 'declared' };
    const archived: Habit = { ...gym, id: 'h-gym-old', archivedAt: 1 };

    expect(marksFromHealth([declared, declaredGym, archived], busy, NOW)).toHaveLength(0);
  });

  it('falls back to the name when the habit has no health type', () => {
    const untyped: Habit = { ...gym, healthType: null };
    expect(marksFromHealth([untyped], busy, NOW)).toHaveLength(1);
  });

  it('gives a verified habit no mark at all when neither its type nor its name maps to Health', () => {
    // 'meditar' is verified and matches no hint: HealthKit has nothing to confirm it
    // with, so it can never be marked — not here and not by hand, because a verified
    // habit is not marked by hand. Nothing in the domain says so out loud; the screen
    // that offers 'verificado' is what has to stop this from being saved.
    const unmappable: Habit = aHabit({
      id: 'h-meditate',
      name: 'meditar',
      countMode: 'verified',
      healthType: null,
    });

    expect(marksFromHealth([unmappable], busy, NOW)).toEqual([]);
    expect(marksFromHealth([unmappable, gym], busy, NOW).map((m) => m.habitId)).toEqual(['h-gym']);
  });

  it('ignores days before the week and after now', () => {
    const marks = marksFromHealth(
      [gym, walk],
      week({
        workouts: [
          { start: at(16, 7), end: at(16, 8) },
          { start: at(17, 7), end: at(17, 8) },
          { start: at(20, 7), end: at(20, 8) },
        ],
        stepsByDay: { '2026-08-10': 20_000, '2026-08-19': 20_000, '2026-08-23': 20_000 },
      }),
      NOW,
    );

    expect(marks.map((m) => `${m.habitId}:${m.dayKey}`)).toEqual([
      'h-gym:2026-08-17',
      'h-walk:2026-08-19',
    ]);
  });

  it('produces the same ids on every run', () => {
    const first = marksFromHealth([gym, walk, sleep], busy, NOW);
    const second = marksFromHealth([gym, walk, sleep], busy, NOW);

    expect(first.map((m) => m.id)).toEqual([
      'hm-h-gym-2026-08-18',
      'hm-h-walk-2026-08-18',
      'hm-h-sleep-2026-08-18',
    ]);
    expect(second).toEqual(first);
  });

  it('is empty for an empty week', () => {
    expect(marksFromHealth([gym, walk, sleep], EMPTY_HEALTH_WEEK, NOW)).toEqual([]);
  });
});
