import { useMemo } from 'react';

import {
  challengeDaysLeft,
  challengeStandings,
  challengeStatus,
  circleWeek,
  inviteCodeFor,
  kudosReceivedInWeek,
  kudosSenderNames,
  nudgesReceivedToday,
  seatsTaken,
  weekKeyOf,
  type ChallengeStatus,
  type CircleWeekRow,
  type Standing,
} from '../domain/circle';
import { dayBounds, dayKeyOf, dayKeyStart, weekDayKeys, weekStart } from '../domain/day';
import { weeklyProgress, type HabitProgress } from '../domain/habits';
import { weeksLived, weeksRemaining, weeksTotal } from '../domain/life';
import { elapsed } from '../domain/session';
import { computeStreak, type StreakState } from '../domain/streak';
import { ME, type Challenge, type Member, type Profile, type SharePrefs } from '../domain/types';
import { weekProgress, type WeekProgress } from '../domain/week';
import { bootDatabase, resetDatabase, type BootResult } from '../db/boot';
import { getStrings, stringsFor, useStrings, type Strings } from '../i18n';
import { freshInstallLocale, useLocaleStore } from '../i18n/store';
import { useOnboardingDraft } from './onboardingDraft';
import { demoActivities, demoApps, demoModeIdeas, HEALTH, USAGE, WEBSITES } from './seed';
import { useAppStore } from './stores/app';
import { readStreak } from './streak';
import { useCircleStore } from './stores/circle';
import { useFocusStore } from './stores/focus';
import type { Activity, AppInfo, DayStat, Mode, ModeIdea, Schedule, Website } from './types';

/**
 * The hooks screens use. Each answers one question a screen has, in the shape the
 * screen wants. This is the seam: the hooks kept their signatures when the stores
 * behind them moved from seeded memory to SQLite (ADR-0016, ADR-0017).
 */

export { useAppStore, useFocusStore, useCircleStore };
export { WEBSITES, HEALTH, USAGE };
export { readStreak };
export type { ChallengeStatus, CircleWeekRow, Standing };

/**
 * The catalogues with words in them (apps, activities, mode ideas) follow the current
 * language (ADR-0020). Built once per language: the dictionary slices are stable
 * objects, so the arrays are too, and a screen can key effects on them.
 */
function perLanguage<T>(build: (demo: Strings['demo']) => T): (demo: Strings['demo']) => T {
  const cache = new WeakMap<Strings['demo'], T>();
  return (demo) => {
    const hit = cache.get(demo);
    if (hit !== undefined) {
      return hit;
    }
    const built = build(demo);
    cache.set(demo, built);
    return built;
  };
}

const appsFor = perLanguage(demoApps);
const activitiesFor = perLanguage(demoActivities);
const modeIdeasFor = perLanguage(demoModeIdeas);

/** Reads the whole database into both stores. Synchronous: op-sqlite is. */
function hydrateStores(now: number): void {
  useLocaleStore.getState().hydrate();
  useAppStore.getState().hydrate(now);
  useFocusStore.getState().hydrate();
  useCircleStore.getState().hydrate(now);
}

/**
 * Opens and migrates the database, seeds it when empty, and fills the stores, all
 * before the first render. Throws on failure; the root layout shows FatalError.
 */
export function bootAndHydrate(now: number): BootResult {
  const result = bootDatabase(now, stringsFor(freshInstallLocale()).demo);
  hydrateStores(now);
  return result;
}

/**
 * "Borrar todo y reiniciar": empties every table, reseeds the demo data and refills
 * the stores. With `onboardingDone` back to false the root layout's guard sends the
 * user through onboarding again, so its draft is cleared too.
 */
export function resetAndRehydrate(now: number): BootResult {
  // The language survives the reset: it was a deliberate choice, not data, and the
  // demo data is written in the language the app is showing right now (ADR-0020).
  const { preference, locale } = useLocaleStore.getState();
  const result = resetDatabase(now, stringsFor(locale).demo);
  if (preference !== 'auto') {
    useLocaleStore.getState().setPreference(preference, now);
  }
  useOnboardingDraft.getState().reset();
  hydrateStores(now);
  return result;
}

