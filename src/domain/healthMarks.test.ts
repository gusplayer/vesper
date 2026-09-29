import { describe, expect, it } from 'vitest';

import { dayBounds, dayKeyOf, dayKeyStart } from './day';
import { aHabit } from './fixtures';
import {
  DEFAULT_SLEEP_HOURS,
  EMPTY_HEALTH_WEEK,
  MIN_WORKOUT_MS,
  STEP_GOAL,
  healthReadStart,
  healthWindow,
  marksFromHealth,
  sleepHoursFor,
  stepGoalFor,
  type HealthWeek,
  type HealthWorkout,
} from './healthMarks';
import { HOUR, MINUTE } from './time';
import type { Habit, WorkoutKind } from './types';

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

/** A workout a watch or an app recorded, of no particular kind unless given one. */
function workout(start: number, end: number, kind: WorkoutKind = 'other', manual = false): HealthWorkout {
  return { start, end, kind, manual };
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
        workouts: [workout(at(18, 7), at(18, 7, 45)), workout(at(18, 18), at(18, 18, 30))],
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
      workouts: [workout(at(18, 7), at(18, 7) + MIN_WORKOUT_MS - 1), workout(at(18, 9), at(18, 9, 5))],
    });
    expect(marksFromHealth([gym], short, NOW)).toHaveLength(0);

    const exact = week({ workouts: [workout(at(18, 7), at(18, 7) + MIN_WORKOUT_MS)] });
    expect(marksFromHealth([gym], exact, NOW)).toHaveLength(1);
  });
});

