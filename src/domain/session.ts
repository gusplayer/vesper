import { HOUR, MINUTE } from './time';
import { DEPTHS, type Activity, type Depth, type Millis, type Session } from './types';

/**
 * Session logic. Pure: no React, no database, no id generation — the caller passes
 * the id, because generating one needs expo-crypto and this module must stay testable.
 */

/** What the next session will be. Inherited from the last one — ADR-0007. */
export type SessionConfig = {
  activityId: string;
  plannedMs: number;
  depth: Depth;
  /** Always null in phase 1 — ADR-0003. */
  blockProfile: string | null;
  /** "Sin límite" (ADR-0022). plannedMs is ignored: the cap applies. */
  open?: boolean;
};

/**
 * An open session ("sin límite") has no chosen end, but it has a ceiling: past this
 * it is more likely forgotten than alive, so it closes as expired (ADR-0022).
 */
export const OPEN_SESSION_CAP_MS = 12 * HOUR;

/** A break is this long at most; it ends by itself when the time is up. */
export const BREAK_MS = 15 * MINUTE;

/** Focus time that has to pass, since the start or the last break, to unlock a break. */
export const BREAK_EVERY_MS = 25 * MINUTE;

/** The offered durations, in minutes. Anything else goes through the custom field. */
export const PRESET_MINUTES = [25, 50, 90] as const;

/** Bounds of the custom duration. A session shorter than a minute is a tap, not a session. */
export const PLANNED_MINUTES_MIN = 1;
export const PLANNED_MINUTES_MAX = 240;

export const DEFAULT_PLANNED_MS = 25 * MINUTE;
export const DEFAULT_DEPTH: Depth = 'soft';

/** How long `mantén pulsado para terminar` must be held. */
export const HOLD_MS = 1_500;

/** After the hold, 'firm' depth asks why and waits this long before letting go. */
export const FIRM_WAIT_MS = 15_000;

export function isDepth(value: unknown): value is Depth {
  return (DEPTHS as ReadonlyArray<unknown>).includes(value);
}

/** Whole minutes inside the allowed range. Guards both the custom field and stored JSON. */
export function isValidPlannedMs(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isInteger(value / MINUTE)) {
    return false;
  }
  const minutes = value / MINUTE;
  return minutes >= PLANNED_MINUTES_MIN && minutes <= PLANNED_MINUTES_MAX;
}

/**
 * Turns whatever was stored last time into a usable config, or falls back to the
 * default: 25 minutes of the first activity, soft. Null only when there is no activity
 * at all, which is a broken database, not a choice.
 *
 * Validated against reality on purpose: an activity can have been archived since, and
 * a stored id pointing nowhere would break the home screen.
 */
export function resolveSessionConfig(
  stored: unknown,
  activities: ReadonlyArray<Activity>,
): SessionConfig | null {
  const first = activities[0];
  if (first === undefined) {
    return null;
  }

  if (typeof stored === 'object' && stored !== null) {
    const candidate = stored as Record<string, unknown>;
    const activity = activities.find((item) => item.id === candidate.activityId);
    if (
      activity !== undefined &&
      isValidPlannedMs(candidate.plannedMs) &&
      isDepth(candidate.depth)
    ) {
      return {
        activityId: activity.id,
        plannedMs: candidate.plannedMs,
        depth: candidate.depth,
        blockProfile: null,
      };
    }
  }

  return {
    activityId: first.id,
    plannedMs: DEFAULT_PLANNED_MS,
    depth: DEFAULT_DEPTH,
    blockProfile: null,
  };
}

/**
 * Whether holding can end this session at all. In 'deep' it cannot: only the timer
 * running out ends it. That is the entire point of the level.
 */
export function canGiveUp(depth: Depth): boolean {
  return depth !== 'deep';
}

/**
 * Deep means "only the timer ends it"; an open session has no timer, so deep and open
 * together would be a session with no way out. It runs as firm instead (ADR-0022).
 */
