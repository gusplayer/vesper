import { describe, expect, it } from 'vitest';

import { aHabit, aMark } from './fixtures';
import {
  activeHabitCount,
  canAddHabit,
  DEFAULT_HABIT_TARGET,
  HABIT_TARGET_OPTIONS,
  healthTypeFor,
  isMarkedOn,
  weeklyProgress,
  isMarkedByHealth,
  workoutKindFor,
} from './habits';
import { CHALLENGE_TARGET_OPTIONS, MAX_HABITS, type Habit, type HabitMark } from './types';

function habit(id: string, name: string, weeklyTarget: number): Habit {
  return aHabit({ id, name, weeklyTarget });
}

function mark(habitId: string, dayKey: string, source: HabitMark['source'] = 'manual'): HabitMark {
  return aMark({ habitId, dayKey, source });
}

const TODAY = '2026-08-23';

describe('healthTypeFor', () => {
  it('maps a name to a health type, case-insensitively', () => {
    expect(healthTypeFor('gym')).toBe('workout');
    expect(healthTypeFor('GYM')).toBe('workout');
    expect(healthTypeFor('caminar')).toBe('steps');
    expect(healthTypeFor('dormir 7h')).toBe('sleep');
    expect(healthTypeFor('sueno')).toBe('sleep');
  });

  it('knows the Spanish names the English list already had', () => {
    expect(healthTypeFor('Gimnasio')).toBe('workout');
    expect(healthTypeFor('gimnasia')).toBe('workout');
    expect(healthTypeFor('Nadar')).toBe('workout');
    expect(healthTypeFor('natación')).toBe('workout');
    expect(healthTypeFor('trotar')).toBe('workout');
    expect(healthTypeFor('senderismo')).toBe('steps');
  });

  it('does not read "nada" as swimming', () => {
    expect(healthTypeFor('no hacer nada')).toBeNull();
    expect(healthTypeFor('nada de azúcar')).toBeNull();
  });

  it('recognizes the English words too, whatever the app language', () => {
    expect(healthTypeFor('Workout')).toBe('workout');
    expect(healthTypeFor('lift weights')).toBe('workout');
    expect(healthTypeFor('running')).toBe('workout');
    expect(healthTypeFor('bike to work')).toBe('workout');
    expect(healthTypeFor('walk')).toBe('steps');
    expect(healthTypeFor('10k steps')).toBe('steps');
    expect(healthTypeFor('sleep 7h')).toBe('sleep');
  });

  it('is null for a name with no hint', () => {
    expect(healthTypeFor('leer')).toBeNull();
    expect(healthTypeFor('read')).toBeNull();
    // Short English words only match at a word start: brunch is not a run.
    expect(healthTypeFor('brunch')).toBeNull();
  });

  it('lets the first hint win when several match', () => {
    // 'caminar' says steps, 'gym' says workout; workout is listed first.
    expect(healthTypeFor('caminar al gym')).toBe('workout');
  });
});

