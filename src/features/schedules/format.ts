import type { Schedule } from '../../data/types';
import type { FormatStrings } from '../../lib/format';

/**
 * How a schedule reads on a card. Pure: minutes, day flags and the `format` slice of
 * the dictionary in, text out (ADR-0020). Lives with the schedules feature because no
 * other screen speaks in these terms.
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const WEEKDAYS = [true, true, true, true, true, false, false];
const WEEKEND = [false, false, false, false, false, true, true];

/** '9:00', '21:30'. Twenty-four hours, no leading zero on the hour. */
export function timeText(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.floor(minutes)));
  const hours = Math.floor(clamped / MINUTES_PER_HOUR);
  const rest = clamped % MINUTES_PER_HOUR;
  return `${hours}:${String(rest).padStart(2, '0')}`;
}

function sameDays(a: readonly boolean[], b: readonly boolean[]): boolean {
  return a.length === b.length && a.every((flag, index) => flag === b[index]);
}

/**
 * 'Entre semana', 'Fines de semana', 'Todos los días', or the chosen days spelled out:
 * 'lun, mar, jue'. No day at all reads 'Ningún día' so the card never goes blank.
 */
export function daysText(days: readonly boolean[], t: FormatStrings): string {
  if (days.length === 7 && days.every(Boolean)) {
    return t.everyDay;
  }
  if (sameDays(days, WEEKDAYS)) {
    return t.weekdays;
  }
  if (sameDays(days, WEEKEND)) {
    return t.weekends;
  }
  const chosen = t.shortDays.filter((_, index) => days[index] === true);
  return chosen.length === 0 ? t.noDay : chosen.join(', ');
}

/** The pieces of a schedule that decide when it runs. The draft on the edit page has these too. */
export type ScheduleWindow = Pick<Schedule, 'startMinutes' | 'endMinutes' | 'days'> & {
  durationMs?: number | null;
};

/**
 * The end of a window in minutes. A null end means 'until you end it', which for the
 * purpose of clashes is until midnight; an end at or before the start also runs to
 * midnight, since the prototype has no overnight windows.
 */
function endOf(window: ScheduleWindow): number {
  if (window.startMinutes === null) {
    return 0;
  }
  if (window.endMinutes === null || window.endMinutes <= window.startMinutes) {
    return MINUTES_PER_DAY;
  }
  return window.endMinutes;
}

/**
 * '9:00 – 18:00 · Entre semana', '21:30 · dom, lun' when the schedule has no end, or
 * 'Cuando quieras · 20 min' for a routine you start by hand.
 */
export function windowText(window: ScheduleWindow, t: FormatStrings): string {
  if (window.startMinutes === null) {
    const minutes = Math.round((window.durationMs ?? 25 * 60_000) / 60_000);
    return t.whenYouWant(minutes);
  }
  const range =
    window.endMinutes === null
      ? timeText(window.startMinutes)
      : `${timeText(window.startMinutes)} – ${timeText(window.endMinutes)}`;
  return `${range} · ${daysText(window.days, t)}`;
}

/** True when two timed schedules share a day and their time ranges cross. */
export function overlaps(a: ScheduleWindow, b: ScheduleWindow): boolean {
  if (a.startMinutes === null || b.startMinutes === null) {
    return false;
  }
  const shareADay = a.days.some((flag, index) => flag && b.days[index] === true);
  if (!shareADay) {
    return false;
  }
  return a.startMinutes < endOf(b) && b.startMinutes < endOf(a);
}

/** What overlapNames needs from a schedule: its window plus who it is and whether it counts. */
export type OverlapCandidate = ScheduleWindow & Pick<Schedule, 'id' | 'name' | 'enabled'>;

/**
 * The names of the other enabled schedules this one crosses, in list order. Disabled
 * schedules never take part, on either side: a schedule that is off cannot clash.
 */
export function overlapNames(schedule: OverlapCandidate, all: readonly OverlapCandidate[]): string[] {
  if (!schedule.enabled) {
    return [];
  }
  return all
    .filter((other) => other.id !== schedule.id && other.enabled && overlaps(schedule, other))
    .map((other) => other.name);
}