export function effectiveDepth(depth: Depth, open: boolean): Depth {
  return open && depth === 'deep' ? 'firm' : depth;
}

export function createSession(id: string, config: SessionConfig, now: Millis): Session {
  const open = config.open === true;
  return {
    id,
    activityId: config.activityId,
    plannedMs: open ? OPEN_SESSION_CAP_MS : config.plannedMs,
    actualMs: 0,
    outcome: 'running',
    depth: effectiveDepth(config.depth, open),
    open,
    breakMs: 0,
    breakStartedAt: null,
    nextBreakAtMs: BREAK_EVERY_MS,
    blockProfile: config.blockProfile,
    // Written on the session screen, where it is also displayed. Never part of config.
    intention: null,
    exitReason: null,
    interruptions: 0,
    startedAt: now,
    endedAt: null,
  };
}

/** How much of the current break has run, capped at its length. Zero outside a break. */
export function breakElapsed(session: Session, now: Millis): number {
  if (session.breakStartedAt === null) {
    return 0;
  }
  return Math.min(Math.max(0, now - session.breakStartedAt), BREAK_MS);
}

/**
 * Time served, as `now - startedAt` minus every break, never by accumulating ticks,
 * so it survives the app going to background. The clock is frozen during a break.
 * Clamped to plannedMs: invariant 2 in DATA_MODEL.md.
 */
export function elapsed(session: Session, now: Millis): number {
  const raw = now - session.startedAt - session.breakMs - breakElapsed(session, now);
  if (raw < 0) {
    return 0;
  }
  return Math.min(raw, session.plannedMs);
}

/**
 * When the planned time runs out, on the wall clock: the start plus the plan plus
 * every break. Null during a break, because nobody knows yet how long it will last.
 */
export function plannedEndAt(session: Session): Millis | null {
  if (session.breakStartedAt !== null) {
    return null;
  }
  return session.startedAt + session.plannedMs + session.breakMs;
}

export function remaining(session: Session, now: Millis): number {
  return session.plannedMs - elapsed(session, now);
}

/** 0 to 1. A zero-length session is fully done, never NaN. */
export function sessionProgress(session: Session, now: Millis): number {
  if (session.plannedMs <= 0) {
    return 1;
  }
  return elapsed(session, now) / session.plannedMs;
}

/**
 * Time a session counts for, whether it is still running or already closed. The one
 * definition the ledger and the weekly goal both use.
 */
export function served(session: Session, now: Millis): number {
  return session.outcome === 'running' ? elapsed(session, now) : session.actualMs;
}

/** The planned time has run out. Never during a break: the clock is frozen there. */
export function isDue(session: Session, now: Millis): boolean {
  return session.breakStartedAt === null && elapsed(session, now) >= session.plannedMs;
}

/**
 * How a session that ran its time out closes. A chosen duration completes; an open
 * session hitting its cap is more likely forgotten than finished, so it expires and
 * gets no celebration (ADR-0022).
 */
export function dueOutcome(session: Session): CloseOutcome {
  return session.open ? 'expired' : 'completed';
}

/** Breaks exist in soft and firm. Deep is the level with no way out, breaks included. */
export function allowsBreaks(depth: Depth): boolean {
  return depth !== 'deep';
}

/** Focus time still to serve before the next break unlocks. Zero when it is available. */
export function breakAvailableIn(session: Session, now: Millis): number {
  return Math.max(0, session.nextBreakAtMs - elapsed(session, now));
}

/** A break can start: allowed by the depth, none running, unlocked, and time left. */
export function canTakeBreak(session: Session, now: Millis): boolean {
  return (
    session.outcome === 'running' &&
    allowsBreaks(session.depth) &&
    session.breakStartedAt === null &&
    breakAvailableIn(session, now) === 0 &&
    !isDue(session, now)
  );
}

