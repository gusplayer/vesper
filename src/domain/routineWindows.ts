import { MINUTE } from './time';
import { OPEN_END_CAP_MS, type RoutineLike } from './routines';
import { shieldCopy, type ShieldStrings } from './blocking';

/**
 * Routine windows as the blocking backends see them. Pure: it turns the routines and
 * modes of the store into the specs `scheduleWindow` takes, and a spec into the
 * clock intervals a system scheduler understands (iOS DeviceActivitySchedule, Android
 * exact alarms). No platform import, so the arithmetic is testable on its own.
 */

/** Every activity a routine window owns in the system starts with this. */
export const ACTIVITY_PREFIX = 'routine-';

/** Suffix of the single activity a window on all seven days gets. */
export const DAILY_SUFFIX = 'daily';

/** Apple refuses a DeviceActivitySchedule shorter than this. */
export const MIN_INTERVAL_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

/** The bits of a window the interval builder needs. `RoutineWindowSpec` fits as is. */
export type WindowLike = {
  id: string;
  startMinute: number;
  endMinute: number | null;
  capMinutes: number;
  days: ReadonlyArray<boolean>;
};

/** The bits of a mode the spec builder needs. `Mode` from src/data fits as is. */
export type WindowModeLike = {
  id: string;
  name: string;
  behavior: 'block' | 'allow';
  selectionToken: string | null;
};

/**
 * What the hook hands the platform for one routine. Structurally identical to
 * `RoutineWindowSpec` in src/platform/blockingTypes.ts, which is the contract; it is
 * repeated here so the domain keeps importing nothing from the platform.
 */
export type RoutineWindowPlan = {
  id: string;
  startMinute: number;
  endMinute: number | null;
  capMinutes: number;
  days: boolean[];
  token: string;
  kind: 'block' | 'allow';
  shieldTitle: string;
  shieldSubtitle: string;
  shieldButton: string;
};

/** A point on the clock. `weekday` follows Apple: Sunday is 1, Saturday is 7. */
export type ClockPoint = {
  hour: number;
  minute: number;
  weekday?: number;
};

/** One repeating system interval; a window has one per weekday, or one daily. */
export type WindowInterval = {
  activityName: string;
  start: ClockPoint;
  end: ClockPoint;
  /** True when the end is on the day after the start. */
  crossesMidnight: boolean;
};

/**
 * The windows the system should hold right now: every enabled, timed routine on at
 * least one day whose mode has a real selection. The cap of an open-ended window is
 * the routine's duration when it has one, like the in-app engine does.
 */
export function routineWindowPlans(
  routines: ReadonlyArray<RoutineLike>,
  modes: ReadonlyArray<WindowModeLike>,
  t?: ShieldStrings,
): RoutineWindowPlan[] {
  const plans: RoutineWindowPlan[] = [];
  for (const routine of routines) {
    if (!routine.enabled || routine.startMinutes === null || !routine.days.some(Boolean)) {
      continue;
    }
    const mode = modes.find((m) => m.id === routine.modeId);
    const token = mode?.selectionToken ?? null;
    if (mode === undefined || token === null || token.trim() === '') {
      continue;
    }
    const copy = shieldCopy(mode.name, t);
    plans.push({
      id: routine.id,
      startMinute: routine.startMinutes,
      endMinute: routine.endMinutes,
      capMinutes: Math.round((routine.durationMs ?? OPEN_END_CAP_MS) / MINUTE),
      days: [...routine.days],
      token,
      kind: mode.behavior,
      shieldTitle: copy.title,
      shieldSubtitle: copy.subtitle,
      shieldButton: copy.primaryButtonLabel,
    });
  }
  return plans;
}

/**
 * Where a window ends on the clock and whether that is the next day. Mirrors
 * `windowOnDay` in routines.ts: an end at or before the start is tomorrow's, and an
 * open end is start + cap. A window shorter than Apple's minimum is stretched to it
 * rather than dropped: fifteen minutes of shield is closer to the intention than none.
 */
export function windowEnd(window: WindowLike): { endMinute: number; crossesMidnight: boolean } {
  const start = window.startMinute;
  let end = window.endMinute ?? (start + window.capMinutes) % MINUTES_PER_DAY;
  let length = end > start ? end - start : end + MINUTES_PER_DAY - start;
  if (length < MIN_INTERVAL_MINUTES) {
    length = MIN_INTERVAL_MINUTES;
    end = (start + length) % MINUTES_PER_DAY;
  }
  return { endMinute: end, crossesMidnight: end <= start };
}

/**
 * The system intervals for a window. All seven days on: a single daily interval, so
 * a routine costs one of the ~20 activities iOS allows instead of seven. Otherwise one
 * interval per weekday, pinned with Apple's weekday number on both ends; a window
 * that crosses midnight ends on the following weekday.
 */
export function windowIntervals(window: WindowLike): WindowInterval[] {
  const days = window.days.slice(0, 7);
  if (!days.some(Boolean)) {
    return [];
  }
  const { endMinute, crossesMidnight } = windowEnd(window);
  const start = clockPoint(window.startMinute);
  const end = clockPoint(endMinute);
  if (days.length === 7 && days.every(Boolean)) {
    return [{ activityName: activityName(window.id, DAILY_SUFFIX), start, end, crossesMidnight }];
  }
  const intervals: WindowInterval[] = [];
  days.forEach((on, mondayFirst) => {
    if (!on) {
      return;
    }
    const endDay = crossesMidnight ? (mondayFirst + 1) % 7 : mondayFirst;
    intervals.push({
      activityName: activityName(window.id, String(mondayFirst)),
      start: { ...start, weekday: appleWeekday(mondayFirst) },
      end: { ...end, weekday: appleWeekday(endDay) },
      crossesMidnight,
    });
  });
  return intervals;
}

/** `routine-<id>-<suffix>`; the suffix is the Monday-first weekday index or 'daily'. */
export function activityName(id: string, suffix: string): string {
  return `${ACTIVITY_PREFIX}${id}-${suffix}`;
}

/** The routine behind an activity name, or null when the name is not one of ours. */
export function routineIdFromActivityName(name: string): string | null {
  if (!name.startsWith(ACTIVITY_PREFIX)) {
    return null;
  }
  const rest = name.slice(ACTIVITY_PREFIX.length);
  const cut = rest.lastIndexOf('-');
  if (cut <= 0 || cut === rest.length - 1) {
    return null;
  }
  return rest.slice(0, cut);
}

/** The distinct routine ids among a list of activity names, in first-seen order. */
export function routineIdsFromActivityNames(names: ReadonlyArray<string>): string[] {
  const ids: string[] = [];
  for (const name of names) {
    const id = routineIdFromActivityName(name);
    if (id !== null && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/** Monday-first index (0..6) to Apple's Gregorian weekday (Sunday 1 .. Saturday 7). */
export function appleWeekday(mondayFirst: number): number {
  return ((mondayFirst + 1) % 7) + 1;
}

function clockPoint(minuteOfDay: number): ClockPoint {
  return { hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 };
}
