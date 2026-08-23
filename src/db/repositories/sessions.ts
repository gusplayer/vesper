import { close as closeSession, elapsed } from '../../domain/session';
import type { Session, SessionOutcome } from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { getDb } from '../client';

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

function rows(result: { rows: Array<Record<string, unknown>> }): SessionRow[] {
  return result.rows as unknown as SessionRow[];
}

export function newId(now: number): string {
  return uuidv7(now);
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

export function update(session: Session): void {
  getDb().executeSync(
    `UPDATE sessions
        SET actual_ms = ?, outcome = ?, exit_reason = ?, interruptions = ?, ended_at = ?
      WHERE id = ?`,
    [
      session.actualMs,
      session.outcome,
      session.exitReason,
      session.interruptions,
      session.endedAt,
      session.id,
    ],
  );
}

/** At most one exists at a time — invariant 1. */
export function findRunning(): Session | null {
  const row = rows(getDb().executeSync("SELECT * FROM sessions WHERE outcome = 'running' LIMIT 1"))[0];
  return row === undefined ? null : toSession(row);
}

export function listBetween(from: number, to: number): Session[] {
  return rows(
    getDb().executeSync(
      'SELECT * FROM sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at',
      [from, to],
    ),
  ).map(toSession);
}

/**
 * Closes sessions that survived a process death as `expired`.
 *
 * Called before the first render. Without it the one-running-session invariant locks
 * the app forever: nothing can start while a ghost session is still running, and in
 * `deep` depth nothing can end it either.
 *
 * Returns how many were recovered, so the caller can log it during development.
 */
export function recoverOrphans(now: number): number {
  const orphans = rows(getDb().executeSync("SELECT * FROM sessions WHERE outcome = 'running'"));

  for (const row of orphans) {
    const session = toSession(row);
    // A session whose planned time has not run out yet is still legitimately running
    // if the app was merely backgrounded — but reaching this code means the process
    // died, so there is nobody left ticking it.
    update(closeSession(session, Math.min(now, session.startedAt + session.plannedMs), 'expired'));
  }

  return orphans.length;
}

/** Time served today by a session, whether it is closed or still running. */
export function servedMs(session: Session, now: number): number {
  return session.outcome === 'running' ? elapsed(session, now) : session.actualMs;
}
