import { dayKeyOf } from '../../domain/day';
import { DAY, HOUR } from '../../domain/time';
import type { DayStat } from '../../data/types';
import type { HeatCell } from '../../design/components';

/** A day with this much focus is drawn at full ink. Anything past it is still full. */
export const FULL_DAY_MS = 3 * HOUR;

/** Monday-first weekday initials, for the grid header. */
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/**
 * The last `weeks` full weeks up to today, Monday-first, one cell per day. Days after
 * today in the current week are omitted, so the grid ends on today.
 */
export function recentDayCells(stats: ReadonlyArray<DayStat>, now: number, weeks = 4): HeatCell[] {
  const byKey = new Map(stats.map((stat) => [stat.dayKey, stat]));
  const todayKey = dayKeyOf(now);
  const weekday = (new Date(now).getDay() + 6) % 7;
  const total = (weeks - 1) * 7 + weekday + 1;
  const cells: HeatCell[] = [];
  for (let offset = total - 1; offset >= 0; offset -= 1) {
    const key = dayKeyOf(now - offset * DAY);
    const focusMs = byKey.get(key)?.focusMs ?? 0;
    cells.push({ key, intensity: Math.min(1, focusMs / FULL_DAY_MS), today: key === todayKey });
  }
  return cells;
}
