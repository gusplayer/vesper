import { activeWindow, isMarked, type RoutineLike, type RoutineStarts, type RoutineWindow } from '../../domain/routines';
import type { Session } from '../../domain/types';

/**
 * The routine that started this session, if one did. The session row does not name
 * it, so it is recognised the way the engine made it (platform/hooks/useRoutineSync):
 * the routine's mode, a window around the start that the engine marked, and a planned
 * length that ends with that window. A session started by hand in the same mode, even
 * inside the window, has its own length and is not claimed.
 *
 * Pure: the session, the routines and the marks come in, the routine and its window
 * come out.
 */
export function sessionRoutine<T extends RoutineLike>(
  session: Pick<Session, 'startedAt' | 'plannedMs' | 'open' | 'blockProfile'>,
  routines: readonly T[],
  starts: RoutineStarts | null,
): { routine: T; window: RoutineWindow } | null {
  if (session.open) {
    return null;
  }
  for (const routine of routines) {
    if (routine.modeId !== session.blockProfile) {
      continue;
    }
    const window = activeWindow(routine, session.startedAt);
    if (window !== null && isMarked(routine, window, starts) && session.startedAt + session.plannedMs === window.end) {
      return { routine, window };
    }
  }
  return null;
}
