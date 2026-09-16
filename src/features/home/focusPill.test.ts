import { describe, expect, it } from 'vitest';

import { HOUR, MINUTE } from '../../domain/time';
import type { WeekProgress } from '../../domain/week';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { focusPillLabel, focusPillText } from './focusPill';

const TODAY = HOUR + 45 * MINUTE;

function week(overrides: Partial<WeekProgress> = {}): WeekProgress {
  return { focusMs: 6 * HOUR, targetMs: 15 * HOUR, met: false, daysLeft: 5, ...overrides };
}

describe('focusPillText', () => {
  it('reads today against the week when there is a goal', () => {
    expect(focusPillText(TODAY, week(), es)).toBe('1h 45m hoy · 6h de 15h esta semana');
    expect(focusPillText(TODAY, week(), en)).toBe('1h 45m today · 6h of 15h this week');
  });

  it('reports only today without a goal', () => {
    expect(focusPillText(TODAY, week({ targetMs: null }), es)).toBe('1h 45m enfocado hoy');
    expect(focusPillText(TODAY, week({ targetMs: null }), en)).toBe('1h 45m focused today');
  });

  it('treats a stored zero target as no goal', () => {
    expect(focusPillText(0, week({ targetMs: 0, focusMs: 0 }), es)).toBe('0m enfocado hoy');
  });
});

describe('focusPillLabel', () => {
  it('spells the numbers out and ends with what a tap does', () => {
    expect(focusPillLabel(TODAY, week(), es)).toBe(
      'Hoy: 1h 45m enfocado. Esta semana: 6h de 15h. Ver la actividad',
    );
    expect(focusPillLabel(TODAY, week({ targetMs: null }), es)).toBe(
      'Hoy: 1h 45m enfocado. Ver la actividad',
    );
  });

  it('reads the same in English', () => {
    expect(focusPillLabel(TODAY, week(), en)).toBe(
      'Today: 1h 45m focused. This week: 6h of 15h. See activity',
    );
    expect(focusPillLabel(TODAY, week({ targetMs: null }), en)).toBe('Today: 1h 45m focused. See activity');
  });
});
