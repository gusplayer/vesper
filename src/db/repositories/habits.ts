import {
  MAX_HABITS,
  type CountMode,
  type DayKey,
  type Habit,
  type HabitMark,
  type HealthType,
  type MarkSource,
} from '../../domain/types';
import { activityKeyOf } from '../../domain/activities';
import { canAddHabit } from '../../domain/habits';
import { uuidv7 } from '../../lib/uuid';
import { getDb, rowsAs, transaction } from '../client';
import { findByKey } from './activities';

/**
 * Habits and their marks. Two tables, one repository: a mark has no meaning without
 * its habit, and the week is read as a unit.
 */

type HabitRow = {
  id: string;
  name: string;
  activity_id: string | null;
  weekly_target: number;
  count_mode: CountMode;
  health_type: HealthType | null;
  archived_at: number | null;
  created_at: number;
};

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    activityId: row.activity_id,
    weeklyTarget: row.weekly_target,
    countMode: row.count_mode,
    healthType: row.health_type,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function listActive(): Habit[] {
  return rowsAs<HabitRow>(
    getDb().executeSync('SELECT * FROM habits WHERE archived_at IS NULL ORDER BY created_at'),
  ).map(toHabit);
}

export function findById(id: string): Habit | null {
  const row = rowsAs<HabitRow>(getDb().executeSync('SELECT * FROM habits WHERE id = ?', [id]))[0];
  return row === undefined ? null : toHabit(row);
}

export function countActive(): number {
  const result = getDb().executeSync(
    'SELECT COUNT(*) AS n FROM habits WHERE archived_at IS NULL',
  );
  const n = result.rows[0]?.n;
  return typeof n === 'number' ? n : 0;
}

/**
 * Inserts or replaces a whole habit by id. The store builds the Habit — id, activity
 * link and all — so this is the one write the prototype's editor and the demo seed
 * both use. The name is the editor's business, but the cap is not: a row that would
 * become the sixth active habit is refused here too, so rule 4 holds whatever the
 * screen did (invariant 3 in DATA_MODEL.md). Updating a habit that is already
 * active, or archiving one, never counts against it.
 */
export function upsert(habit: Habit): void {
  const existing = findById(habit.id);
  const becomesActive = habit.archivedAt === null && (existing === null || existing.archivedAt !== null);
  if (becomesActive && !canAddHabit(countActive())) {
    throw new Error(`cannot have more than ${MAX_HABITS} active habits`);
  }

  getDb().executeSync(
    `INSERT INTO habits
       (id, name, activity_id, weekly_target, count_mode, health_type, archived_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       activity_id = excluded.activity_id,
       weekly_target = excluded.weekly_target,
       count_mode = excluded.count_mode,
       health_type = excluded.health_type,
       archived_at = excluded.archived_at`,
    [
      habit.id,
      habit.name,
      habit.activityId,
      habit.weeklyTarget,
      habit.countMode,
      habit.healthType,
      habit.archivedAt,
      habit.createdAt,
    ],
  );
}

export function rename(habitId: string, name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('habit name cannot be empty');
  }
  // Re-links the activity: renaming 'leer' to 'gym' should follow the name.
  getDb().executeSync('UPDATE habits SET name = ?, activity_id = ? WHERE id = ?', [
    trimmed,
    findByKey(activityKeyOf(trimmed))?.id ?? null,
    habitId,
  ]);
}

export function setWeeklyTarget(habitId: string, weeklyTarget: number): void {
  getDb().executeSync('UPDATE habits SET weekly_target = ? WHERE id = ?', [
    weeklyTarget,
    habitId,
  ]);
}

/** Habits are archived, never deleted: their marks are history. */
export function archive(habitId: string, now: number): void {
  getDb().executeSync('UPDATE habits SET archived_at = ? WHERE id = ?', [now, habitId]);
}

type MarkRow = {
  id: string;
  habit_id: string;
  day_key: string;
  source: MarkSource;
  source_ref: string;
  duration_ms: number | null;
  marked_at: number;
};

function toMark(row: MarkRow): HabitMark {
  return {
    id: row.id,
    habitId: row.habit_id,
    dayKey: row.day_key,
    source: row.source,
    sourceRef: row.source_ref,
    durationMs: row.duration_ms,
    markedAt: row.marked_at,
  };
}

export type NewMark = {
  habitId: string;
  dayKey: DayKey;
  source: MarkSource;
  /** Health sample or session id. Empty string for a manual mark. */
  sourceRef?: string;
  durationMs?: number | null;
};

/**
 * Records a mark. INSERT OR IGNORE plus the UNIQUE index makes it idempotent, which
 * is what keeps a health sync from double counting and what limits a manual mark to
 * one a day (invariant 6).
 */
export function mark(newMark: NewMark, now: number): void {
  getDb().executeSync(
    `INSERT OR IGNORE INTO habit_marks
       (id, habit_id, day_key, source, source_ref, duration_ms, marked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv7(now),
      newMark.habitId,
      newMark.dayKey,
      newMark.source,
      newMark.sourceRef ?? '',
      newMark.durationMs ?? null,
      now,
    ],
  );
}

/** Verified marks cannot be removed by hand — invariant 5. */
export function unmarkManual(habitId: string, dayKey: DayKey): void {
  getDb().executeSync(
    "DELETE FROM habit_marks WHERE habit_id = ? AND day_key = ? AND source != 'health'",
    [habitId, dayKey],
  );
}

/**
 * Replaces the Health-sourced marks of `window` with what Health says now; without a
 * window, every one of them (disconnecting Health). Manual marks stay, and so do the
 * health marks of days the read did not cover: it used to delete them all, so a
 * verified habit kept only the current week, and a backup's could not survive a read.
 * The ids come from the caller so a re-sync writes the same rows; INSERT OR IGNORE
 * keeps the (habit, day, sample) uniqueness of invariant 6. One transaction: a
 * failure halfway must not leave the verified marks deleted until the next sync.
 */
export function replaceHealthMarks(
  marks: readonly HabitMark[],
  window?: { fromKey: DayKey; toKey: DayKey },
): void {
  transaction(() => {
    const db = getDb();
    if (window === undefined) {
      db.executeSync("DELETE FROM habit_marks WHERE source = 'health'");
    } else {
      db.executeSync("DELETE FROM habit_marks WHERE source = 'health' AND day_key >= ? AND day_key <= ?", [
        window.fromKey,
        window.toKey,
      ]);
    }
    for (const item of marks) {
      db.executeSync(
        `INSERT OR IGNORE INTO habit_marks
           (id, habit_id, day_key, source, source_ref, duration_ms, marked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.habitId, item.dayKey, 'health', item.sourceRef, item.durationMs, item.markedAt],
      );
    }
  });
}

export function listMarksBetween(fromDayKey: DayKey, toDayKey: DayKey): HabitMark[] {
  return rowsAs<MarkRow>(
    getDb().executeSync(
      'SELECT * FROM habit_marks WHERE day_key >= ? AND day_key <= ? ORDER BY day_key',
      [fromDayKey, toDayKey],
    ),
  ).map(toMark);
}
