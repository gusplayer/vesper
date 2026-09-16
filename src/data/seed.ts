import { dayKeyOf } from '../domain/day';
import { DAY, HOUR, MINUTE } from '../domain/time';
import type { Strings } from '../i18n/es';
import type { AppCategory } from '../i18n/es/demo';
import type {
  Activity,
  AppInfo,
  DayStat,
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
const APP_CATALOGUE: ReadonlyArray<Omit<AppInfo, 'category'> & { category: AppCategory }> = [
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
export function demoActivities(t: DemoStrings): Activity[] {
  return [
    { id: 'trabajo', label: t.activity.trabajo },
    { id: 'lectura', label: t.activity.lectura },
    { id: 'aprender', label: t.activity.aprender },
    { id: 'gym', label: t.activity.gym },
    { id: 'familia', label: t.activity.familia },
    { id: 'amigos', label: t.activity.amigos },
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

export function demoModeIdeas(t: DemoStrings): ModeIdea[] {
  return [
    {
      id: 'idea-family',
      name: t.ideaName.family,
      description: t.ideaDescription.family,
      icon: 'home',
      appIds: ['instagram', 'tiktok', 'youtube', 'x'],
      depth: 'soft',
    },
    {
      id: 'idea-sleep',
      name: t.ideaName.sleep,
      description: t.ideaDescription.sleep,
      icon: 'moon',
      appIds: ['instagram', 'tiktok', 'youtube', 'netflix', 'reddit'],
      depth: 'firm',
    },
    {
      id: 'idea-work',
      name: t.ideaName.work,
      description: t.ideaDescription.work,
      icon: 'briefcase',
      appIds: ['instagram', 'tiktok', 'youtube', 'x', 'reddit', 'twitch'],
      depth: 'deep',
    },
    {
      id: 'idea-mindfulness',
      name: t.ideaName.mindfulness,
      description: t.ideaDescription.mindfulness,
      icon: 'wind',
      appIds: ['instagram', 'tiktok', 'x', 'facebook', 'reddit', 'youtube', 'whatsapp'],
      depth: 'firm',
    },
    {
      id: 'idea-no-socials',
      name: t.ideaName.noSocials,
      description: t.ideaDescription.noSocials,
      icon: 'slash',
      appIds: ['instagram', 'tiktok', 'x', 'facebook', 'reddit'],
      depth: 'firm',
    },
  ];
}

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
      enabled: true,
    },
    {
      id: 'schedule-sleep',
      name: t.scheduleName.sleep,
      modeId: 'mode-no-socials',
      startMinutes: 21 * 60 + 30,
      endMinutes: null,
      durationMs: null,
      days: [true, true, true, true, false, false, true],
      enabled: true,
    },
    {
      id: 'schedule-walk',
      name: t.scheduleName.walk,
      modeId: 'mode-no-socials',
      startMinutes: null,
      endMinutes: null,
      durationMs: 20 * MINUTE,
      days: [false, false, false, false, false, false, false],
      enabled: true,
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
  rules: { strictMode: false, blockInstalls: false, blockPurchases: false, blockMature: false },
  notifications: { coaching: true, updates: true, sessionEnd: true, weeklyClose: true },
  birthDate: new Date(1992, 3, 14).getTime(),
  country: null,
  sex: null,
  lifeExpectancyYears: 77.6,
  weeklyTargetMs: 15 * HOUR,
  pendingBanner: null,
  healthSyncedAt: null,
  lastRoutineStart: null,
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

/** Local midnight `offset` days before the day containing `now`. */
function dayStartBefore(now: number, offset: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset).getTime();
}

type DemoDay = {
  /** Local midnight of the day. */
  dayStart: number;
  focusMs: number;
  sessions: number;
};

/** The shape of one fabricated day: how much focus, split into how many sessions. */
function demoDay(now: number, offset: number): DemoDay {
  const dayStart = dayStartBefore(now, offset);
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

/** Day stats for the last `days` days, today included, oldest first. */
export function seedDayStats(now: number, days = DEMO_HISTORY_DAYS): DayStat[] {
  const stats: DayStat[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const { dayStart, focusMs, sessions } = demoDay(now, offset);
    const segments = Array.from({ length: sessions }, (_, i) => {
      const start = sessionStartFraction(i);
      return { start, end: Math.min(0.98, start + (focusMs / (sessions * DAY)) * 1.4) };
    });
    stats.push({ dayKey: dayKeyOf(dayStart), focusMs, sessions, segments });
  }
  return stats;
}

/**
 * The same history as seedDayStats, as the completed sessions that would produce it,
 * oldest first. Folded back by day (db/queries/dayStats) it gives the same focus and
 * session count per day, so the charts look as they did when the stats were seeded
 * directly. Ids are deterministic so a re-seed writes the same rows.
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
      const startedAt = Math.round(dayStart + sessionStartFraction(i) * DAY);
      result.push({
        id: `demo-${dayKeyOf(dayStart)}-${i}`,
        activityId: 'trabajo',
        plannedMs: perSession,
        actualMs: perSession,
        outcome: 'completed',
        depth: 'firm',
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
    const dayKey = dayKeyOf(now - offset * DAY);
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