export function useApps(): AppInfo[] {
  return appsFor(useStrings().demo);
}

/** For code outside React. Reads the language at call time. */
export function getApps(): AppInfo[] {
  return appsFor(getStrings().demo);
}

export function useActivities(): Activity[] {
  return activitiesFor(useStrings().demo);
}

export function getActivities(): Activity[] {
  return activitiesFor(getStrings().demo);
}

export function useModeIdeas(): ModeIdea[] {
  return modeIdeasFor(useStrings().demo);
}

export function getModeIdeas(): ModeIdea[] {
  return modeIdeasFor(getStrings().demo);
}

export function appsById(ids: readonly string[]): AppInfo[] {
  const apps = getApps();
  return ids.map((id) => apps.find((app) => app.id === id)).filter((app): app is AppInfo => app !== undefined);
}

export function websitesById(ids: readonly string[]): Website[] {
  return ids.map((id) => WEBSITES.find((site) => site.id === id)).filter((site): site is Website => site !== undefined);
}

export function useModes(): Mode[] {
  return useAppStore((state) => state.modes);
}

export function useMode(id: string | undefined): Mode | null {
  return useAppStore((state) => state.modes.find((mode) => mode.id === id) ?? null);
}

export function useActiveMode(): Mode | null {
  return useAppStore((state) => state.modes.find((mode) => mode.id === state.activeModeId) ?? null);
}

export function useSchedules(): Schedule[] {
  return useAppStore((state) => state.schedules);
}

export function useSettings() {
  return useAppStore((state) => state.settings);
}

export function useRunningSession() {
  return useFocusStore((state) => state.session);
}

/** Today's focus so far, running session included, for the counter on the home page. */
export function useTodayFocusMs(now: number): number {
  const stats = useAppStore((state) => state.dayStats);
  const session = useFocusStore((state) => state.session);
  const today = stats.find((d) => d.dayKey === dayKeyOf(now));
  const live = session === null ? 0 : elapsed(session, now);
  return (today?.focusMs ?? 0) + live;
}

export function useDayStats(): DayStat[] {
  return useAppStore((state) => state.dayStats);
}

/**
 * The daily streak and the grace left this month (ADR-0027). Derived from the day
 * stats the store already keeps, which the focus store refreshes after every close,
 * and from the grace rows `settleStreak` maintains; the running session is not in
 * either, so today counts once it is closed with its ten minutes.
 */
export function useStreak(now: number): StreakState {
  const stats = useDayStats();
  const graceDays = useAppStore((state) => state.graceDays);
  const todayKey = dayKeyOf(now);
  return useMemo(() => computeStreak(stats, graceDays, todayKey), [stats, graceDays, todayKey]);
}

/** The seven days of the week containing `now`, Monday first; future days have zero. */
export function useWeekStats(now: number): DayStat[] {
  const stats = useDayStats();
  return useMemo(() => {
    // Calendar days, not `monday + i * DAY`: a DST change inside the week would shift
    // the later keys by an hour and, at midnight, onto the wrong day.
    return weekDayKeys(weekKeyOf(now)).map(
      (dayKey) => stats.find((d) => d.dayKey === dayKey) ?? { dayKey, focusMs: 0, sessions: 0, segments: [] },
    );
  }, [stats, now]);
}

export function useWeekProgress(now: number): WeekProgress {
  const week = useWeekStats(now);
  const target = useAppStore((state) => state.settings.weeklyTargetMs);
  return useMemo(() => {
    const focusMs = week.reduce((total, day) => total + day.focusMs, 0);
    // weekProgress wants sessions; the prototype has day totals. Same arithmetic.
    const base = weekProgress([], target, now);
    return { ...base, focusMs, met: base.targetMs !== null && focusMs >= base.targetMs };
  }, [week, target, now]);
}

