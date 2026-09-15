import { describe, expect, it } from 'vitest';

import { aDoneSession, anActivity, aRunningSession, T0 } from './fixtures';
import {
  canGiveUp,
  close,
  createSession,
  DEFAULT_DEPTH,
  DEFAULT_PLANNED_MS,
  elapsed,
  expire,
  interrupt,
  isDepth,
  isDue,
  isValidPlannedMs,
  remaining,
  resolveSessionConfig,
  served,
  sessionProgress,
  type SessionConfig,
} from './session';
import { HOUR, MINUTE } from './time';

const config: SessionConfig = {
  activityId: 'act-1',
  plannedMs: 25 * MINUTE,
  depth: 'soft',
  blockProfile: null,
};

/** A running session with the 25 minute config above, started at T0. */
function running(overrides: Partial<SessionConfig> = {}) {
  return createSession('s-1', { ...config, ...overrides }, T0);
}

describe('isDepth', () => {
  it('accepts the three depths', () => {
    expect(isDepth('soft')).toBe(true);
    expect(isDepth('firm')).toBe(true);
    expect(isDepth('deep')).toBe(true);
  });

  it('rejects other strings, numbers and null', () => {
    expect(isDepth('hard')).toBe(false);
    expect(isDepth(1)).toBe(false);
    expect(isDepth(null)).toBe(false);
    expect(isDepth(undefined)).toBe(false);
  });
});

describe('isValidPlannedMs', () => {
  it('accepts whole minutes from 1 to 240', () => {
    expect(isValidPlannedMs(MINUTE)).toBe(true);
    expect(isValidPlannedMs(240 * MINUTE)).toBe(true);
  });

  it('rejects zero and anything past 240 minutes', () => {
    expect(isValidPlannedMs(0)).toBe(false);
    expect(isValidPlannedMs(241 * MINUTE)).toBe(false);
  });

  it('rejects fractional minutes and non-numbers', () => {
    expect(isValidPlannedMs(1.5 * MINUTE)).toBe(false);
    expect(isValidPlannedMs(String(MINUTE))).toBe(false);
  });
});

describe('resolveSessionConfig', () => {
  const work = anActivity();
  const read = anActivity({ id: 'activity-read', key: 'lectura', label: 'lectura' });
  const activities = [work, read];
  const fallback: SessionConfig = {
    activityId: work.id,
    plannedMs: DEFAULT_PLANNED_MS,
    depth: DEFAULT_DEPTH,
    blockProfile: null,
  };

  it('is null without activities', () => {
    expect(resolveSessionConfig(null, [])).toBeNull();
  });

  it('defaults to 25 minutes of the first activity, soft, when nothing is stored', () => {
    expect(resolveSessionConfig(null, activities)).toStrictEqual(fallback);
    expect(DEFAULT_PLANNED_MS).toBe(25 * MINUTE);
  });

  it('defaults when the stored activity no longer exists', () => {
    const stored = { activityId: 'activity-gone', plannedMs: 50 * MINUTE, depth: 'firm' };

    expect(resolveSessionConfig(stored, activities)).toStrictEqual(fallback);
  });

  it('defaults on a bad depth', () => {
    const stored = { activityId: read.id, plannedMs: 50 * MINUTE, depth: 'hard' };

    expect(resolveSessionConfig(stored, activities)).toStrictEqual(fallback);
  });

  it('defaults on a bad duration', () => {
    for (const plannedMs of [0, String(50 * MINUTE), 300 * MINUTE]) {
      const stored = { activityId: read.id, plannedMs, depth: 'firm' };

      expect(resolveSessionConfig(stored, activities)).toStrictEqual(fallback);
    }
  });

  it('returns a valid stored config exactly, with blockProfile forced null', () => {
    const stored = {
      activityId: read.id,
      plannedMs: 50 * MINUTE,
      depth: 'firm',
      blockProfile: 'strict',
    };

    expect(resolveSessionConfig(stored, activities)).toStrictEqual({
      activityId: read.id,
      plannedMs: 50 * MINUTE,
      depth: 'firm',
      blockProfile: null,
    });
  });

  it('ignores extra keys', () => {
    const stored = { activityId: read.id, plannedMs: 50 * MINUTE, depth: 'deep', legacy: true };

    expect(resolveSessionConfig(stored, activities)).toStrictEqual({
      activityId: read.id,
      plannedMs: 50 * MINUTE,
      depth: 'deep',
      blockProfile: null,
    });
  });
});

