import type { Mode, NotificationPrefs, Schedule } from '../data/types';
import { durationText } from '../lib/format';
import type { Session } from './types';

/**
 * Which local notifications the app wants scheduled right now, given its state. Pure:
 * no expo-notifications here, only the specs. The platform layer diffs this plan
 * against what the OS already holds and schedules or cancels the difference, so the
 * plan must be a complete, deterministic function of the state — never "add one".
 *
 * Ids are stable and derived from the thing they announce (`session-end-<id>`,
 * `schedule-<id>-<weekday>`), which is what makes the diff possible.
 */

export type NotificationKind = 'sessionEnd' | 'schedule' | 'weeklyClose';

type SpecBase = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Only the end of a session is allowed to make noise. */
  sound: boolean;
};

/** Fires once, at an instant in epoch ms. */
export type DateSpec = SpecBase & { trigger: 'date'; at: number };

/** Fires every week. `weekday` uses expo's convention: 1 = Sunday … 7 = Saturday. */
export type WeeklySpec = SpecBase & {
  trigger: 'weekly';
  weekday: number;
  hour: number;
  minute: number;
};

export type NotificationSpec = DateSpec | WeeklySpec;

export const EXPO_SUNDAY = 1;
export const EXPO_SATURDAY = 7;

/** When the Sunday closing knocks: 20:00 local. */
export const WEEKLY_CLOSE_HOUR = 20;
export const WEEKLY_CLOSE_MINUTE = 0;

const MINUTES_PER_HOUR = 60;

/**
 * `Schedule.days` is Monday-first (0 = Monday … 6 = Sunday); expo counts
 * 1 = Sunday … 7 = Saturday. Monday becomes 2, Saturday 7, Sunday wraps to 1.
 */
export function expoWeekday(mondayFirstIndex: number): number {
  return ((mondayFirstIndex + 1) % 7) + 1;
}

/**
 * The one notice at the planned end of a session. Its instant comes from
 * `startedAt + plannedMs`, never from "now": the OS keeps time while the app sleeps.
 */
export function sessionEndReminder(session: Session): DateSpec {
  return {
    id: `session-end-${session.id}`,
    kind: 'sessionEnd',
    trigger: 'date',
    at: session.startedAt + session.plannedMs,
    title: 'Terminó tu sesión',
    body: `${durationText(session.plannedMs)} de foco. Vuelve a Vesper para cerrarla.`,
    sound: true,
  };
}

/** One weekly notice per enabled day, at the schedule's start. Nothing when it is off. */
export function scheduleReminders(schedule: Schedule, modeName: string): WeeklySpec[] {
  if (!schedule.enabled) {
    return [];
  }
  const hour = Math.floor(schedule.startMinutes / MINUTES_PER_HOUR);
  const minute = schedule.startMinutes % MINUTES_PER_HOUR;
  const specs: WeeklySpec[] = [];
  schedule.days.forEach((on, index) => {
    if (!on) {
      return;
    }
    const weekday = expoWeekday(index);
    specs.push({
      id: `schedule-${schedule.id}-${weekday}`,
      kind: 'schedule',
      trigger: 'weekly',
      weekday,
      hour,
      minute,
      title: `Empieza ${schedule.name}`,
      body: `Modo ${modeName}. Toca para enfocar.`,
      sound: false,
    });
  });
  return specs;
}

/** Sunday evening: time to close the week (ADR-0013). */
export function weeklyCloseReminder(): WeeklySpec {
  return {
    id: 'weekly-close',
    kind: 'weeklyClose',
    trigger: 'weekly',
    weekday: EXPO_SUNDAY,
    hour: WEEKLY_CLOSE_HOUR,
    minute: WEEKLY_CLOSE_MINUTE,
    title: 'Cierra la semana',
    body: 'Mira cómo te fue. La que empieza mañana arranca en cero.',
    sound: false,
  };
}

export type ReminderState = {
  session: Session | null;
  schedules: ReadonlyArray<Schedule>;
  modes: ReadonlyArray<Pick<Mode, 'id' | 'name'>>;
  prefs: NotificationPrefs;
  /** The OS permission and the user's own switch, together. Nothing is planned without it. */
  allowed: boolean;
};

/**
 * The full set the OS should hold. Each kind is gated by its preference: session end
 * by `sessionEnd`, schedule starts by `coaching` (they are the reminders that sustain
 * the habit), the Sunday closing by `weeklyClose`. A schedule whose mode no longer
 * exists announces nothing: there would be nothing to start.
 */
export function plannedNotifications(state: ReminderState): NotificationSpec[] {
  if (!state.allowed) {
    return [];
  }
  const specs: NotificationSpec[] = [];

  if (state.prefs.sessionEnd && state.session !== null && state.session.outcome === 'running') {
    specs.push(sessionEndReminder(state.session));
  }

  if (state.prefs.coaching) {
    for (const schedule of state.schedules) {
      const mode = state.modes.find((m) => m.id === schedule.modeId);
      if (mode !== undefined) {
        specs.push(...scheduleReminders(schedule, mode.name));
      }
    }
  }

  if (state.prefs.weeklyClose) {
    specs.push(weeklyCloseReminder());
  }

  return specs;
}
