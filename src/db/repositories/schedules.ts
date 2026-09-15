import type { Schedule } from '../../data/types';
import { getDb, rowsAs } from '../client';

/**
 * Schedules: a mode, a start, an optional end, and which weekdays. The days are a
 * JSON array of seven booleans, Monday first, because the row is always read whole.
 */

type ScheduleRow = {
  id: string;
  name: string;
  mode_id: string;
  start_minutes: number;
  end_minutes: number | null;
  days: string;
  enabled: number;
  created_at: number;
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
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    days: parseDays(row.days),
    enabled: row.enabled === 1,
  };
}

/** Every schedule, oldest first. */
export function list(): Schedule[] {
  return rowsAs<ScheduleRow>(
    getDb().executeSync('SELECT * FROM schedules ORDER BY created_at, id'),
  ).map(toSchedule);
}

/**
 * Inserts or replaces the whole row by id. `now` only becomes created_at on a new
 * row; an update keeps the original.
 */
export function upsert(schedule: Schedule, now: number): void {
  getDb().executeSync(
    `INSERT INTO schedules
       (id, name, mode_id, start_minutes, end_minutes, days, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mode_id = excluded.mode_id,
       start_minutes = excluded.start_minutes,
       end_minutes = excluded.end_minutes,
       days = excluded.days,
       enabled = excluded.enabled`,
    [
      schedule.id,
      schedule.name,
      schedule.modeId,
      schedule.startMinutes,
      schedule.endMinutes,
      JSON.stringify(schedule.days),
      schedule.enabled ? 1 : 0,
      now,
    ],
  );
}

export function setEnabled(id: string, enabled: boolean): void {
  getDb().executeSync('UPDATE schedules SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

/** Turns off every schedule of a mode. Called when the mode is deleted. */
export function disableByMode(modeId: string): void {
  getDb().executeSync('UPDATE schedules SET enabled = 0 WHERE mode_id = ?', [modeId]);
}

export function remove(id: string): void {
  getDb().executeSync('DELETE FROM schedules WHERE id = ?', [id]);
}