describe('marksFromHealth: the kind of workout (ADR-0055)', () => {
  const ride: Habit = aHabit({ id: 'h-ride', name: 'Montar en bici', countMode: 'verified', healthType: 'workout' });
  const run: Habit = aHabit({ id: 'h-run', name: 'Correr', countMode: 'verified', healthType: 'workout' });
  const swim: Habit = aHabit({ id: 'h-swim', name: 'Swim', countMode: 'verified', healthType: 'workout' });

  const mixed = week({
    workouts: [
      workout(at(17, 7), at(17, 8), 'cycling'),
      workout(at(18, 7), at(18, 8), 'other'),
      workout(at(19, 7), at(19, 7, 40), 'running'),
      workout(at(19, 18), at(19, 18, 30), 'swimming'),
    ],
  });

  it('marks a named kind only on the days with a workout of that kind', () => {
    const marks = marksFromHealth([ride, run, swim], mixed, NOW);

    expect(marks.map((m) => `${m.habitId}:${m.dayKey}`)).toEqual([
      'h-ride:2026-08-17',
      'h-run:2026-08-19',
      'h-swim:2026-08-19',
    ]);
  });

  it('marks a workout of any kind for a name that asks for none', () => {
    expect(marksFromHealth([gym], mixed, NOW).map((m) => m.dayKey)).toEqual(['2026-08-17', '2026-08-18', '2026-08-19']);
  });

  it('reads the kind from the name when the habit carries no health type', () => {
    const untyped: Habit = { ...ride, healthType: null };
    expect(marksFromHealth([untyped], mixed, NOW).map((m) => m.dayKey)).toEqual(['2026-08-17']);
  });

  it('counts days, not rides: two rides in a day are one mark carrying both', () => {
    const twice = week({
      workouts: [workout(at(18, 7), at(18, 8), 'cycling'), workout(at(18, 18), at(18, 18, 45), 'cycling')],
    });
    const marks = marksFromHealth([ride], twice, NOW);

    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ id: 'hm-h-ride-2026-08-18', durationMs: 105 * MINUTE });
  });

  it('adds up only the workouts that count, and lets no other kind lift a short ride', () => {
    const day = week({
      workouts: [workout(at(18, 7), at(18, 7, 40), 'cycling'), workout(at(18, 18), at(18, 19), 'other')],
    });
    expect(marksFromHealth([ride], day, NOW)[0]?.durationMs).toBe(40 * MINUTE);
    expect(marksFromHealth([gym], day, NOW)[0]?.durationMs).toBe(100 * MINUTE);

    const shortRide = week({
      workouts: [workout(at(18, 7), at(18, 7, 5), 'cycling'), workout(at(18, 18), at(18, 19), 'other')],
    });
    expect(marksFromHealth([ride], shortRide, NOW)).toEqual([]);
  });

  it('never verifies a workout typed in by hand (ADR-0005), of any kind', () => {
    const typed = week({ workouts: [workout(at(18, 7), at(18, 9), 'cycling', true)] });
    expect(marksFromHealth([ride, gym], typed, NOW)).toEqual([]);

    // A recorded ride the same day still counts, and carries only its own time.
    const both = week({
      workouts: [workout(at(18, 7), at(18, 9), 'cycling', true), workout(at(18, 18), at(18, 18, 30), 'cycling')],
    });
    expect(marksFromHealth([ride], both, NOW).map((m) => m.durationMs)).toEqual([30 * MINUTE]);
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

describe('stepGoalFor', () => {
  it('reads the goal from the name, with thousands written any way', () => {
    expect(stepGoalFor('Caminar 10.000 pasos')).toBe(10_000);
    expect(stepGoalFor('Walk 10,000 steps')).toBe(10_000);
    expect(stepGoalFor('caminar 12000 pasos')).toBe(12_000);
    expect(stepGoalFor('caminar 10 000 pasos')).toBe(10_000);
  });

  it('reads k and mil as thousands, decimals included', () => {
    expect(stepGoalFor('10k pasos')).toBe(10_000);
    expect(stepGoalFor('8.5k steps')).toBe(8_500);
    expect(stepGoalFor('7,5k pasos')).toBe(7_500);
    expect(stepGoalFor('12 mil pasos')).toBe(12_000);
  });

  it('needs the unit, so minutes and kilometres are not goals', () => {
    expect(stepGoalFor('caminar')).toBe(STEP_GOAL);
    expect(stepGoalFor('caminar 30 minutos')).toBe(STEP_GOAL);
    expect(stepGoalFor('caminar 5 km')).toBe(STEP_GOAL);
  });

  it('falls back when the number is absurd', () => {
    expect(stepGoalFor('caminar 50 pasos')).toBe(STEP_GOAL);
    expect(stepGoalFor('caminar 100.000 pasos')).toBe(STEP_GOAL);
  });
});

describe('marksFromHealth: a step goal in the name', () => {
  it('counts a day against the goal the habit names, not the default', () => {
    const walk10k = aHabit({ id: 'h-walk-10k', name: 'Caminar 10.000 pasos', countMode: 'verified', healthType: 'steps' });
    const marks = marksFromHealth(
      [walk10k],
      week({ stepsByDay: { '2026-08-17': 9_000, '2026-08-18': 10_000 } }),
      NOW,
    );
    expect(marks.map((m) => m.dayKey)).toEqual(['2026-08-18']);
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
    workouts: [workout(at(18, 7), at(18, 8))],
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

  it('ignores days before the window and after now', () => {
    // The window of Wednesday the 19th starts on Wednesday the 12th.
    const marks = marksFromHealth(
      [gym, walk, sleep],
      week({
        workouts: [
          workout(at(11, 7), at(11, 8)),
          workout(at(12, 7), at(12, 8)),
          workout(at(16, 7), at(16, 8)),
          workout(at(20, 7), at(20, 8)),
        ],
        stepsByDay: { '2026-08-11': 20_000, '2026-08-12': 20_000, '2026-08-19': 20_000, '2026-08-23': 20_000 },
        sleepSessions: [
          { start: at(10, 23), end: at(11, 7), asleep: true },
          { start: at(11, 23), end: at(12, 7), asleep: true },
        ],
      }),
      NOW,
    );

    expect(marks.map((m) => `${m.habitId}:${m.dayKey}`)).toEqual([
      'h-gym:2026-08-12',
      'h-gym:2026-08-16',
      'h-walk:2026-08-12',
      'h-walk:2026-08-19',
      'h-sleep:2026-08-12',
    ]);
  });

  it('marks on Monday a Sunday ride that reached Health late (ADR-0055)', () => {
    const ride: Habit = aHabit({ id: 'h-ride', name: 'bici', countMode: 'verified', healthType: 'workout' });
    const late = week({ workouts: [workout(at(23, 17), at(23, 19), 'cycling')] });

    expect(marksFromHealth([ride], late, at(24, 9)).map((m) => m.dayKey)).toEqual(['2026-08-23']);
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

describe('healthReadStart / healthWindow', () => {
  it('reads today and the seven days before, from local midnight', () => {
    expect(healthReadStart(NOW)).toBe(at(12, 0));
    expect(healthWindow(NOW)).toEqual({ fromKey: '2026-08-12', toKey: '2026-08-19' });
  });

  it('holds all of last week on a Monday, and only last Sunday on a Sunday', () => {
    expect(healthWindow(at(24, 0, 5))).toEqual({ fromKey: '2026-08-17', toKey: '2026-08-24' });
    expect(healthWindow(at(23, 23, 55))).toEqual({ fromKey: '2026-08-16', toKey: '2026-08-23' });
  });

  it('counts calendar days across a DST change', () => {
    // Chile, where `npm run test:dst` runs: 4 April 2026 is 25 hours long and
    // 6 September starts at 01:00 and is 23. Taking 7 × 24 hours from now or from
    // today's midnight lands on the wrong day in all but the second case; elsewhere
    // these are ordinary days.
    const cases: [number, string][] = [
      [new Date(2026, 3, 7, 23, 30).getTime(), '2026-03-31'],
      [new Date(2026, 3, 11, 0, 30).getTime(), '2026-04-04'],
      [new Date(2026, 8, 9, 12).getTime(), '2026-09-02'],
      [new Date(2026, 8, 13, 0, 30).getTime(), '2026-09-06'],
    ];
    for (const [now, fromKey] of cases) {
      const start = healthReadStart(now);
      expect(dayKeyOf(start)).toBe(fromKey);
      expect(start).toBe(dayKeyStart(fromKey));
      expect(dayBounds(start).dayStart).toBe(start);
      expect(healthWindow(now)).toEqual({ fromKey, toKey: dayKeyOf(now) });
    }
  });
});
