import { HOUR } from '../../domain/time';
import { durationText } from '../../lib/format';
import {
  capitalize,
  dayLongLabel,
  midnightOf,
  weekdayIndex,
  weekdayLong,
  type ActivityStrings,
} from './dates';
import type { CalendarDay, ChartBar, Delta } from './selectors';

/**
 * Small plurals and spoken summaries for the activity tab. Presentation only. Every
 * function takes the `activity` slice of the dictionary (`useStrings().activity`) and,
 * where a date or a number is spelled, the Intl tag (`useLocale().tag`) — ADR-0020.
 */

export function sessionsText(count: number, t: ActivityStrings): string {
  return t.units.sessions(count);
}

/** '42 horas', '1 hora'. Whole hours: the lifetime figure is a headline, not a ledger. */
export function hoursText(ms: number, t: ActivityStrings, tag: string): string {
  return t.units.hours(Math.round(ms / HOUR), tag);
}

export function daysText(count: number, t: ActivityStrings, tag: string): string {
  return t.units.days(count, tag);
}

export function weeksText(count: number, t: ActivityStrings, tag: string): string {
  return t.units.weeks(count, tag);
}

/** '30 % más que la semana anterior'. The words carry the direction; the arrow is decoration. */
export function deltaText(delta: Delta, t: ActivityStrings, tag: string): string {
  if (delta.direction === 'flat') {
    return t.spoken.deltaFlat;
  }
  return t.spoken.delta(delta.percent.toLocaleString(tag), delta.direction);
}

/**
 * What VoiceOver reads for the week chart: 'Lunes 14: 3h 10m, martes 15: 2h, …'. Each
 * bar's key is its day, so the weekday is read from the date and not from the short
 * label under the bar.
 */
export function chartSummary(bars: readonly ChartBar[], t: ActivityStrings, tag: string): string {
  const parts = bars.map((bar) => {
    const at = midnightOf(bar.key);
    const day = `${weekdayLong(weekdayIndex(at), tag)} ${new Date(at).getDate()}`;
    const value = bar.value > 0 ? durationText(bar.value) : t.spoken.noFocus;
    return `${day}: ${value}`;
  });
  return capitalize(parts.join(', '));
}

/** 'Hoy, 6h 12m, 3 sesiones' or 'Domingo 13 de septiembre, 6h 12m, 3 sesiones'. */
export function dayCardSummary(day: CalendarDay, t: ActivityStrings, tag: string): string {
  const when = day.isToday ? t.spoken.today : capitalize(dayLongLabel(day.at, t, tag));
  return `${when}, ${durationText(day.stat.focusMs)}, ${sessionsText(day.stat.sessions, t)}`;
}
