import { describe, expect, it } from 'vitest';

import { HOUR, MINUTE } from '../../domain/time';
import type { WeekProgress } from '../../domain/week';
import { focusPillLabel, focusPillText } from './focusPill';

const TODAY = HOUR + 45 * MINUTE;

function week(overrides: Partial<WeekProgress> = {}): WeekProgress {
  return { focusMs: 6 * HOUR, targetMs: 15 * HOUR, met: false, daysLeft: 5, ...overrides };
}

describe('focusPillText', () => {
  it('reads today against the week when there is a goal', () => {
    expect(focusPillText(TODAY, week())).toBe('1h 45m hoy · 6h de 15h esta semana');
  });

  it('reports only today without a goal', () => {
    expect(focusPillText(TODAY, week({ targetMs: null }))).toBe('1h 45m enfocado hoy');
  });

  it('treats a stored zero target as no goal', () => {
    expect(focusPillText(0, week({ targetMs: 0, focusMs: 0 }))).toBe('0m enfocado hoy');
  });
});

describe('focusPillLabel', () => {
  it('spells the numbers out and ends with what a tap does', () => {
    expect(focusPillLabel(TODAY, week())).toBe(
      'Hoy: 1h 45m enfocado. Esta semana: 6h de 15h. Ver la actividad',
    );
    expect(focusPillLabel(TODAY, week({ targetMs: null }))).toBe(
      'Hoy: 1h 45m enfocado. Ver la actividad',
    );
  });
});
