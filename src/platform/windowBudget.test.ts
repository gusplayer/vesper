import { describe, expect, it } from 'vitest';

import type { RoutineWindowPlan } from '../domain/routineWindows';
import { windowBudget, windowCost } from './windowBudget';

/** Tuesday 2026-09-15, 10:00 local (America/Bogota, pinned in vitest.config). */
const NOW = new Date(2026, 8, 15, 10, 0).getTime();

const ALL_DAYS = [true, true, true, true, true, true, true];
const WEEKDAYS = [true, true, true, true, true, false, false];

function plan(id: string, days: boolean[], startMinute: number): RoutineWindowPlan {
  return {
    id,
    startMinute,
    endMinute: startMinute + 60,
    capMinutes: 480,
    days,
    notBefore: 0,
    token: 'token',
    kind: 'block',
    shieldTitle: 'Vesper',
    shieldSubtitle: '',
    shieldButton: 'Cerrar',
  };
}

describe('windowCost', () => {
  it('is one name for a daily routine and one per weekday otherwise', () => {
    expect(windowCost(plan('a', ALL_DAYS, 9 * 60))).toBe(1);
    expect(windowCost(plan('b', WEEKDAYS, 9 * 60))).toBe(5);
    expect(windowCost(plan('c', [false, false, false, false, false, false, false], 9 * 60))).toBe(0);
  });
});

describe('windowBudget', () => {
  it('keeps everything when it fits', () => {
    const plans = [plan('a', WEEKDAYS, 9 * 60), plan('b', ALL_DAYS, 21 * 60)];
    const { kept, skipped } = windowBudget(plans, 16, NOW);
    expect(kept.map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(skipped).toEqual([]);
  });

  it('puts daily routines first, then the earliest next start', () => {
    const plans = [
      plan('late-weekdays', WEEKDAYS, 20 * 60),
      plan('soon-weekdays', WEEKDAYS, 11 * 60),
      plan('daily', ALL_DAYS, 23 * 60),
    ];
    const { kept, skipped } = windowBudget(plans, 6, NOW);
    expect(kept.map((p) => p.id)).toEqual(['daily', 'soon-weekdays']);
    expect(skipped.map(({ plan: p, cost }) => [p.id, cost])).toEqual([['late-weekdays', 5]]);
  });

  it('counts a window open right now as the soonest', () => {
    const plans = [plan('next', WEEKDAYS, 10 * 60 + 30), plan('open', WEEKDAYS, 9 * 60 + 30)];
    const { kept } = windowBudget(plans, 5, NOW);
    expect(kept.map((p) => p.id)).toEqual(['open']);
  });

  it('still fits a small routine after a large one was skipped', () => {
    const plans = [
      plan('five', WEEKDAYS, 9 * 60),
      plan('one', [false, false, true, false, false, false, false], 18 * 60),
    ];
    const { kept, skipped } = windowBudget(plans, 3, NOW);
    expect(kept.map((p) => p.id)).toEqual(['one']);
    expect(skipped.map(({ plan: p }) => p.id)).toEqual(['five']);
  });

  it('drops a routine with no day on without charging for it', () => {
    const none = plan('none', [false, false, false, false, false, false, false], 9 * 60);
    const { kept, skipped } = windowBudget([none, plan('a', ALL_DAYS, 9 * 60)], 1, NOW);
    expect(kept.map((p) => p.id)).toEqual(['a']);
    expect(skipped).toEqual([]);
  });
});
