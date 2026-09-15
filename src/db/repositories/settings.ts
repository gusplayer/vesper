import type { NotificationPrefs, Rules, Settings } from '../../data/types';
import { getDb } from '../client';

/**
 * The settings table is a key-value store, not a settings screen. Every value here is
 * written from the flow that uses it — ADR-0007.
 *
 * Known keys are listed in docs/DATA_MODEL.md.
 */

export const SETTING_KEYS = {
  lastSessionConfig: 'last_session_config',
  birthDate: 'birth_date',
  lifeExpectancyYears: 'life_expectancy_years',
  weeklyFocusTargetMs: 'weekly_focus_target_ms',
  onboardingCompletedAt: 'onboarding_completed_at',
  /** The whole prototype Settings object as one JSON value (ADR-0017). */
  prototypeSettings: 'prototype_settings',
  /** The mode the home page shows. */
  activeModeId: 'active_mode_id',
  /** Set once the demo data has been seeded, so it is never seeded twice. */
  demoSeededAt: 'demo_seeded_at',
} as const;

export const DEFAULT_LIFE_EXPECTANCY_YEARS = 77.6;

export function get(key: string): string | null {
  const result = getDb().executeSync('SELECT value FROM settings WHERE key = ?', [key]);
  const value = result.rows[0]?.value;
  return typeof value === 'string' ? value : null;
}

export function set(key: string, value: string, now: number): void {
  getDb().executeSync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now],
  );
}

export function getNumber(key: string): number | null {
  const raw = get(key);
  if (raw === null) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setNumber(key: string, value: number, now: number): void {
  set(key, String(value), now);
}

/**
 * The weekly goal, or null when there is none. Stored as 0 for "none" because the
 * table holds text and a missing row and an explicit choice should read the same.
 */
export function getWeeklyTargetMs(): number | null {
  const stored = getNumber(SETTING_KEYS.weeklyFocusTargetMs);
  return stored === null || stored <= 0 ? null : stored;
}

export function setWeeklyTargetMs(targetMs: number | null, now: number): void {
  setNumber(SETTING_KEYS.weeklyFocusTargetMs, targetMs ?? 0, now);
}

/**
 * Reads a JSON value, returning null on anything unparseable rather than throwing.
 * A corrupt stored config should fall back to defaults, not break the home screen.
 */
export function getJson<T>(key: string): T | null {
  const raw = get(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJson(key: string, value: unknown, now: number): void {
  set(key, JSON.stringify(value), now);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numOrNull(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function rules(value: unknown, fallback: Rules): Rules {
  const raw = isRecord(value) ? value : {};
  return {
    strictMode: bool(raw.strictMode, fallback.strictMode),
    blockInstalls: bool(raw.blockInstalls, fallback.blockInstalls),
    blockPurchases: bool(raw.blockPurchases, fallback.blockPurchases),
    blockMature: bool(raw.blockMature, fallback.blockMature),
  };
}

function notifications(value: unknown, fallback: NotificationPrefs): NotificationPrefs {
  const raw = isRecord(value) ? value : {};
  return {
    coaching: bool(raw.coaching, fallback.coaching),
    updates: bool(raw.updates, fallback.updates),
    sessionEnd: bool(raw.sessionEnd, fallback.sessionEnd),
    weeklyClose: bool(raw.weeklyClose, fallback.weeklyClose),
  };
}

function banner(value: unknown, fallback: Settings['pendingBanner']): Settings['pendingBanner'] {
  if (value === null) {
    return null;
  }
  if (isRecord(value) && typeof value.title === 'string' && typeof value.message === 'string') {
    return { title: value.title, message: value.message };
  }
  return fallback;
}

/**
 * Turns whatever is stored under `prototype_settings` into a complete Settings object.
 * Every field is checked one by one and falls back to `defaults` on its own, so a
 * field added later, or a corrupt one, never takes the rest down with it.
 */
export function parseSettings(raw: unknown, defaults: Settings): Settings {
  const value = isRecord(raw) ? raw : {};
  return {
    onboardingDone: bool(value.onboardingDone, defaults.onboardingDone),
    screenTimeConnected: bool(value.screenTimeConnected, defaults.screenTimeConnected),
    healthConnected: bool(value.healthConnected, defaults.healthConnected),
    notificationsAllowed: bool(value.notificationsAllowed, defaults.notificationsAllowed),
    liveActivities: bool(value.liveActivities, defaults.liveActivities),
    emergencyLeft: num(value.emergencyLeft, defaults.emergencyLeft),
    emergencyTotal: num(value.emergencyTotal, defaults.emergencyTotal),
    rules: rules(value.rules, defaults.rules),
    notifications: notifications(value.notifications, defaults.notifications),
    birthDate: numOrNull(value.birthDate, defaults.birthDate),
    country: typeof value.country === 'string' ? value.country : defaults.country,
    sex: value.sex === 'female' || value.sex === 'male' ? value.sex : defaults.sex,
    lifeExpectancyYears: num(value.lifeExpectancyYears, defaults.lifeExpectancyYears),
    weeklyTargetMs: numOrNull(value.weeklyTargetMs, defaults.weeklyTargetMs),
    pendingBanner: banner(value.pendingBanner, defaults.pendingBanner),
    healthSyncedAt: numOrNull(value.healthSyncedAt, defaults.healthSyncedAt),
  };
}

/** The prototype settings, validated field by field against `defaults`. */
export function getPrototypeSettings(defaults: Settings): Settings {
  return parseSettings(getJson<unknown>(SETTING_KEYS.prototypeSettings), defaults);
}

export function setPrototypeSettings(settings: Settings, now: number): void {
  setJson(SETTING_KEYS.prototypeSettings, settings, now);
}

export function getActiveModeId(): string | null {
  return get(SETTING_KEYS.activeModeId);
}

export function setActiveModeId(id: string, now: number): void {
  set(SETTING_KEYS.activeModeId, id, now);
}
