import type { DayStat } from '../../data/types';
import { dayKeyOf, weekStart } from '../../domain/day';
import { HOUR } from '../../domain/time';
import { durationText } from '../../lib/format';
import {
  dayOfMonth,
  daysInMonth,
  midnightOf,
  monthLabel,
  monthStart,
  shiftDays,
  weekdayIndex,
  weekdayShort,
} from './dates';

/**
 * Pure selectors over the day stats for the activity tab. Each one takes the whole
 * history and a clock and answers one question a chart asks. No React in here, so
 * they can be memoised by the caller and tested without a renderer.
 *
 * `offset` counts periods back from the one containing `now`: 0 is this week (or
 * month), 1 the previous one.
 */

/** Shaped like the design system's `Bar`, without importing it. */
export type ChartBar = {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  highlight?: boolean;
};

export type Guide = { value: number; label: string };

export type Delta = {
  /** Whole percent, absolute value. */
  percent: number;
  direction: 'up' | 'down' | 'flat';
};

export type CalendarDay = {
  dayKey: string;
  /** Local midnight. */
  at: number;
  isToday: boolean;
  isFuture: boolean;
  stat: DayStat;
};

export type RhythmRow = { key: string; label: string; value: number; valueText: string };

export type LifetimeTotals = {
  totalMs: number;
  /** Days with any focus at all. */
  daysFocused: number;
  /** The largest single-day total — a proxy for the longest session. */
  bestDayMs: number;
  /** Local midnight of the earliest day with data, or null when there is none. */
  firstAt: number | null;
};

export type MonthGrid = {
  key: string;
  at: number;
  /** 'sep 2026'. */
  label: string;
  /** One flag per day of the month: focused or not. */
  cells: boolean[];
};

const EMPTY_STAT: Omit<DayStat, 'dayKey'> = { focusMs: 0, sessions: 0, segments: [] };

function indexStats(stats: ReadonlyArray<DayStat>): ReadonlyMap<string, DayStat> {
  return new Map(stats.map((stat) => [stat.dayKey, stat]));
}

function calendarDay(index: ReadonlyMap<string, DayStat>, at: number, now: number): CalendarDay {
  const dayKey = dayKeyOf(at);
  const todayKey = dayKeyOf(now);
  return {
    dayKey,
    at,
    isToday: dayKey === todayKey,
    isFuture: dayKey > todayKey,
    stat: index.get(dayKey) ?? { dayKey, ...EMPTY_STAT },
  };
}

function averageOfFocused(days: ReadonlyArray<CalendarDay>): number | null {
  const focused = days.filter((day) => !day.isFuture && day.stat.focusMs > 0);
  if (focused.length === 0) {
    return null;
  }
  return focused.reduce((total, day) => total + day.stat.focusMs, 0) / focused.length;
}

/** The seven days of the week `offset` weeks back, Monday first. */
export function weekDays(stats: ReadonlyArray<DayStat>, now: number, offset = 0): CalendarDay[] {
  const index = indexStats(stats);
  const monday = shiftDays(weekStart(now), -7 * offset);
  return Array.from({ length: 7 }, (_, i) => calendarDay(index, shiftDays(monday, i), now));
}

export function weekBars(stats: ReadonlyArray<DayStat>, now: number, offset = 0): ChartBar[] {
  return weekDays(stats, now, offset).map((day, i) => ({
    key: day.dayKey,
    label: weekdayShort(i),
    sublabel: String(dayOfMonth(day.at)),
    value: day.stat.focusMs,
    highlight: day.isToday,
  }));
}

/**
 * Mean focus per day over the days of that week that have happened: Monday to today
 * for the current week, all seven for a past one. A day off counts as zero, so the
 * number is honest about the week and not just about the good days. Null when the
 * week has no focus at all.
 */
export function weekAverage(stats: ReadonlyArray<DayStat>, now: number, offset = 0): number | null {
  const elapsed = weekDays(stats, now, offset).filter((day) => !day.isFuture);
  if (elapsed.length === 0 || !elapsed.some((day) => day.stat.focusMs > 0)) {
    return null;
  }
  return elapsed.reduce((total, day) => total + day.stat.focusMs, 0) / elapsed.length;
}

/** How many days of that week had any focus. */
export function weekFocusedDays(stats: ReadonlyArray<DayStat>, now: number, offset = 0): number {
  return weekDays(stats, now, offset).filter((day) => !day.isFuture && day.stat.focusMs > 0).length;
}

/** A week needs this many focused days before a comparison against it means anything. */
export const MIN_DAYS_FOR_DELTA = 2;

/**
 * How this week's average compares to the previous one. Null when either week has
 * fewer than two days with focus: a percentage against one afternoon is noise.
 */
