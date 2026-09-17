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
 * Local midnight of the day `days` calendar days from the day containing `at`
 * (negative goes back). Calendar arithmetic, never `at ± days * DAY`: a day is 23 or
 * 25 hours long twice a year and the subtraction would land on the wrong day.
 */
export function dayStartShifted(at: Millis, days: number): Millis {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/**
 * The instant at `minutes` past local midnight of the day containing `at`, on the
 * wall clock: 21:30 is 21:30 even on a 23 or 25 hour day, which `dayStart + minutes`
 * would miss by an hour. A minute that does not exist that day (inside the spring
 * gap) lands on the next one that does, like a phone alarm.
 */
export function atMinuteOfDay(at: Millis, minutes: number): Millis {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).getTime();
}

/** Local midnight of a DayKey. The inverse of `dayKeyOf`, for the local zone. */
export function dayKeyStart(key: DayKey): Millis {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/** The DayKey `days` calendar days after `key` (negative goes back). DST-safe. */
export function shiftDayKey(key: DayKey, days: number): DayKey {
  return dayKeyOf(dayStartShifted(dayKeyStart(key), days));
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

/** The DayKey of the Monday of the week containing `now`. */
export function weekKeyOf(now: Millis): DayKey {
  return dayKeyOf(weekStart(now));
}

/** The seven DayKeys of a week, Monday first. */
export function weekDayKeys(weekKey: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(weekKey, i));
}
