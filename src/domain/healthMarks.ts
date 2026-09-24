import { dayKeyOf, weekStart } from './day';
import { healthTypeFor } from './habits';
import { HOUR, MINUTE } from './time';
import type { DayKey, Habit, HabitMark, HealthType, Millis } from './types';

/**
 * Turns a week of Health data into habit marks. Pure: the platform reads HealthKit
 * and hands the numbers here; the store replaces every health-sourced mark with the
 * result (setHealthMarks). Verified habits only — a declared habit never gets a mark
 * from Health, and the two are never mixed (ADR-0005).
 *
 * Ids are deterministic (`hm-<habit>-<day>`) so a resync yields the same marks and
 * nothing in the UI flickers.
 */

export type HealthWorkout = {
  start: Millis;
  end: Millis;
};

export type HealthSleepSession = {
  start: Millis;
  end: Millis;
  /** True for the asleep stages (asleep, core, deep, REM); false for in bed or awake. */
  asleep: boolean;
};

export type HealthWeek = {
  workouts: HealthWorkout[];
  /** Steps per local day. */
  stepsByDay: Record<DayKey, number>;
  sleepSessions: HealthSleepSession[];
};

export const EMPTY_HEALTH_WEEK: HealthWeek = { workouts: [], stepsByDay: {}, sleepSessions: [] };

/** Steps that make a day count when the habit name says nothing. */
export const STEP_GOAL = 8000;

/** A workout shorter than this is a false start, not a session. */
export const MIN_WORKOUT_MS = 10 * MINUTE;

/** Hours of sleep that make a night count when the habit name says nothing. */
export const DEFAULT_SLEEP_HOURS = 7;

const SLEEP_HOURS_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:h\b|hs\b|horas?\b)/i;
const MIN_SLEEP_HOURS = 1;
const MAX_SLEEP_HOURS = 16;

/**
 * 'dormir 7h' → 7, 'dormir 7,5 horas' → 7.5. Anything missing or absurd falls back to
 * the default: the name is free text (ADR-0008) and cannot be trusted to be a number.
 */
export function sleepHoursFor(name: string): number {
  const match = SLEEP_HOURS_PATTERN.exec(name);
  if (match?.[1] === undefined) {
    return DEFAULT_SLEEP_HOURS;
  }
  const hours = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(hours) || hours < MIN_SLEEP_HOURS || hours > MAX_SLEEP_HOURS) {
    return DEFAULT_SLEEP_HOURS;
  }
  return hours;
}

/**
 * A step count written in the name, with its unit: '10.000 pasos', '10,000 steps',
 * '10000 pasos', '10k pasos', '12 mil pasos', '8.5k steps'. The unit is required, so
 * 'caminar 30 minutos' or 'caminar 5 km' never read as a goal.
 */
const STEP_GOAL_PATTERN = /(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|mil)?\s*(?:pasos|steps?)\b/i;
const THOUSANDS_PATTERN = /^\d{1,3}(?:[.,\s]\d{3})+$/;
const MIN_STEP_GOAL = 1000;
const MAX_STEP_GOAL = 50000;

/**
 * 'caminar 10.000 pasos' → 10000, '10k steps' → 10000, '12 mil pasos' → 12000. The
 * sibling of sleepHoursFor (ADR-0042): the goal lives in the name, so a challenge's
 * name gives every participant the same one. Anything missing or absurd falls back to
 * STEP_GOAL.
 */
export function stepGoalFor(name: string): number {
  const match = STEP_GOAL_PATTERN.exec(name);
  const digits = match?.[1];
  if (digits === undefined) {
    return STEP_GOAL;
  }
  // '10.000' and '10,000' are thousands; '8.5' and '8,5' are decimals of a 'k'.
  const value = THOUSANDS_PATTERN.test(digits) ? Number(digits.replace(/[.,\s]/g, '')) : Number(digits.replace(',', '.'));
  const steps = Math.round(match?.[2] === undefined ? value : value * 1000);
  if (!Number.isFinite(steps) || steps < MIN_STEP_GOAL || steps > MAX_STEP_GOAL) {
    return STEP_GOAL;
  }
  return steps;
}

