import { dayBounds } from '../../domain/day';
import { MANUAL_DEFAULT_MS, type RoutineStatus } from '../../domain/routines';
import { MINUTE } from '../../domain/time';
import type { Millis } from '../../domain/types';
import { timeText } from './format';

/**
 * The first line under a routine's name: what it is doing right now, or when it is
 * next. Pure: a status from the engine and the clock in, Spanish text out.
 */

/** Indexed by `Date.getDay()`, Sunday first. Lowercase, like everything the user sees. */
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

export type StatusDetail = {
  /** A session is running for this routine right now. Only matters when active. */
  running?: boolean;
  /** Session length of a hand-started routine. */
  durationMs?: number | null;
};

/** Minutes from local midnight of an instant, for timeText. */
function minutesOfDay(at: Millis): number {
  return Math.floor((at - dayBounds(at).dayStart) / MINUTE);
}

/** 'las 9:00', but 'la 1:00': one o'clock is singular in Spanish. */
function clockText(at: Millis): string {
  const minutes = minutesOfDay(at);
  const article = Math.floor(minutes / 60) === 1 ? 'la' : 'las';
  return `${article} ${timeText(minutes)}`;
}

/** 'Hoy', 'Mañana', or 'El lunes' for the day containing `at`, seen from `now`. */
function dayLabel(at: Millis, now: Millis): string {
  const today = dayBounds(now);
  const target = dayBounds(at).dayStart;
  if (target === today.dayStart) {
    return 'Hoy';
  }
  if (target === today.dayEnd) {
    return 'Mañana';
  }
  return `El ${WEEKDAY_NAMES[new Date(at).getDay()]}`;
}

/**
 * 'Activa · hasta las 18:00' (or 'En curso · …' while its session runs), 'Hoy a las
 * 21:30', 'Mañana a las 9:00', 'El lunes a las 9:00', 'Cuando quieras · 20 min',
 * 'Sin días elegidos'. Null when the routine is off: the dimmed card already says it.
 */
export function statusText(status: RoutineStatus, now: Millis, detail: StatusDetail = {}): string | null {
  switch (status.kind) {
    case 'off':
      return null;
    case 'manual': {
      const minutes = Math.round((detail.durationMs ?? MANUAL_DEFAULT_MS) / MINUTE);
      return `Cuando quieras · ${minutes} min`;
    }
    case 'active':
      return `${detail.running === true ? 'En curso' : 'Activa'} · hasta ${clockText(status.until)}`;
    case 'next':
      return `${dayLabel(status.at, now)} a ${clockText(status.at)}`;
    case 'never':
      return 'Sin días elegidos';
  }
}
