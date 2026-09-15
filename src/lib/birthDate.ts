import { dayKeyOf } from '../domain/day';

/**
 * The birth date is the only date the user types. It travels as 'aaaa-mm-dd', which
 * is exactly a DayKey, and is stored as local midnight in epoch ms like every other
 * instant in the app.
 */

/**
 * 'aaaa-mm-dd' to epoch ms, or null. Deliberately strict: no partial dates, no
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

/** The inverse of parseBirthDate: local 'aaaa-mm-dd'. */
export function formatBirthDate(birthDate: number): string {
  return dayKeyOf(birthDate);
}
