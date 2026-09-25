import { dayKeyOf, dayStartShifted } from '../domain/day';
import { BREAK_EVERY_MS } from '../domain/session';
import { DAY, HOUR, MINUTE } from '../domain/time';
import type { Strings } from '../i18n/es';
import type { AppCategory } from '../i18n/es/demo';
import type {
  Activity,
  AppInfo,
  Habit,
  HabitMark,
  HealthSummary,
  Mode,
  ModeIdea,
  Schedule,
  Session,
  Settings,
  UsageEstimate,
  Website,
} from './types';

/**
 * Demo data for the prototype. Deterministic: the same numbers every launch, so a
 * screenshot today matches one tomorrow. Nothing here is real (ADR-0016).
 *
 * Since ADR-0017 it is seeded into SQLite once, when the database is empty, and can
 * be wiped from Ajustes. Catalogues (apps, websites, ideas) stay static.
 *
 * Anything with words in it is a function of the `demo` slice of the dictionary
 * (ADR-0020): the seeder passes the language of that first boot, the pickers pass the
 * current one. Ids never depend on the language. This file imports no store.
 */

type DemoStrings = Strings['demo'];

/** The catalogue without words: the category is a key the dictionary resolves. */
const APP_CATALOGUE: readonly (Omit<AppInfo, 'category'> & { category: AppCategory })[] = [
  { id: 'instagram', name: 'Instagram', category: 'social', color: '#C13584', initial: 'I' },
  { id: 'tiktok', name: 'TikTok', category: 'entertainment', color: '#1C1B1A', initial: 'T' },
  { id: 'youtube', name: 'YouTube', category: 'entertainment', color: '#D6322A', initial: 'Y' },
  { id: 'x', name: 'X', category: 'social', color: '#2B2B2B', initial: 'X' },
  { id: 'facebook', name: 'Facebook', category: 'social', color: '#1877F2', initial: 'f' },
  { id: 'reddit', name: 'Reddit', category: 'social', color: '#FF4500', initial: 'r' },
  { id: 'netflix', name: 'Netflix', category: 'entertainment', color: '#B20710', initial: 'N' },
  { id: 'disney', name: 'Disney+', category: 'entertainment', color: '#0E3C8C', initial: 'D' },
  { id: 'whatsapp', name: 'WhatsApp', category: 'messages', color: '#25A244', initial: 'W' },
  { id: 'telegram', name: 'Telegram', category: 'messages', color: '#2AABEE', initial: 't' },
  { id: 'twitch', name: 'Twitch', category: 'entertainment', color: '#8A4BE0', initial: 'T' },
  { id: 'amazon', name: 'Amazon', category: 'shopping', color: '#E67E22', initial: 'a' },
  { id: 'mail', name: 'Mail', category: 'productivity', color: '#3478F6', initial: 'M' },
  { id: 'slack', name: 'Slack', category: 'productivity', color: '#4A154B', initial: 'S' },
];

/** The app catalogue, with each category in the given language. */
export function demoApps(t: DemoStrings): AppInfo[] {
  return APP_CATALOGUE.map((app) => ({ ...app, category: t.appCategory[app.category] }));
}

export const WEBSITES: Website[] = [
  { id: 'amazon.com', host: 'amazon.com', popular: true },
  { id: 'facebook.com', host: 'facebook.com', popular: true },
  { id: 'instagram.com', host: 'instagram.com', popular: true },
  { id: 'reddit.com', host: 'reddit.com', popular: true },
  { id: 'tiktok.com', host: 'tiktok.com', popular: true },
  { id: 'youtube.com', host: 'youtube.com', popular: true },
  { id: 'x.com', host: 'x.com', popular: true },
  { id: 'twitter.com', host: 'twitter.com', popular: false },
  { id: 'twitch.tv', host: 'twitch.tv', popular: false },
  { id: 'ads-twitter.com', host: 'ads-twitter.com', popular: false },
];

/** The default activities. The id is the key the activities table carries, never translated. */
/** Ids of the seeded activities that screens point a new mode at. */
export const WORK_ACTIVITY_ID = 'trabajo';
export const FAMILY_ACTIVITY_ID = 'familia';
/** Time away from the screen that is not work: what sleep and calm count as. */
export const REST_ACTIVITY_ID = 'descanso';

