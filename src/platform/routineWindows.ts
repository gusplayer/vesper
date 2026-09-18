import { atMinuteOfDay, dayStartShifted } from '../domain/day';
import { MINUTE } from '../domain/time';
import type { Millis } from '../domain/types';
import type { RoutineWindowSpec } from './blockingTypes';

/**
 * The clock arithmetic of a routine window, shared by both platforms and by nothing
 * native. It follows activeWindow/nextStart in src/domain/routines.ts exactly, with
 * the spec's own vocabulary (startMinute, endMinute, capMinutes): Monday-first days,
 * an end at or before the start crosses midnight, a null end is the start plus the
 * cap, and a window that crossed midnight may have started yesterday. The spec's
 * `notBefore` is the domain's `updatedAt` (ADR-0026 §7): an occurrence that started
 * before it never counts, neither as "active now" nor as the next start, so the OS
 * never raises a shield for a window the user saved themselves into.
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
export type WindowTiming = Pick<RoutineWindowSpec, 'startMinute' | 'endMinute' | 'capMinutes' | 'days' | 'notBefore'>;

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
  // Wall-clock minutes, not offsets from midnight: a 23 or 25 hour day keeps 21:30.
  const start = atMinuteOfDay(dayAt, spec.startMinute);
  let end: Millis;
  if (spec.endMinute === null) {
    end = start + spec.capMinutes * MINUTE;
  } else if (spec.endMinute > spec.startMinute) {
    end = atMinuteOfDay(dayAt, spec.endMinute);
  } else {
    // Crosses midnight: 21:30 → 06:30 ends the next day.
    end = atMinuteOfDay(dayStartShifted(dayAt, 1), spec.endMinute);
  }
  return { start, end };
}

/** The occurrence containing `now`, `notBefore` or not. */
function containingWindow(spec: WindowTiming, now: Millis): WindowInstants | null {
  for (const dayAt of [dayStartShifted(now, -1), now]) {
    const window = windowOnDay(spec, dayAt);
    if (window !== null && now >= window.start && now < window.end) {
      return window;
    }
  }
  return null;
}

/** An occurrence that started before `notBefore` was already open when the routine was saved. */
function openedBeforeSave(spec: WindowTiming, window: WindowInstants): boolean {
  return window.start < spec.notBefore;
}

/**
 * The window containing `now`, if the spec is inside one right now. An occurrence that
 * was already open at `notBefore` is not one of them (activeWindow in routines.ts).
 */
export function activeWindow(spec: WindowTiming, now: Millis): WindowInstants | null {
  const window = containingWindow(spec, now);
  return window !== null && openedBeforeSave(spec, window) ? null : window;
}

/**
 * The occurrence containing `now` that `notBefore` rules out, if any: the one the OS
 * must not open even though the clock is inside it. iOS needs it to tell DeviceActivity
 * where that occurrence ends; Android arms nothing for it and needs nothing more.
 */
export function skippedWindow(spec: WindowTiming, now: Millis): WindowInstants | null {
  const window = containingWindow(spec, now);
  return window !== null && openedBeforeSave(spec, window) ? window : null;
}

/**
 * The first window whose start is at or after `at` and not before `notBefore`, looking
 * a week ahead from the later of the two.
 */
export function nextWindow(spec: WindowTiming, at: Millis): WindowInstants | null {
  const from = Math.max(at, spec.notBefore);
  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const window = windowOnDay(spec, offset === 0 ? from : dayStartShifted(from, offset));
    if (window !== null && window.start >= from) {
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
 * day is on. Inside an occurrence `notBefore` rules out, both belong to the following
 * one: its end alarm is never armed, so it neither opens nor closes anything.
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
