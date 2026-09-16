import { dayBounds } from '../domain/day';
import { DAY, MINUTE } from '../domain/time';
import type { Millis } from '../domain/types';
import type { RoutineWindowSpec } from './blockingTypes';

/**
 * The clock arithmetic of a routine window, shared by both platforms and by nothing
 * native. It follows activeWindow/nextStart in src/domain/routines.ts exactly, with
 * the spec's own vocabulary (startMinute, endMinute, capMinutes): Monday-first days,
 * an end at or before the start crosses midnight, a null end is the start plus the
 * cap, and a window that crossed midnight may have started yesterday.
 *
 * This file is the reference for WindowSchedule.kt in modules/vesper-blocking, which
 * mirrors it line by line so the alarms the OS fires agree with what the app shows.
 * A change here is a change there.
 */

export type WindowInstants = {
  start: Millis;
  /** Exclusive. */
  end: Millis;
};

/** What to arm at a given instant: the next start and the next end. */
export type AlarmInstants = {
  nextStart: Millis | null;
  nextEnd: Millis | null;
};

/** Shape the arithmetic needs; RoutineWindowSpec carries more. */
export type WindowTiming = Pick<RoutineWindowSpec, 'startMinute' | 'endMinute' | 'capMinutes' | 'days'>;

const LOOKAHEAD_DAYS = 8;

/** Monday-first weekday index of an instant. */
function weekdayOf(at: Millis): number {
  return (new Date(at).getDay() + 6) % 7;
}

/** The window the spec would have if it started on the day containing `dayAt`. */
export function windowOnDay(spec: WindowTiming, dayAt: Millis): WindowInstants | null {
  if (spec.days[weekdayOf(dayAt)] !== true) {
    return null;
  }
  const { dayStart } = dayBounds(dayAt);
  const start = dayStart + spec.startMinute * MINUTE;
  let end: Millis;
  if (spec.endMinute === null) {
    end = start + spec.capMinutes * MINUTE;
  } else if (spec.endMinute > spec.startMinute) {
    end = dayStart + spec.endMinute * MINUTE;
  } else {
    // Crosses midnight: 21:30 → 06:30 ends the next day.
    end = dayStart + DAY + spec.endMinute * MINUTE;
  }
  return { start, end };
}

/** The window containing `now`, if the spec is inside one right now. */
export function activeWindow(spec: WindowTiming, now: Millis): WindowInstants | null {
  for (const dayAt of [now - DAY, now]) {
    const window = windowOnDay(spec, dayAt);
    if (window !== null && now >= window.start && now < window.end) {
      return window;
    }
  }
  return null;
}

/** The first window whose start is at or after `at`, looking a week ahead. */
export function nextWindow(spec: WindowTiming, at: Millis): WindowInstants | null {
  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const window = windowOnDay(spec, at + offset * DAY);
    if (window !== null && window.start >= at) {
      return window;
    }
  }
  return null;
}

/**
 * The two instants an OS alarm should be armed for at `now`. Inside a window the
 * end is that window's and the start is the following occurrence's (strictly after
 * the one already open, so a start alarm handled at its own instant never re-arms
 * itself). Outside a window both belong to the next occurrence. Both null when no
 * day is on.
 */
export function nextWindowInstants(spec: WindowTiming, now: Millis): AlarmInstants {
  const active = activeWindow(spec, now);
  if (active !== null) {
    return { nextStart: nextWindow(spec, active.start + 1)?.start ?? null, nextEnd: active.end };
  }
  const next = nextWindow(spec, now);
  if (next === null) {
    return { nextStart: null, nextEnd: null };
  }
  return { nextStart: next.start, nextEnd: next.end };
}
