import { atMinuteOfDay, dayStartShifted } from './day';
import { HOUR, MINUTE } from './time';
import type { Millis } from './types';

/**
 * Routines: a mode, and either a window (start, optional end, weekdays) or nothing
 * but a duration ("cuando quieras"). The engine below decides, from the clock alone,
 * which routine is due and what to do about it. Pure: the platform hook feeds it the
 * time and the running session.
 */

export type RoutineLike = {
  id: string;
  modeId: string;
  /** Minutes from local midnight, or null for a routine you start by hand. */
  startMinutes: number | null;
  /** Null means "until you end it" (capped by OPEN_END_CAP_MS). */
  endMinutes: number | null;
  /** Monday first. Ignored when startMinutes is null. */
  days: readonly boolean[];
  enabled: boolean;
  /** Session length for a hand-started routine; also the cap for an open-ended window. */
  durationMs: number | null;
  /**
   * When the routine was last saved or switched on. A window that was already open at
   * that instant does not count: the user did not ask for a session that was "due"
   * the moment they created the routine. Absent means every window counts.
   */
  updatedAt?: Millis;
};

/** An open-ended window ("hasta que lo termines") still ends on its own, eventually. */
export const OPEN_END_CAP_MS = 8 * HOUR;

export const MANUAL_DEFAULT_MS = 25 * MINUTE;

export type RoutineWindow = {
  start: Millis;
  end: Millis;
};

/** Monday-first weekday index of an instant. */
function weekdayOf(at: Millis): number {
  return (new Date(at).getDay() + 6) % 7;
}

function isManual(routine: RoutineLike): boolean {
  return routine.startMinutes === null;
}

/** The window a timed routine would have if it started on the day containing `dayAt`. */
function windowOnDay(routine: RoutineLike, dayAt: Millis): RoutineWindow | null {
  if (routine.startMinutes === null || !routine.days[weekdayOf(dayAt)]) {
    return null;
  }
  // Wall-clock minutes, so 21:30 is 21:30 on a DST day too (atMinuteOfDay).
  const start = atMinuteOfDay(dayAt, routine.startMinutes);
  let end: Millis;
  if (routine.endMinutes === null) {
    end = start + (routine.durationMs ?? OPEN_END_CAP_MS);
  } else if (routine.endMinutes > routine.startMinutes) {
    end = atMinuteOfDay(dayAt, routine.endMinutes);
  } else {
    // Crosses midnight: 21:30 → 06:30 ends the next day.
    end = atMinuteOfDay(dayStartShifted(dayAt, 1), routine.endMinutes);
  }
  return { start, end };
}

/**
 * A window that opened before the routine was last saved was already open when the
 * routine became what it is. It never counts: only windows that open afterwards do.
 */
function openedBeforeSave(routine: RoutineLike, window: RoutineWindow): boolean {
  return routine.updatedAt !== undefined && window.start < routine.updatedAt;
}

/**
 * The window containing `now`, if the routine is inside one right now. A window
 * that was already open when the routine was saved is not one of them.
 */
export function activeWindow(routine: RoutineLike, now: Millis): RoutineWindow | null {
  if (!routine.enabled || isManual(routine)) {
    return null;
  }
  // A window that crossed midnight may have started yesterday. Yesterday is found on
  // the calendar, not as `now - DAY`: on the day after a 23-hour DST day that
  // subtraction skips a day and the window is missed.
  for (const dayAt of [dayStartShifted(now, -1), now]) {
    const window = windowOnDay(routine, dayAt);
    if (window !== null && now >= window.start && now < window.end) {
      return openedBeforeSave(routine, window) ? null : window;
    }
  }
  return null;
}

/** The next start at or after `now`, looking one week ahead. Null for manual or off. */
export function nextStart(routine: RoutineLike, now: Millis): Millis | null {
  if (!routine.enabled || isManual(routine)) {
    return null;
  }
  for (let offset = 0; offset < 8; offset += 1) {
    const window = windowOnDay(routine, dayStartShifted(now, offset));
    if (window !== null && window.start >= now) {
      return window.start;
    }
  }
  return null;
}

/** What the engine last did, so a window never starts twice. */
export type RoutineMark = {
  routineId: string;
  windowStart: Millis;
};

