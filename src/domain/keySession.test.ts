import { describe, expect, it } from 'vitest';

import {
  canGiveUp,
  closeDue,
  createSession,
  dueOutcome,
  isDue,
  isKeyLocked,
  OPEN_SESSION_CAP_MS,
  settle,
} from './session';
import { HOUR } from './time';

/**
 * A session the key opened (ADR-0035). The key does not add a depth: it adds a way out
 * of the deepest one. These tests hold the two claims the ADR makes about that.
 */

const T0 = new Date(2026, 8, 22, 21, 0, 0).getTime();

function config(depth: 'soft' | 'firm' | 'deep', open: boolean) {
  return { activityId: 'activity-work', plannedMs: HOUR, depth, blockProfile: null, open };
}

describe('a session a key opened', () => {
  it('runs deep whatever the mode says, so no tap ends it', () => {
    for (const depth of ['soft', 'firm', 'deep'] as const) {
      const session = createSession('s-1', { ...config(depth, false), key: { id: 'k1', step: 10 } }, T0);
      expect(session.depth).toBe('deep');
      expect(canGiveUp(session.depth)).toBe(false);
      expect(isKeyLocked(session)).toBe(true);
    }
  });

  it('stays deep although it is open, unlike a plain deep session', () => {
    // Without a key, deep and open would have no way out, so the domain downgrades it.
    expect(createSession('s-2', config('deep', true), T0).depth).toBe('firm');
    // With a key there is a way out, so the downgrade does not apply.
    const keyed = createSession('s-3', { ...config('deep', true), key: { id: 'k1', step: 10 } }, T0);
    expect(keyed.depth).toBe('deep');
    expect(keyed.open).toBe(true);
  });

  it('remembers which key and which step opened it', () => {
    const session = createSession('s-4', { ...config('soft', false), key: { id: 'k7', step: 42 } }, T0);
    expect(session.keyId).toBe('k7');
    expect(session.keyStep).toBe(42);
  });

  it('is not key-locked without one, and keeps the mode depth', () => {
    const session = createSession('s-5', config('soft', false), T0);
    expect(isKeyLocked(session)).toBe(false);
    expect(session.keyId).toBeNull();
    expect(session.keyStep).toBeNull();
    expect(session.depth).toBe('soft');
  });
});

describe('a key session has no timer of its own', () => {
  const key = { id: 'k1', step: 10 };

  it('is open however it was asked for, so the hour on the picker does not end it', () => {
    const plain = createSession('s-1', config('firm', false), T0);
    const keyed = createSession('s-2', { ...config('firm', false), key }, T0);
    const afterTheHour = T0 + HOUR + 1;

    expect(plain.open).toBe(false);
    expect(isDue(plain, afterTheHour)).toBe(true);
    // The cheapest attack on the lock was winding the clock past the planned end and
    // coming back to a session the app had closed by itself. There is no such end now.
    expect(keyed.open).toBe(true);
    expect(keyed.plannedMs).toBe(OPEN_SESSION_CAP_MS);
    expect(isDue(keyed, afterTheHour)).toBe(false);
    expect(isDue(keyed, T0 + 11 * HOUR)).toBe(false);
  });

  it('still ends at the 12 h cap, and expires rather than completing there', () => {
    const keyed = createSession('s-3', { ...config('firm', false), key }, T0);
    const atCap = T0 + OPEN_SESSION_CAP_MS;

    expect(isDue(keyed, atCap)).toBe(true);
    expect(dueOutcome(keyed)).toBe('expired');
    expect(closeDue(keyed).endedAt).toBe(atCap);
  });

  it('settle leaves it running for hours and closes it at the cap', () => {
    const keyed = createSession('s-4', { ...config('firm', false), key }, T0);
    expect(settle(keyed, T0 + 5 * HOUR).outcome).toBe('running');
    expect(settle(keyed, T0 + 13 * HOUR).outcome).toBe('expired');
  });
});
