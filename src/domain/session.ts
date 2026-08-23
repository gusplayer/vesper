import type { Depth, Millis, Session } from './types';

/**
 * Session logic. Pure: no React, no database, no id generation — the caller passes
 * the id, because generating one needs expo-crypto and this module must stay testable.
 */

export type SessionConfig = {
  activityId: string;
  plannedMs: number;
  depth: Depth;
  intention: string | null;
  /** Always null in phase 1 — ADR-0003. */
  blockProfile: string | null;
};

/** How long `mantén pulsado para terminar` must be held. */
export const HOLD_MS = 1_500;

/** After the hold, 'firm' depth asks why and waits this long before letting go. */
export const FIRM_WAIT_MS = 15_000;

/**
 * Whether holding can end this session at all. In 'deep' it cannot: only the timer
 * running out ends it. That is the entire point of the level.
 */
export function canGiveUp(depth: Depth): boolean {
  return depth !== 'deep';
}

export function createSession(id: string, config: SessionConfig, now: Millis): Session {
  return {
    id,
    activityId: config.activityId,
    plannedMs: config.plannedMs,
    actualMs: 0,
    outcome: 'running',
    depth: config.depth,
    blockProfile: config.blockProfile,
    intention: config.intention,
    exitReason: null,
    interruptions: 0,
    startedAt: now,
    endedAt: null,
  };
}

/**
 * Time served, as `now - startedAt` and never by accumulating ticks, so it survives
 * the app going to background. Clamped to plannedMs: invariant 2 in DATA_MODEL.md.
 */
export function elapsed(session: Session, now: Millis): number {
  const raw = now - session.startedAt;
  if (raw < 0) {
    return 0;
  }
  return Math.min(raw, session.plannedMs);
}

export function remaining(session: Session, now: Millis): number {
  return session.plannedMs - elapsed(session, now);
}

/** The planned time has run out. The session should be closed as completed. */
export function isDue(session: Session, now: Millis): boolean {
  return now - session.startedAt >= session.plannedMs;
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

  return {
    ...session,
    outcome,
    actualMs: outcome === 'completed' ? session.plannedMs : elapsed(session, now),
    exitReason: options.exitReason ?? session.exitReason,
    endedAt: now,
  };
}

/**
 * Leaving the app counts as an interruption in 'firm' and 'deep'. It never cancels
 * the session — it is recorded, not punished.
 */
export function interrupt(session: Session): Session {
  if (session.outcome !== 'running' || session.depth === 'soft') {
    return session;
  }
  return { ...session, interruptions: session.interruptions + 1 };
}
