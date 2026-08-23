import type { DayKey, Millis } from './types';

/**
 * Local day and week boundaries. Pure, but unlike the rest of domain/ it does use the
 * Date constructor — that is the only way to know where a local day starts, and a day
 * is a local concept: it is 23 or 25 hours long twice a year.
 */

export type DayBounds = {
  dayStart: Millis;
  dayEnd: Millis;
};

/** The local day containing `now`. dayEnd is exclusive. */
export function dayBounds(now: Millis): DayBounds {
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  return { dayStart: start.getTime(), dayEnd: end.getTime() };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 'YYYY-MM-DD' in local time. The key habit marks are counted by. */
export function dayKeyOf(now: Millis): DayKey {
  const date = new Date(now);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Start of the local week, Monday. Weekly goals reset on Monday because daily streaks
 * punish whoever gets sick on a Tuesday — see docs/PRD.md.
 */
export function weekStart(now: Millis): Millis {
  const date = new Date(now);
  // getDay() is 0 for Sunday, so Sunday belongs to the week that started 6 days ago.
  const daysSinceMonday = (date.getDay() + 6) % 7;
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysSinceMonday,
  );

  return monday.getTime();
}
