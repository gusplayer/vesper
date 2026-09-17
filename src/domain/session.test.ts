import { describe, expect, it } from 'vitest';

import { aDoneSession, aRunningSession, T0 } from './fixtures';
import {
  allowsBreaks,
  BREAK_MS,
  breakAvailableIn,
  breakEndsAt,
  canGiveUp,
  canTakeBreak,
  close,
  closeDue,
  createSession,
  DEFAULT_DEPTH,
  DEFAULT_PLANNED_MS,
  dueOutcome,
  effectiveDepth,
  elapsed,
  endBreak,
  interrupt,
  isBreakOver,
  isDepth,
  isDue,
  isValidPlannedMs,
  occupiedIntervals,
  OPEN_SESSION_CAP_MS,
  plannedEndAt,
  remaining,
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

describe('defaults', () => {
  it('are 25 minutes and soft', () => {
    expect(DEFAULT_PLANNED_MS).toBe(25 * MINUTE);
    expect(DEFAULT_DEPTH).toBe('soft');
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

describe('closeDue', () => {
  it('completes a chosen duration at its planned end, not when the app noticed', () => {
    const session = aRunningSession();
    const closed = closeDue(session);

    expect(closed.outcome).toBe('completed');
    expect(closed.endedAt).toBe(session.startedAt + session.plannedMs);
    expect(closed.actualMs).toBe(session.plannedMs);
  });

  it('expires an open session at its cap: the only way to earn expired', () => {
    const closed = closeDue(running({ open: true }));

    expect(closed.outcome).toBe('expired');
    expect(closed.endedAt).toBe(T0 + OPEN_SESSION_CAP_MS);
    expect(closed.actualMs).toBe(OPEN_SESSION_CAP_MS);
  });

  it('refuses a session on a break: settle ends the break first', () => {
    expect(() => closeDue(startBreak(running({ plannedMs: HOUR }), T0 + 30 * MINUTE))).toThrow(/break/);
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

  it('completes a chosen session past its end, at that end, breaks included', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));
    const settled = settle(paused, at(200));

    expect(settled.outcome).toBe('completed');
    expect(settled.actualMs).toBe(HOUR);
    expect(settled.endedAt).toBe(at(75));
    expect(settle(running({ plannedMs: HOUR }), at(60)).endedAt).toBe(at(60));
  });

  it('gives boot and foreground the same verdict as the screen: dueOutcome', () => {
    const chosen = running({ plannedMs: HOUR });
    const open = running({ open: true });

    expect(settle(chosen, at(61)).outcome).toBe(dueOutcome(chosen));
    expect(settle(open, T0 + OPEN_SESSION_CAP_MS + 1).outcome).toBe(dueOutcome(open));
    expect(settle(open, T0 + OPEN_SESSION_CAP_MS + 1).outcome).toBe('expired');
  });

  it('is idempotent: settling a settled session changes nothing', () => {
    const settled = settle(running({ plannedMs: HOUR }), at(90));

    expect(settle(settled, at(500))).toBe(settled);
  });
});

describe('the 12 h cap of an open session, with breaks (ADR-0022)', () => {
  it('serves at most the cap however long the clock has run, and ends at start + cap', () => {
    const session = running({ open: true });

    expect(elapsed(session, T0 + 20 * HOUR)).toBe(OPEN_SESSION_CAP_MS);
    expect(served(session, T0 + 20 * HOUR)).toBe(OPEN_SESSION_CAP_MS);
    expect(plannedEndAt(session)).toBe(T0 + OPEN_SESSION_CAP_MS);
    expect(remaining(session, T0 + 20 * HOUR)).toBe(0);
  });

  it('a break pushes the cap back by what it took, and the session still expires there', () => {
    const paused = startBreak(running({ open: true }), T0 + 25 * MINUTE);
    const resumed = endBreak(paused, T0 + 35 * MINUTE);

    expect(plannedEndAt(resumed)).toBe(T0 + OPEN_SESSION_CAP_MS + 10 * MINUTE);
    expect(isDue(resumed, T0 + OPEN_SESSION_CAP_MS + 10 * MINUTE - 1)).toBe(false);
    expect(isDue(resumed, T0 + OPEN_SESSION_CAP_MS + 10 * MINUTE)).toBe(true);

    const settled = settle(resumed, T0 + 14 * HOUR);
    expect(settled.outcome).toBe('expired');
    expect(settled.endedAt).toBe(T0 + OPEN_SESSION_CAP_MS + 10 * MINUTE);
    expect(settled.actualMs).toBe(OPEN_SESSION_CAP_MS);
    expect(settled.breakMs).toBe(10 * MINUTE);
  });

  it('a break left running near the cap ends at its own end, and the session expires after it', () => {
    const paused = startBreak(running({ open: true }), T0 + OPEN_SESSION_CAP_MS - 5 * MINUTE);

    // Frozen during the break: the cap is never reached while paused.
    expect(isDue(paused, T0 + 2 * OPEN_SESSION_CAP_MS)).toBe(false);

    const settled = settle(paused, T0 + 2 * OPEN_SESSION_CAP_MS);
    expect(settled.outcome).toBe('expired');
    expect(settled.breakMs).toBe(BREAK_MS);
    expect(settled.endedAt).toBe(T0 + OPEN_SESSION_CAP_MS + BREAK_MS);
    expect(settled.actualMs).toBe(OPEN_SESSION_CAP_MS);
  });
});

describe('break arithmetic invariants', () => {
  const at = (minutes: number) => T0 + minutes * MINUTE;

  it('actualMs never exceeds plannedMs after a break, whatever the outcome', () => {
    const resumed = endBreak(startBreak(running({ plannedMs: HOUR }), at(30)), at(40));

    expect(close(resumed, at(200), 'completed').actualMs).toBe(HOUR);
    expect(close(resumed, at(200), 'expired').actualMs).toBe(HOUR);
    expect(close(resumed, at(50), 'cancelled').actualMs).toBe(40 * MINUTE);
    expect(close(resumed, at(50), 'cancelled').breakMs).toBe(10 * MINUTE);
  });

  it('elapsed plus breaks equals the wall clock while running, so nothing is lost or double counted', () => {
    const resumed = endBreak(startBreak(running({ plannedMs: HOUR }), at(30)), at(40));
    const paused = startBreak(resumed, at(65));

    for (const minutes of [41, 50, 64]) {
      expect(elapsed(resumed, at(minutes)) + resumed.breakMs).toBe(minutes * MINUTE);
    }
    for (const minutes of [66, 70, 79]) {
      expect(elapsed(paused, at(minutes)) + paused.breakMs + (at(minutes) - at(65))).toBe(minutes * MINUTE);
    }
  });

  it('a break cannot start once the session is due, even when the unlock has passed', () => {
    expect(canTakeBreak(running({ plannedMs: 25 * MINUTE }), at(25))).toBe(false);
    expect(canTakeBreak(running({ plannedMs: 30 * MINUTE }), at(25))).toBe(true);
    expect(canTakeBreak(running({ plannedMs: 30 * MINUTE }), at(30))).toBe(false);
  });

  it('a break cannot start inside a break, and ending one twice changes nothing', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));

    expect(canTakeBreak(paused, at(35))).toBe(false);
    expect(() => startBreak(paused, at(35))).toThrow();
    const resumed = endBreak(paused, at(40));
    expect(endBreak(resumed, at(41))).toBe(resumed);
  });

  it('an ended break unlocks the next one 25 minutes of focus later, not of wall clock', () => {
    const resumed = endBreak(startBreak(running({ plannedMs: 2 * HOUR }), at(30)), at(45));

    expect(resumed.nextBreakAtMs).toBe(55 * MINUTE);
    expect(breakAvailableIn(resumed, at(60))).toBe(10 * MINUTE);
    expect(canTakeBreak(resumed, at(70))).toBe(true);
  });

  it('settle of a session on a break still inside its length changes nothing', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));

    expect(settle(paused, at(40))).toBe(paused);
  });

  it('a clock that moved back never yields a negative break', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));

    expect(elapsed(paused, at(20))).toBe(20 * MINUTE);
    expect(endBreak(paused, at(20)).breakMs).toBe(0);
  });
});

