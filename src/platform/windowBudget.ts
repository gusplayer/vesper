import { windowIntervals, type RoutineWindowPlan } from '../domain/routineWindows';
import type { Millis } from '../domain/types';
import { activeWindow, nextWindow } from './routineWindows';

/**
 * iOS accepts about 20 DeviceActivity names at once and fails `startMonitoring` in
 * silence past that (docs/PLATFORM_IOS.md, "Presupuesto de schedules"). A routine on
 * all seven days costs one name; one on some days costs one per day. This keeps the
 * scheduled names under a limit so no routine loses its shield without anyone
 * knowing: daily routines first (cheapest, and the steadiest intention), then the
 * routines whose next window comes soonest. A routine that does not fit is skipped
 * and the next one is still tried, so a one-day routine can follow a five-day one
 * that did not fit. Pure, so a screen can say which routines were left out.
 *
 * Android has no such limit; the hook applies this only on iOS.
 */

/** Names kept below iOS's ~20 so a focus session and a little slack stay possible. */
export const IOS_ACTIVITY_BUDGET = 16;

export type WindowBudget = {
  kept: RoutineWindowPlan[];
  /** In priority order, with the names each one would have cost. */
  skipped: { plan: RoutineWindowPlan; cost: number }[];
};

/** How many DeviceActivity names a plan takes: one daily, or one per weekday. */
export function windowCost(plan: RoutineWindowPlan): number {
  return windowIntervals(plan).length;
}

/** The start of the window a plan is in, or of its next one; null when no day is on. */
function upcomingStart(plan: RoutineWindowPlan, now: Millis): Millis | null {
  return activeWindow(plan, now)?.start ?? nextWindow(plan, now)?.start ?? null;
}

export function windowBudget(
  plans: readonly RoutineWindowPlan[],
  limit: number = IOS_ACTIVITY_BUDGET,
  now: Millis = Date.now(),
): WindowBudget {
  const ranked = plans
    .map((plan, index) => ({ plan, index, cost: windowCost(plan), start: upcomingStart(plan, now) }))
    .filter((entry) => entry.cost > 0)
    .sort((a, b) => {
      const aDaily = a.cost === 1 && a.plan.days.every(Boolean);
      const bDaily = b.cost === 1 && b.plan.days.every(Boolean);
      if (aDaily !== bDaily) {
        return aDaily ? -1 : 1;
      }
      const aStart = a.start ?? Number.POSITIVE_INFINITY;
      const bStart = b.start ?? Number.POSITIVE_INFINITY;
      if (aStart !== bStart) {
        return aStart - bStart;
      }
      return a.index - b.index;
    });

  const kept: RoutineWindowPlan[] = [];
  const skipped: WindowBudget['skipped'] = [];
  let used = 0;
  for (const { plan, cost } of ranked) {
    if (used + cost <= limit) {
      kept.push(plan);
      used += cost;
    } else {
      skipped.push({ plan, cost });
    }
  }
  return { kept, skipped };
}