/** Whether `mark` is this routine's window: the engine already started it. */
export function isMarked(routine: RoutineLike, window: RoutineWindow, mark: RoutineMark | null): boolean {
  return mark !== null && mark.routineId === routine.id && mark.windowStart === window.start;
}

export type RoutineStatus =
  | { kind: 'off' }
  | { kind: 'manual' }
  /** Inside a window the engine has not started yet. */
  | { kind: 'active'; until: Millis }
  /**
   * Inside a window the engine already started. Its session may still run, or the
   * user may have ended it early: either way this window is done, it will not start
   * again. `next` is the following start, so the list can say when.
   */
  | { kind: 'started'; until: Millis; next: Millis | null }
  | { kind: 'next'; at: Millis }
  | { kind: 'never' };

/**
 * What a routine is doing right now. `lastMark` is what the engine last started
 * (settings.lastRoutineStart): without it a window whose session was ended early
 * would still read as active, which it is not — a window never starts twice.
 */
export function routineStatus(routine: RoutineLike, now: Millis, lastMark: RoutineMark | null = null): RoutineStatus {
  if (!routine.enabled) {
    return { kind: 'off' };
  }
  if (isManual(routine)) {
    return { kind: 'manual' };
  }
  const active = activeWindow(routine, now);
  if (active !== null) {
    return isMarked(routine, active, lastMark)
      ? { kind: 'started', until: active.end, next: nextStart(routine, now) }
      : { kind: 'active', until: active.end };
  }
  const at = nextStart(routine, now);
  return at === null ? { kind: 'never' } : { kind: 'next', at };
}

/**
 * List order for the Rutinas tab: what is running first, then what comes soonest,
 * then the ones you start by hand, then the ones that are off.
 */
export function sortRoutines<T extends RoutineLike>(
  routines: readonly T[],
  now: Millis,
  lastMark: RoutineMark | null = null,
): T[] {
  const rank = (routine: T): [number, number] => {
    const status = routineStatus(routine, now, lastMark);
    switch (status.kind) {
      case 'active':
      case 'started':
        return [0, status.until];
      case 'next':
        return [1, status.at];
      case 'manual':
        return [2, 0];
      case 'never':
        return [3, 0];
      case 'off':
        return [4, 0];
    }
  };
  return [...routines]
    .map((routine) => ({ routine, rank: rank(routine) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1])
    .map((item) => item.routine);
}

/**
 * The routine that should be running now. When two windows overlap, the one that
 * started most recently wins: the later intention is the current one.
 */
export function dueRoutine<T extends RoutineLike>(
  routines: readonly T[],
  now: Millis,
): { routine: T; window: RoutineWindow } | null {
  let best: { routine: T; window: RoutineWindow } | null = null;
  for (const routine of routines) {
    const window = activeWindow(routine, now);
    if (window !== null && (best === null || window.start > best.window.start)) {
      best = { routine, window };
    }
  }
  return best;
}

export type RoutineDecision =
  | { action: 'start'; routine: RoutineLike; window: RoutineWindow; plannedMs: number }
  | { action: 'wait'; routine: RoutineLike; window: RoutineWindow }
  | { action: 'none' };

/**
 * One tick of the engine.
 *
 * - A due window with no session running starts a session that ends with the window.
 * - A due window while a session runs waits: it never interrupts what you are doing.
 *   The next tick after that session ends will start it, if the window is still open.
 * - A window already started (same routine, same start) is never started again, even
 *   if its session was ended early. Ending it was a decision.
 * - A window that was already open when the routine was saved is not due at all
 *   (activeWindow): saving a routine is not asking for a session right now.
 */
export function routineDecision(
  routines: readonly RoutineLike[],
  sessionRunning: boolean,
  lastMark: RoutineMark | null,
  now: Millis,
): RoutineDecision {
  const due = dueRoutine(routines, now);
  if (due === null) {
    return { action: 'none' };
  }
  if (isMarked(due.routine, due.window, lastMark)) {
    return { action: 'none' };
  }
  if (sessionRunning) {
    return { action: 'wait', routine: due.routine, window: due.window };
  }
  return {
    action: 'start',
    routine: due.routine,
    window: due.window,
    plannedMs: Math.max(MINUTE, due.window.end - now),
  };
}

/** How long a hand-started routine runs. */
export function manualDurationMs(routine: RoutineLike): number {
  return routine.durationMs ?? MANUAL_DEFAULT_MS;
}
