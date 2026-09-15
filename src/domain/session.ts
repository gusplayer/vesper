import { MINUTE } from './time';
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
};

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

export function createSession(id: string, config: SessionConfig, now: Millis): Session {
  return {
    id,
    activityId: config.activityId,
    plannedMs: config.plannedMs,
    actualMs: 0,
    outcome: 'running',
    depth: config.depth,
    blockProfile: config.blockProfile,
    // Written on the session screen, where it is also displayed. Never part of config.
    intention: null,
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
 * Closes an orphan: a session whose time ran out while nobody was watching. It ends
 * at its planned end, not at `now` — the row records when the timer would have
 * finished, not when the app noticed.
 */
export function expire(session: Session): Session {
  return close(session, session.startedAt + session.plannedMs, 'expired');
}

/**
 * Leaving the app counts as an interruption in 'firm' and 'deep'. It never cancels
 * the session — it is recorded, not punished. Returns the same object when nothing
 * changes, so callers can skip the write.
 */
export function interrupt(session: Session): Session {
  if (session.outcome !== 'running' || session.depth === 'soft') {
    return session;
  }
  return { ...session, interruptions: session.interruptions + 1 };
}
