import type { CircleAccount, NotificationPrefs, Rules, Settings } from '../../data/types';
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
  /**
   * Set once the demo data has been seeded, so it is never seeded twice. A reset writes
   * it again after emptying the table, so the examples never come back (ADR-0047 §1).
   */
  demoSeededAt: 'demo_seeded_at',
  /** 'auto' | 'es' | 'en' — Ajustes › Idioma (ADR-0020). Missing reads as 'auto'. */
  language: 'language',
  /** The user's circle identity as one JSON value; absent until they create it (ADR-0021). */
  circleProfile: 'circle_profile',
  /** What the user shares with the circle, JSON. Missing reads as the defaults. */
  circleShare: 'circle_share',
  /**
   * That an account exists on the circle's server, JSON `{ id, createdAt }`. The id is
   * `circle_profile.id`. Absent until the user invites someone or uses a code
   * (ADR-0044 §2). The secret is not here: it lives in the keychain.
   */
  circleAccount: 'circle_account',
  /** The sync cursor: `now` from the last `POST /sync`. Missing reads as 0. */
  circleSyncSince: 'circle_sync_since',
  /** When the server last answered, epoch ms. Missing means it never has. */
  circleSyncedAt: 'circle_synced_at',
  /** The ids the onboarding wrote (its mode and routine), JSON; kept by src/data/onboardingIds.ts. */
  onboardingIds: 'onboarding_ids',
  /**
   * This person's identity (ADR-0048), JSON `{ id, registeredAt }`. Born on the first
   * launch; `registeredAt` is null until the server has it. The circle profile and
   * account share this id. The secret is not here: it lives in platform/identity.
   */
  identity: 'identity',
  /** The last `POST /device` ping (platform, version, time zone), epoch ms. Missing is never. */
  identityPingAt: 'identity_ping_at',
  /**
   * The encrypted backup (ADR-0048), JSON `{ enabled, lastAt, lastError }`. Missing reads
   * as enabled with no backup yet: it is on by default.
   */
  backup: 'backup',
  /**
   * The modes whose app selection stayed on another phone (ADR-0048 §9), JSON string[]:
   * a restore empties a Screen Time token, and the card says to pick the apps again
   * until a new selection is saved. It travels in the backup, so a restore of a restore
   * still knows.
   */
  modesRepick: 'modes_repick',
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
    streak: bool(raw.streak, fallback.streak),
    noFocus: bool(raw.noFocus, fallback.noFocus),
    reactivation: bool(raw.reactivation, fallback.reactivation),
    challenges: bool(raw.challenges, fallback.challenges),
    nudges: bool(raw.nudges, fallback.nudges),
    reminderMinutes: num(raw.reminderMinutes, fallback.reminderMinutes),
  };
}

function routineStarts(value: unknown, fallback: Settings['routineStarts']): Settings['routineStarts'] {
  if (!isRecord(value)) {
    return fallback;
  }
  // Entry by entry, like every other field: one corrupt mark is one routine that may
  // start its window again, not a settings object that falls back whole.
  const starts: Record<string, number> = {};
  for (const [routineId, windowStart] of Object.entries(value)) {
    if (typeof windowStart === 'number' && Number.isFinite(windowStart)) {
      starts[routineId] = windowStart;
    }
  }
  return starts;
}

