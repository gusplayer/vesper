import type { Mode, NotificationPrefs, Schedule } from '../data/types';
import type { Strings } from '../i18n/es';
import { durationText } from '../lib/format';
import { atMinuteOfDay, dayKeyOf, dayKeyStart, dayStartShifted } from './day';
import { breakEndsAt, plannedEndAt } from './session';
import type { StreakState } from './streak';
import type { DayKey, Session } from './types';

/**
 * Which local notifications the app wants scheduled right now, given its state. Pure:
 * no expo-notifications here, only the specs. The platform layer diffs this plan
 * against what the OS already holds and schedules or cancels the difference, so the
 * plan must be a complete, deterministic function of the state — never "add one".
 *
 * Ids are stable and derived from the thing they announce (`session-end-<id>`,
 * `schedule-<id>-<weekday>`, `streak-risk-<dayKey>`), which is what makes the diff
 * possible.
 *
 * Three rules from ADR-0027 sit on top of the per-kind switches:
 *
 * - **Silence in session.** While a session runs (break included) the plan holds only
 *   the end of the session and the end of the break. Everything else is dropped, so the
 *   diff cancels it when the session starts and puts it back when it closes.
 * - **Quiet hours.** No daily notice between 22:00 and 8:00. The hour picker only
 *   offers 8:00–21:00, but the guard stays here so the plan never depends on the UI.
 * - **Daily budget.** At most two daily notices per local day (streak at risk, a
 *   challenge slipping away, a challenge that ended, day without focus,
 *   reactivation), by priority. Session, routine and Sunday notices are
 *   appointments the user made and stay outside the budget.
 *
 * The words come in as the `notifications` slice of the dictionary (ADR-0020), and
 * every function here takes it. There is no default: a Spanish one would let a caller
 * forget the argument and send Spanish notices to a phone in English without `tsc`
 * saying a word. The type crosses from i18n, the value never does.
 */

export type ReminderStrings = Strings['notifications'];

export type NotificationKind =
  | 'sessionEnd'
  | 'breakEnd'
  | 'schedule'
  | 'weeklyClose'
  | 'streakRisk'
  | 'challengeRisk'
  | 'challengeEnd'
  | 'noFocus'
  | 'reactivation';

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

/** Quiet hours, as minutes of the local day: from 22:00 up to (not including) 8:00. */
export const QUIET_START_MINUTES = 22 * 60;
export const QUIET_END_MINUTES = 8 * 60;

/** Daily notices per local day, at most, outside the session and routine ones. */
export const DAILY_BUDGET = 2;

/** Days without opening the app after which a reactivation notice knocks, once each. */
export const REACTIVATION_DAYS: readonly number[] = [3, 7];

/**
 * The daily kinds the budget counts, best first (ADR-0027 §2, amended by ADR-0031):
 * a streak about to break, then a challenge that can only still be met by marking
 * every remaining day, then the challenge that just ended, then the two about use.
 * The nudge sits above all of them and is not planned here: it arrives as a push.
 */
