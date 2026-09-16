import { hasTarget, type WeekProgress } from '../../domain/week';
import type { Strings } from '../../i18n/es';
import { durationText, focusOfTargetText } from '../../lib/format';

/** The two slices the pill needs: its own words and the week formatter's. */
export type FocusPillStrings = Pick<Strings, 'focus' | 'format'>;

/**
 * The pill at the top of the home page. With a weekly goal it reads today against
 * the week: '1h 45m hoy · 6h de 15h esta semana'. Without one it reports today and
 * nothing else: the app does not invent a number to measure you against.
 */
export function focusPillText(todayMs: number, week: WeekProgress, t: FocusPillStrings): string {
  const today = durationText(todayMs);
  return hasTarget(week.targetMs)
    ? t.focus.pill.todayAndWeek(today, focusOfTargetText(week, t.format))
    : t.focus.pill.todayOnly(today);
}

/** What VoiceOver reads for the pill: the same numbers, then what a tap does. */
export function focusPillLabel(todayMs: number, week: WeekProgress, t: FocusPillStrings): string {
  const weekText = hasTarget(week.targetMs) ? focusOfTargetText(week, t.format) : null;
  return t.focus.pill.label(durationText(todayMs), weekText);
}
