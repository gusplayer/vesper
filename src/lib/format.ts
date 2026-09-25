import type { HabitProgress } from '../domain/habits';
import { HOUR, MINUTE, SECOND } from '../domain/time';
import { hasTarget, type WeekProgress } from '../domain/week';
import type { Strings } from '../i18n/es';

/**
 * Presentation-only formatting. Lives outside domain/ because how a number reads is a
 * UI decision, not a rule of the product.
 *
 * Anything that is words takes the `format` slice of the dictionary (ADR-0020); the
 * caller gets it from `useStrings().format` or `getStrings().format`. Numbers alone
 * ('2h 15m', '21:30') read the same in every language and take nothing.
 */

export type FormatStrings = Strings['format'];

/** 'mm:ss', or 'h:mm:ss' past an hour. Used by the session clock. */
export function timerText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / SECOND));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * '2h 15m', '45m', '<1m', '0m'. Used by the ledger, where seconds are noise.
 *
 * Anything under a minute reads '<1m' rather than '0m': a session that served 55
 * seconds is not nothing, and a row claiming 0m while sitting in the ledger reads like
 * a bug. Exactly zero still says '0m'.
 */
export function durationText(ms: number): string {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);

  if (total > 0 && total < MINUTE) {
    return '<1m';
  }
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * The Intl tag `clockText` formats with when the caller passes none. Set once by the
 * locale store whenever the language resolves (`setClockLocale`), so every existing
 * `clockText(at)` follows Ajustes › Idioma without taking a parameter. Null until then:
 * the twenty-four-hour form, which is also what the tests without a locale see.
 */
let clockLocale: string | null = null;

/** Called by the locale store with the resolved Intl tag ('es-CO', 'en-US'). */
export function setClockLocale(tag: string | null): void {
  clockLocale = tag;
}

/** '9:05', '14:30': local time, twenty-four hours, no leading zero on the hour. */
function twentyFour(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * A time of day in the language's own clock: '6:05 PM' in English, '18:05' in Spanish
 * (twenty-four hours whatever the region, like the rest of the app's Spanish; Intl's
 * es-MX would say '06:05 p.m.'). `tag` defaults to the current language
 * (`setClockLocale`), so `clockText(at)` keeps working everywhere.
 */
export function clockText(at: number, tag: string | null = clockLocale): string {
  const date = new Date(at);
  if (tag === null || !tag.toLowerCase().startsWith('en')) {
    return twentyFour(date);
  }
  try {
    return new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }).format(date);
  } catch {
    return twentyFour(date);
  }
}

/** Whole minutes, for the duration chips. */
export function minutesText(ms: number): string {
  return String(Math.round(ms / MINUTE));
}

/**
 * 'domingo, 23 de agosto' or 'Sunday, August 23', in the Intl tag of the current
 * language (`useLocale().tag`). Spanish reads in lowercase, like the rest of the app;
 * English keeps the capitals its day and month names carry.
 */
export function dayText(now: number, tag: string): string {
  const text = new Date(now).toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' });
  return tag.toLowerCase().startsWith('es') ? text.toLowerCase() : text;
}

/** '4h de 10h'. The progress of a week against its goal. */
export function focusOfTargetText(week: WeekProgress, t: FormatStrings): string {
  return hasTarget(week.targetMs)
    ? t.ofTarget(durationText(week.focusMs), durationText(week.targetMs))
    : durationText(week.focusMs);
}

export function habitProgressText(progress: HabitProgress, t: FormatStrings): string {
  return progress.met ? t.done : t.ofCount(progress.markedDays, progress.habit.weeklyTarget);
}
