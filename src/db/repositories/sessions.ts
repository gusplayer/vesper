import { settle } from '../../domain/session';
import type { Session, SessionOutcome } from '../../domain/types';
import { getDb, rowsAs } from '../client';

type SessionRow = {
  id: string;
  activity_id: string;
  planned_ms: number;
  actual_ms: number;
  outcome: SessionOutcome;
  depth: Session['depth'];
  block_profile: string | null;
  intention: string | null;
  exit_reason: string | null;
  interruptions: number;
  started_at: number;
  ended_at: number | null;
  open: number;
  break_ms: number;
  break_started_at: number | null;
  next_break_at_ms: number;
  key_id: string | null;
  key_step: number | null;
  key_tries: number;
};

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    activityId: row.activity_id,
    plannedMs: row.planned_ms,
    actualMs: row.actual_ms,
    outcome: row.outcome,
    depth: row.depth,
    blockProfile: row.block_profile,
    intention: row.intention,
    exitReason: row.exit_reason,
    interruptions: row.interruptions,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    open: row.open === 1,
    breakMs: row.break_ms,
    breakStartedAt: row.break_started_at,
    nextBreakAtMs: row.next_break_at_ms,
    keyId: row.key_id,
    keyStep: row.key_step,
    keyTries: row.key_tries,
  };
}

/**
 * Inserts a session. A running one is refused while another runs: invariant 1 holds
 * in the table, not only in the focus store's cache.
 */
export function insert(session: Session): void {
  if (session.outcome === 'running' && findRunning() !== null) {
    throw new Error('a session is already running');
  }
  getDb().executeSync(
    `INSERT INTO sessions
       (id, activity_id, planned_ms, actual_ms, outcome, depth, block_profile,
        intention, exit_reason, interruptions, started_at, ended_at,
        open, break_ms, break_started_at, next_break_at_ms, key_id, key_step, key_tries)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.activityId,
      session.plannedMs,
      session.actualMs,
      session.outcome,
      session.depth,
      session.blockProfile,
      session.intention,
      session.exitReason,
      session.interruptions,
      session.startedAt,
      session.endedAt,
      session.open ? 1 : 0,
      session.breakMs,
      session.breakStartedAt,
      session.nextBreakAtMs,
      session.keyId,
      session.keyStep,
      session.keyTries,
    ],
  );
}

/** Writes everything that changes after the start: the clock, the outcome, the intention, the breaks. */
export function update(session: Session): void {
  getDb().executeSync(
    `UPDATE sessions
        SET actual_ms = ?, outcome = ?, exit_reason = ?, interruptions = ?, ended_at = ?,
            intention = ?, break_ms = ?, break_started_at = ?, next_break_at_ms = ?,
            key_tries = ?
      WHERE id = ?`,
    [
      session.actualMs,
      session.outcome,
      session.exitReason,
      session.interruptions,
      session.endedAt,
      session.intention,
      session.breakMs,
      session.breakStartedAt,
      session.nextBreakAtMs,
      session.keyTries,
      session.id,
    ],
  );
}

/** At most one exists at a time — invariant 1. */
export function findRunning(): Session | null {
  const row = rowsAs<SessionRow>(
    getDb().executeSync("SELECT * FROM sessions WHERE outcome = 'running' LIMIT 1"),
  )[0];
  return row === undefined ? null : toSession(row);
}

/** How many sessions ever ran their timer out. The first one gets its own closing. */
export function countCompleted(): number {
  const result = getDb().executeSync("SELECT COUNT(*) AS n FROM sessions WHERE outcome = 'completed'");
  const n = result.rows[0]?.n;
  return typeof n === 'number' ? n : 0;
}

export function listBetween(from: number, to: number): Session[] {
  return rowsAs<SessionRow>(
    getDb().executeSync(
      'SELECT * FROM sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at',
      [from, to],
    ),
  ).map(toSession);
}

/**
 * Settles the running session after nobody watched it for a while: a break past its
 * length is ended when it should have ended, and a session past its planned end is
 * closed at that instant with the verdict it would have had on screen — `completed`
 * for a chosen duration, `expired` for an open session at its cap
 * (domain/session.settle). Boot and foreground share that one function, so the
 * outcome never depends on whether the app was awake.
 *
 * Called before the first render. Without it the one-running-session invariant locks
 * the app forever: nothing can start while a ghost session is still running, and in
 * `deep` depth nothing can end it either.
 *
 * It deliberately leaves alone a session still inside its window. The clock is
 * `now - startedAt` minus the breaks, so a session survives the app being killed —
 * reopening two minutes into a 25 minute session should continue it, not void it.
 * Only a session whose time is already up cannot continue.
 *
 * Returns how many were closed, so the caller can log it during development.
 */
export function recoverOrphans(now: number): number {
  const running = rowsAs<SessionRow>(
    getDb().executeSync("SELECT * FROM sessions WHERE outcome = 'running'"),
  );

  let closed = 0;
  for (const row of running) {
    const session = toSession(row);
    const settled = settle(session, now);
    if (settled === session) {
      continue;
    }
    update(settled);
    if (settled.outcome !== 'running') {
      closed += 1;
    }
  }

  return closed;
}
