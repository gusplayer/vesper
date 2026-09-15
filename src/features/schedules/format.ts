import type { Schedule } from '../../data/types';

/**
 * How a schedule reads on a card. Pure: minutes and day flags in, Spanish text out.
 * Lives with the schedules feature because no other screen speaks in these terms.
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** Monday first, matching `Schedule.days` and the DayPicker. */
const SHORT_DAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

const WEEKDAYS = [true, true, true, true, true, false, false];
const WEEKEND = [false, false, false, false, false, true, true];

/** '9:00', '21:30'. Twenty-four hours, no leading zero on the hour. */
export function timeText(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.floor(minutes)));
  const hours = Math.floor(clamped / MINUTES_PER_HOUR);
  const rest = clamped % MINUTES_PER_HOUR;
  return `${hours}:${String(rest).padStart(2, '0')}`;
}

function sameDays(a: ReadonlyArray<boolean>, b: ReadonlyArray<boolean>): boolean {
  return a.length === b.length && a.every((flag, index) => flag === b[index]);
}

/**
 * 'Entre semana', 'Fines de semana', 'Todos los días', or the chosen days spelled out:
 * 'lun, mar, jue'. No day at all reads 'Ningún día' so the card never goes blank.
 */
export function daysText(days: ReadonlyArray<boolean>): string {
  if (days.length === 7 && days.every(Boolean)) {
    return 'Todos los días';
  }
  if (sameDays(days, WEEKDAYS)) {
    return 'Entre semana';
  }
  if (sameDays(days, WEEKEND)) {
    return 'Fines de semana';
  }
  const chosen = SHORT_DAYS.filter((_, index) => days[index] === true);
  return chosen.length === 0 ? 'Ningún día' : chosen.join(', ');
}

/** The pieces of a schedule that decide when it runs. The draft on the edit page has these too. */
export type ScheduleWindow = Pick<Schedule, 'startMinutes' | 'endMinutes' | 'days'>;

/**
 * The end of a window in minutes. A null end means 'until you end it', which for the
 * purpose of clashes is until midnight; an end at or before the start also runs to
 * midnight, since the prototype has no overnight windows.
 */
function endOf(window: ScheduleWindow): number {
  if (window.endMinutes === null || window.endMinutes <= window.startMinutes) {
    return MINUTES_PER_DAY;
  }
  return window.endMinutes;
}

/** '9:00 – 18:00 · Entre semana', or '21:30 · dom, lun' when the schedule has no end. */
export function windowText(window: ScheduleWindow): string {
  const range =
    window.endMinutes === null
      ? timeText(window.startMinutes)
      : `${timeText(window.startMinutes)} – ${timeText(window.endMinutes)}`;
  return `${range} · ${daysText(window.days)}`;
}

/** True when two schedules share a day and their time ranges cross. */
export function overlaps(a: ScheduleWindow, b: ScheduleWindow): boolean {
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
export function overlapNames(schedule: OverlapCandidate, all: ReadonlyArray<OverlapCandidate>): string[] {
  if (!schedule.enabled) {
    return [];
  }
  return all
    .filter((other) => other.id !== schedule.id && other.enabled && overlaps(schedule, other))
    .map((other) => other.name);
}
