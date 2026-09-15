import { expire } from '../../domain/session';
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
  };
}

export function insert(session: Session): void {
  getDb().executeSync(
    `INSERT INTO sessions
       (id, activity_id, planned_ms, actual_ms, outcome, depth, block_profile,
        intention, exit_reason, interruptions, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
  );
}

/** Writes everything that changes after the start: the clock, the outcome, the intention. */
export function update(session: Session): void {
  getDb().executeSync(
    `UPDATE sessions
        SET actual_ms = ?, outcome = ?, exit_reason = ?, interruptions = ?, ended_at = ?,
            intention = ?
      WHERE id = ?`,
    [
      session.actualMs,
      session.outcome,
      session.exitReason,
      session.interruptions,
      session.endedAt,
      session.intention,
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

export function countAll(): number {
  const result = getDb().executeSync('SELECT COUNT(*) AS n FROM sessions');
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
 * Closes running sessions whose planned time already ran out, as `expired`.
 *
 * Called before the first render. Without it the one-running-session invariant locks
 * the app forever: nothing can start while a ghost session is still running, and in
 * `deep` depth nothing can end it either.
 *
 * It deliberately leaves alone a session still inside its window. The clock is
 * `now - startedAt`, so a session survives the app being killed — reopening two
 * minutes into a 25 minute session should continue it, not void it. Only a session
 * whose time is already up cannot continue.
 *
 * The outcome is `expired` and not `completed`: the timer ran its course, but nobody
 * was watching, so crediting it as completed would be a claim we cannot make.
 *
 * Returns how many were recovered, so the caller can log it during development.
 */
export function recoverOrphans(now: number): number {
  const orphans = rowsAs<SessionRow>(
    getDb().executeSync(
      "SELECT * FROM sessions WHERE outcome = 'running' AND started_at + planned_ms <= ?",
      [now],
    ),
  );

  for (const row of orphans) {
    update(expire(toSession(row)));
  }

  return orphans.length;
}
