import type { NotificationPrefs, Rules, Settings } from '../../data/types';
import { DEFAULT_SHARE_PREFS } from '../../domain/circle';
import type { Profile, SharePrefs } from '../../domain/types';
import { getDb } from '../client';

/**
 * The settings table is a key-value store, not a settings screen. Every value here is
 * written from the flow that uses it — ADR-0007.
 *
 * Known keys are listed in docs/DATA_MODEL.md.
 */

export const SETTING_KEYS = {
  /** The whole prototype Settings object as one JSON value (ADR-0017). */
  prototypeSettings: 'prototype_settings',
  /** The mode the home page shows. */
  activeModeId: 'active_mode_id',
  /** Set once the demo data has been seeded, so it is never seeded twice. */
  demoSeededAt: 'demo_seeded_at',
  /** 'auto' | 'es' | 'en' — Ajustes › Idioma (ADR-0020). Missing reads as 'auto'. */
  language: 'language',
  /** The user's circle identity as one JSON value; absent until they create it (ADR-0021). */
  circleProfile: 'circle_profile',
  /** What the user shares with the circle, JSON. Missing reads as the defaults. */
  circleShare: 'circle_share',
} as const;

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
function routineMark(value: unknown, fallback: Settings['lastRoutineStart']): Settings['lastRoutineStart'] {
  if (value === null) {
    return null;
  }
  if (isRecord(value) && typeof value.routineId === 'string' && typeof value.windowStart === 'number') {
    return { routineId: value.routineId, windowStart: value.windowStart };
  }
  return fallback;
}

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
    lastRoutineStart: routineMark(value.lastRoutineStart, defaults.lastRoutineStart),
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

/**
 * A stored profile, or null. There is no partial profile: a row missing its id or
 * name is no identity at all, and the flow that creates one runs again.
 */
export function parseProfile(raw: unknown): Profile | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { id, name, handle, createdAt, codeGeneration } = raw;
  if (typeof id !== 'string' || id.length === 0 || typeof name !== 'string' || typeof handle !== 'string') {
    return null;
  }
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return null;
  }
  // A profile written before codes could be regenerated is generation 0.
  const generation =
    typeof codeGeneration === 'number' && Number.isInteger(codeGeneration) && codeGeneration >= 0 ? codeGeneration : 0;
  return { id, name, handle, codeGeneration: generation, createdAt };
}

/** The circle profile, or null while the user has not created one (ADR-0021). */
export function getProfile(): Profile | null {
  return parseProfile(getJson<unknown>(SETTING_KEYS.circleProfile));
}

export function setProfile(profile: Profile, now: number): void {
  setJson(SETTING_KEYS.circleProfile, profile, now);
}

/** Each switch falls back on its own, so one corrupt flag never flips the others. */
export function parseSharePrefs(raw: unknown, defaults: SharePrefs = DEFAULT_SHARE_PREFS): SharePrefs {
  const value = isRecord(raw) ? raw : {};
  return {
    focus: bool(value.focus, defaults.focus),
    habits: bool(value.habits, defaults.habits),
    social: bool(value.social, defaults.social),
  };
}

/** What the user shares with the circle, validated switch by switch. */
export function getSharePrefs(defaults: SharePrefs = DEFAULT_SHARE_PREFS): SharePrefs {
  return parseSharePrefs(getJson<unknown>(SETTING_KEYS.circleShare), defaults);
}

export function setSharePrefs(prefs: SharePrefs, now: number): void {
  setJson(SETTING_KEYS.circleShare, prefs, now);
}
