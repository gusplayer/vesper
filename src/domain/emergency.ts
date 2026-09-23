import { dayKeyOf } from './day';
import { monthKeyOf } from './streak';
import type { DayKey, Millis } from './types';

/**
 * The emergency unlock's monthly budget (ADR-0025, made load-bearing by ADR-0035).
 *
 * Ajustes and the session screen have always said "cinco al mes", and the store only
 * ever counted down: five per install, for ever. That was survivable while every
 * session could be ended by hand; with a key session it is the only way out that does
 * not depend on somebody else, so it has to be true.
 *
 * The month is the local calendar month of the day the app is looking at, recorded
 * next to the count. Crossing into a new month refills; nothing else does, and the
 * count is never raised by a clock moved backwards — an unknown or later stored month
 * is left alone rather than treated as a refill.
 */

export type EmergencyBudget = {
  left: number;
  total: number;
  /** 'YYYY-MM' the count belongs to, or null on a database written before this. */
  monthKey: string | null;
};

/** The budget as it should be for `now`. Returns the same numbers when nothing is owed. */
export function refilled(budget: EmergencyBudget, now: Millis): EmergencyBudget {
  return refilledOn(budget, dayKeyOf(now));
}

/** The same, for a day key already in hand. */
export function refilledOn(budget: EmergencyBudget, today: DayKey): EmergencyBudget {
  const month = monthKeyOf(today);
  if (budget.monthKey === month) {
    return budget;
  }
  // A database from before the month was recorded, or a month that is not this one:
  // either way this month has not been spent yet.
  return { left: budget.total, total: budget.total, monthKey: month };
}

/** Spending one, refilling first if the month turned over while nobody looked. */
export function spend(budget: EmergencyBudget, now: Millis): EmergencyBudget {
  const current = refilled(budget, now);
  return { ...current, left: Math.max(0, current.left - 1) };
}
