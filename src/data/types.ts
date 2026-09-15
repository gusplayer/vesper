import type { Depth, Habit, HabitMark, Session } from '../domain/types';

/**
 * What the UI needs to know, in the shape the real data layer will one day provide.
 * Everything here is served by in-memory stores seeded from seed.ts (ADR-0016).
 * Domain types are reused where they exist; the rest is new product surface.
 */

export type AppInfo = {
  id: string;
  name: string;
  category: string;
  /** Tile color; iOS never gives real icons (ADR-0004). */
  color: string;
  initial: string;
};

export type Website = {
  id: string;
  host: string;
  popular: boolean;
};

export type ModeBehavior = 'block' | 'allow';

export type Mode = {
  id: string;
  name: string;
  behavior: ModeBehavior;
  appIds: string[];
  websiteIds: string[];
  /** Vesper's own: how hard it is to leave a session in this mode. */
  depth: Depth;
  /** Which activity the ledger credits. */
  activityId: string;
  /**
   * The opaque FamilyActivitySelection token from iOS Screen Time, when the user picked
   * real apps through the native picker. Null in the simulator and until the entitlement
   * exists. Never resolved to app names — ADR-0004.
   */
  selectionToken: string | null;
  createdAt: number;
};

export type ModeIdea = {
  id: string;
  name: string;
  description: string;
  icon: 'home' | 'moon' | 'briefcase' | 'wind' | 'slash';
  appIds: string[];
  depth: Depth;
};

export type Schedule = {
  id: string;
  name: string;
  modeId: string;
  /** Minutes from midnight, or null for a routine you start by hand ("cuando quieras"). */
  startMinutes: number | null;
  /** Null means "until you end it". */
  endMinutes: number | null;
  /** Session length for a hand-started routine; also the cap of an open-ended window. */
  durationMs: number | null;
  /** Monday first. */
  days: boolean[];
  enabled: boolean;
};

export type Rules = {
  strictMode: boolean;
  blockInstalls: boolean;
  blockPurchases: boolean;
  blockMature: boolean;
};

export type NotificationPrefs = {
  coaching: boolean;
  updates: boolean;
  sessionEnd: boolean;
  weeklyClose: boolean;
};

export type Settings = {
  onboardingDone: boolean;
  screenTimeConnected: boolean;
  healthConnected: boolean;
  notificationsAllowed: boolean;
  liveActivities: boolean;
  emergencyLeft: number;
  emergencyTotal: number;
  rules: Rules;
  notifications: NotificationPrefs;
  birthDate: number | null;
  /**
   * Optional, never asked for up front. With a country (and sex) the reference
   * expectancy becomes the user's; without them the default applies. Nothing else is
   * collected for this: no weight, no height (docs/PRD.md).
   */
  country: string | null;
  sex: 'female' | 'male' | null;
  /** Kept in step with country and sex by the settings action; editable by hand. */
  lifeExpectancyYears: number;
  weeklyTargetMs: number | null;
  /** Shown once on the home page after the first schedule completes. */
  pendingBanner: { title: string; message: string } | null;
  /** Last time Health was read, epoch ms. Null until the first sync. */
  healthSyncedAt: number | null;
  /** The routine window the engine last started, so it never starts it twice. */
  lastRoutineStart: { routineId: string; windowStart: number } | null;
};

export type DayStat = {
  dayKey: string;
  focusMs: number;
  sessions: number;
  /** Session windows as fractions of the day, for the segmented bar. */
  segments: Array<{ start: number; end: number }>;
};

export type UsageEstimate = {
  /** Always a floor (ADR-0004). */
  todayMs: number;
  weekMs: number;
  /** Per app, today. */
  byApp: Array<{ appId: string; ms: number }>;
};

export type HealthSummary = {
  workoutsThisWeek: number;
  stepsToday: number;
  sleepLastNightMs: number;
};

export type Activity = {
  id: string;
  label: string;
};

export type { Depth, Habit, HabitMark, Session };
