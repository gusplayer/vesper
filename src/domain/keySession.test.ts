import { describe, expect, it } from 'vitest';

import { canGiveUp, createSession, isKeyLocked } from './session';
import { HOUR } from './time';

/**
 * A session the key opened (ADR-0034). The key does not add a depth: it adds a way out
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

  it('stays deep when it is open, unlike a plain deep session', () => {
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
