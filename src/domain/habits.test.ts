import { describe, expect, it } from 'vitest';

import { isMarkedOn, weeklyProgress } from './habits';
import type { Habit, HabitMark } from './types';

function habit(id: string, name: string, weeklyTarget: number): Habit {
  return {
    id,
    name,
    activityId: null,
    weeklyTarget,
    countMode: 'declared',
    healthType: null,
    archivedAt: null,
    createdAt: 0,
  };
}

function mark(habitId: string, dayKey: string, source: HabitMark['source'] = 'manual'): HabitMark {
  return {
    id: `${habitId}-${dayKey}-${source}`,
    habitId,
    dayKey,
    source,
    sourceRef: source === 'manual' ? '' : `ref-${dayKey}`,
    durationMs: null,
    markedAt: 0,
  };
}

const TODAY = '2026-08-23';

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

  it('ignores marks belonging to another habit', () => {
    const [progress] = weeklyProgress([habit('h1', 'gym', 4)], [mark('h2', TODAY)], TODAY);

    expect(progress?.markedDays).toBe(0);
    expect(progress?.markedToday).toBe(false);
  });

  it('reports whether today counts, so the UI knows if a tap marks or unmarks', () => {
    const [progress] = weeklyProgress([habit('h1', 'gym', 4)], [mark('h1', TODAY)], TODAY);

    expect(progress?.markedToday).toBe(true);
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
});