type DayTotals = Map<DayKey, number>;

/** Total workout ms per day, for days that had at least one real workout. */
function workoutDays(workouts: readonly HealthWorkout[]): DayTotals {
  const totals: DayTotals = new Map();
  const qualified = new Set<DayKey>();
  for (const workout of workouts) {
    const ms = Math.max(0, workout.end - workout.start);
    if (ms === 0) {
      continue;
    }
    // A workout belongs to the day it started; nobody trains across midnight on purpose.
    const dayKey = dayKeyOf(workout.start);
    totals.set(dayKey, (totals.get(dayKey) ?? 0) + ms);
    if (ms >= MIN_WORKOUT_MS) {
      qualified.add(dayKey);
    }
  }
  for (const dayKey of totals.keys()) {
    if (!qualified.has(dayKey)) {
      totals.delete(dayKey);
    }
  }
  return totals;
}

function stepDays(stepsByDay: Readonly<Record<DayKey, number>>, goal: number): DayTotals {
  const totals: DayTotals = new Map();
  for (const [dayKey, steps] of Object.entries(stepsByDay)) {
    if (steps >= goal) {
      totals.set(dayKey, steps);
    }
  }
  return totals;
}

/**
 * Asleep ms per night, keyed by the day the sleep ended: Sunday night's sleep counts
 * for Monday, which is the morning the user wakes up and looks at the app.
 */
function sleepNights(sessions: readonly HealthSleepSession[], minMs: number): DayTotals {
  const totals: DayTotals = new Map();
  for (const session of sessions) {
    const ms = Math.max(0, session.end - session.start);
    if (!session.asleep || ms === 0) {
      continue;
    }
    const dayKey = dayKeyOf(session.end);
    totals.set(dayKey, (totals.get(dayKey) ?? 0) + ms);
  }
  for (const [dayKey, ms] of totals) {
    if (ms < minMs) {
      totals.delete(dayKey);
    }
  }
  return totals;
}

function daysFor(habit: Habit, type: HealthType, week: HealthWeek): DayTotals {
  switch (type) {
    case 'workout':
      return workoutDays(week.workouts);
    case 'steps':
      return stepDays(week.stepsByDay, stepGoalFor(habit.name));
    case 'sleep':
      return sleepNights(week.sleepSessions, sleepHoursFor(habit.name) * HOUR);
  }
}

/** Steps are a count, not a duration; the mark carries no time for them. */
function durationFor(type: HealthType, total: number): number | null {
  return type === 'steps' ? null : total;
}

/**
 * One mark per verified habit per day Health confirms it, within the week of `now`
 * and never in the future. Archived habits and declared habits are ignored.
 */
export function marksFromHealth(
  habits: readonly Habit[],
  week: HealthWeek,
  now: Millis,
): HabitMark[] {
  const fromKey = dayKeyOf(weekStart(now));
  const toKey = dayKeyOf(now);
  const marks: HabitMark[] = [];

  for (const habit of habits) {
    if (habit.archivedAt !== null || habit.countMode !== 'verified') {
      continue;
    }
    const type = habit.healthType ?? healthTypeFor(habit.name);
    if (type === null) {
      continue;
    }
    const days = [...daysFor(habit, type, week)].sort(([a], [b]) => a.localeCompare(b));
    for (const [dayKey, total] of days) {
      // DayKeys are 'YYYY-MM-DD', so string order is date order.
      if (dayKey < fromKey || dayKey > toKey) {
        continue;
      }
      marks.push({
        id: `hm-${habit.id}-${dayKey}`,
        habitId: habit.id,
        dayKey,
        source: 'health',
        sourceRef: `hk-${type}-${dayKey}`,
        durationMs: durationFor(type, total),
        markedAt: now,
      });
    }
  }

  return marks;
}
