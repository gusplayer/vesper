import { hasTarget, type WeekProgress } from '../../domain/week';
import { durationText, focusOfTargetText } from '../../lib/format';

/**
 * The pill at the top of the home page. With a weekly goal it reads today against
 * the week: '1h 45m hoy · 6h de 15h esta semana'. Without one it reports today and
 * nothing else: the app does not invent a number to measure you against.
 */
export function focusPillText(todayMs: number, week: WeekProgress): string {
  const today = durationText(todayMs);
  return hasTarget(week.targetMs)
    ? `${today} hoy · ${focusOfTargetText(week)} esta semana`
    : `${today} enfocado hoy`;
}

/** What VoiceOver reads for the pill: the same numbers, then what a tap does. */
export function focusPillLabel(todayMs: number, week: WeekProgress): string {
  const today = `Hoy: ${durationText(todayMs)} enfocado`;
  const suffix = hasTarget(week.targetMs) ? `. Esta semana: ${focusOfTargetText(week)}` : '';
  return `${today}${suffix}. Ver la actividad`;
}
