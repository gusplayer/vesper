import type { Schedule } from '../../data/types';
import { windowMinutes } from '../../domain/routines';
import { clockText, type FormatStrings } from '../../lib/format';

/**
 * How a schedule reads on a card. Pure: minutes, day flags and the `format` slice of
 * the dictionary in, text out (ADR-0020). Lives with the schedules feature because no
 * other screen speaks in these terms.
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const WEEKDAYS = [true, true, true, true, true, false, false];
const WEEKEND = [false, false, false, false, false, true, true];

/**
 * A wall-clock minute of the day in the language's own clock, through `clockText`:
 * '21:30' in Spanish (and wherever no language is set yet, as in the tests), '9:30 PM'
 * in English. Formatted on a fixed calendar day, so no clock change moves it.
 */
export function timeText(minutes: number, tag?: string | null): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.floor(minutes)));
  const at = new Date(2000, 0, 1, Math.floor(clamped / MINUTES_PER_HOUR), clamped % MINUTES_PER_HOUR).getTime();
  return tag === undefined ? clockText(at) : clockText(at, tag);
}

/** An hour chip: '21' in Spanish, '9 PM' in English, in the Intl tag of the language. */
export function hourText(hour: number, tag: string | null): string {
  if (tag === null || !tag.toLowerCase().startsWith('en')) {
    return String(hour);
  }
  try {
    return new Intl.DateTimeFormat(tag, { hour: 'numeric', hourCycle: 'h12' }).format(new Date(2000, 0, 1, hour));
  } catch {
    return String(hour);
  }
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

const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/**
 * Every occurrence of a timed window across one week, in minutes from Monday 0:00,
 * with the engine's rules (`windowMinutes`): an end at or before the start runs into
 * the next day, a null end runs the open-end cap. Empty for a hand-started routine.
 */
function occurrences(window: ScheduleWindow): [number, number][] {
  const minutes = windowMinutes({
    startMinutes: window.startMinutes,
    endMinutes: window.endMinutes,
    durationMs: window.durationMs ?? null,
  });
  if (minutes === null) {
    return [];
  }
  return window.days.flatMap((on, day): [number, number][] =>
    on ? [[day * MINUTES_PER_DAY + minutes.start, day * MINUTES_PER_DAY + minutes.end]] : [],
  );
}

/**
 * '9:00 – 18:00 · Entre semana', '21:30 · dom, lun' when the schedule has no end, or
 * 'Cuando quieras · 20 min' for a routine you start by hand. With `nextDay`, an end at
 * or before the start says so: '22:00 – 6:00 (día siguiente) · Entre semana'.
 */
export function windowText(
  window: ScheduleWindow,
  t: FormatStrings,
  nextDay?: (time: string) => string,
): string {
  if (window.startMinutes === null) {
    const minutes = Math.round((window.durationMs ?? 25 * 60_000) / 60_000);
    return t.whenYouWant(minutes);
  }
  if (window.endMinutes === null) {
    return `${timeText(window.startMinutes)} · ${daysText(window.days, t)}`;
  }
  const end = timeText(window.endMinutes);
  const crosses = window.endMinutes <= window.startMinutes && nextDay !== undefined;
  return `${timeText(window.startMinutes)} – ${crosses ? nextDay(end) : end} · ${daysText(window.days, t)}`;
}

/** True when an end is on the day after the start: 22:00 → 6:00, or the same hour. */
export function endsNextDay(window: Pick<ScheduleWindow, 'startMinutes' | 'endMinutes'>): boolean {
  return window.startMinutes !== null && window.endMinutes !== null && window.endMinutes <= window.startMinutes;
}

/**
 * True when two timed schedules are ever inside their windows at the same moment, on
 * the engine's own arithmetic: a window that crosses midnight overlaps the next
 * morning, Sunday night overlaps Monday, and an open end runs its cap.
 */
export function overlaps(a: ScheduleWindow, b: ScheduleWindow): boolean {
  const ours = occurrences(a);
  const theirs = occurrences(b);
  return ours.some(([start, end]) =>
    theirs.some(([otherStart, otherEnd]) =>
      [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK].some(
        (shift) => start < otherEnd + shift && otherStart + shift < end,
      ),
    ),
  );
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