export function useHabitsWeek(now: number): HabitProgress[] {
  const habits = useAppStore((state) => state.habits);
  const marks = useAppStore((state) => state.habitMarks);
  return useMemo(() => {
    const active = habits.filter((h) => h.archivedAt === null);
    const fromKey = dayKeyOf(weekStart(now));
    const todayKey = dayKeyOf(now);
    const weekMarks = marks.filter((m) => m.dayKey >= fromKey && m.dayKey <= todayKey);
    return weeklyProgress(active, weekMarks, todayKey);
  }, [habits, marks, now]);
}

export function useLife(now: number) {
  const settings = useSettings();
  return useMemo(() => {
    if (settings.birthDate === null) {
      return null;
    }
    return {
      lived: weeksLived(settings.birthDate, now),
      total: weeksTotal(settings.lifeExpectancyYears),
      left: weeksRemaining(settings.birthDate, settings.lifeExpectancyYears, now),
    };
  }, [settings.birthDate, settings.lifeExpectancyYears, now]);
}

/** The window of today, for anything that clips to the day. */
export function todayBounds(now: number) {
  return dayBounds(now);
}

// --- Circle (ADR-0021) -------------------------------------------------------------

export function useProfile(): Profile | null {
  return useCircleStore((state) => state.profile);
}

export function useSharePrefs(): SharePrefs {
  return useCircleStore((state) => state.share);
}

/** Everyone, whatever the status: in the circle, invited, or waiting for an answer. */
export function useCircleMembers(): Member[] {
  return useCircleStore((state) => state.members);
}

/** Seats taken out of MAX_CIRCLE: the same count the cap uses (domain/circle.seatsTaken). */
export function useSeatsTaken(): number {
  return useCircleStore((state) => seatsTaken(state.members));
}

/** People who invited the user and wait for an answer. */
export function usePendingInvites(): Member[] {
  const members = useCircleMembers();
  return useMemo(() => members.filter((m) => m.status === 'pending'), [members]);
}

/**
 * The circle's week, the user included. Empty without a profile or without anyone
 * in the circle: the screen shows the invitation card instead. The user's numbers
 * come from their own stores; social use is the estimated floor and goes in only
 * when they chose to share it (ADR-0005, ADR-0021).
 */
export function useCircleWeek(now: number): CircleWeekRow[] {
  const profile = useProfile();
  const share = useSharePrefs();
  const members = useCircleMembers();
  const memberWeeks = useCircleStore((state) => state.memberWeeks);
  const week = useWeekStats(now);
  const habits = useHabitsWeek(now);
  return useMemo(() => {
    if (profile === null || !members.some((m) => m.status === 'member')) {
      return [];
    }
    const focusMs = week.reduce((total, day) => total + day.focusMs, 0);
    const habitsDone = habits.reduce((total, h) => total + Math.min(h.markedDays, h.habit.weeklyTarget), 0);
    const habitsTarget = habits.reduce((total, h) => total + h.habit.weeklyTarget, 0);
    const mine = { focusMs, socialMs: share.social ? USAGE.weekMs : null, habitsDone, habitsTarget };
    return circleWeek(members, memberWeeks, { profile, week: mine }, weekKeyOf(now));
  }, [profile, share.social, members, memberWeeks, week, habits, now]);
}

/** The ids of the people the user already cheered today. */
export function useKudosGivenToday(now: number): Set<string> {
  const kudos = useCircleStore((state) => state.kudos);
  return useMemo(() => {
    const todayKey = dayKeyOf(now);
    return new Set(kudos.filter((k) => k.fromId === ME && k.dayKey === todayKey).map((k) => k.toId));
  }, [kudos, now]);
}

/** Kudos the user received this week, and who sent them, for the one quiet line. */
export function useKudosReceived(now: number): { count: number; names: string[] } {
  const kudos = useCircleStore((state) => state.kudos);
  const members = useCircleMembers();
  return useMemo(() => {
    const received = kudosReceivedInWeek(kudos, weekKeyOf(now), dayKeyOf(now));
    return { count: received.length, names: kudosSenderNames(received, members) };
  }, [kudos, members, now]);
}

export type ChallengeView = {
  challenge: Challenge;
  status: ChallengeStatus;
  joined: boolean;
  /** Today included; null for a challenge with no end (ADR-0027). */
  daysLeft: number | null;
  participants: { id: string; name: string; isMe: boolean }[];
};

