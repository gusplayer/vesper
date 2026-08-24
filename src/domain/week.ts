import { weekStart } from './day';
import type { Millis, Session } from './types';

/**
 * The weekly focus goal. One target per week, reset on Monday — daily streaks punish
 * whoever gets sick on a Tuesday (docs/PRD.md).
 *
 * Pure. The target itself lives in settings, written from the flow that uses it.
 */

/** Offered targets, in hours. `null` means no goal, which is a valid answer. */
export const WEEKLY_TARGET_HOURS = [5, 10, 15, 20] as const;

export type WeekProgress = {
  focusMs: number;
  targetMs: number | null;
  /** 0 to 1, clamped. Null when there is no target — there is nothing to fill. */
  ratio: number | null;
  met: boolean;
  daysLeft: number;
};

/** Days remaining in the week including today, so Monday reads as 7 and Sunday as 1. */
export function daysLeftInWeek(now: Millis): number {
  const elapsedDays = Math.floor((now - weekStart(now)) / 86_400_000);
  return Math.max(1, 7 - elapsedDays);
}

export function weekProgress(
  sessions: Session[],
  servedMs: (session: Session) => number,
  targetMs: number | null,
  now: Millis,
): WeekProgress {
  const focusMs = sessions.reduce((total, session) => total + servedMs(session), 0);

  return {
    focusMs,
    targetMs,
    ratio:
      targetMs === null || targetMs <= 0 ? null : Math.min(1, Math.max(0, focusMs / targetMs)),
    met: targetMs !== null && targetMs > 0 && focusMs >= targetMs,
    daysLeft: daysLeftInWeek(now),
  };
}
