import type { ShieldEvent, ShieldEventKind, ShieldEventRow, ShieldPlatform } from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { getDb, rowsAs } from '../client';

/**
 * `usage_events`: what happened on the shield (ADR-0053), one row per event, tied to
 * the session running when it happened. Only the shield writes here, through the
 * native queue the app drains; never anything from DeviceActivityReport (rule 10).
 */

type EventRow = {
  id: string;
  platform: ShieldPlatform;
  kind: ShieldEventKind;
  token: string;
  duration_ms: number | null;
  session_id: string | null;
  fired_at: number;
};

function toEvent(row: EventRow): ShieldEventRow {
  return {
    id: row.id,
    platform: row.platform,
    kind: row.kind,
    token: row.token,
    lengthMs: row.duration_ms,
    sessionId: row.session_id,
    at: row.fired_at,
  };
}

/** The session that covered `at`: started at or before it and not ended before it. */
export function sessionIdAt(at: number): string | null {
  const row = rowsAs<{ id: string }>(
    getDb().executeSync(
      `SELECT id FROM sessions
        WHERE started_at <= ? AND (ended_at IS NULL OR ended_at >= ?)
        ORDER BY started_at DESC LIMIT 1`,
      [at, at],
    ),
  )[0];
  return row?.id ?? null;
}

/** Stores one event, tied to the session that covered it. Returns the stored row. */
export function insert(event: ShieldEvent): ShieldEventRow {
  const row: ShieldEventRow = { ...event, id: uuidv7(event.at), sessionId: sessionIdAt(event.at) };
  getDb().executeSync(
    `INSERT INTO usage_events (id, platform, kind, token, duration_ms, session_id, fired_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.platform, row.kind, row.token, row.kind === 'unlock_granted' ? row.lengthMs : null, row.sessionId, row.at],
  );
  return row;
}

/** Events fired in [from, to), oldest first. */
export function listBetween(from: number, to: number): ShieldEventRow[] {
  return rowsAs<EventRow>(
    getDb().executeSync('SELECT * FROM usage_events WHERE fired_at >= ? AND fired_at < ? ORDER BY fired_at', [
      from,
      to,
    ]),
  ).map(toEvent);
}

/** One session's events, oldest first. */
export function listForSession(sessionId: string): ShieldEventRow[] {
  return rowsAs<EventRow>(
    getDb().executeSync('SELECT * FROM usage_events WHERE session_id = ? ORDER BY fired_at', [sessionId]),
  ).map(toEvent);
}
