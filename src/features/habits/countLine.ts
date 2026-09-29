import { healthTypeFor, workoutKindFor } from '../../domain/habits';
import { MIN_WORKOUT_MS } from '../../domain/healthMarks';
import { MINUTE } from '../../domain/time';
import type { Strings } from '../../i18n/es';
import { stepGoalText } from '../health/format';

/** The shortest workout Health counts, in the minutes the copy says. */
export const WORKOUT_FLOOR_MINUTES = MIN_WORKOUT_MS / MINUTE;

/**
 * Which workouts a workout name counts (ADR-0055): 'Montar en bici' says rides, and a
 * name that names no sport says any workout. Null for a name that is not a workout.
 */
export function workoutKindText(name: string, t: Strings['habits']['form']): string | null {
  const trimmed = name.trim();
  if (healthTypeFor(trimmed) !== 'workout') {
    return null;
  }
  return t.workoutKind[workoutKindFor(trimmed) ?? 'any'](WORKOUT_FLOOR_MINUTES);
}

/**
 * The line under a habit's or a challenge's name that says which days count, read
 * from the name like everything else about it: the step goal of a steps name
 * (ADR-0042), the kind of a workout name (ADR-0055). Days, never distance or pace.
 * Null for any other name, so the line only shows where the name decides something.
 * Pure.
 */
export function countLineText(name: string, t: Strings['habits']['form'], tag: string): string | null {
  return stepGoalText(name, t, tag) ?? workoutKindText(name, t);
}
