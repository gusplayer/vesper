import { describe, expect, it } from 'vitest';

import {
  canGiveUp,
  close,
  createSession,
  elapsed,
  interrupt,
  isDue,
  remaining,
  type SessionConfig,
} from './session';

const MINUTE = 60_000;
const T0 = 1_700_000_000_000;

const config: SessionConfig = {
  activityId: 'act-1',
  plannedMs: 25 * MINUTE,
  depth: 'soft',
  blockProfile: null,
};

describe('createSession', () => {
  it('starts running with nothing served', () => {
    const session = createSession('s-1', config, T0);

    expect(session.outcome).toBe('running');
    expect(session.actualMs).toBe(0);
    expect(session.startedAt).toBe(T0);
    expect(session.endedAt).toBeNull();
    expect(session.interruptions).toBe(0);
  });

  it('keeps blockProfile null in phase 1', () => {
    expect(createSession('s-1', config, T0).blockProfile).toBeNull();
  });
});

describe('elapsed', () => {
  it('is now minus startedAt, not a sum of ticks', () => {
    const session = createSession('s-1', config, T0);

    expect(elapsed(session, T0 + 10 * MINUTE)).toBe(10 * MINUTE);
  });

  it('survives a long time in background by clamping to plannedMs', () => {
    const session = createSession('s-1', config, T0);

    expect(elapsed(session, T0 + 5 * 60 * MINUTE)).toBe(config.plannedMs);
  });

  it('never goes negative if the clock moves backwards', () => {
    const session = createSession('s-1', config, T0);

    expect(elapsed(session, T0 - MINUTE)).toBe(0);
  });
});

describe('remaining and isDue', () => {
  it('counts down and reaches zero exactly at the planned end', () => {
    const session = createSession('s-1', config, T0);

    expect(remaining(session, T0 + 5 * MINUTE)).toBe(20 * MINUTE);
    expect(remaining(session, T0 + config.plannedMs)).toBe(0);
  });

  it('is due at the planned end, not one tick later', () => {
    const session = createSession('s-1', config, T0);

    expect(isDue(session, T0 + config.plannedMs - 1)).toBe(false);
    expect(isDue(session, T0 + config.plannedMs)).toBe(true);
  });
});

describe('canGiveUp', () => {
  it('is false only in deep', () => {
    expect(canGiveUp('soft')).toBe(true);
    expect(canGiveUp('firm')).toBe(true);
    expect(canGiveUp('deep')).toBe(false);
  });
});

describe('close', () => {
  it('completed credits the full planned time', () => {
    const session = createSession('s-1', config, T0);
    const closed = close(session, T0 + config.plannedMs + 3 * MINUTE, 'completed');

    expect(closed.outcome).toBe('completed');
    expect(closed.actualMs).toBe(config.plannedMs);
    expect(closed.endedAt).toBe(T0 + config.plannedMs + 3 * MINUTE);
  });

  it('cancelled credits only what was served, and keeps the reason', () => {
    const session = createSession('s-1', { ...config, depth: 'firm' }, T0);
    const closed = close(session, T0 + 4 * MINUTE, 'cancelled', {
      exitReason: 'me llamaron',
    });

    expect(closed.actualMs).toBe(4 * MINUTE);
    expect(closed.exitReason).toBe('me llamaron');
  });

  it('expired credits what was served, capped at planned', () => {
    const session = createSession('s-1', config, T0);
    const closed = close(session, T0 + 90 * MINUTE, 'expired');

    expect(closed.outcome).toBe('expired');
    expect(closed.actualMs).toBe(config.plannedMs);
  });

  it('never exceeds plannedMs, whatever the outcome', () => {
    const session = createSession('s-1', config, T0);

    for (const outcome of ['completed', 'cancelled', 'expired'] as const) {
      expect(close(session, T0 + 10 * 60 * MINUTE, outcome).actualMs).toBeLessThanOrEqual(
        config.plannedMs,
      );
    }
  });

  it('refuses to close a session twice', () => {
    const closed = close(createSession('s-1', config, T0), T0 + MINUTE, 'cancelled');

    expect(() => close(closed, T0 + 2 * MINUTE, 'completed')).toThrow(/already cancelled/);
  });
});

describe('interrupt', () => {
  it('counts leaving the app in firm and deep', () => {
    const firm = createSession('s-1', { ...config, depth: 'firm' }, T0);

    expect(interrupt(firm).interruptions).toBe(1);
    expect(interrupt(interrupt(firm)).interruptions).toBe(2);
  });

  it('ignores soft, where leaving is not a betrayal', () => {
    expect(interrupt(createSession('s-1', config, T0)).interruptions).toBe(0);
  });

  it('never cancels the session', () => {
    const deep = createSession('s-1', { ...config, depth: 'deep' }, T0);

    expect(interrupt(deep).outcome).toBe('running');
  });
});
