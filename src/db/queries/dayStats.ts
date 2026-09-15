import type { DayStat } from '../../data/types';
import { dayBounds, dayKeyOf } from '../../domain/day';
import { served } from '../../domain/session';
import { DAY } from '../../domain/time';
import * as sessionsRepo from '../repositories/sessions';

/**
 * Day stats are not stored: they are the sessions table folded by local day. One
 * DayStat per day for the last `days` days, today included, oldest first — the shape
 * the activity tab always wanted (ADR-0016), now derived instead of seeded.
 */

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Local midnight `offset` days before the day containing `now`. Calendar days, not 24h. */
function dayStartBefore(now: number, offset: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset).getTime();
}

/**
 * The stats of every day in the window, empty days included so the charts have a
 * bar for each. A session counts on the day it started and is clipped to it.
 *
 * A running session is left out on purpose: the home counter adds it live from the
 * focus store, and counting it here too would show it twice.
 */
export function loadDayStats(now: number, days: number): DayStat[] {
  const from = dayStartBefore(now, days - 1);
  const to = dayBounds(now).dayEnd;

  const byDay = new Map<string, DayStat>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayKey = dayKeyOf(dayStartBefore(now, offset));
    byDay.set(dayKey, { dayKey, focusMs: 0, sessions: 0, segments: [] });
  }

  for (const session of sessionsRepo.listBetween(from, to)) {
    if (session.outcome === 'running') {
      continue;
    }
    const stat = byDay.get(dayKeyOf(session.startedAt));
    if (stat === undefined) {
      continue;
    }
    const ms = served(session, now);
    const { dayStart } = dayBounds(session.startedAt);
    stat.focusMs += ms;
    stat.sessions += 1;
    stat.segments.push({
      start: clamp01((session.startedAt - dayStart) / DAY),
      end: clamp01((session.startedAt + ms - dayStart) / DAY),
    });
  }

  return [...byDay.values()];
}
