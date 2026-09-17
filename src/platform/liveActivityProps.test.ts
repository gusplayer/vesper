import { describe, expect, it } from 'vitest';

import { focusActivityProps, focusInputFor, statusTextFor } from './liveActivityProps';
import { BREAK_MS, createSession, OPEN_SESSION_CAP_MS, startBreak, type SessionConfig } from '../domain/session';
import { MINUTE } from '../domain/time';
import type { Session } from '../domain/types';
import { session as en } from '../i18n/en/session';
import { session as es } from '../i18n/es/session';

const T0 = new Date(2026, 8, 17, 9, 0).getTime();

function running(overrides: Partial<SessionConfig> = {}): Session {
  return createSession('s1', { activityId: 'm1', plannedMs: 25 * MINUTE, depth: 'soft', blockProfile: null, ...overrides }, T0);
}

describe('focusInputFor', () => {
  it('counts a planned session down from its start to its planned end', () => {
    expect(focusInputFor(running(), 'Trabajo')).toEqual({
      modeName: 'Trabajo',
      phase: 'focus',
      startedAt: T0,
      endsAt: T0 + 25 * MINUTE,
    });
  });

  it('counts an open session up from its start', () => {
    const input = focusInputFor(running({ open: true }), 'Trabajo');
    expect(input.phase).toBe('open');
    expect(input.startedAt).toBe(T0);
    expect(input.endsAt).toBe(T0 + OPEN_SESSION_CAP_MS);
  });

  it('counts a break down from its start to its end, not the session', () => {
    const paused = startBreak(running({ plannedMs: 50 * MINUTE }), T0 + 26 * MINUTE);
    expect(focusInputFor(paused, 'Trabajo')).toEqual({
      modeName: 'Trabajo',
      phase: 'break',
      startedAt: T0 + 26 * MINUTE,
      endsAt: T0 + 26 * MINUTE + BREAK_MS,
    });
  });

  it('pushes the planned end back by the breaks already taken', () => {
    const withBreak = { ...running({ plannedMs: 50 * MINUTE }), breakMs: 10 * MINUTE };
    expect(focusInputFor(withBreak, 'Trabajo').endsAt).toBe(T0 + 60 * MINUTE);
  });
});

describe('focusActivityProps', () => {
  it('sends the interval, the phase and the phase words, never a clock string', () => {
    const props = focusActivityProps(focusInputFor(running(), 'Trabajo'), es.liveActivity);
    expect(props).toEqual({
      modeName: 'Trabajo',
      phase: 'focus',
      startedAt: T0,
      endsAt: T0 + 25 * MINUTE,
      statusText: 'Enfocado',
    });
    expect(JSON.stringify(props)).not.toMatch(/\d+m\b/);
  });

  it('names each phase in both languages', () => {
    expect(statusTextFor('focus', es.liveActivity)).toBe('Enfocado');
    expect(statusTextFor('open', es.liveActivity)).toBe('Enfocado · sin límite');
    expect(statusTextFor('break', es.liveActivity)).toBe('Pausa');
    expect(statusTextFor('focus', en.liveActivity)).toBe('Focused');
    expect(statusTextFor('open', en.liveActivity)).toBe('Focused · no limit');
    expect(statusTextFor('break', en.liveActivity)).toBe('Break');
  });
});