describe('workoutKindFor', () => {
  const CYCLING = [
    'bici',
    'Montar en bicicleta',
    'Salir en la cicla',
    'Ciclismo',
    'Ciclista de fin de semana',
    'Ciclocross',
    'Cicloturismo',
    'Cyclocross',
    'Rodar juntos',
    'Pedalear',
    'Spinning',
    'MTB',
    'Bike',
    'Biking to work',
    'Mountain bike',
    'E-bike',
    'Bicycle',
    'Cycling',
    'Cycle to work',
    'Ride',
    'Morning ride',
    'Riding',
    'Spin class',
  ];
  const RUNNING = ['Correr', 'Salir a correr', 'Trotar', 'Trote', 'Run', 'Running', 'Morning run', 'Jog', 'Jogging'];
  const SWIMMING = ['Nadar', 'natación', 'NATACION', 'Swim', 'Swimming', 'Swims', 'Swimmer'];

  it('reads a ride, a run and a swim in both languages', () => {
    for (const name of CYCLING) {
      expect(workoutKindFor(name), name).toBe('cycling');
    }
    for (const name of RUNNING) {
      expect(workoutKindFor(name), name).toBe('running');
    }
    for (const name of SWIMMING) {
      expect(workoutKindFor(name), name).toBe('swimming');
    }
  });

  it('makes every name it reads a workout habit too', () => {
    for (const name of [...CYCLING, ...RUNNING, ...SWIMMING]) {
      expect(healthTypeFor(name), name).toBe('workout');
    }
  });

  it('is null for a workout of any kind', () => {
    for (const name of ['gym', 'Gimnasio', 'Entrenar', 'Pesas', 'Hacer ejercicio', 'Workout', 'Lift weights']) {
      expect(healthTypeFor(name), name).toBe('workout');
      expect(workoutKindFor(name), name).toBeNull();
    }
  });

  it('is null for walking and sleep, which are not workouts', () => {
    expect(workoutKindFor('caminar')).toBeNull();
    expect(workoutKindFor('Caminar 10.000 pasos')).toBeNull();
    expect(workoutKindFor('dormir 7h')).toBeNull();
  });

  it('does not read a word that only hides a stem', () => {
    const lookalikes = [
      'no hacer nada',
      'Reciclar',
      'Recorrer la ciudad',
      'Socorrer',
      'Recycle',
      'Recycling',
      'Motorbike',
      'Eat spinach',
      'Pride',
      'Get rid of clutter',
      'Brunch',
      'Prune',
      'Bikini',
      'Correo',
      'Ciclo de lectura',
      'Cyclone drill',
      'Buy swimwear',
      'Pack the swimsuit',
    ];
    for (const name of lookalikes) {
      expect(workoutKindFor(name), name).toBeNull();
      expect(healthTypeFor(name), name).not.toBe('workout');
    }
  });

  it('takes the first kind when a name asks for several', () => {
    expect(workoutKindFor('Nadar, bici y correr')).toBe('cycling');
    expect(workoutKindFor('Correr o nadar')).toBe('running');
    expect(workoutKindFor('Gym y bici')).toBe('cycling');
  });
});

describe('targets', () => {
  it('offers 1 to 6, and defaults to one of them', () => {
    expect(HABIT_TARGET_OPTIONS).toEqual([1, 2, 3, 4, 5, 6]);
    expect((HABIT_TARGET_OPTIONS as readonly number[]).includes(DEFAULT_HABIT_TARGET)).toBe(
      true,
    );
  });

  it('offers every target a challenge can ask for, so a linked habit keeps its own', () => {
    expect(HABIT_TARGET_OPTIONS).toEqual(CHALLENGE_TARGET_OPTIONS);
  });
});

