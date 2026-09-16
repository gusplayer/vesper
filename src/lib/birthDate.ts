import { dayKeyOf } from '../domain/day';

/**
 * The birth date is the only date the user types. It travels as 'yyyy-mm-dd', which
 * is exactly a DayKey, and is stored as local midnight in epoch ms like every other
 * instant in the app.
 */

/**
 * 'yyyy-mm-dd' to epoch ms, or null. Deliberately strict: no partial dates, no
 * impossible ones (Feb 30 rolls over in Date, so it is checked field by field), and
 * nothing after `now`.
 */
export function parseBirthDate(text: string, now: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getTime() > now
  ) {
    return null;
  }
  return parsed.getTime();
}

/** The inverse of parseBirthDate: local 'yyyy-mm-dd', the same in every language. */
export function formatBirthDate(birthDate: number): string {
  return dayKeyOf(birthDate);
}

/**
 * How the date reads when it is not being edited: '3 feb 1990' or 'Feb 3, 1990', in
 * the Intl tag of the current language (`useLocale().tag`).
 */
export function birthDateText(birthDate: number, tag: string): string {
  return new Date(birthDate).toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' });
}
