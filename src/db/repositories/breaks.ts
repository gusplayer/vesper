import type { BreakRecord, BreakSource, Session } from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { getDb, rowsAs } from '../client';

/**
 * Every break as a row (ADR-0053). The session row keeps the total its clock needs
 * (`break_ms`); this keeps how many there were, how long each one took, and from which
 * app's shield. Written by following the session: `follow` looks at the row before and
 * after a change and opens or closes the break that change implies, so the one
 * definition of when a break ends stays in domain/session.
 */

type BreakRow = {
  id: string;
  session_id: string;
  started_at: number;
  ended_at: number | null;
  length_ms: number;
  source: BreakSource;
  token: string | null;
};

function toRecord(row: BreakRow): BreakRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lengthMs: row.length_ms,
    source: row.source,
    token: row.token,
  };
}

/** Where a break that is starting came from. Only an opening needs it. */
export type BreakOrigin = { source: BreakSource; token: string | null };

const FROM_SESSION: BreakOrigin = { source: 'session', token: null };

/**
 * Writes what going from `previous` to `next` did to the session's breaks:
 * - a break started: a row opens, at its start, with its chosen length and `origin`;
 * - a break ended: the open row closes where the domain ended it, which is the start
 *   plus what joined `breakMs` (the store may learn of it late; the instant does not
 *   move with it).
 * Nothing when neither happened. Both at once (a break ending and another starting in
 * one step) never happens in the domain, and closes first if it ever does.
 */
export function follow(previous: Session, next: Session, origin: BreakOrigin = FROM_SESSION): void {
  const wasOnBreak = previous.breakStartedAt !== null;
  const isOnBreak = next.breakStartedAt !== null;
  if (wasOnBreak && (!isOnBreak || next.breakStartedAt !== previous.breakStartedAt)) {
    const took = next.breakMs - previous.breakMs;
    close(next.id, (previous.breakStartedAt ?? 0) + Math.max(0, took));
  }
  if (isOnBreak && next.breakStartedAt !== previous.breakStartedAt) {
    const startedAt = next.breakStartedAt ?? 0;
    getDb().executeSync(
      `INSERT INTO breaks (id, session_id, started_at, ended_at, length_ms, source, token)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
      [uuidv7(startedAt), next.id, startedAt, next.breakLengthMs, origin.source, origin.token],
    );
  }
}

/** Closes the session's open break at `endedAt`. A no-op when none is open. */
function close(sessionId: string, endedAt: number): void {
  getDb().executeSync('UPDATE breaks SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL', [
    endedAt,
    sessionId,
  ]);
}

/** Breaks that started in [from, to), oldest first. */
export function listBetween(from: number, to: number): BreakRecord[] {
  return rowsAs<BreakRow>(
    getDb().executeSync('SELECT * FROM breaks WHERE started_at >= ? AND started_at < ? ORDER BY started_at', [
      from,
      to,
    ]),
  ).map(toRecord);
}

/** One session's breaks, oldest first. */
export function listForSession(sessionId: string): BreakRecord[] {
  return rowsAs<BreakRow>(
    getDb().executeSync('SELECT * FROM breaks WHERE session_id = ? ORDER BY started_at', [sessionId]),
  ).map(toRecord);
}
