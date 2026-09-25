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

/**
 * An open-ended window ("hasta que lo termines") stays open this long for the engine
 * and the OS, so the routine can start inside it. Its session is open (ADR-0047 §3c):
 * it ends when the user ends it, or at the open-session cap of domain/session.
 */
export const OPEN_END_CAP_MS = 8 * HOUR;

export const MANUAL_DEFAULT_MS = 25 * MINUTE;

export type RoutineWindow = {
  start: Millis;
  end: Millis;
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * A timed routine's window in wall-clock minutes from the midnight of the day it
 * starts, with the same rules as `windowOnDay`: a null end runs its duration (or the
 * open-end cap), an end after the start is the same day, and an end at or before the
 * start is the next day (`end` past 1440). Null for a routine you start by hand. The
 * screens use it to say what the engine will do: "(día siguiente)", overlaps.
 */
export function windowMinutes(
  routine: Pick<RoutineLike, 'startMinutes' | 'endMinutes' | 'durationMs'>,
): { start: number; end: number } | null {
  if (routine.startMinutes === null) {
    return null;
  }
  const start = routine.startMinutes;
  if (routine.endMinutes === null) {
    return { start, end: start + Math.round((routine.durationMs ?? OPEN_END_CAP_MS) / MINUTE) };
  }
  if (routine.endMinutes > start) {
    return { start, end: routine.endMinutes };
  }
  return { start, end: routine.endMinutes + MINUTES_PER_DAY };
}

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

/**
 * What the engine last started, one window per routine: `{ [routineId]: windowStart }`.
 *
 * One mark for all of them would not do. Two routines can overlap — "Trabajo" 09:00
 * to 18:00 and "Lectura" 13:00 to 13:30 — and the second one starting would erase
 * the first one's mark; when the short one closed, the long one's window would still
 * be open, read as never started, and take the phone into a four-hour session nobody
 * asked for. A mark per routine is what makes "a window never starts twice" true.
 */
export type RoutineStarts = Readonly<Record<string, Millis>>;

/**
 * Whether this routine's window is already marked: the engine started it. `null` is
 * a phone that has started nothing yet, the same as an empty record.
 */
export function isMarked(routine: RoutineLike, window: RoutineWindow, starts: RoutineStarts | null): boolean {
  return starts?.[routine.id] === window.start;
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
 * What a routine is doing right now. `starts` is what the engine started, by routine
 * (settings.routineStarts): without it a window whose session was ended early would
 * still read as active, which it is not — a window never starts twice.
 */
export function routineStatus(routine: RoutineLike, now: Millis, starts: RoutineStarts | null = null): RoutineStatus {
  if (!routine.enabled) {
    return { kind: 'off' };
  }
  if (isManual(routine)) {
    return { kind: 'manual' };
  }
  const active = activeWindow(routine, now);
  if (active !== null) {
    return isMarked(routine, active, starts)
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
  starts: RoutineStarts | null = null,
): T[] {
  const rank = (routine: T): [number, number] => {
    const status = routineStatus(routine, now, starts);
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
  /**
   * `plannedMs` is null for a window with no end time: the session starts open, and a
   * deep mode runs as firm, like "Sin límite" (ADR-0047 §3c, ADR-0022).
   */
  | { action: 'start'; routine: RoutineLike; window: RoutineWindow; plannedMs: number | null }
  | { action: 'wait'; routine: RoutineLike; window: RoutineWindow }
  | { action: 'none' };

/**
 * One tick of the engine.
 *
 * - A due window with no session running starts a session that ends with the window.
 * - A due window while a session runs waits: it never interrupts what you are doing.
 *   The next tick after that session ends will start it, if the window is still open.
 * - A window already started (same routine, same start) is never started again, even
 *   if its session was ended early. Ending it was a decision. The mark is per routine,
 *   so an overlapping routine starting does not revive the one that already ran.
 * - A window that was already open when the routine was saved is not due at all
 *   (activeWindow): saving a routine is not asking for a session right now.
 * - A window with no end time starts an open session (plannedMs null): it ends when
 *   the user ends it, not at an hour they never chose (ADR-0047 §3c).
 */
export function routineDecision(
  routines: readonly RoutineLike[],
  sessionRunning: boolean,
  starts: RoutineStarts | null,
  now: Millis,
): RoutineDecision {
  const due = dueRoutine(routines, now);
  if (due === null) {
    return { action: 'none' };
  }
  if (isMarked(due.routine, due.window, starts)) {
    return { action: 'none' };
  }
  if (sessionRunning) {
    return { action: 'wait', routine: due.routine, window: due.window };
  }
  return {
    action: 'start',
    routine: due.routine,
    window: due.window,
    plannedMs:
      due.routine.startMinutes !== null && due.routine.endMinutes === null ? null : Math.max(MINUTE, due.window.end - now),
  };
}

/**
 * The marks after a session the user ended by choice — the exit ritual or an
 * emergency unlock — at `now`: every routine window open at that moment reads as
 * started, so no waiting routine starts the instant the user chose to stop and locks
 * them in again (ADR-0047 §3b). Ending a routine's own session early was already a
 * decision (ADR-0019); ending any session is the same decision for every window open
 * then. Windows that open later start as usual. Returns `starts` itself when nothing
 * changes.
 */
export function markOpenWindows(
  routines: readonly RoutineLike[],
  starts: RoutineStarts | null,
  now: Millis,
): RoutineStarts {
  const next: Record<string, Millis> = { ...(starts ?? {}) };
  let changed = false;
  for (const routine of routines) {
    const window = activeWindow(routine, now);
    if (window !== null && next[routine.id] !== window.start) {
      next[routine.id] = window.start;
      changed = true;
    }
  }
  return changed ? next : (starts ?? {});
}

/** How long a hand-started routine runs. */
export function manualDurationMs(routine: RoutineLike): number {
  return routine.durationMs ?? MANUAL_DEFAULT_MS;
}
