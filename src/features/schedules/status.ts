import { dayBounds } from '../../domain/day';
import { MANUAL_DEFAULT_MS, type RoutineStatus } from '../../domain/routines';
import { MINUTE } from '../../domain/time';
import type { Millis } from '../../domain/types';
import type { Strings } from '../../i18n/es';
import { timeText } from './format';

/**
 * The first line under a routine's name: what it is doing right now, or when it is
 * next. Pure: a status from the engine, the clock and the `routines` slice of the
 * dictionary in, text out (ADR-0020).
 */

export type RoutinesStrings = Strings['routines'];

export type StatusDetail = {
  /** A session is running for this routine right now. Only matters when active. */
  running?: boolean;
  /**
   * Another session is running while this window is open and not yet started: the
   * engine waits for it to end (ADR-0019). Only matters when active.
   */
  waiting?: boolean;
  /**
   * The window has no end time: its session is open and ends when the user ends it
   * (ADR-0047 §3c), so the line names no hour. Only matters when active or started.
   */
  open?: boolean;
  /** Session length of a hand-started routine. */
  durationMs?: number | null;
};

/** Minutes from local midnight of an instant, for timeText. */
function minutesOfDay(at: Millis): number {
  return Math.floor((at - dayBounds(at).dayStart) / MINUTE);
}

/** 'las 9:00' in Spanish, '9:00' in English: the dictionary decides the article. */
function clockText(at: Millis, t: RoutinesStrings): string {
  const minutes = minutesOfDay(at);
  return t.status.clock(timeText(minutes), Math.floor(minutes / 60));
}

/** 'Hoy', 'Mañana', or 'El lunes' for the day containing `at`, seen from `now`. */
function dayLabel(at: Millis, now: Millis, t: RoutinesStrings): string {
  const today = dayBounds(now);
  const target = dayBounds(at).dayStart;
  if (target === today.dayStart) {
    return t.status.today;
  }
  if (target === today.dayEnd) {
    return t.status.tomorrow;
  }
  return t.status.onWeekday(t.status.weekdays[new Date(at).getDay()] ?? '');
}

/**
 * 'Activa · hasta las 18:00' (or 'En curso · …' while its session runs, or 'Espera a
 * que termine tu sesión · …' while another one does), 'Hoy ya
 * pasó · mañana a las 9:00' for a window that already started and whose session is
 * over, 'Hoy a las 21:30', 'Mañana a las 9:00', 'El lunes a las 9:00', 'Cuando
 * quieras · 20 min', 'Sin días elegidos'. Null when the routine is off: the dimmed
 * card already says it.
 */
export function statusText(
  status: RoutineStatus,
  now: Millis,
  t: RoutinesStrings,
  detail: StatusDetail = {},
): string | null {
  switch (status.kind) {
    case 'off':
      return null;
    case 'manual': {
      const minutes = Math.round((detail.durationMs ?? MANUAL_DEFAULT_MS) / MINUTE);
      return t.status.manual(minutes);
    }
    case 'active': {
      const open = detail.open === true;
      const clock = clockText(status.until, t);
      if (detail.running === true) {
        return open ? t.status.runningOpen : t.status.running(clock);
      }
      if (detail.waiting === true) {
        return open ? t.status.waitingOpen : t.status.waiting(clock);
      }
      return open ? t.status.activeOpen : t.status.active(clock);
    }
    case 'started': {
      // The window already started once. While its session runs it is in progress;
      // once that session is over, it is done for today and never active again.
      if (detail.running === true) {
        return detail.open === true ? t.status.runningOpen : t.status.running(clockText(status.until, t));
      }
      return status.next === null
        ? t.status.doneOnly
        : t.status.done(dayLabel(status.next, now, t), clockText(status.next, t));
    }
    case 'next':
      return t.status.next(dayLabel(status.at, now, t), clockText(status.at, t));
    case 'never':
      return t.status.never;
  }
}

