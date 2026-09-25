import { useMemo } from 'react';

import {
  challengeDaysLeft,
  challengeStandings,
  challengeStatus,
  challengeWeeks,
  circleWeek,
  inviteCodeFor,
  kudosReceivedInWeek,
  kudosSenderNames,
  nudgesReceivedToday,
  seatsTaken,
  weekKeyOf,
  type ChallengeStatus,
  type ChallengeWeek,
  type CircleWeekRow,
  type Standing,
} from '../domain/circle';
import { dayBounds, dayKeyOf, dayKeyStart, weekDayKeys, weekStart } from '../domain/day';
import { weeklyProgress, type HabitProgress } from '../domain/habits';
import { buildLedger } from '../domain/ledger';
import { weeksLived, weeksRemaining, weeksTotal } from '../domain/life';
import { elapsed } from '../domain/session';
import { computeStreak, type StreakState } from '../domain/streak';
import { ME, type Challenge, type Ledger, type Member, type Profile, type SharePrefs } from '../domain/types';
import { weekProgress, type WeekProgress } from '../domain/week';
import { bootDatabase, resetDatabase, type BootResult } from '../db/boot';
import * as sessionsRepo from '../db/repositories/sessions';
import { getStrings, stringsFor, useStrings, type Strings } from '../i18n';
import { freshInstallLocale, useLocaleStore } from '../i18n/store';
import { forgetCircleSync } from '../platform/hooks/useCircleSync';
import { deleteIdentityForReset, forgetIdentitySync, settleIdentity } from '../platform/hooks/useIdentitySync';
import { myChallengeWeeks, type MyChallengeWeek } from './challenges';
import { useOnboardingDraft } from './onboardingDraft';
import { demoActivities, demoApps, demoModeIdeas, HEALTH, USAGE, WEBSITES } from './seed';
import { useAppStore } from './stores/app';
import { readStreak } from './streak';
import { useCircleStore } from './stores/circle';
import { useFocusStore } from './stores/focus';
import { sharedWeekUsageMs, useUsageStore, type UsageSource } from './stores/usage';
import type { LifetimeTotals } from '../db/queries/lifetime';
import type { Activity, AppInfo, AppUsage, DayStat, Mode, ModeIdea, Schedule, Website } from './types';

/**
 * The hooks screens use. Each answers one question a screen has, in the shape the
 * screen wants. This is the seam: the hooks kept their signatures when the stores
 * behind them moved from seeded memory to SQLite (ADR-0016, ADR-0017).
 */

export { useAppStore, useFocusStore, useCircleStore, useUsageStore };
export { WEBSITES, HEALTH };
export { readStreak };
export type { ChallengeStatus, ChallengeWeek, CircleWeekRow, LifetimeTotals, MyChallengeWeek, Standing, UsageSource };

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
  // A session that ran out while the app was dead gets its closing once (ADR-0047 §9).
  useFocusStore.getState().hydrate(sessionsRepo.takeRecoveredClosing());
  useCircleStore.getState().hydrate(now);
}

/**
 * The stores read the database again after a backup replaced it (ADR-0048 §7,
 * src/platform/backup.ts). Nothing is seeded and nothing is reset: the rows are the
 * person's, and the language they chose comes back with them.
 */
