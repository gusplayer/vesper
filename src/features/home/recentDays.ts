import { dayKeyOf } from '../../domain/day';
import { DAY, HOUR } from '../../domain/time';
import type { DayStat } from '../../data/types';
import type { HeatCell } from '../../design/components';
import type { Strings } from '../../i18n/es';

/** A day with this much focus is drawn at full ink. Anything past it is still full. */
export const FULL_DAY_MS = 3 * HOUR;

export type RecentDaysStrings = Strings['focus']['recentDays'];

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

/** How many of the cells had any focus at all. */
export function focusedDayCount(cells: ReadonlyArray<HeatCell>): number {
  return cells.filter((cell) => cell.intensity > 0).length;
}

/** What VoiceOver reads for the grid: the count, then what a tap does. */
export function gridSummary(cells: ReadonlyArray<HeatCell>, t: RecentDaysStrings): string {
  return t.gridSummary(focusedDayCount(cells));
}
