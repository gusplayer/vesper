import type { Mode, NotificationPrefs, Schedule } from '../data/types';
import { es, type Strings } from '../i18n/es';
import { durationText } from '../lib/format';
import { breakEndsAt, plannedEndAt } from './session';
import type { Session } from './types';

/**
 * Which local notifications the app wants scheduled right now, given its state. Pure:
 * no expo-notifications here, only the specs. The platform layer diffs this plan
 * against what the OS already holds and schedules or cancels the difference, so the
 * plan must be a complete, deterministic function of the state — never "add one".
 *
 * Ids are stable and derived from the thing they announce (`session-end-<id>`,
 * `schedule-<id>-<weekday>`), which is what makes the diff possible.
 *
 * The words come in as the `notifications` slice of the dictionary (ADR-0020). The
 * caller passes `getStrings().notifications`; the Spanish default only keeps callers
 * that have not been migrated yet compiling, and is not what the app should rely on.
 */

export type ReminderStrings = Strings['notifications'];

export type NotificationKind = 'sessionEnd' | 'breakEnd' | 'schedule' | 'weeklyClose';

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
 * The one notice at the planned end of a session. Its instant is the planned end on
 * the wall clock (start, plan and breaks), never "now": the OS keeps time while the
 * app sleeps. Null during a break, when the end is not known yet, and for an open
 * session, which has no end to announce.
 */
export function sessionEndReminder(session: Session, t: ReminderStrings = es.notifications): DateSpec | null {
  const at = plannedEndAt(session);
  if (at === null || session.open) {
    return null;
  }
  return {
    id: `session-end-${session.id}`,
    kind: 'sessionEnd',
    trigger: 'date',
    at,
    title: t.sessionEnd.title,
    body: t.sessionEnd.body(durationText(session.plannedMs)),
    sound: true,
  };
}

/**
 * The notice when a break runs out: the apps lock again and the session goes on.
 * Its id changes with each break, so a new break is a new notice for the diff.
 */
export function breakEndReminder(session: Session, t: ReminderStrings = es.notifications): DateSpec | null {
  const at = breakEndsAt(session);
  if (at === null) {
    return null;
  }
  return {
    id: `break-end-${session.id}-${session.breakStartedAt}`,
    kind: 'breakEnd',
    trigger: 'date',
    at,
    title: t.breakEnd.title,
    body: t.breakEnd.body,
    sound: true,
  };
}

/** One weekly notice per enabled day, at the schedule's start. Nothing when it is off. */
export function scheduleReminders(
  schedule: Schedule,
  modeName: string,
  t: ReminderStrings = es.notifications,
): WeeklySpec[] {
  // A routine you start by hand has no hour to remind about.
  if (!schedule.enabled || schedule.startMinutes === null) {
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
      title: t.schedule.title(schedule.name),
      body: t.schedule.body(modeName),
      sound: false,
    });
  });
  return specs;
}

/** Sunday evening: time to close the week (ADR-0013). */
export function weeklyCloseReminder(t: ReminderStrings = es.notifications): WeeklySpec {
  return {
    id: 'weekly-close',
    kind: 'weeklyClose',
    trigger: 'weekly',
    weekday: EXPO_SUNDAY,
    hour: WEEKLY_CLOSE_HOUR,
    minute: WEEKLY_CLOSE_MINUTE,
    title: t.weeklyClose.title,
    body: t.weeklyClose.body,
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
 *
 * The plan carries its words, so a language change is a change of plan: the diff
 * reschedules every pending notice in the new language.
 */
export function plannedNotifications(state: ReminderState, t: ReminderStrings = es.notifications): NotificationSpec[] {
  if (!state.allowed) {
    return [];
  }
  const specs: NotificationSpec[] = [];

  if (state.prefs.sessionEnd && state.session !== null && state.session.outcome === 'running') {
    for (const spec of [sessionEndReminder(state.session, t), breakEndReminder(state.session, t)]) {
      if (spec !== null) {
        specs.push(spec);
      }
    }
  }

  if (state.prefs.coaching) {
    for (const schedule of state.schedules) {
      const mode = state.modes.find((m) => m.id === schedule.modeId);
      if (mode !== undefined) {
        specs.push(...scheduleReminders(schedule, mode.name, t));
      }
    }
  }

  if (state.prefs.weeklyClose) {
    specs.push(weeklyCloseReminder(t));
  }

  return specs;
}
