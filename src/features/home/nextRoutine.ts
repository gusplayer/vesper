import { dayKeyOf } from '../../domain/day';
import { dueRoutine, nextStart, type RoutineLike } from '../../domain/routines';
import { DAY } from '../../domain/time';

/**
 * The one line under the mode on the home page: what the routines are doing right
 * now, or what the next one will do, if it is close. Pure: routines, modes and the
 * clock in, Spanish text out. Anything further than a day away says nothing, so the
 * line is news, not a calendar.
 */

/** What the line needs from a routine: the engine's fields plus its own name. */
export type NamedRoutine = RoutineLike & { name: string };

/** What the line needs from a mode: enough to name it. */
export type NamedMode = { id: string; name: string };

/** '9:05', '14:30'. Local time, twenty-four hours, no leading zero on the hour. */
function clockText(at: number): string {
  const date = new Date(at);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The mode's name is what the user recognises; the routine's own name is the fallback. */
function displayName(routine: NamedRoutine, modes: ReadonlyArray<NamedMode>): string {
  return modes.find((mode) => mode.id === routine.modeId)?.name ?? routine.name;
}

/**
 * 'Trabajo · activa hasta las 18:00' while a routine is inside its window;
 * 'Trabajo empieza a las 9:00' or 'Trabajo empieza mañana a las 9:00' when the
 * soonest start is less than a day away; null otherwise.
 */
export function nextRoutineText(
  routines: ReadonlyArray<NamedRoutine>,
  modes: ReadonlyArray<NamedMode>,
  now: number,
): string | null {
  const due = dueRoutine(routines, now);
  if (due !== null) {
    return `${displayName(due.routine, modes)} · activa hasta las ${clockText(due.window.end)}`;
  }

  let soonest: { routine: NamedRoutine; at: number } | null = null;
  for (const routine of routines) {
    const at = nextStart(routine, now);
    if (at !== null && (soonest === null || at < soonest.at)) {
      soonest = { routine, at };
    }
  }
  if (soonest === null || soonest.at - now >= DAY) {
    return null;
  }

  const name = displayName(soonest.routine, modes);
  const time = clockText(soonest.at);
  const today = dayKeyOf(soonest.at) === dayKeyOf(now);
  return today ? `${name} empieza a las ${time}` : `${name} empieza mañana a las ${time}`;
}