export function rehydrateStores(now: number): void {
  hydrateStores(now);
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

/** What "Borrar todo y reiniciar" leaves behind, when it cannot leave nothing. */
export type ResetOutcome = {
  result: BootResult;
  /**
   * True when there was an account (the identity, ADR-0048, with its backup and its
   * circle) and the server could not be reached to delete it, or this phone had lost its
   * key. The database is empty either way and the key is out of the keychain; what is
   * left is a row on a server nobody can claim any more, and the screen says so out
   * loud rather than pretending the reset was total.
   */
  accountLeft: boolean;
};

/**
 * "Borrar todo y reiniciar": empties every table and refills the stores. The database
 * ends empty: the sample data is seeded only on a first install, never after a reset
 * (ADR-0047 §1); the default activities still go in. With `onboardingDone` back to false the root layout's guard sends the
 * user through onboarding again, so its draft is cleared too.
 *
 * **The account goes first** (ADR-0044 §7). Since ADR-0048 it is the identity, so its
 * encrypted backup and its circle go with it. Emptying the database alone would leave
 * the account alive on the server and its secret orphaned in the keychain — a secret
 * belonging to an identity this phone no longer has, which nothing would ever use and
 * nothing would ever delete. So: delete the account, clear the key, then wipe. A new
 * identity is born for the empty phone right after, as on a first launch.
 *
 * Without network the delete cannot happen and the reset still does: a phone that is
 * offline must not be stuck with its data. The keychain is cleared anyway, because
 * the entry is useless the moment the identity it names is gone, and the caller is
 * told the server's copy outlived it.
 *
 * This is the one place `src/data/` reaches into `src/platform/` (the arrow normally
 * runs the other way). The alternative was a screen that has to remember to delete
 * an account before it wipes, and a reset that is only complete when it is called
 * from the right screen.
 */
export async function resetAndRehydrate(now: number): Promise<ResetOutcome> {
  const deleted = await deleteIdentityForReset();
  forgetCircleSync();
  forgetIdentitySync();
  const result = wipeAndRehydrate(now);
  void settleIdentity(Date.now());
  return { result, accountLeft: deleted !== 'done' };
}

/** The local half of the reset, once the account has been dealt with. */
function wipeAndRehydrate(now: number): BootResult {
  // The language survives the reset: it was a deliberate choice, not data, and the
  // demo data is written in the language the app is showing right now (ADR-0020).
  const { preference, locale } = useLocaleStore.getState();
  const result = resetDatabase(now, stringsFor(locale).demo);
  if (preference !== 'auto') {
    useLocaleStore.getState().setPreference(preference, now);
  }
  useOnboardingDraft.getState().reset();
  // The phone's usage reading is not in SQLite, so rehydrating cannot clear it: the
  // store (and, through its epoch, the platform's cooldown) is reset by hand.
  useUsageStore.getState().reset();
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

/** Sample data is still on the phone: the line on Focus and Actividad, and the Ajustes row (ADR-0047 §1). */
export function useHasDemoData(): boolean {
  return useAppStore((state) => state.hasDemoData);
}

/** Actividad › De por vida: totals over every closed session, not the cached window. */
export function useLifetimeTotals(): LifetimeTotals {
  return useAppStore((state) => state.lifetime);
}

/**
 * Today's ledger (ADR-0010, ADR-0038). The unregistered row is the part of the
 * elapsed day that no interval covers — a set operation, not a subtraction — so no
 * figure of one provenance is ever taken off a figure of another (rule 9). The
 * social estimate rides along as its own row and stays out of that subtraction.
 *
 * The running session comes from the focus store rather than the cached rows: its
 * breaks move while the screen is open, and the cache only refreshes on close.
 */
export function useDayLedger(now: number): Ledger {
  const { sessions: cached, activities } = useAppStore((state) => state.ledger);
  const running = useFocusStore((state) => state.session);
  const usage = useUsage();
  const t = useStrings();
  return useMemo(() => {
    const sessions = running === null ? cached : [...cached.filter((s) => s.id !== running.id), running];
    const { dayStart, dayEnd } = dayBounds(now);
    return buildLedger(
      { dayStart, dayEnd, now, activities, sessions, healthSamples: [], usageEstimateMs: usage.todayMs },
      t.activity.ledger,
    );
  }, [cached, activities, running, usage.todayMs, t, now]);
}

/** The usage floor a screen shows: totals, breakdown, where it came from and why (ADR-0029). */
export type UsageView = {
  source: UsageSource;
  /** Why the phone gives nothing; null when it does, and before the first read. */
  reason: string | null;
  /** When the phone was last read, epoch ms; null for the demo. */
  readAt: number | null;
  todayMs: number;
  weekMs: number;
  /** Today, most used first. */
  byApp: AppUsage[];
};

/**
 * Today's and this week's floor of social use with the breakdown by app. From the
 * phone where it can answer (Android with usage access and real apps in a mode),
 * from the demo estimate everywhere else, with the reason spelled out (rule 8).
 */
export function useUsage(): UsageView {
  const source = useUsageStore((state) => state.source);
  const reason = useUsageStore((state) => state.reason);
  const reading = useUsageStore((state) => state.reading);
  const readAt = useUsageStore((state) => state.readAt);
  const apps = useApps();
  return useMemo(() => {
    if (source === 'device' && reading !== null) {
      return { source, reason: null, readAt, ...reading };
    }
    // The seed carries four apps, inside the breakdown's cap; a device reading is cut
    // to MAX_USAGE_ROWS in platform/usageReading.ts, which owns that number (ADR-0029).
    const byApp: AppUsage[] = [];
    for (const { appId, ms } of USAGE.byApp) {
      const app = apps.find((candidate) => candidate.id === appId);
      if (app !== undefined) {
        byApp.push({ id: app.id, name: app.name, icon: null, initial: app.initial, color: app.color, ms });
      }
    }
    return { source: 'demo', reason, readAt: null, todayMs: USAGE.todayMs, weekMs: USAGE.weekMs, byApp };
  }, [source, reason, reading, readAt, apps]);
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
 * when they chose to share it *and* the phone gave a figure of their own; otherwise
 * the row says "not shared" (ADR-0005, ADR-0021, ADR-0033).
 *
 * **The user's own row is built through the same three switches the upload is**
 * (`buildUpload` in src/platform/circleApi.ts). Showing hours here that the circle
 * never receives would make the app teach the user something different from what
 * everyone else sees of them, which is the one thing Ajustes › Círculo promises it
 * does not do. A metric turned off is null, never zero: zero says "did nothing".
 */
export function useCircleWeek(now: number): CircleWeekRow[] {
  const profile = useProfile();
  const share = useSharePrefs();
  const socialWeekMs = useUsageStore(sharedWeekUsageMs);
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
    // `socialWeekMs` is null while the floor is the demo one: the circle says "not
    // shared" rather than publishing seed data as this person's week (ADR-0035 §2).
    const mine = {
      focusMs: share.focus ? focusMs : null,
      socialMs: share.social ? socialWeekMs : null,
      habitsDone: share.habits ? habitsDone : null,
      habitsTarget: share.habits ? habitsTarget : null,
    };
    return circleWeek(members, memberWeeks, { profile, week: mine }, weekKeyOf(now));
  }, [profile, share.focus, share.habits, share.social, socialWeekMs, members, memberWeeks, week, habits, now]);
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

/**
 * The user's own week in each of their challenges, active first (ADR-0031): the row
 * of dots and the line that says how it is going, for Focus, the card and Actividad.
 */
export function useMyChallengeWeeks(now: number): MyChallengeWeek[] {
  const challenges = useCircleStore((state) => state.challenges);
  const marks = useAppStore((state) => state.habitMarks);
  return useMemo(() => myChallengeWeeks(challenges, marks, now), [challenges, marks, now]);
}

/**
 * Every week a challenge ran, with what the user delivered in each: the card a
 * finished challenge leaves behind (ADR-0031). Empty for a challenge they never joined.
 */
export function useChallengeWeeks(id: string | undefined, now: number): ChallengeWeek[] {
  const challenge = useCircleStore((state) => state.challenges.find((c) => c.id === id) ?? null);
  const marks = useAppStore((state) => state.habitMarks);
  return useMemo(
    () => (challenge === null ? [] : challengeWeeks(challenge, marks, dayKeyOf(now))),
    [challenge, marks, now],
  );
}

/**
 * The live challenge each habit is counting for, by habit id, with the other people
 * in it: a habit that is part of a challenge says so where it is marked (ADR-0031).
 * A map, because the habits are a list and a hook cannot be called inside one.
 */
export function useChallengesByHabit(now: number): Map<string, { id: string; name: string; others: string[] }> {
  const challenges = useCircleStore((state) => state.challenges);
  const members = useCircleMembers();
  return useMemo(() => {
    const todayKey = dayKeyOf(now);
    const byHabit = new Map<string, { id: string; name: string; others: string[] }>();
    for (const challenge of challenges) {
      if (challenge.archivedAt !== null || challenge.habitId === null) {
        continue;
      }
      if (challengeStatus(challenge, todayKey) === 'ended' || byHabit.has(challenge.habitId)) {
        continue;
      }
      const others = challenge.participantIds
        .filter((id) => id !== ME)
        .map((id) => members.find((member) => member.id === id)?.name)
        .filter((name): name is string => name !== undefined);
      byHabit.set(challenge.habitId, { id: challenge.id, name: challenge.name, others });
    }
    return byHabit;
  }, [challenges, members, now]);
}

/** The user's code to give to someone, or null before they have a profile. */
export function useInviteCode(): string | null {
  const profile = useProfile();
  return useMemo(() => (profile === null ? null : inviteCodeFor(profile)), [profile]);
}

/**
 * The same code, read at call time. For a handler that has just awaited something
 * that may have bumped the generation — claiming the account past a collision —
 * where the value it closed over while rendering is no longer the code on screen.
 */
export function getInviteCode(): string | null {
  const profile = useCircleStore.getState().profile;
  return profile === null ? null : inviteCodeFor(profile);
}
