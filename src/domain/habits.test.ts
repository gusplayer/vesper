import { describe, expect, it } from 'vitest';

import { aHabit, aMark } from './fixtures';
import {
  DEFAULT_HABIT_TARGET,
  HABIT_TARGET_OPTIONS,
  healthTypeFor,
  isMarkedOn,
  weeklyProgress,
} from './habits';
import type { Habit, HabitMark } from './types';

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

  it('is null for a name with no hint', () => {
    expect(healthTypeFor('leer')).toBeNull();
  });

  it('lets the first hint win when several match', () => {
    // 'caminar' says steps, 'gym' says workout; workout is listed first.
    expect(healthTypeFor('caminar al gym')).toBe('workout');
  });
});

describe('targets', () => {
  it('offers 2, 4 and 6, and defaults to one of them', () => {
    expect(HABIT_TARGET_OPTIONS).toEqual([2, 4, 6]);
    expect((HABIT_TARGET_OPTIONS as ReadonlyArray<number>).includes(DEFAULT_HABIT_TARGET)).toBe(
      true,
    );
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