/** Monday first, like `Schedule.days`. Spread at every use: an idea owns its own array. */
const WEEKDAYS = [true, true, true, true, true, false, false];
const EVERY_DAY = [true, true, true, true, true, true, true];

export function demoActivities(t: DemoStrings): Activity[] {
  return [
    { id: 'trabajo', label: t.activity.trabajo },
    { id: 'lectura', label: t.activity.lectura },
    { id: 'aprender', label: t.activity.aprender },
    { id: 'gym', label: t.activity.gym },
    { id: 'familia', label: t.activity.familia },
    { id: 'amigos', label: t.activity.amigos },
    { id: 'descanso', label: t.activity.descanso },
  ];
}

export function demoModes(t: DemoStrings): Mode[] {
  return [
    {
      id: 'mode-no-socials',
      name: t.modeName.noSocials,
      behavior: 'block',
      appIds: ['instagram', 'tiktok', 'x', 'facebook'],
      websiteIds: ['instagram.com', 'tiktok.com', 'x.com'],
      depth: 'firm',
      activityId: 'trabajo',
      selectionToken: null,
      createdAt: 1,
    },
    {
      id: 'mode-family',
      name: t.modeName.family,
      behavior: 'block',
      appIds: ['instagram', 'tiktok', 'youtube', 'netflix'],
      websiteIds: [],
      depth: 'soft',
      activityId: 'familia',
      selectionToken: null,
      createdAt: 2,
    },
    {
      id: 'mode-deep-work',
      name: t.modeName.deepWork,
      behavior: 'allow',
      appIds: ['mail', 'slack', 'whatsapp'],
      websiteIds: [],
      depth: 'deep',
      activityId: 'trabajo',
      selectionToken: null,
      createdAt: 3,
    },
  ];
}

/**
 * The five answers to "what is your first mode for?". Each one carries the routine the
 * onboarding proposes, so the hour on the routine screen follows the idea instead of
 * being the same 21:00 for all five.
 *
 * The windows: family and calm are short evening blocks, sleep runs open from bedtime
 * (the open end is capped at OPEN_END_CAP_MS, so it releases by itself before morning),
 * and work and "no socials" cover the workday, weekdays only.
 *
 * `activityId` is what a session of the mode counts as in the ledger: family time,
 * rest for sleep and calm, work for the rest. An hour off the phone before bed is
 * not an hour of work, and the ledger says so.
 */
export function demoModeIdeas(t: DemoStrings): ModeIdea[] {
  return [
    {
      id: 'idea-family',
      name: t.ideaName.family,
      description: t.ideaDescription.family,
      icon: 'home',
      appIds: ['instagram', 'tiktok', 'youtube', 'x'],
      depth: 'soft',
      schedule: { startMinutes: 19 * 60, endMinutes: 21 * 60, days: [...EVERY_DAY] },
      activityId: FAMILY_ACTIVITY_ID,
    },
    {
      id: 'idea-sleep',
      name: t.ideaName.sleep,
      description: t.ideaDescription.sleep,
      icon: 'moon',
      appIds: ['instagram', 'tiktok', 'youtube', 'netflix', 'reddit'],
      depth: 'firm',
      schedule: { startMinutes: 22 * 60, endMinutes: null, days: [...EVERY_DAY] },
      activityId: REST_ACTIVITY_ID,
    },
    {
      id: 'idea-work',
      name: t.ideaName.work,
      description: t.ideaDescription.work,
      icon: 'briefcase',
      appIds: ['instagram', 'tiktok', 'youtube', 'x', 'reddit', 'twitch'],
      depth: 'deep',
      schedule: { startMinutes: 9 * 60, endMinutes: 18 * 60, days: [...WEEKDAYS] },
      activityId: WORK_ACTIVITY_ID,
    },
    {
      id: 'idea-mindfulness',
      name: t.ideaName.mindfulness,
      description: t.ideaDescription.mindfulness,
      icon: 'wind',
      appIds: ['instagram', 'tiktok', 'x', 'facebook', 'reddit', 'youtube', 'whatsapp'],
      depth: 'firm',
      schedule: { startMinutes: 20 * 60, endMinutes: 21 * 60, days: [...EVERY_DAY] },
      activityId: REST_ACTIVITY_ID,
    },
    {
      id: 'idea-no-socials',
      name: t.ideaName.noSocials,
      description: t.ideaDescription.noSocials,
      icon: 'slash',
      appIds: ['instagram', 'tiktok', 'x', 'facebook', 'reddit'],
      depth: 'firm',
      schedule: { startMinutes: 9 * 60, endMinutes: 18 * 60, days: [...WEEKDAYS] },
      activityId: WORK_ACTIVITY_ID,
    },
  ];
}