describe('createSession', () => {
  it('starts running with nothing served', () => {
    const session = running();

    expect(session.outcome).toBe('running');
    expect(session.actualMs).toBe(0);
    expect(session.startedAt).toBe(T0);
    expect(session.endedAt).toBeNull();
    expect(session.interruptions).toBe(0);
  });

  it('copies the config and leaves the intention empty', () => {
    const session = createSession('s-1', { ...config, depth: 'firm' }, T0);

    expect(session.activityId).toBe(config.activityId);
    expect(session.plannedMs).toBe(config.plannedMs);
    expect(session.depth).toBe('firm');
    expect(session.blockProfile).toBe(config.blockProfile);
    expect(session.intention).toBeNull();
  });

  it('keeps blockProfile null in phase 1', () => {
    expect(running().blockProfile).toBeNull();
  });
});

describe('elapsed', () => {
  it('is now minus startedAt, not a sum of ticks', () => {
    expect(elapsed(running(), T0 + 10 * MINUTE)).toBe(10 * MINUTE);
  });

  it('is zero at startedAt and plannedMs at the planned end', () => {
    expect(elapsed(running(), T0)).toBe(0);
    expect(elapsed(running(), T0 + config.plannedMs)).toBe(config.plannedMs);
  });

  it('survives a long time in background by clamping to plannedMs', () => {
    expect(elapsed(running(), T0 + 5 * HOUR)).toBe(config.plannedMs);
  });

  it('never goes negative if the clock moves backwards', () => {
    expect(elapsed(running(), T0 - MINUTE)).toBe(0);
  });
});

describe('remaining and isDue', () => {
  it('counts down and reaches zero exactly at the planned end', () => {
    const session = running();

    expect(remaining(session, T0 + 5 * MINUTE)).toBe(20 * MINUTE);
    expect(remaining(session, T0 + config.plannedMs)).toBe(0);
  });

  it('never goes negative past the end', () => {
    expect(remaining(running(), T0 + 2 * config.plannedMs)).toBe(0);
  });

  it('is due at the planned end, not one tick later', () => {
    const session = running();

    expect(isDue(session, T0 + config.plannedMs - 1)).toBe(false);
    expect(isDue(session, T0 + config.plannedMs)).toBe(true);
  });

  it('is not due when the clock moved back', () => {
    expect(isDue(running(), T0 - MINUTE)).toBe(false);
  });
});

describe('sessionProgress', () => {
  it('goes from 0 to 1 and stays there', () => {
    const session = running();

    expect(sessionProgress(session, T0)).toBe(0);
    expect(sessionProgress(session, T0 + config.plannedMs / 2)).toBe(0.5);
    expect(sessionProgress(session, T0 + 2 * config.plannedMs)).toBe(1);
  });

  it('is 1 for a zero-length session, never NaN', () => {
    expect(sessionProgress(aRunningSession({ plannedMs: 0 }), T0)).toBe(1);
  });
});

