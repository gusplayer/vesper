import { describe, expect, it } from 'vitest';

import { refilledOn, spend, type EmergencyBudget } from './emergency';

const full: EmergencyBudget = { left: 5, total: 5, monthKey: '2026-09' };
const spent: EmergencyBudget = { left: 0, total: 5, monthKey: '2026-09' };

// Wednesday 2026-09-23, and the first of the next month.
const SEPTEMBER = new Date(2026, 8, 23, 10).getTime();
const OCTOBER = new Date(2026, 9, 1, 0, 1).getTime();

describe('refilledOn', () => {
  it('leaves this month alone', () => {
    expect(refilledOn(full, '2026-09-23')).toBe(full);
    expect(refilledOn(spent, '2026-09-30')).toBe(spent);
  });

  it('refills on the first day of the next month', () => {
    expect(refilledOn(spent, '2026-10-01')).toEqual({ left: 5, total: 5, monthKey: '2026-10' });
  });

  it('refills a database written before the month was recorded', () => {
    expect(refilledOn({ left: 0, total: 5, monthKey: null }, '2026-09-23')).toEqual({
      left: 5,
      total: 5,
      monthKey: '2026-09',
    });
  });

  it('does not hand out more by winding the clock back', () => {
    // Spent in September, clock moved to August: the month is not September, so it
    // refills — and records August, so going back to September refills once more.
    // What it must never do is raise the count inside a month already spent.
    const august = refilledOn(spent, '2026-08-15');
    expect(august.monthKey).toBe('2026-08');
    expect(refilledOn(august, '2026-08-20')).toBe(august);
  });
});

describe('spend', () => {
  it('counts down inside the month and stops at zero', () => {
    const once = spend(full, SEPTEMBER);
    expect(once.left).toBe(4);
    expect(spend({ ...full, left: 0 }, SEPTEMBER).left).toBe(0);
  });

  it('refills first when the month turned over, then spends', () => {
    expect(spend(spent, OCTOBER)).toEqual({ left: 4, total: 5, monthKey: '2026-10' });
  });
});