/**
 * `updatedAt` is 0 here: the seeder's write stamps the real instant. Every routine is
 * seeded **off** (ADR-0047 §1): an example must never start a session, let alone a deep
 * one, that the user did not ask for. They are there to be looked at and turned on.
 */
export function demoSchedules(t: DemoStrings): Schedule[] {
  return [
    {
      id: 'schedule-work',
      name: t.scheduleName.work,
      modeId: 'mode-deep-work',
      startMinutes: 9 * 60,
      endMinutes: 18 * 60,
      durationMs: null,
      days: [true, true, true, true, true, false, false],
      enabled: false,
      updatedAt: 0,
    },
    {
      id: 'schedule-sleep',
      name: t.scheduleName.sleep,
      modeId: 'mode-no-socials',
      startMinutes: 21 * 60 + 30,
      endMinutes: null,
      durationMs: null,
      days: [true, true, true, true, false, false, true],
      enabled: false,
      updatedAt: 0,
    },
    {
      id: 'schedule-walk',
      name: t.scheduleName.walk,
      modeId: 'mode-no-socials',
      startMinutes: null,
      endMinutes: null,
      durationMs: 20 * MINUTE,
      days: [false, false, false, false, false, false, false],
      enabled: false,
      updatedAt: 0,
    },
  ];
}

export const SETTINGS: Settings = {
  onboardingDone: false,
  screenTimeConnected: false,
  healthConnected: false,
  notificationsAllowed: false,
  liveActivities: true,
  emergencyLeft: 5,
  emergencyTotal: 5,
  emergencyMonthKey: null,
  rules: { strictMode: false, blockInstalls: false, blockPurchases: false, blockMature: false },
  notifications: {
    coaching: true,
    updates: true,
    sessionEnd: true,
    weeklyClose: true,
    streak: true,
    noFocus: true,
    reactivation: true,
    challenges: true,
    nudges: true,
    reminderMinutes: 20 * 60,
  },
  // Vida is opt-in (docs/PRD.md §3): no date until the user writes their own.
  birthDate: null,
  country: null,
  sex: null,
  lifeExpectancyYears: 77.6,
  weeklyTargetMs: 15 * HOUR,
  healthSyncedAt: null,
  routineStarts: {},
  lastOpenedAt: null,
};

export function demoHabits(t: DemoStrings): Habit[] {
  return [
    { id: 'habit-gym', name: t.habitName.gym, activityId: 'gym', weeklyTarget: 4, countMode: 'verified', healthType: 'workout', archivedAt: null, createdAt: 1 },
    { id: 'habit-read', name: t.habitName.read, activityId: 'lectura', weeklyTarget: 6, countMode: 'declared', healthType: null, archivedAt: null, createdAt: 2 },
    { id: 'habit-sleep', name: t.habitName.sleep, activityId: null, weeklyTarget: 5, countMode: 'verified', healthType: 'sleep', archivedAt: null, createdAt: 3 },
  ];
}

/** A shape of focus per weekday, used to fabricate ~10 weeks of history. */
const WEEKDAY_PATTERN_MS = [3 * HOUR, 2.5 * HOUR, 1 * HOUR, 4 * HOUR, 0, 1.5 * HOUR, 5 * HOUR];

function seededSessions(dayIndex: number, focusMs: number): number {
  if (focusMs === 0) {
    return 0;
  }
  return 1 + ((dayIndex * 7) % 3);
}

