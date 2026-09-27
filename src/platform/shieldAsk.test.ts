import { describe, expect, it } from 'vitest';

import { T0 } from '../domain/fixtures';
import { BREAK_EVERY_MS } from '../domain/session';
import { MINUTE } from '../domain/time';
import { breakPolicy, parseShieldEvents } from './shieldAsk';

const timing = { startedAt: T0, endsAt: T0 + 60 * MINUTE, open: false, breakUnlocksAt: T0 + 25 * MINUTE, deep: false };

describe('breakPolicy', () => {
  it('carries when the next break unlocks, the interval and the three lengths', () => {
    expect(breakPolicy(timing)).toEqual({
      breakUnlocksAt: T0 + 25 * MINUTE,
      breakEveryMs: BREAK_EVERY_MS,
      breakChoicesMs: [5 * MINUTE, 10 * MINUTE, 15 * MINUTE],
    });
  });

  it('gives deep no unlock and no interval, so the shield says so instead', () => {
    const deep = breakPolicy({ ...timing, deep: true });

    expect(deep.breakUnlocksAt).toBeNull();
    expect(deep.breakEveryMs).toBe(0);
  });
});

describe('parseShieldEvents', () => {
  it('turns the native queue into domain events on Android', () => {
    expect(
      parseShieldEvents([
        { kind: 'shield_hit', packageName: 'pkg', at: T0, lengthMs: null },
        { kind: 'unlock_granted', packageName: 'pkg', at: T0 + 1, lengthMs: 10 * MINUTE },
      ]),
    ).toEqual([
      { kind: 'shield_hit', platform: 'android', token: 'pkg', at: T0, lengthMs: null },
      { kind: 'unlock_granted', platform: 'android', token: 'pkg', at: T0 + 1, lengthMs: 10 * MINUTE },
    ]);
  });

  it('drops what it cannot trust, and keeps a length only on a break', () => {
    expect(
      parseShieldEvents([
        { kind: 'threshold', packageName: 'pkg', at: T0, lengthMs: null },
        { kind: 'shield_hit', packageName: '', at: T0, lengthMs: null },
        { kind: 'shield_hit', packageName: 'pkg', at: Number.NaN, lengthMs: null },
        { kind: 'backed_off', packageName: 'pkg', at: T0, lengthMs: 5 * MINUTE },
      ]),
    ).toEqual([{ kind: 'backed_off', platform: 'android', token: 'pkg', at: T0, lengthMs: null }]);
  });
});
