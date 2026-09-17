import type { Schedule } from '../../data/types';
import { getDb, rowsAs } from '../client';

/**
 * Schedules: a mode, a start, an optional end, and which weekdays. The days are a
 * JSON array of seven booleans, Monday first, because the row is always read whole.
 *
 * Every write stamps updated_at with the caller's `now`: the engine uses it to
 * ignore a window that was already open when the routine was saved or switched on.
 */

type ScheduleRow = {
  id: string;
  name: string;
  mode_id: string;
  start_minutes: number;
  end_minutes: number | null;
  duration_ms: number | null;
  days: string;
  enabled: number;
  created_at: number;
  updated_at: number;
};

const WEEK_LENGTH = 7;

/** Seven booleans, Monday first. Anything malformed reads as no days at all. */
export function parseDays(raw: unknown): boolean[] {
  const none = Array.from({ length: WEEK_LENGTH }, () => false);
  if (typeof raw !== 'string') {
    return none;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== WEEK_LENGTH) {
      return none;
    }
    return parsed.map((day) => day === true);
  } catch {
    return none;
  }
}

function toSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    name: row.name,
    modeId: row.mode_id,
    // -1 is how the NOT NULL column spells "no time": a hand-started routine.
    startMinutes: row.start_minutes < 0 ? null : row.start_minutes,
    endMinutes: row.end_minutes,
    durationMs: row.duration_ms ?? null,
    days: parseDays(row.days),
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
  };
}

/** Every schedule, oldest first. */
export function list(): Schedule[] {
  return rowsAs<ScheduleRow>(
    getDb().executeSync('SELECT * FROM schedules ORDER BY created_at, id'),
  ).map(toSchedule);
}

/**
 * Inserts or replaces the whole row by id. `now` becomes updated_at every time and
 * created_at only on a new row; an update keeps the original. The schedule's own
 * updatedAt is ignored: the stamp is the write's, not the caller's.
 */
export function upsert(schedule: Schedule, now: number): void {
  getDb().executeSync(
    `INSERT INTO schedules
       (id, name, mode_id, start_minutes, end_minutes, duration_ms, days, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mode_id = excluded.mode_id,
       start_minutes = excluded.start_minutes,
       end_minutes = excluded.end_minutes,
       duration_ms = excluded.duration_ms,
       days = excluded.days,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
    [
      schedule.id,
      schedule.name,
      schedule.modeId,
      schedule.startMinutes ?? -1,
      schedule.endMinutes,
      schedule.durationMs,
      JSON.stringify(schedule.days),
      schedule.enabled ? 1 : 0,
      now,
      now,
    ],
  );
}

export function setEnabled(id: string, enabled: boolean, now: number): void {
  getDb().executeSync('UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?', [enabled ? 1 : 0, now, id]);
}

/** Turns off every schedule of a mode. Called when the mode is deleted. */
export function disableByMode(modeId: string, now: number): void {
  getDb().executeSync('UPDATE schedules SET enabled = 0, updated_at = ? WHERE mode_id = ?', [now, modeId]);
}

/**
 * Stamps every schedule as saved at `now`. Called when the onboarding ends, so a
 * demo routine whose window is open at that moment waits for its next one.
 */
export function touchAll(now: number): void {
  getDb().executeSync('UPDATE schedules SET updated_at = ?', [now]);
}

export function remove(id: string): void {
  getDb().executeSync('DELETE FROM schedules WHERE id = ?', [id]);
}