/** How many days of history the demo fabricates. */
export const DEMO_HISTORY_DAYS = 70;

type DemoDay = {
  /** Local midnight of the day. */
  dayStart: number;
  focusMs: number;
  sessions: number;
};

/** The shape of one fabricated day: how much focus, split into how many sessions. */
function demoDay(now: number, offset: number): DemoDay {
  const dayStart = dayStartShifted(now, -offset);
  const weekday = (new Date(dayStart).getDay() + 6) % 7;
  const wobble = ((offset * 37) % 11) / 10;
  const base = WEEKDAY_PATTERN_MS[weekday] ?? 0;
  const focusMs = offset === 0 ? 0 : Math.round(base * (0.6 + wobble * 0.8));
  return { dayStart, focusMs, sessions: seededSessions(offset, focusMs) };
}

/** Where the i-th session of a day starts, as a fraction of the day. */
function sessionStartFraction(index: number): number {
  return 0.35 + index * 0.2;
}

/**
 * About ten weeks of completed sessions, oldest first, following the weekday shape
 * above. Folded by day (db/queries/dayStats) they give the charts their history.
 * Ids are deterministic so a re-seed writes the same rows.
 *
 * activityId is the activity key; the seeder resolves it to the row id.
 */
export function seedDemoSessions(now: number, days = DEMO_HISTORY_DAYS): Session[] {
  const result: Session[] = [];
  for (let offset = days - 1; offset >= 1; offset -= 1) {
    const { dayStart, focusMs, sessions } = demoDay(now, offset);
    if (sessions === 0) {
      continue;
    }
    const perSession = Math.round(focusMs / sessions);
    for (let i = 0; i < sessions; i += 1) {
      // A fraction of the day for demo data: an hour off on a DST day is fine here.
      // eslint-disable-next-line no-restricted-syntax
      const startedAt = Math.round(dayStart + sessionStartFraction(i) * DAY);
      result.push({
        id: `demo-${dayKeyOf(dayStart)}-${i}`,
        activityId: 'trabajo',
        plannedMs: perSession,
        actualMs: perSession,
        outcome: 'completed',
        depth: 'firm',
        open: false,
        breakMs: 0,
        breakStartedAt: null,
        nextBreakAtMs: BREAK_EVERY_MS,
        blockProfile: null,
        intention: null,
        exitReason: null,
        interruptions: 0,
        startedAt,
        endedAt: startedAt + perSession,
      });
    }
  }
  return result;
}

/** Marks for the current week so the habits have some progress. */
export function seedHabitMarks(now: number): HabitMark[] {
  const marks: HabitMark[] = [];
  const weekday = (new Date(now).getDay() + 6) % 7;
  for (let offset = weekday; offset >= 1; offset -= 1) {
    const dayKey = dayKeyOf(dayStartShifted(now, -offset));
    if (offset % 2 === 0) {
      marks.push({ id: `m-gym-${dayKey}`, habitId: 'habit-gym', dayKey, source: 'health', sourceRef: `hk-${dayKey}`, durationMs: 55 * MINUTE, markedAt: now });
    }
    marks.push({ id: `m-read-${dayKey}`, habitId: 'habit-read', dayKey, source: 'manual', sourceRef: '', durationMs: null, markedAt: now });
    if (offset !== 3) {
      marks.push({ id: `m-sleep-${dayKey}`, habitId: 'habit-sleep', dayKey, source: 'health', sourceRef: `hk-s-${dayKey}`, durationMs: 7.2 * HOUR, markedAt: now });
    }
  }
  return marks;
}

export const USAGE: UsageEstimate = {
  todayMs: 1 * HOUR + 12 * MINUTE,
  weekMs: 11 * HOUR + 40 * MINUTE,
  byApp: [
    { appId: 'instagram', ms: 34 * MINUTE },
    { appId: 'tiktok', ms: 22 * MINUTE },
    { appId: 'youtube', ms: 11 * MINUTE },
    { appId: 'x', ms: 5 * MINUTE },
  ],
};

export const HEALTH: HealthSummary = {
  workoutsThisWeek: 2,
  stepsToday: 6420,
  sleepLastNightMs: 7 * HOUR + 12 * MINUTE,
};
