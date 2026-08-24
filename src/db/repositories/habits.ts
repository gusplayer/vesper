import {
  MAX_HABITS,
  type CountMode,
  type DayKey,
  type Habit,
  type HabitMark,
  type HealthType,
  type MarkSource,
} from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { getDb } from '../client';
import { findByKey } from './activities';

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
  const result = getDb().executeSync(
    'SELECT * FROM habits WHERE archived_at IS NULL ORDER BY created_at',
  );
  return (result.rows as unknown as HabitRow[]).map(toHabit);
}

export function countActive(): number {
  const result = getDb().executeSync(
    'SELECT COUNT(*) AS n FROM habits WHERE archived_at IS NULL',
  );
  const n = result.rows[0]?.n;
  return typeof n === 'number' ? n : 0;
}

export type NewHabit = {
  name: string;
  weeklyTarget: number;
  countMode: CountMode;
  healthType: HealthType | null;
};

/**
 * Creates a habit.
 *
 * The name is free text (ADR-0008), but when it matches an existing activity key the
 * habit is linked to it, so the day ledger shows one row instead of two that mean the
 * same thing.
 *
 * Enforces the 5-habit cap here rather than in SQL: invariant 3 is a product decision
 * and the error has to be legible to the UI.
 */
export function insert(habit: NewHabit, now: number): Habit {
  if (countActive() >= MAX_HABITS) {
    throw new Error(`cannot have more than ${MAX_HABITS} active habits`);
  }

  const name = habit.name.trim();
  if (name.length === 0) {
    throw new Error('habit name cannot be empty');
  }

  const created: Habit = {
    id: uuidv7(now),
    name,
    activityId: findByKey(name.toLowerCase())?.id ?? null,
    weeklyTarget: habit.weeklyTarget,
    countMode: habit.countMode,
    healthType: habit.healthType,
    archivedAt: null,
    createdAt: now,
  };

  getDb().executeSync(
    `INSERT INTO habits
       (id, name, activity_id, weekly_target, count_mode, health_type, archived_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      created.id,
      created.name,
      created.activityId,
      created.weeklyTarget,
      created.countMode,
      created.healthType,
      created.createdAt,
    ],
  );

  return created;
}

export function rename(habitId: string, name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('habit name cannot be empty');
  }
  // Re-links the activity: renaming 'leer' to 'gym' should follow the name.
  getDb().executeSync('UPDATE habits SET name = ?, activity_id = ? WHERE id = ?', [
    trimmed,
    findByKey(trimmed.toLowerCase())?.id ?? null,
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

export function listMarksBetween(fromDayKey: DayKey, toDayKey: DayKey): HabitMark[] {
  const result = getDb().executeSync(
    'SELECT * FROM habit_marks WHERE day_key >= ? AND day_key <= ? ORDER BY day_key',
    [fromDayKey, toDayKey],
  );
  return (result.rows as unknown as MarkRow[]).map(toMark);
}