export function startBreak(session: Session, now: Millis): Session {
  if (!canTakeBreak(session, now)) {
    throw new Error(`session ${session.id} cannot take a break now`);
  }
  return { ...session, breakStartedAt: now };
}

/** When the running break ends by itself. Null outside a break. */
export function breakEndsAt(session: Session): Millis | null {
  return session.breakStartedAt === null ? null : session.breakStartedAt + BREAK_MS;
}

export function isBreakOver(session: Session, now: Millis): boolean {
  const end = breakEndsAt(session);
  return end !== null && now >= end;
}

/**
 * Ends the running break, by hand or because its time is up. What it took joins
 * breakMs, and the next break unlocks BREAK_EVERY_MS of focus from here. Returns the
 * same object when there is no break to end.
 */
export function endBreak(session: Session, now: Millis): Session {
  if (session.breakStartedAt === null) {
    return session;
  }
  const took = breakElapsed(session, now);
  const ended = { ...session, breakMs: session.breakMs + took, breakStartedAt: null };
  return { ...ended, nextBreakAtMs: elapsed(ended, now) + BREAK_EVERY_MS };
}

export type CloseOutcome = 'completed' | 'cancelled' | 'expired';

export type CloseOptions = {
  /** Text written when giving up in 'firm' depth. */
  exitReason?: string | null;
};

/**
 * Closes a running session.
 *
 * - 'completed' — the timer ran out, so actualMs is the full plannedMs. This is also
 *   the case when the app comes back from background past the end.
 * - 'cancelled' — the user gave up. actualMs is what was actually served.
 * - 'expired' — the process died mid-session and nobody closed the row. Not a
 *   surrender: we simply do not know what happened. See ARCHITECTURE.md.
 */
export function close(
  session: Session,
  now: Millis,
  outcome: CloseOutcome,
  options: CloseOptions = {},
): Session {
  if (session.outcome !== 'running') {
    throw new Error(`session ${session.id} is already ${session.outcome}`);
  }

  // Closing in the middle of a break ends the break first, so its time is on record.
  const settled = endBreak(session, now);
  return {
    ...settled,
    outcome,
    actualMs: outcome === 'completed' ? settled.plannedMs : elapsed(settled, now),
    exitReason: options.exitReason ?? settled.exitReason,
    endedAt: now,
  };
}

/**
 * Closes an orphan: a session whose time ran out while nobody was watching. It ends
 * at its planned end, not at `now` — the row records when the timer would have
 * finished, not when the app noticed. Never called during a break: settle() ends
 * the break first, and the planned end is known again.
 */
export function expire(session: Session): Session {
  const end = plannedEndAt(session);
  if (end === null) {
    throw new Error(`session ${session.id} is on a break; settle it first`);
  }
  return close(session, end, 'expired');
}

/**
 * What a session that nobody watched for a while should look like now: a break past
 * its length ended when it should have, and a session past its planned end expired
 * then. Returns the same object when nothing was owed. Used at boot for orphans and
 * on foreground, so the clock never depends on the app being awake.
 */
export function settle(session: Session, now: Millis): Session {
  if (session.outcome !== 'running') {
    return session;
  }
  let current = session;
  if (isBreakOver(current, now)) {
    const end = breakEndsAt(current);
    current = endBreak(current, end ?? now);
  }
  if (current.breakStartedAt === null && isDue(current, now)) {
    return expire(current);
  }
  return current;
}

/**
 * Leaving the app counts as an interruption in 'firm' and 'deep'. It never cancels
 * the session — it is recorded, not punished. Returns the same object when nothing
 * changes, so callers can skip the write. Leaving during a break is what a break is
 * for, so it does not count.
 */
export function interrupt(session: Session): Session {
  if (session.outcome !== 'running' || session.depth === 'soft' || session.breakStartedAt !== null) {
    return session;
  }
  return { ...session, interruptions: session.interruptions + 1 };
}
