import { describe, expect, it } from 'vitest';

import { T0 } from './fixtures';
import { breakTook, isQuiet, summarizeShield } from './shieldTally';
import { MINUTE } from './time';
import type { BreakRecord, ShieldEventRow } from './types';

const IG = 'com.instagram.android';
const TT = 'com.zhiliaoapp.musically';
const HOUR_LATER = 60 * MINUTE;

function event(overrides: Partial<ShieldEventRow> = {}): ShieldEventRow {
  return {
    id: `e-${Math.random()}`,
    kind: 'shield_hit',
    platform: 'android',
    token: IG,
    at: T0,
    lengthMs: null,
    sessionId: 's-1',
    ...overrides,
  };
}

function aBreak(overrides: Partial<BreakRecord> = {}): BreakRecord {
  return {
    id: `b-${Math.random()}`,
    sessionId: 's-1',
    startedAt: T0,
    endedAt: T0 + 10 * MINUTE,
    lengthMs: 10 * MINUTE,
    source: 'shield',
    token: IG,
    ...overrides,
  };
}

describe('summarizeShield', () => {
  it('counts every shield on Android as an attempt, and the taps on top of it', () => {
    const summary = summarizeShield(
      [
        event(),
        event({ kind: 'backed_off' }),
        event(),
        event({ kind: 'unlock_granted', lengthMs: 10 * MINUTE }),
        event({ token: TT }),
      ],
      [aBreak()],
      T0 + HOUR_LATER,
    );

    expect(summary.attempts).toBe(3);
    expect(summary.backs).toBe(1);
    expect(summary.breaks).toBe(1);
    expect(summary.breakMs).toBe(10 * MINUTE);
    expect(summary.floor).toBe(false);
    expect(summary.byApp).toEqual([
      { token: IG, attempts: 2, backs: 1, breaks: 1, breakMs: 10 * MINUTE },
      { token: TT, attempts: 1, backs: 0, breaks: 0, breakMs: 0 },
    ]);
  });

  it('counts only taps on iOS, and says the total is a floor', () => {
    const summary = summarizeShield(
      [
        event({ platform: 'ios', kind: 'backed_off', token: 'tok-a' }),
        event({ platform: 'ios', kind: 'unlock_granted', token: 'tok-a', lengthMs: 5 * MINUTE }),
      ],
      [],
      T0,
    );

    expect(summary.attempts).toBe(2);
    expect(summary.floor).toBe(true);
  });

  it("leaves the session's own breaks out: they are not the shield's", () => {
    const summary = summarizeShield([], [aBreak({ source: 'session', token: null, lengthMs: 15 * MINUTE, endedAt: T0 + 15 * MINUTE })], T0);

    expect(summary.breaks).toBe(0);
    expect(summary.breakMs).toBe(0);
    expect(summary.byApp).toEqual([]);
  });

  it('measures a running break up to now, never past its length', () => {
    const running = aBreak({ endedAt: null, lengthMs: 10 * MINUTE });

    expect(breakTook(running, T0 + 4 * MINUTE)).toBe(4 * MINUTE);
    expect(breakTook(running, T0 + 30 * MINUTE)).toBe(10 * MINUTE);
    expect(breakTook(aBreak({ endedAt: T0 + 3 * MINUTE }), T0 + 30 * MINUTE)).toBe(3 * MINUTE);
  });

  it('orders apps by attempts, then by what their breaks took', () => {
    const summary = summarizeShield(
      [event({ token: 'b' }), event({ token: 'a' })],
      [aBreak({ token: 'b', endedAt: T0 + 5 * MINUTE })],
      T0,
    );

    expect(summary.byApp.map((line) => line.token)).toEqual(['b', 'a']);
  });

  it('is quiet with no attempt and no break', () => {
    expect(isQuiet(summarizeShield([], [], T0))).toBe(true);
    expect(isQuiet(summarizeShield([event()], [], T0))).toBe(false);
  });
});
