import { HOUR } from '../../domain/time';
import { durationText } from '../../lib/format';
import { capitalize, dayLongLabel, midnightOf, weekdayIndex, weekdayLong } from './dates';
import type { CalendarDay, ChartBar, Delta } from './selectors';

/** Small Spanish plurals and spoken summaries for the activity tab. Presentation only. */

export function sessionsText(count: number): string {
  if (count === 0) {
    return 'Sin sesiones';
  }
  return count === 1 ? '1 sesión' : `${count} sesiones`;
}

/** '42 horas', '1 hora'. Whole hours: the lifetime figure is a headline, not a ledger. */
export function hoursText(ms: number): string {
  const hours = Math.round(ms / HOUR);
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

export function daysText(count: number): string {
  return count === 1 ? '1 día' : `${count} días`;
}

export function weeksText(count: number): string {
  return count === 1 ? '1 semana' : `${count} semanas`;
}

/** '30 % más que la semana anterior'. The words carry the direction; the arrow is decoration. */
export function deltaText(delta: Delta): string {
  if (delta.direction === 'flat') {
    return 'Igual que la semana anterior';
  }
  const word = delta.direction === 'up' ? 'más' : 'menos';
  return `${delta.percent} % ${word} que la semana anterior`;
}

/**
 * What VoiceOver reads for the week chart: 'Lunes 7: 3h 10m, martes 8: 2h, …'. Each
 * bar's key is its day, so the weekday is read from the date and not from the short
 * label under the bar.
 */
export function chartSummary(bars: ReadonlyArray<ChartBar>): string {
  const parts = bars.map((bar) => {
    const at = midnightOf(bar.key);
    const day = `${weekdayLong(weekdayIndex(at))} ${new Date(at).getDate()}`;
    const value = bar.value > 0 ? durationText(bar.value) : 'sin foco';
    return `${day}: ${value}`;
  });
  return capitalize(parts.join(', '));
}

/** 'Hoy, 6h 12m, 3 sesiones' or 'Domingo 13 de septiembre, 6h 12m, 3 sesiones'. */
export function dayCardSummary(day: CalendarDay): string {
  const when = day.isToday ? 'Hoy' : capitalize(dayLongLabel(day.at));
  return `${when}, ${durationText(day.stat.focusMs)}, ${sessionsText(day.stat.sessions)}`;
}