const DAILY_KINDS: readonly NotificationKind[] = [
  'streakRisk',
  'challengeRisk',
  'challengeEnd',
  'noFocus',
  'reactivation',
];

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
export function sessionEndReminder(session: Session, t: ReminderStrings): DateSpec | null {
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
export function breakEndReminder(session: Session, t: ReminderStrings): DateSpec | null {
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
  t: ReminderStrings,
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
export function weeklyCloseReminder(t: ReminderStrings): WeeklySpec {
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
  schedules: readonly Schedule[];
  modes: readonly Pick<Mode, 'id' | 'name'>[];
  prefs: NotificationPrefs;
  /** The OS permission and the user's own switch, together. Nothing is planned without it. */
  allowed: boolean;
  /** The instant the plan is made. A daily notice whose hour already passed is not planned. */
  now: number;
  /** Today's streak, as `readStreak(now)` sees it (ADR-0027 §3). */
  streak: StreakState;
  /** When the app was last opened; null before the first open. Drives reactivation. */
  lastOpenedAt: number | null;
  /** A profile with at least one accepted member: the reactivation notice mentions them. */
  hasCircle: boolean;
  /** The user's own side of every challenge they are in (ADR-0031). */
  challenges: readonly ChallengeReminder[];
};

/**
 * What the planner needs to know about one challenge, already reduced by
 * `src/data/challenges.ts` from the standings and the habit marks. The planner never
 * touches the circle's types: it reads a week that is already counted.
 */
export type ChallengeReminder = {
  id: string;
  name: string;
  /** Marks still missing this week. */
  needed: number;
  /** Days this week that can still take a mark; today counts while it is unmarked. */
  daysLeft: number;
  /** True when only marking every remaining day still meets the week. */
  atRisk: boolean;
  /** True once today is marked: there is nothing left to say today. */
  markedToday: boolean;
  /**
   * The challenge's last day and how it has gone so far, for every challenge that has
   * an end — before that day as much as after it. Null for one with no end. The
   * closing notice goes out the day after, so a challenge that ends on Sunday is not
   * announced while its Sunday is still open.
   */
  endsOn: { dayKey: DayKey; met: number; total: number } | null;
};

/**
 * The reminder hour on the day containing `at`, and the same hour tomorrow. Both on
 * the wall clock, so 20:00 is 20:00 across a DST change.
 */
function reminderInstants(state: ReminderState): { today: number; tomorrow: number } {
  const { now, prefs } = state;
  return {
    today: atMinuteOfDay(now, prefs.reminderMinutes),
    tomorrow: atMinuteOfDay(dayStartShifted(now, 1), prefs.reminderMinutes),
  };
}

/**
 * "Your 12-day streak ends at midnight": at the reminder hour, when the streak is two
 * days or longer. Today's notice only if today does not count yet and the hour is
 * still ahead; tomorrow's always, so a phone that is not opened tomorrow still hears
 * it (the next sync replaces it with what is true then). `days` already includes
 * today when it counts, so tomorrow's number is the same streak, not one more.
 */
export function streakRiskReminders(state: ReminderState, t: ReminderStrings): DateSpec[] {
  if (!state.prefs.streak) {
    return [];
  }
  const { days, todayCounts } = state.streak;
  if (days < 2) {
    return [];
  }
  const { today, tomorrow } = reminderInstants(state);
  const spec = (at: number): DateSpec => ({
    id: `streak-risk-${dayKeyOf(at)}`,
    kind: 'streakRisk',
    trigger: 'date',
    at,
    title: t.streakRisk.title(days),
    body: t.streakRisk.body,
    sound: false,
  });
  const specs: DateSpec[] = [];
  if (!todayCounts && today > state.now) {
    specs.push(spec(today));
  }
  specs.push(spec(tomorrow));
  return specs;
}

/**
 * "No focus yet today": the soft one, at the reminder hour, when there is no streak
 * to warn about (fewer than two days). Today's if today does not count yet and the
 * hour is ahead, and tomorrow's once more; after that nothing until the app opens
 * again and the plan is remade (ADR-0027 §4). Never together with the streak notice:
 * the two are exclusive on `days`, so tomorrow holds exactly one of them.
 */
export function noFocusReminders(state: ReminderState, t: ReminderStrings): DateSpec[] {
  if (!state.prefs.noFocus) {
    return [];
  }
  const { days, todayCounts } = state.streak;
  if (days >= 2) {
    return [];
  }
  const { today, tomorrow } = reminderInstants(state);
  const spec = (at: number): DateSpec => ({
    id: `no-focus-${dayKeyOf(at)}`,
    kind: 'noFocus',
    trigger: 'date',
    at,
    title: t.noFocus.title,
    body: t.noFocus.body,
    sound: false,
  });
  const specs: DateSpec[] = [];
  if (!todayCounts && today > state.now) {
    specs.push(spec(today));
  }
  specs.push(spec(tomorrow));
  return specs;
}

/**
 * One notice 3 and 7 days after the app was last opened, at the reminder hour, and
 * nothing after that until it opens again. The ids carry the day it was last opened,
 * so a new open is a new pair for the diff. The body says what the app knows: the
 * circle if there is one, the streak that stopped if there was one, else the plain line.
 */
export function reactivationReminders(state: ReminderState, t: ReminderStrings): DateSpec[] {
  if (!state.prefs.reactivation || state.lastOpenedAt === null) {
    return [];
  }
  const { lastOpenedAt, hasCircle, streak } = state;
  const body = hasCircle
    ? t.reactivation.bodyCircle
    : streak.days >= 2
      ? t.reactivation.bodyStreak(streak.days)
      : t.reactivation.body;
  const openedKey = dayKeyOf(lastOpenedAt);
  const specs: DateSpec[] = [];
  for (const n of REACTIVATION_DAYS) {
    const at = atMinuteOfDay(dayStartShifted(lastOpenedAt, n), state.prefs.reminderMinutes);
    if (at > state.now) {
      specs.push({
        id: `reactivation-${n}-${openedKey}`,
        kind: 'reactivation',
        trigger: 'date',
        at,
        title: t.reactivation.title(n),
        body,
        sound: false,
      });
    }
  }
  return specs;
}

/**
 * "Leer se te está yendo": at the reminder hour, for the one challenge that can only
 * still be met by marking every day that is left this week, and is not marked today.
 * Today only, and one at most: tomorrow's risk depends on whether today was marked,
 * which is not known yet, and the plan is remade on every mark and on every open.
 *
 * When two challenges are equally lost, the tightest wins: fewest days left first,
 * then the one that needs the most. Nothing is planned once the hour has passed.
 */
export function challengeRiskReminders(state: ReminderState, t: ReminderStrings): DateSpec[] {
  if (!state.prefs.challenges) {
    return [];
  }
  const { today } = reminderInstants(state);
  if (today <= state.now) {
    return [];
  }
  const candidates = state.challenges.filter((challenge) => challenge.atRisk && !challenge.markedToday);
  const tightest = [...candidates].sort((a, b) => a.daysLeft - b.daysLeft || b.needed - a.needed)[0];
  if (tightest === undefined) {
    return [];
  }
  return [
    {
      id: `challenge-risk-${tightest.id}-${dayKeyOf(today)}`,
      kind: 'challengeRisk',
      trigger: 'date',
      at: today,
      title: t.challengeRisk.title(tightest.name),
      body: t.challengeRisk.body(tightest.needed, tightest.daysLeft),
      sound: false,
    },
  ];
}

/**
 * "Terminó Leer. Cumpliste 3 de 3 semanas.": once, at the reminder hour of the day
 * after the last day. It is the only notice that says how something went instead of
 * asking for something, and a challenge only has one, so its id carries the last day.
 *
 * It is planned as soon as the end is known, not once the end has passed — the same
 * way the streak and no-focus notices always plan tomorrow's. Waiting for the last
 * day would mean the one notice in the app that celebrates something never arrives on
 * a phone nobody opens that day. The count it carries is what the app knew when the
 * plan was made, and every sync until then replaces it with what is true by then.
 */
export function challengeEndReminders(state: ReminderState, t: ReminderStrings): DateSpec[] {
  if (!state.prefs.challenges) {
    return [];
  }
  const specs: DateSpec[] = [];
  for (const challenge of state.challenges) {
    const ends = challenge.endsOn;
    if (ends === null) {
      continue;
    }
    const at = atMinuteOfDay(dayStartShifted(dayKeyStart(ends.dayKey), 1), state.prefs.reminderMinutes);
    if (at <= state.now) {
      continue;
    }
    specs.push({
      id: `challenge-end-${challenge.id}-${ends.dayKey}`,
      kind: 'challengeEnd',
      trigger: 'date',
      at,
      title: t.challengeEnd.title(challenge.name),
      body: t.challengeEnd.body(ends.met, ends.total),
      sound: false,
    });
  }
  return specs;
}

/** True from 22:00 up to 8:00, wrapping midnight. `minutesOfDay` is minutes past local midnight. */
export function inQuietHours(minutesOfDay: number): boolean {
  return minutesOfDay >= QUIET_START_MINUTES || minutesOfDay < QUIET_END_MINUTES;
}

function localMinutesOfDay(at: number): number {
  const date = new Date(at);
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

/** Drops the date specs that would fire inside quiet hours, by their local minute. */
export function withoutQuietHours<S extends DateSpec>(specs: readonly S[]): S[] {
  return specs.filter((spec) => !inQuietHours(localMinutesOfDay(spec.at)));
}

/**
 * At most `DAILY_BUDGET` daily notices per local day, kept in the order of
 * `DAILY_KINDS`: streak at risk, challenge at risk, challenge ended, day without
 * focus, reactivation. Only those five count; everything else passes through
 * untouched, in its place. The Sunday close is weekly and stays outside the cap.
 *
 * The cap cuts for real. Since ADR-0031 one day can hold a streak about to break, a
 * challenge slipping away, a challenge that ended and a reactivation all at once, and
 * this is what decides which two of them the phone sees.
 */
export function applyDailyBudget(specs: readonly NotificationSpec[]): NotificationSpec[] {
  const perDay = new Map<string, DateSpec[]>();
  for (const spec of specs) {
    if (spec.trigger === 'date' && DAILY_KINDS.includes(spec.kind)) {
      const key = dayKeyOf(spec.at);
      const bucket = perDay.get(key) ?? [];
      bucket.push(spec);
      perDay.set(key, bucket);
    }
  }
  const kept = new Set<DateSpec>();
  for (const bucket of perDay.values()) {
    [...bucket]
      .sort((a, b) => DAILY_KINDS.indexOf(a.kind) - DAILY_KINDS.indexOf(b.kind))
      .slice(0, DAILY_BUDGET)
      .forEach((spec) => kept.add(spec));
  }
  return specs.filter((spec) => spec.trigger !== 'date' || !DAILY_KINDS.includes(spec.kind) || kept.has(spec));
}

/**
 * The full set the OS should hold. Each kind is gated by its preference: session end
 * by `sessionEnd`, schedule starts by `coaching` (they are the reminders that sustain
 * the habit), the Sunday closing by `weeklyClose`, the daily notices by `streak`,
 * `challenges`, `noFocus` and `reactivation`. A schedule whose mode no longer exists announces
 * nothing: there would be nothing to start.
 *
 * While a session runs, break included, the plan is only the session's own notices
 * (ADR-0027 §1): the diff cancels the rest and puts it back when the session closes.
 * The daily notices then go through quiet hours and the daily budget.
 *
 * The plan carries its words, so a language change is a change of plan: the diff
 * reschedules every pending notice in the new language.
 */
export function plannedNotifications(state: ReminderState, t: ReminderStrings): NotificationSpec[] {
  if (!state.allowed) {
    return [];
  }

  if (state.session !== null && state.session.outcome === 'running') {
    if (!state.prefs.sessionEnd) {
      return [];
    }
    return [sessionEndReminder(state.session, t), breakEndReminder(state.session, t)].filter(
      (spec): spec is DateSpec => spec !== null,
    );
  }

  const specs: NotificationSpec[] = [];

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

  const daily = withoutQuietHours([
    ...streakRiskReminders(state, t),
    ...challengeRiskReminders(state, t),
    ...challengeEndReminders(state, t),
    ...noFocusReminders(state, t),
    ...reactivationReminders(state, t),
  ]);
  specs.push(...applyDailyBudget(daily));

  return specs;
}
