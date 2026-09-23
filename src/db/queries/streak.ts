import { dayBounds, dayKeyOf, dayStartShifted } from '../../domain/day';
import { served } from '../../domain/session';
import { STREAK_WINDOW_DAYS, type DayFocus } from '../../domain/streak';
import * as sessionsRepo from '../repositories/sessions';

/**
 * The daily focus the streak is computed from (ADR-0027). Like dayStats, it is the
 * sessions table folded by local day: a session is credited whole to the day it
 * started, and the running one is left out because today is still open. Only the
 * focus figure is kept; the streak needs nothing else.
 *
 * The default window is `STREAK_WINDOW_DAYS`, the same span the store loads its day
 * stats over: `computeStreak` stops at the edge of the window it is given, so the two
 * routes to the streak have to see the same days to agree.
 */

/** Every day of the last `days` days, today included, oldest first; empty days are 0. */
export function loadDayFocus(now: number, days = STREAK_WINDOW_DAYS): DayFocus[] {
  const from = dayStartShifted(now, -(days - 1));
  const to = dayBounds(now).dayEnd;

  const byDay = new Map<string, DayFocus>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayKey = dayKeyOf(dayStartShifted(now, -offset));
    byDay.set(dayKey, { dayKey, focusMs: 0 });
  }

  for (const session of sessionsRepo.listBetween(from, to)) {
    if (session.outcome === 'running') {
      continue;
    }
    const day = byDay.get(dayKeyOf(session.startedAt));
    if (day !== undefined) {
      day.focusMs += served(session, now);
    }
  }

  return [...byDay.values()];
}
