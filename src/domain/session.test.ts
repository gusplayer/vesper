import { describe, expect, it } from 'vitest';

import { aDoneSession, anActivity, aRunningSession, T0 } from './fixtures';
import {
  allowsBreaks,
  breakAvailableIn,
  breakEndsAt,
  canGiveUp,
  canTakeBreak,
  close,
  createSession,
  DEFAULT_DEPTH,
  DEFAULT_PLANNED_MS,
  dueOutcome,
  effectiveDepth,
  elapsed,
  endBreak,
  expire,
  interrupt,
  isBreakOver,
  isDepth,
  isDue,
  isValidPlannedMs,
  OPEN_SESSION_CAP_MS,
  plannedEndAt,
  remaining,
  resolveSessionConfig,
  served,
  sessionProgress,
  settle,
  startBreak,
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

describe('open sessions (ADR-0022)', () => {
  it('takes the cap as its plan and never runs deep', () => {
    const session = running({ open: true, depth: 'deep', plannedMs: 5 * MINUTE });

    expect(session.open).toBe(true);
    expect(session.plannedMs).toBe(OPEN_SESSION_CAP_MS);
    expect(session.depth).toBe('firm');
    expect(running({ open: true, depth: 'soft' }).depth).toBe('soft');
    expect(effectiveDepth('deep', false)).toBe('deep');
  });

  it('is due at the cap and expires rather than completes', () => {
    const session = running({ open: true });

    expect(isDue(session, T0 + OPEN_SESSION_CAP_MS - 1)).toBe(false);
    expect(isDue(session, T0 + OPEN_SESSION_CAP_MS)).toBe(true);
    expect(dueOutcome(session)).toBe('expired');
    expect(dueOutcome(running())).toBe('completed');
  });
});

describe('breaks (ADR-0022)', () => {
  const at = (minutes: number) => T0 + minutes * MINUTE;

  it('unlock after 25 minutes of focus, never in deep', () => {
    const session = running({ plannedMs: HOUR });

    expect(canTakeBreak(session, at(24))).toBe(false);
    expect(breakAvailableIn(session, at(20))).toBe(5 * MINUTE);
    expect(canTakeBreak(session, at(25))).toBe(true);
    expect(allowsBreaks('deep')).toBe(false);
    expect(canTakeBreak(running({ plannedMs: HOUR, depth: 'deep' }), at(30))).toBe(false);
    expect(() => startBreak(session, at(10))).toThrow();
  });

  it('freeze the clock and end by themselves after 15 minutes', () => {
    const session = startBreak(running({ plannedMs: HOUR }), at(30));

    expect(elapsed(session, at(40))).toBe(30 * MINUTE);
    expect(breakEndsAt(session)).toBe(at(45));
    expect(isBreakOver(session, at(44))).toBe(false);
    expect(isBreakOver(session, at(45))).toBe(true);
    expect(plannedEndAt(session)).toBeNull();
    expect(isDue(session, at(200))).toBe(false);
    // Noticed late, the break still counts its full length and no more: the clock
    // runs again from minute 45, and settle() ends the break at that instant.
    expect(elapsed(session, at(70))).toBe(55 * MINUTE);
  });

  it('push the end back by what they took, and unlock the next one 25 minutes later', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));
    const resumed = endBreak(paused, at(40));

    expect(resumed.breakMs).toBe(10 * MINUTE);
    expect(resumed.breakStartedAt).toBeNull();
    expect(elapsed(resumed, at(50))).toBe(40 * MINUTE);
    expect(plannedEndAt(resumed)).toBe(at(70));
    expect(isDue(resumed, at(70))).toBe(true);
    expect(resumed.nextBreakAtMs).toBe(55 * MINUTE);
    expect(canTakeBreak(resumed, at(60))).toBe(false);
    expect(canTakeBreak(resumed, at(65))).toBe(true);
    expect(endBreak(resumed, at(50))).toBe(resumed);
  });

  it('are not focus when the session closes, and closing ends them', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));
    const closed = close(paused, at(40), 'cancelled');

    expect(closed.actualMs).toBe(30 * MINUTE);
    expect(closed.breakMs).toBe(10 * MINUTE);
    expect(closed.breakStartedAt).toBeNull();
  });

  it('do not count leaving the app as an interruption', () => {
    const paused = startBreak(running({ plannedMs: HOUR, depth: 'firm' }), at(30));

    expect(interrupt(paused)).toBe(paused);
  });
});

describe('settle', () => {
  const at = (minutes: number) => T0 + minutes * MINUTE;

  it('returns the same session when nothing is owed', () => {
    const session = running({ plannedMs: HOUR });
    expect(settle(session, at(10))).toBe(session);
    expect(settle(close(session, at(10), 'cancelled'), at(500))).toEqual(close(session, at(10), 'cancelled'));
  });

  it('ends an overdue break at its own end and keeps the session running', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));
    const settled = settle(paused, at(50));

    expect(settled.outcome).toBe('running');
    expect(settled.breakMs).toBe(15 * MINUTE);
    expect(settled.breakStartedAt).toBeNull();
    expect(elapsed(settled, at(50)).toString()).toBe(String(35 * MINUTE));
  });

  it('expires a session past its end, at that end, breaks included', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));
    const settled = settle(paused, at(200));

    expect(settled.outcome).toBe('expired');
    expect(settled.actualMs).toBe(HOUR);
    expect(settled.endedAt).toBe(at(75));
    expect(settle(running({ plannedMs: HOUR }), at(60)).endedAt).toBe(at(60));
  });

  it('refuses to expire a session still on a break', () => {
    expect(() => expire(startBreak(running({ plannedMs: HOUR }), at(30)))).toThrow();
  });
});