/**
 * Turns whatever is stored under `prototype_settings` into a complete Settings object.
 * Every field is checked one by one and falls back to `defaults` on its own, so a
 * field added later, or a corrupt one, never takes the rest down with it. A field an
 * older build wrote and this one no longer has (the home banner's `pendingBanner`) is
 * simply not read, and the next write leaves it out.
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
    emergencyMonthKey:
      typeof value.emergencyMonthKey === 'string' ? value.emergencyMonthKey : defaults.emergencyMonthKey,
    rules: rules(value.rules, defaults.rules),
    notifications: notifications(value.notifications, defaults.notifications),
    birthDate: numOrNull(value.birthDate, defaults.birthDate),
    country: typeof value.country === 'string' ? value.country : defaults.country,
    sex: value.sex === 'female' || value.sex === 'male' ? value.sex : defaults.sex,
    lifeExpectancyYears: num(value.lifeExpectancyYears, defaults.lifeExpectancyYears),
    weeklyTargetMs: numOrNull(value.weeklyTargetMs, defaults.weeklyTargetMs),
    healthSyncedAt: numOrNull(value.healthSyncedAt, defaults.healthSyncedAt),
    routineStarts: routineStarts(value.routineStarts, defaults.routineStarts),
    lastOpenedAt: numOrNull(value.lastOpenedAt, defaults.lastOpenedAt),
  };
}

/** The prototype settings, validated field by field against `defaults`. */
export function getPrototypeSettings(defaults: Settings): Settings {
  return parseSettings(getJson<unknown>(SETTING_KEYS.prototypeSettings), defaults);
}

export function setPrototypeSettings(settings: Settings, now: number): void {
  setJson(SETTING_KEYS.prototypeSettings, settings, now);
}

/** The modes to pick apps for again after a restore; an empty list when none. */
export function getModesRepick(): string[] {
  const raw = getJson<unknown>(SETTING_KEYS.modesRepick);
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

export function setModesRepick(ids: readonly string[], now: number): void {
  setJson(SETTING_KEYS.modesRepick, [...new Set(ids)], now);
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

// --- The circle's account (ADR-0044) -------------------------------------------------

/**
 * A stored account marker, or null. Only the id and when it was created: the secret is
 * in the keychain, and a marker without a usable id is no account at all.
 */
export function parseAccount(raw: unknown): CircleAccount | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { id, createdAt } = raw;
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  return { id, createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0 };
}

export function getAccount(): CircleAccount | null {
  return parseAccount(getJson<unknown>(SETTING_KEYS.circleAccount));
}

export function setAccount(account: CircleAccount, now: number): void {
  setJson(SETTING_KEYS.circleAccount, account, now);
}

/** Deleting the account: the marker, the cursor and the stamp go together. */
export function clearAccount(): void {
  const db = getDb();
  for (const key of [SETTING_KEYS.circleAccount, SETTING_KEYS.circleSyncSince, SETTING_KEYS.circleSyncedAt]) {
    db.executeSync('DELETE FROM settings WHERE key = ?', [key]);
  }
}

/** The sync cursor. A missing or unreadable one is 0: ask the server for everything. */
export function getSyncSince(): number {
  const since = getNumber(SETTING_KEYS.circleSyncSince);
  return since !== null && since >= 0 ? since : 0;
}

/**
 * Moves the cursor and stamps the success in one write each. Only ever called after a
 * `/sync` that answered: a failed sync leaves the cursor where it was, so nothing
 * another phone wrote is skipped (ADR-0044 §5).
 */
export function setSynced(since: number, now: number): void {
  setNumber(SETTING_KEYS.circleSyncSince, since, now);
  setNumber(SETTING_KEYS.circleSyncedAt, now, now);
}

export function getSyncedAt(): number | null {
  return getNumber(SETTING_KEYS.circleSyncedAt);
}

/**
 * The cursor back to zero and the stamp gone, the account marker left alone: a phone
 * that just restored asks the server for everything again (ADR-0048 §6).
 */
export function resetSync(): void {
  const db = getDb();
  for (const key of [SETTING_KEYS.circleSyncSince, SETTING_KEYS.circleSyncedAt]) {
    db.executeSync('DELETE FROM settings WHERE key = ?', [key]);
  }
}

// --- The identity (ADR-0048 §2) -------------------------------------------------------

/**
 * This install's identity, as the settings table keeps it. The secret is never here: it
 * lives in platform/identity (the keychain, and the copy that travels).
 *
 * - `registeredAt`: null until `POST /account` answered with a secret.
 * - `supersedes`: the id of a previous Vesper this phone chose to start over from
 *   ("Empezar de cero") and could not delete yet, for lack of a connection. Its key
 *   stays in the keychain until the server confirms the delete, and nothing else signs
 *   with it.
 * - `rotatePending`: a restore that could not change the secret (ADR-0048 §5); the
 *   old one keeps working until the identity sync rotates it.
 * - `localOnly`: this device's own identity next to another device's that keeps
 *   travelling ("Empezar aparte", ADR-0050 §9). Its secret is kept only in the local
 *   copy, never in the one iCloud Keychain or Block Store carries, so it does not reach
 *   a new phone by itself.
 */
export type IdentityRecord = {
  id: string;
  registeredAt: number | null;
  supersedes: string | null;
  rotatePending: boolean;
  localOnly: boolean;
};

/** A stored identity, or null. An id is the whole of it: without one there is none. */
export function parseIdentity(raw: unknown): IdentityRecord | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { id, registeredAt, supersedes, rotatePending, localOnly } = raw;
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  return {
    id,
    registeredAt: numOrNull(registeredAt, null),
    supersedes: typeof supersedes === 'string' && supersedes.length > 0 ? supersedes : null,
    rotatePending: rotatePending === true,
    localOnly: localOnly === true,
  };
}

