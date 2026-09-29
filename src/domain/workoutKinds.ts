import type { WorkoutKind } from './types';

/**
 * A platform's workout type, read as a WorkoutKind (ADR-0055). Pure: the platform
 * hands the raw number here and never decides on its own what a ride is.
 *
 * A stationary bike is a ride and a treadmill is a run: the habit asks to ride, not to
 * go outside. A number this table does not know is 'other', never a guess, so a type a
 * platform adds later counts as a workout and never as a ride.
 */

/** HKWorkoutActivityType raw values (HealthKit, HKWorkout.h). */
const HEALTHKIT: Readonly<Record<number, WorkoutKind>> = {
  13: 'cycling', // cycling
  74: 'cycling', // handCycling
  37: 'running', // running
  46: 'swimming', // swimming
};

/** ExerciseSessionRecord.EXERCISE_TYPE_* (androidx.health.connect.client.records). */
const HEALTH_CONNECT: Readonly<Record<number, WorkoutKind>> = {
  8: 'cycling', // BIKING
  9: 'cycling', // BIKING_STATIONARY
  56: 'running', // RUNNING
  57: 'running', // RUNNING_TREADMILL
  73: 'swimming', // SWIMMING_OPEN_WATER
  74: 'swimming', // SWIMMING_POOL
};

function kindIn(table: Readonly<Record<number, WorkoutKind>>, raw: unknown): WorkoutKind {
  return typeof raw === 'number' && Number.isInteger(raw) ? (table[raw] ?? 'other') : 'other';
}

/** `raw` is unknown on purpose: an old native build hands nothing, and that is 'other'. */
export function workoutKindFromHealthKit(raw: unknown): WorkoutKind {
  return kindIn(HEALTHKIT, raw);
}

export function workoutKindFromHealthConnect(raw: unknown): WorkoutKind {
  return kindIn(HEALTH_CONNECT, raw);
}
