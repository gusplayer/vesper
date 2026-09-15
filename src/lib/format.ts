import type { HabitProgress } from '../domain/habits';
import { HOUR, MINUTE, SECOND } from '../domain/time';
import { hasTarget, type WeekProgress } from '../domain/week';

/**
 * Presentation-only formatting. Lives outside domain/ because how a number reads is a
 * UI decision, not a rule of the product. Spanish, lowercase, like everything the
 * user sees.
 */

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

/** Whole minutes, for the duration chips. */
export function minutesText(ms: number): string {
  return String(Math.round(ms / MINUTE));
}

/** 'domingo, 23 de agosto'. Lowercase, like everything else in the app. */
export function dayText(now: number): string {
  return new Date(now)
    .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .toLowerCase();
}

/** '4h de 10h'. The progress of a week against its goal. */
export function focusOfTargetText(week: WeekProgress): string {
  return hasTarget(week.targetMs)
    ? `${durationText(week.focusMs)} de ${durationText(week.targetMs)}`
    : durationText(week.focusMs);
}

/**
 * The header line for the weekly goal. Without a target it reports the total and says
 * nothing about progress: the app does not invent a number to measure you against.
 * On Sunday it stops counting down and invites the closing — ADR-0013.
 */
export function weekSummaryText(week: WeekProgress, closingDay: boolean): string {
  if (closingDay) {
    return 'cerrar la semana';
  }
  if (!hasTarget(week.targetMs)) {
    return `${durationText(week.focusMs)} esta semana`;
  }
  if (week.met) {
    return `meta hecha · ${durationText(week.focusMs)}`;
  }
  return `${focusOfTargetText(week)} · ${week.daysLeft}d`;
}

/** What the Sunday closing says under the numbers. */
export function weekClosingText(week: WeekProgress): string {
  if (!hasTarget(week.targetMs)) {
    return 'no había meta esta semana. pon una para la que empieza mañana';
  }
  if (week.met) {
    return 'meta cumplida. la semana que empieza mañana arranca en cero';
  }
  return 'la semana que empieza mañana arranca en cero. sin rachas que perder';
}

/** 'hecho', or '2 de 4'. Done is a word, never a color. */
export function habitProgressText(progress: HabitProgress): string {
  return progress.met ? 'hecho' : `${progress.markedDays} de ${progress.habit.weeklyTarget}`;
}
