import { dayKeyOf } from '../domain/day';
import { monthKeyOf } from '../domain/streak';
import type { Settings } from './types';

/**
 * The emergency unlocks are five a month (ADR-0025). The count lives in settings with
 * the month it belongs to; these pure helpers decide when it fills again, so the store
 * only has to write what they return.
 */

type EmergencyCount = Pick<Settings, 'emergencyLeft' | 'emergencyTotal' | 'emergencyMonthKey'>;

/** The local month an instant falls in: '2026-09'. */
export function emergencyMonthOf(now: number): string {
  return monthKeyOf(dayKeyOf(now));
}

/**
 * The count for the month `now` is in. When the stored count belongs to another month
 * (or to none yet, as on an upgrade) it is full again and stamped with this month.
 * Null when it already belongs to this month, so nothing needs writing.
 */
export function settledEmergency(
  count: EmergencyCount,
  now: number,
): Pick<Settings, 'emergencyLeft' | 'emergencyMonthKey'> | null {
  const month = emergencyMonthOf(now);
  if (count.emergencyMonthKey === month) {
    return null;
  }
  return { emergencyLeft: count.emergencyTotal, emergencyMonthKey: month };
}

/** Local midnight of the first day of next month: when the count fills again. */
export function nextEmergencyRefill(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}
