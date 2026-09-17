import { describe, expect, it } from 'vitest';

import { aRunningSession } from '../../domain/fixtures';
import { OPEN_SESSION_CAP_MS } from '../../domain/session';
import { HOUR, MINUTE } from '../../domain/time';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { focusPillLabel, focusPillText, focusSessionText } from './focusPill';

const TODAY = HOUR + 45 * MINUTE;

describe('focusPillText', () => {
  it('reports today and nothing else', () => {
    expect(focusPillText(TODAY, es)).toBe('1h 45m enfocado hoy');
    expect(focusPillText(TODAY, en)).toBe('1h 45m focused today');
  });

  it('says zero on an empty day', () => {
    expect(focusPillText(0, es)).toBe('0m enfocado hoy');
  });
});

describe('focusPillLabel', () => {
  it('spells the number out and ends with what a tap does', () => {
    expect(focusPillLabel(TODAY, es)).toBe('Hoy: 1h 45m enfocado. Ver la actividad');
    expect(focusPillLabel(TODAY, en)).toBe('Today: 1h 45m focused. See activity');
  });
});

describe('focusSessionText', () => {
  it('reads elapsed against planned', () => {
    const startedAt = new Date(2026, 8, 16, 9).getTime();
    const session = aRunningSession({ startedAt, plannedMs: 25 * MINUTE });
    const now = startedAt + 12 * MINUTE;
    expect(focusSessionText(session, now, es)).toBe('En sesión · 12m de 25m');
    expect(focusSessionText(session, now, en)).toBe('In session · 12m of 25m');
  });

  it('says no limit for an open session', () => {
    const startedAt = new Date(2026, 8, 16, 9).getTime();
    const session = aRunningSession({ startedAt, open: true, plannedMs: OPEN_SESSION_CAP_MS });
    expect(focusSessionText(session, startedAt + 72 * MINUTE, es)).toBe('En sesión · 1h 12m · sin límite');
    expect(focusSessionText(session, startedAt + 72 * MINUTE, en)).toBe('In session · 1h 12m · no limit');
  });
});
