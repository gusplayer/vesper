import type { Strings } from '../../i18n/es';

/**
 * Calendar arithmetic for the activity views. Local days and months, walked with the
 * Date constructor so a 23- or 25-hour day never slips the count (see domain/day.ts).
 *
 * Names come from Intl with the tag of the current language (`useLocale().tag`,
 * ADR-0020), except the short month, which the dictionary spells by hand because the
 * period strip needs a fixed width and Intl varies it by region ('sept.', 'Sept').
 * Spanish names arrive in lowercase and stay so; English keeps its capitals.
 */

export type ActivityStrings = Strings['activity'];

/** A known Monday, to name weekdays from an index without touching a real date. */
const A_MONDAY = new Date(2024, 0, 1);

/** Local midnight of a 'YYYY-MM-DD' key. */
export function midnightOf(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime();
}

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

function weekdayAt(index: number): Date {
  return new Date(A_MONDAY.getFullYear(), A_MONDAY.getMonth(), A_MONDAY.getDate() + index);
}

/** 'lun', 'mar', … or 'Mon', 'Tue', … for a weekday index, Monday first. */
export function weekdayShort(index: number, tag: string): string {
  return weekdayAt(index).toLocaleDateString(tag, { weekday: 'short' });
}

/** 'lunes', 'martes', … or 'Monday', 'Tuesday', … for a weekday index, Monday first. */
export function weekdayLong(index: number, tag: string): string {
  return weekdayAt(index).toLocaleDateString(tag, { weekday: 'long' });
}

/** 'septiembre' or 'September'. */
export function monthLong(ms: number, tag: string): string {
  return new Date(ms).toLocaleDateString(tag, { month: 'long' });
}

/** 'sep' or 'Sep', from the dictionary. */
export function monthShort(ms: number, t: ActivityStrings): string {
  return t.dates.monthShort[new Date(ms).getMonth()] ?? '';
}

/** 'domingo 13 de septiembre' or 'Sunday, September 13' — the spoken form of a day, for VoiceOver. */
export function dayLongLabel(ms: number, t: ActivityStrings, tag: string): string {
  return t.dates.dayLong(weekdayLong(weekdayIndex(ms), tag), dayOfMonth(ms), monthLong(ms, tag));
}

/** 'sep 2026' or 'Sep 2026'. */
export function monthLabel(ms: number, t: ActivityStrings): string {
  return `${monthShort(ms, t)} ${new Date(ms).getFullYear()}`;
}

/** 'mié, 24 sep' or 'Wed, Sep 24'. */
export function dayLabel(ms: number, t: ActivityStrings, tag: string): string {
  return t.dates.dayShort(weekdayShort(weekdayIndex(ms), tag), dayOfMonth(ms), monthShort(ms, t));
}

/** 'Sep 2026' — the first letter up, for a caption above a month grid. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