describe('served', () => {
  it('is the elapsed time while running', () => {
    expect(served(aRunningSession(), T0 + 20 * MINUTE)).toBe(20 * MINUTE);
  });

  it('is actualMs once closed, whatever the clock says', () => {
    expect(served(aDoneSession(HOUR), T0 + 10 * HOUR)).toBe(HOUR);
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
    const closed = close(running(), T0 + config.plannedMs + 3 * MINUTE, 'completed');

    expect(closed.outcome).toBe('completed');
    expect(closed.actualMs).toBe(config.plannedMs);
    expect(closed.endedAt).toBe(T0 + config.plannedMs + 3 * MINUTE);
  });

  it('completed before the end still credits plannedMs', () => {
    // Pins current behaviour: 'completed' means the timer ran out, so the caller is
    // trusted and actualMs is plannedMs even if `now` says otherwise.
    const closed = close(running(), T0 + 5 * MINUTE, 'completed');

    expect(closed.actualMs).toBe(config.plannedMs);
  });

  it('cancelled credits only what was served, and keeps the reason', () => {
    const closed = close(running({ depth: 'firm' }), T0 + 4 * MINUTE, 'cancelled', {
      exitReason: 'me llamaron',
    });

    expect(closed.actualMs).toBe(4 * MINUTE);
    expect(closed.exitReason).toBe('me llamaron');
  });

  it('keeps a prior reason when the option is null', () => {
    const session = aRunningSession({ depth: 'firm', exitReason: 'antes' });

    expect(close(session, T0 + MINUTE, 'cancelled', { exitReason: null }).exitReason).toBe('antes');
    expect(close(session, T0 + MINUTE, 'cancelled').exitReason).toBe('antes');
  });

  it('keeps the interruptions', () => {
    const session = aRunningSession({ depth: 'firm', interruptions: 2 });

    expect(close(session, T0 + MINUTE, 'cancelled').interruptions).toBe(2);
  });

  it('expired credits what was served, capped at planned', () => {
    const closed = close(running(), T0 + 90 * MINUTE, 'expired');

    expect(closed.outcome).toBe('expired');
    expect(closed.actualMs).toBe(config.plannedMs);
  });

  it('never exceeds plannedMs, whatever the outcome', () => {
    const session = running();

    for (const outcome of ['completed', 'cancelled', 'expired'] as const) {
      expect(close(session, T0 + 10 * HOUR, outcome).actualMs).toBeLessThanOrEqual(
        config.plannedMs,
      );
    }
  });

  it('refuses to close a session twice', () => {
    const closed = close(running(), T0 + MINUTE, 'cancelled');

    expect(() => close(closed, T0 + 2 * MINUTE, 'completed')).toThrow(/already cancelled/);
  });

  it('throws for any session that is not running', () => {
    for (const outcome of ['completed', 'expired', 'cancelled'] as const) {
      const session = aRunningSession({ outcome });

      expect(() => close(session, T0 + MINUTE, 'completed')).toThrow(`already ${outcome}`);
    }
  });
});

describe('expire', () => {
  it('ends at the planned end, not when the app noticed', () => {
    const session = aRunningSession();
    const expired = expire(session);

    expect(expired.outcome).toBe('expired');
    expect(expired.endedAt).toBe(session.startedAt + session.plannedMs);
    expect(expired.actualMs).toBe(session.plannedMs);
  });
});

describe('interrupt', () => {
  it('counts leaving the app in firm and deep', () => {
    const firm = running({ depth: 'firm' });
    const deep = running({ depth: 'deep' });

    expect(interrupt(firm).interruptions).toBe(1);
    expect(interrupt(interrupt(firm)).interruptions).toBe(2);
    expect(interrupt(deep).interruptions).toBe(1);
  });

  it('ignores soft, where leaving is not a betrayal', () => {
    expect(interrupt(running()).interruptions).toBe(0);
  });

  it('returns the same object when nothing changes, so callers can skip the write', () => {
    const soft = running();
    const closed = aDoneSession(HOUR, T0, { depth: 'firm' });

    expect(interrupt(soft)).toBe(soft);
    expect(interrupt(closed)).toBe(closed);
  });

  it('never cancels the session', () => {
    expect(interrupt(running({ depth: 'deep' })).outcome).toBe('running');
  });
});