const STATUS_ORDER: Record<ChallengeStatus, number> = { active: 0, upcoming: 1, ended: 2 };

function challengeView(
  challenge: Challenge,
  members: readonly Member[],
  profile: Profile | null,
  todayKey: string,
): ChallengeView {
  const participants: ChallengeView['participants'] = [];
  for (const id of challenge.participantIds) {
    if (id === ME) {
      participants.push({ id, name: profile?.name ?? '', isMe: true });
      continue;
    }
    const member = members.find((m) => m.id === id);
    if (member !== undefined) {
      participants.push({ id, name: member.name, isMe: false });
    }
  }
  return {
    challenge,
    status: challengeStatus(challenge, todayKey),
    joined: challenge.participantIds.includes(ME),
    daysLeft: challengeDaysLeft(challenge, todayKey),
    participants,
  };
}

/** Every challenge not archived: active first, then upcoming, then ended. */
export function useChallenges(now: number): ChallengeView[] {
  const challenges = useCircleStore((state) => state.challenges);
  const members = useCircleMembers();
  const profile = useProfile();
  return useMemo(() => {
    const todayKey = dayKeyOf(now);
    return challenges
      .filter((c) => c.archivedAt === null)
      .map((c) => challengeView(c, members, profile, todayKey))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [challenges, members, profile, now]);
}

export function useChallenge(id: string | undefined, now: number): ChallengeView | null {
  const challenge = useCircleStore((state) => state.challenges.find((c) => c.id === id) ?? null);
  const members = useCircleMembers();
  const profile = useProfile();
  return useMemo(
    () => (challenge === null ? null : challengeView(challenge, members, profile, dayKeyOf(now))),
    [challenge, members, profile, now],
  );
}

/**
 * Where everyone stands in the week containing `now`, clamped into the challenge:
 * before it starts the first week shows, after it ends the last one stays.
 */
export function useChallengeStandings(id: string | undefined, now: number): Standing[] {
  const challenge = useCircleStore((state) => state.challenges.find((c) => c.id === id) ?? null);
  const members = useCircleMembers();
  const marks = useCircleStore((state) => state.challengeMarks);
  const myMarks = useAppStore((state) => state.habitMarks);
  const profile = useProfile();
  return useMemo(() => {
    if (challenge === null) {
      return [];
    }
    const current = weekKeyOf(now);
    const lastWeekKey = challenge.endDayKey === null ? null : weekKeyOf(dayKeyStart(challenge.endDayKey));
    const weekKey =
      current < challenge.startWeekKey
        ? challenge.startWeekKey
        : lastWeekKey !== null && current > lastWeekKey
          ? lastWeekKey
          : current;
    return challengeStandings(challenge, members, marks, myMarks, profile, weekKey);
  }, [challenge, members, marks, myMarks, profile, now]);
}

/** The ids of the participants the user already nudged today on that challenge. */
export function useNudgesGivenToday(now: number, challengeId: string | undefined): Set<string> {
  const nudges = useCircleStore((state) => state.nudges);
  return useMemo(() => {
    const todayKey = dayKeyOf(now);
    return new Set(
      nudges
        .filter((n) => n.fromId === ME && n.challengeId === challengeId && n.dayKey === todayKey)
        .map((n) => n.toId),
    );
  }, [nudges, challengeId, now]);
}

/** Who nudged the user today on that challenge, for the one line above the standings. */
export function useNudgesReceivedToday(now: number, challengeId: string | undefined): { names: string[] } {
  const nudges = useCircleStore((state) => state.nudges);
  const members = useCircleMembers();
  return useMemo(() => {
    const received = nudgesReceivedToday(nudges, dayKeyOf(now)).filter((n) => n.challengeId === challengeId);
    return { names: kudosSenderNames(received, members) };
  }, [nudges, members, challengeId, now]);
}

/** The user's code to give to someone, or null before they have a profile. */
export function useInviteCode(): string | null {
  const profile = useProfile();
  return useMemo(() => (profile === null ? null : inviteCodeFor(profile)), [profile]);
}