describe('occupiedIntervals', () => {
  const at = (minutes: number) => T0 + minutes * MINUTE;
  const total = (session: ReturnType<typeof running>, now: number) =>
    occupiedIntervals(session, now).reduce((sum, i) => sum + (i.end - i.start), 0);

  it('is one stretch from the start for what was served, without breaks', () => {
    const session = running({ plannedMs: HOUR });

    expect(occupiedIntervals(session, at(20))).toEqual([{ start: T0, end: at(20) }]);
    expect(occupiedIntervals(close(session, at(20), 'cancelled'), at(500))).toEqual([{ start: T0, end: at(20) }]);
    expect(occupiedIntervals(closeDue(session), at(500))).toEqual([{ start: T0, end: at(60) }]);
  });

  it('cuts a running break out where it is, frozen while it lasts', () => {
    const paused = startBreak(running({ plannedMs: HOUR }), at(30));

    expect(occupiedIntervals(paused, at(35))).toEqual([{ start: T0, end: at(30) }]);
    expect(occupiedIntervals(paused, at(45))).toEqual([{ start: T0, end: at(30) }]);
    // Past its length the break is over and the clock runs again from minute 45,
    // like elapsed() says, until settle() writes that down.
    expect(occupiedIntervals(paused, at(200))).toEqual([
      { start: T0, end: at(30) },
      { start: at(45), end: at(75) },
    ]);
  });

  it('cuts a finished break out where it was, so the session ends later on the clock', () => {
    const resumed = endBreak(startBreak(running({ plannedMs: HOUR }), at(30)), at(40));

    expect(occupiedIntervals(resumed, at(50))).toEqual([
      { start: T0, end: at(30) },
      { start: at(40), end: at(50) },
    ]);
    expect(occupiedIntervals(closeDue(resumed), at(500))).toEqual([
      { start: T0, end: at(30) },
      { start: at(40), end: at(70) },
    ]);
  });

  it('cuts both a finished and a running break', () => {
    const resumed = endBreak(startBreak(running({ plannedMs: 2 * HOUR }), at(30)), at(40));
    const paused = startBreak(resumed, at(70));

    expect(occupiedIntervals(paused, at(75))).toEqual([
      { start: T0, end: at(30) },
      { start: at(40), end: at(70) },
    ]);
  });

  it('always measures exactly what was served, whatever the breaks', () => {
    const resumed = endBreak(startBreak(running({ plannedMs: 2 * HOUR }), at(25)), at(40));
    const again = endBreak(startBreak(resumed, at(70)), at(80));
    const cancelledOnBreak = close(startBreak(again, at(110)), at(115), 'cancelled');

    expect(total(again, at(90))).toBe(served(again, at(90)));
    expect(total(cancelledOnBreak, at(500))).toBe(cancelledOnBreak.actualMs);
    expect(total(closeDue(again), at(500))).toBe(2 * HOUR);
    for (const interval of occupiedIntervals(cancelledOnBreak, at(500))) {
      expect(interval.end).toBeGreaterThan(interval.start);
    }
  });

  it('is empty for a session that served nothing', () => {
    expect(occupiedIntervals(running(), T0)).toEqual([]);
    expect(occupiedIntervals(close(running(), T0, 'cancelled'), at(10))).toEqual([]);
  });
});
