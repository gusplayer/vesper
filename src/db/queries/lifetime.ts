import { dayBounds, dayKeyOf, dayKeyStart } from '../../domain/day';
import { served } from '../../domain/session';
import * as sessionsRepo from '../repositories/sessions';

/**
 * The lifetime cards of Actividad, over every session ever closed. The day stats the
 * app caches only reach back HISTORY_DAYS (about 400), so totals built from them stop
 * growing after a year; this reads the whole table instead. Nothing is stored: like the
 * day stats, it is the sessions table folded (ADR-0016).
 *
 * The same rules as `loadDayStats`: a session counts whole on the day it started, and a
 * running one is left out because the focus store adds it live.
 */

export type LifetimeTotals = {
  totalMs: number;
  /** Days with any focus at all. */
  daysFocused: number;
  /** The largest single-day total, a proxy for the longest stretch. */
  bestDayMs: number;
  /** Local midnight of the earliest day with focus, or null when there is none. */
  firstAt: number | null;
};

export const EMPTY_LIFETIME: LifetimeTotals = { totalMs: 0, daysFocused: 0, bestDayMs: 0, firstAt: null };

export function loadLifetimeTotals(now: number): LifetimeTotals {
  const byDay = new Map<string, number>();
  for (const session of sessionsRepo.listBetween(0, dayBounds(now).dayEnd)) {
    if (session.outcome === 'running') {
      continue;
    }
    const ms = served(session, now);
    if (ms <= 0) {
      continue;
    }
    const dayKey = dayKeyOf(session.startedAt);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + ms);
  }
  if (byDay.size === 0) {
    return EMPTY_LIFETIME;
  }
  let totalMs = 0;
  let bestDayMs = 0;
  for (const ms of byDay.values()) {
    totalMs += ms;
    bestDayMs = Math.max(bestDayMs, ms);
  }
  const firstKey = [...byDay.keys()].sort()[0];
  return {
    totalMs,
    daysFocused: byDay.size,
    bestDayMs,
    firstAt: firstKey === undefined ? null : dayKeyStart(firstKey),
  };
}