export function getIdentity(): IdentityRecord | null {
  return parseIdentity(getJson<unknown>(SETTING_KEYS.identity));
}

export function setIdentity(record: IdentityRecord, now: number): void {
  setJson(SETTING_KEYS.identity, record, now);
}

/** The record and the last ping go together: a new identity pings on its own. */
export function deleteIdentity(): void {
  const db = getDb();
  for (const key of [SETTING_KEYS.identity, SETTING_KEYS.identityPingAt]) {
    db.executeSync('DELETE FROM settings WHERE key = ?', [key]);
  }
}

/** The last `POST /device` ping, epoch ms, or null when there has been none. */
export function getIdentityPingAt(): number | null {
  return getNumber(SETTING_KEYS.identityPingAt);
}

export function setIdentityPingAt(at: number, now: number): void {
  setNumber(SETTING_KEYS.identityPingAt, at, now);
}

// --- The encrypted backup (ADR-0048 §7) -------------------------------------------------

/**
 * What this phone knows of its backup. It never travels in the backup itself: it is
 * about this install (src/db/backup.ts).
 *
 * - `lastAt`: the last upload the server accepted, epoch ms.
 * - `lastError`: why the last attempt did not go out, as a code the platform turns
 *   into words at read time (the language can change in between). Null after a success.
 * - `fingerprint`: what the last accepted upload held, so an automatic run with
 *   nothing new does not send the same bytes again.
 * - `remoteAt`: the server's `updatedAt` of the copy this install last wrote or
 *   restored. A copy on the server with another stamp was written by another install,
 *   and an automatic run never replaces it on its own.
 */
export type BackupSetting = {
  enabled: boolean;
  lastAt: number | null;
  lastError: string | null;
  fingerprint: string | null;
  remoteAt: number | null;
};

/** On by default: the product owner chose it (ADR-0048). */
export const DEFAULT_BACKUP: BackupSetting = {
  enabled: true,
  lastAt: null,
  lastError: null,
  fingerprint: null,
  remoteAt: null,
};

/** Field by field, like every other stored value: one corrupt field never flips the switch. */
export function parseBackup(raw: unknown): BackupSetting {
  const value = isRecord(raw) ? raw : {};
  return {
    enabled: bool(value.enabled, DEFAULT_BACKUP.enabled),
    lastAt: numOrNull(value.lastAt, null),
    lastError: typeof value.lastError === 'string' ? value.lastError : null,
    fingerprint: typeof value.fingerprint === 'string' ? value.fingerprint : null,
    remoteAt: numOrNull(value.remoteAt, null),
  };
}

export function getBackup(): BackupSetting {
  return parseBackup(getJson<unknown>(SETTING_KEYS.backup));
}

/** Merges a patch into what is stored and returns the result. */
export function updateBackup(patch: Partial<BackupSetting>, now: number): BackupSetting {
  const next = { ...getBackup(), ...patch };
  setJson(SETTING_KEYS.backup, next, now);
  return next;
}