export function deltaVsPrevious(stats: ReadonlyArray<DayStat>, now: number, offset = 0): Delta | null {
  if (
    weekFocusedDays(stats, now, offset) < MIN_DAYS_FOR_DELTA ||
    weekFocusedDays(stats, now, offset + 1) < MIN_DAYS_FOR_DELTA
  ) {
    return null;
  }
  const current = weekAverage(stats, now, offset);
  const previous = weekAverage(stats, now, offset + 1);
  if (current === null || previous === null) {
    return null;
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    percent: Math.abs(percent),
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
  };
}

/** The days of that week up to today, newest first, for the per-day cards. */
export function weekDayCards(stats: ReadonlyArray<DayStat>, now: number, offset = 0): CalendarDay[] {
  return weekDays(stats, now, offset)
    .filter((day) => !day.isFuture)
    .reverse();
}

/**
 * Two dotted lines at whole hours: the top rounded up to an even hour so the half
 * reads whole too ('4h' and '2h', never '2h 30m'). At least 2h so an empty chart
 * still has a scale.
 */
export function niceGuides(bars: ReadonlyArray<ChartBar>): Guide[] {
  const maxMs = Math.max(0, ...bars.map((bar) => bar.value));
  const topHours = Math.max(2, 2 * Math.ceil(maxMs / (2 * HOUR)));
  return [
    { value: topHours * HOUR, label: `${topHours}h` },
    { value: (topHours / 2) * HOUR, label: `${topHours / 2}h` },
  ];
}

/** Every day of the month `offset` months back, the 1st first. */
export function monthDays(stats: ReadonlyArray<DayStat>, now: number, offset = 0): CalendarDay[] {
  const index = indexStats(stats);
  const first = monthStart(now, offset);
  return Array.from({ length: daysInMonth(first) }, (_, i) =>
    calendarDay(index, shiftDays(first, i), now),
  );
}

const MONTH_LABELLED_DAYS = new Set([1, 5, 10, 15, 20, 25, 30]);

export function monthBars(stats: ReadonlyArray<DayStat>, now: number, offset = 0): ChartBar[] {
  return monthDays(stats, now, offset).map((day) => {
    const number = dayOfMonth(day.at);
    return {
      key: day.dayKey,
      label: MONTH_LABELLED_DAYS.has(number) ? String(number) : '',
      value: day.stat.focusMs,
      highlight: day.isToday,
    };
  });
}

export function monthTotals(
  stats: ReadonlyArray<DayStat>,
  now: number,
  offset = 0,
): { totalMs: number; averageMs: number | null } {
  const days = monthDays(stats, now, offset);
  return {
    totalMs: days.reduce((total, day) => total + day.stat.focusMs, 0),
    averageMs: averageOfFocused(days),
  };
}

/** Average focus per weekday over the whole history, Monday first. */
export function weekdayRhythm(stats: ReadonlyArray<DayStat>): RhythmRow[] {
  const sums = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const stat of stats) {
    if (stat.focusMs <= 0) {
      continue;
    }
    const bucket = sums[weekdayIndex(midnightOf(stat.dayKey))];
    if (bucket !== undefined) {
      bucket.total += stat.focusMs;
      bucket.count += 1;
    }
  }
  return sums.map((bucket, i) => {
    const value = bucket.count === 0 ? 0 : bucket.total / bucket.count;
    return { key: String(i), label: weekdayShort(i), value, valueText: durationText(value) };
  });
}

export function lifetimeTotals(stats: ReadonlyArray<DayStat>): LifetimeTotals {
  const focused = stats.filter((stat) => stat.focusMs > 0);
  const firstKey = focused.map((stat) => stat.dayKey).sort()[0];
  return {
    totalMs: focused.reduce((total, stat) => total + stat.focusMs, 0),
    daysFocused: focused.length,
    bestDayMs: Math.max(0, ...focused.map((stat) => stat.focusMs)),
    firstAt: firstKey === undefined ? null : midnightOf(firstKey),
  };
}

/** One flag per day of the month starting at `monthStartMs`: focused or not. */
export function monthGrid(stats: ReadonlyArray<DayStat>, monthStartMs: number): boolean[] {
  const index = indexStats(stats);
  return Array.from({ length: daysInMonth(monthStartMs) }, (_, i) => {
    const stat = index.get(dayKeyOf(shiftDays(monthStartMs, i)));
    return stat !== undefined && stat.focusMs > 0;
  });
}

/** The last `count` months with any focus, newest first, each with its day grid. */
export function recentMonths(stats: ReadonlyArray<DayStat>, now: number, count = 3): MonthGrid[] {
  const months: MonthGrid[] = [];
  // Walk back month by month; stop past the earliest day with data.
  const first = lifetimeTotals(stats).firstAt;
  if (first === null) {
    return months;
  }
  for (let offset = 0; months.length < count; offset += 1) {
    const at = monthStart(now, offset);
    if (at < monthStart(first)) {
      break;
    }
    const cells = monthGrid(stats, at);
    if (cells.some(Boolean)) {
      months.push({ key: dayKeyOf(at), at, label: monthLabel(at), cells });
    }
  }
  return months;
}
