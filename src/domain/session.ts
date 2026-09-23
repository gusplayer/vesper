import { HOUR, MINUTE } from './time';
import { DEPTHS, type Depth, type Millis, type Session } from './types';

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
  /** The key that opened it and the code's step, when a key did (ADR-0035). */
  key?: { id: string; step: number };
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
  return (DEPTHS as readonly unknown[]).includes(value);
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
  const key = config.key ?? null;
  // A key session has no timer of its own: the key ends it, and the 12 h cap is the
  // backstop every open session already has. That is the promise of ADR-0035, and it
  // also takes away the cheapest attack on the lock — winding the clock past a
  // planned end and coming back to a session the app closed by itself.
  const open = config.open === true || key !== null;
  return {
    id,
    activityId: config.activityId,
    plannedMs: open ? OPEN_SESSION_CAP_MS : config.plannedMs,
    actualMs: 0,
    outcome: 'running',
    // A key session is deep whatever the mode says, and stays deep when it is open:
    // the downgrade of effectiveDepth exists because deep and open have no way out,
    // and the key is one (ADR-0035).
    depth: key === null ? effectiveDepth(config.depth, open) : 'deep',
    open,
    breakMs: 0,
    breakStartedAt: null,
    nextBreakAtMs: BREAK_EVERY_MS,
    blockProfile: config.blockProfile,
    // Written on the session screen, where it is also displayed. Never part of config.
    intention: null,
    exitReason: null,
    keyId: key?.id ?? null,
    keyStep: key?.step ?? null,
    keyTries: 0,
    interruptions: 0,
    startedAt: now,
    endedAt: null,
  };
}

/** True when only this session's key (or the timer, or the emergency) can end it. */
export function isKeyLocked(session: Session): boolean {
  return session.keyId !== null;
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

/**
 * Whether a break will ever unlock in this session: the next one comes before the
 * planned end. A 5-minute session never reaches its first break at minute 25, and a
 * 50-minute one whose break ended at minute 30 never reaches the next at 55, so the
 * screen has no countdown to show. Both instants are focus time, so breaks already
 * taken shift them equally; an open session counts against its cap.
 */
export function breakReachable(session: Session, now: Millis): boolean {
  return (
    session.outcome === 'running' &&
    allowsBreaks(session.depth) &&
    !isDue(session, now) &&
    session.nextBreakAtMs < session.plannedMs
  );
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
 * - 'completed' — the timer ran out, so actualMs is the full plannedMs. The same
 *   whether the app watched it happen, woke up past the end, or was killed and
 *   relaunched hours later: settle() closes an orphan this way too.
 * - 'cancelled' — the user gave up. actualMs is what was actually served.
 * - 'expired' — an open session reached its 12 h cap (ADR-0022): more likely
 *   forgotten than finished, so it gets no celebration.
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
 * Closes a session whose time ran out, at its planned end on the wall clock (start,
 * plan and breaks), not at `now`: the row records when the timer finished, not when
 * the app noticed. The verdict is dueOutcome's, the same one the session screen
 * gives: a chosen duration completes, an open session at its cap expires. Never
 * called during a break: settle() ends the break first, and the end is known again.
 */
export function closeDue(session: Session): Session {
  const end = plannedEndAt(session);
  if (end === null) {
    throw new Error(`session ${session.id} is on a break; settle it first`);
  }
  return close(session, end, dueOutcome(session));
}

/**
 * What a session that nobody watched for a while should look like now: a break past
 * its length ended when it should have, and a session past its planned end closed
 * then, with the verdict it would have had on screen. Returns the same object when
 * nothing was owed. The one path for boot (orphans) and foreground, so the outcome
 * never depends on whether the app was awake.
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
    return closeDue(current);
  }
  return current;
}

export type ClockInterval = {
  start: Millis;
  end: Millis;
};

/**
 * The stretches of wall clock a session occupied with focus: from its start, for as
 * long as it served, with every break cut out. A break is not focus and must not
 * cover the clock (ADR-0005, ADR-0010): a verified workout taken during one is not
 * inside a session. Together the intervals measure exactly `served`.
 *
 * The row keeps the total of finished breaks, not each one, so finished breaks are
 * drawn as one gap ending where the last one ended; nextBreakAtMs remembers that
 * point (it is that focus plus BREAK_EVERY_MS). With one finished break this is
 * exact; with two, only the position of the first is approximate. A break still
 * running is cut where it is.
 */
export function occupiedIntervals(session: Session, now: Millis): ClockInterval[] {
  const focus = served(session, now);
  const gaps: ClockInterval[] = [];
  if (session.breakMs > 0) {
    const focusBefore = Math.min(focus, Math.max(0, session.nextBreakAtMs - BREAK_EVERY_MS));
    const start = session.startedAt + focusBefore;
    gaps.push({ start, end: start + session.breakMs });
  }
  if (session.outcome === 'running' && session.breakStartedAt !== null) {
    const start = session.breakStartedAt;
    gaps.push({ start, end: start + breakElapsed(session, now) });
  }

  const intervals: ClockInterval[] = [];
  let cursor = session.startedAt;
  let left = focus;
  for (const gap of gaps) {
    const run = Math.min(left, Math.max(0, gap.start - cursor));
    if (run > 0) {
      intervals.push({ start: cursor, end: cursor + run });
    }
    left -= run;
    cursor = Math.max(cursor, gap.end);
  }
  if (left > 0) {
    intervals.push({ start: cursor, end: cursor + left });
  }
  return intervals;
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