describe('weeklyProgress', () => {
  it('counts distinct days, so two marks on one day count once', () => {
    const marks = [mark('h1', '2026-08-17'), mark('h1', '2026-08-17', 'health')];
    const [progress] = weeklyProgress([habit('h1', 'gym', 4)], marks, TODAY);

    expect(progress?.markedDays).toBe(1);
  });

  it('is met only at the target, not before', () => {
    const gym = habit('h1', 'gym', 2);
    const one = weeklyProgress([gym], [mark('h1', '2026-08-17')], TODAY);
    const two = weeklyProgress([gym], [mark('h1', '2026-08-17'), mark('h1', '2026-08-18')], TODAY);

    expect(one[0]?.met).toBe(false);
    expect(two[0]?.met).toBe(true);
  });

  it('meets a target of one with a single day', () => {
    const ride = habit('h1', 'bici', 1);

    expect(weeklyProgress([ride], [], TODAY)[0]?.met).toBe(false);
    expect(weeklyProgress([ride], [mark('h1', '2026-08-17', 'health')], TODAY)[0]?.met).toBe(true);
  });

  it('stays met past the target', () => {
    const marks = ['17', '18', '19'].map((day) => mark('h1', `2026-08-${day}`));
    const [progress] = weeklyProgress([habit('h1', 'gym', 2)], marks, TODAY);

    expect(progress?.markedDays).toBe(3);
    expect(progress?.met).toBe(true);
  });

  it('is met at a zero target with no marks', () => {
    const [progress] = weeklyProgress([habit('h1', 'gym', 0)], [], TODAY);

    expect(progress?.met).toBe(true);
  });

  it('counts a session mark as a day', () => {
    const [progress] = weeklyProgress(
      [habit('h1', 'gym', 4)],
      [mark('h1', '2026-08-17', 'session')],
      TODAY,
    );

    expect(progress?.markedDays).toBe(1);
  });

  it('ignores marks belonging to another habit', () => {
    const [progress] = weeklyProgress([habit('h1', 'gym', 4)], [mark('h2', TODAY)], TODAY);

    expect(progress?.markedDays).toBe(0);
    expect(progress?.markedToday).toBe(false);
  });

  it('reports whether today counts, so the UI knows if a tap marks or unmarks', () => {
    const [progress] = weeklyProgress([habit('h1', 'gym', 4)], [mark('h1', TODAY)], TODAY);

    expect(progress?.markedToday).toBe(true);
  });

  it('does not call a mark on another day today', () => {
    const [progress] = weeklyProgress([habit('h1', 'gym', 4)], [mark('h1', '2026-08-22')], TODAY);

    expect(progress?.markedDays).toBe(1);
    expect(progress?.markedToday).toBe(false);
  });

  it('returns one entry per habit, in order, even with no marks', () => {
    const progress = weeklyProgress([habit('h1', 'gym', 4), habit('h2', 'leer', 6)], [], TODAY);

    expect(progress.map((entry) => entry.habit.name)).toEqual(['gym', 'leer']);
    expect(progress.every((entry) => entry.markedDays === 0)).toBe(true);
  });
});

describe('isMarkedOn', () => {
  it('is false for an empty list and true for a matching day', () => {
    expect(isMarkedOn([], 'h1', TODAY)).toBe(false);
    expect(isMarkedOn([mark('h1', TODAY)], 'h1', TODAY)).toBe(true);
  });

  it('is false for another habit or another day', () => {
    const marks = [mark('h1', TODAY)];

    expect(isMarkedOn(marks, 'h2', TODAY)).toBe(false);
    expect(isMarkedOn(marks, 'h1', '2026-08-22')).toBe(false);
  });
});

describe('the five-habit cap (rule 4)', () => {
  it('canAddHabit is true under the cap and false at it', () => {
    expect(canAddHabit(0)).toBe(true);
    expect(canAddHabit(MAX_HABITS - 1)).toBe(true);
    expect(canAddHabit(MAX_HABITS)).toBe(false);
    expect(canAddHabit(MAX_HABITS + 1)).toBe(false);
  });

  it('activeHabitCount ignores archived habits: they do not take a slot', () => {
    const habits = [
      aHabit({ id: 'h1' }),
      aHabit({ id: 'h2', archivedAt: 1 }),
      aHabit({ id: 'h3' }),
    ];

    expect(activeHabitCount(habits)).toBe(2);
    expect(activeHabitCount([])).toBe(0);
  });
});

describe('isMarkedByHealth', () => {
  const walk = aHabit({ name: 'Caminar 10.000 pasos', countMode: 'verified', healthType: 'steps' });

  it('is Health’s only when connected, verified and recognisable', () => {
    expect(isMarkedByHealth(walk, true)).toBe(true);
    expect(isMarkedByHealth(walk, false)).toBe(false);
    expect(isMarkedByHealth({ ...walk, countMode: 'declared' }, true)).toBe(false);
  });

  it('leaves a verified habit nothing can recognise to a tap (ADR-0041)', () => {
    expect(isMarkedByHealth(aHabit({ name: 'Meditar', countMode: 'verified', healthType: null }), true)).toBe(false);
    expect(isMarkedByHealth(aHabit({ name: 'gym', countMode: 'verified', healthType: null }), true)).toBe(true);
  });
});
