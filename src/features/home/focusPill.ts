import { elapsed } from '../../domain/session';
import type { Session } from '../../domain/types';
import type { Strings } from '../../i18n/es';
import { durationText } from '../../lib/format';

/** The slice the pill and the session line need: the Focus tab's own words. */
export type FocusPillStrings = Pick<Strings, 'focus'>;

/**
 * The pill at the top of the home page: '1h 45m enfocado hoy'. Today only, the running
 * session included. The week and its goal live in Actividad; two numbers with two
 * rules in one line read as a contradiction, not as context.
 */
export function focusPillText(todayMs: number, t: FocusPillStrings): string {
  return t.focus.pill.today(durationText(todayMs));
}

/** What VoiceOver reads for the pill: the same number, then what a tap does. */
export function focusPillLabel(todayMs: number, t: FocusPillStrings): string {
  return t.focus.pill.label(durationText(todayMs));
}

/**
 * The last line above the button while a session runs: 'En sesión · 12m de 25m'. The
 * page otherwise looks the same with or without a session, and "Seguir" alone does
 * not say what it continues.
 */
export function focusSessionText(session: Session, now: number, t: FocusPillStrings): string {
  const done = durationText(elapsed(session, now));
  return session.open ? t.focus.home.inSessionOpen(done) : t.focus.home.inSession(done, durationText(session.plannedMs));
}
