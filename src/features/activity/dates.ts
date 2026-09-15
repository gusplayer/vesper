/**
 * Calendar arithmetic for the activity views. Local days and months, walked with the
 * Date constructor so a 23- or 25-hour day never slips the count (see domain/day.ts).
 * Labels are hard-coded Spanish, like every string the user sees in phase 1.
 */

const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;
const MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** The same local time `days` days away. Negative goes back. */
export function shiftDays(ms: number, days: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** Midnight on the 1st of the month `offsetMonths` months before the one containing `ms`. */
export function monthStart(ms: number, offsetMonths = 0): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth() - offsetMonths, 1).getTime();
}

export function daysInMonth(monthStartMs: number): number {
  const date = new Date(monthStartMs);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** 0 for Monday through 6 for Sunday. */
export function weekdayIndex(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

export function dayOfMonth(ms: number): number {
  return new Date(ms).getDate();
}

/** 'lun', 'mar', … for a weekday index. */
export function weekdayShort(index: number): string {
  return WEEKDAY_SHORT[index] ?? '';
}

/** 'sep 2026'. */
export function monthLabel(ms: number): string {
  const date = new Date(ms);
  return `${MONTH_SHORT[date.getMonth()] ?? ''} ${date.getFullYear()}`;
}

/** 'mié, 24 sep'. */
export function dayLabel(ms: number): string {
  const date = new Date(ms);
  return `${weekdayShort(weekdayIndex(ms))}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()] ?? ''}`;
}

/** 'Sep 2026' — the first letter up, for a caption above a month grid. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
