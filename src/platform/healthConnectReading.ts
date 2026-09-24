import type { NativeHealthWeek, NativeSleepSession } from '../../modules/vesper-health';
import { dayKeyOf } from '../domain/day';
import type { HealthSleepSession, HealthWeek, HealthWorkout } from '../domain/healthMarks';
import type { DayKey } from '../domain/types';

/**
 * What Health Connect hands back, turned into the same HealthWeek HealthKit fills on
 * iOS (ADR-0043). Pure, so the one decision that differs between the two platforms,
 * sleep, is tested here instead of on a phone.
 *
 * Deciding which days count stays in domain/healthMarks.ts.
 */

/** Health Connect's stage ints that are sleep: sleeping, light, deep, REM. */
export const ASLEEP_STAGES: ReadonlySet<number> = new Set([2, 4, 5, 6]);

function isSpan(start: number, end: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function toStepsByDay(days: NativeHealthWeek['steps']): Record<DayKey, number> {
  const byDay: Record<DayKey, number> = {};
  for (const day of days) {
    if (!Number.isFinite(day.start) || !Number.isFinite(day.count)) {
      continue;
    }
    const dayKey = dayKeyOf(day.start);
    byDay[dayKey] = (byDay[dayKey] ?? 0) + Math.max(0, Math.round(day.count));
  }
  return byDay;
}

function toWorkouts(workouts: NativeHealthWeek['workouts']): HealthWorkout[] {
  return workouts.filter((w) => isSpan(w.start, w.end)).map((w) => ({ start: w.start, end: w.end }));
}

/**
 * One asleep span per session, ending when the session ended. A night from 23:00 to
 * 07:00 has stages on both sides of midnight; keyed stage by stage, the ones before
 * midnight would land on the wrong day. So the asleep stages are summed and the span
 * is laid back from the session's end: the morning the user wakes up gets the whole
 * night, which is what healthMarks keys sleep by. A session with no stages is all sleep.
 */
function toSleepSession(session: NativeSleepSession): HealthSleepSession | null {
  if (!isSpan(session.start, session.end)) {
    return null;
  }
  if (session.stages.length === 0) {
    return { start: session.start, end: session.end, asleep: true };
  }
  let asleepMs = 0;
  for (const stage of session.stages) {
    if (ASLEEP_STAGES.has(stage.stage) && isSpan(stage.start, stage.end)) {
      asleepMs += stage.end - stage.start;
    }
  }
  const sessionMs = session.end - session.start;
  if (asleepMs === 0) {
    return { start: session.start, end: session.end, asleep: false };
  }
  return { start: session.end - Math.min(asleepMs, sessionMs), end: session.end, asleep: true };
}

export function weekFromHealthConnect(native: NativeHealthWeek): HealthWeek {
  const sleepSessions: HealthSleepSession[] = [];
  for (const session of native.sleep) {
    const mapped = toSleepSession(session);
    if (mapped !== null) {
      sleepSessions.push(mapped);
    }
  }
  return {
    workouts: toWorkouts(native.workouts),
    stepsByDay: toStepsByDay(native.steps),
    sleepSessions,
  };
}
