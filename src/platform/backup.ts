import { rehydrateStores } from '../data';
import { readIdentity } from '../data/identity';
import {
  BACKUP_FORMAT,
  exportBackup,
  fingerprintOf,
  importBackup,
  LATEST_SCHEMA,
  readPayload,
  type BackupPlatform,
} from '../db/backup';
import * as settingsRepo from '../db/repositories/settings';
import type { BackupSetting } from '../db/repositories/settings';
import { getLocaleTag, getStrings } from '../i18n';
import { deleteBackup, getBackup, getBackupMeta, putBackup, type BackupFailure, type BackupMeta } from './backupApi';
import { expoEngine, openBackup, sealBackup } from './backupCrypto';
import { mayReplace } from './backupPolicy';
import { isAndroid } from './capabilities';
import { backupKeyOf, type ApiResult, type Credentials } from './circleApi';

/**
 * The encrypted backup (ADR-0048 §7): the database, encrypted on this phone with a key
 * only the person holds, and kept on the server as one blob per account.
 *
 * - `backupNow`: export → encrypt → upload, and the result written down.
 * - `restoreBackup`: download → decrypt with the key of the credentials given →
 *   replace the database → the stores read it again.
 * - `status()`: one true line (rule 8). Off, no identity yet, never backed up, the last
 *   backup, or why the last attempt did not go out.
 *
 * It reaches into src/db/ directly, which the other platform modules do not: a backup is
 * the database as a whole, not something a store holds, and there is no store-shaped
 * way to say "every table". The when lives in src/platform/hooks/useBackupSync.ts.
 *
 * Nothing leaves unencrypted, ever: without the cipher the backup says so and sends
 * nothing. Nothing here throws; nothing is logged (the key is in every request).
 */

/** What an upload came to. The errors are the codes kept in the `backup` setting. */
export type BackupError =
  | 'offline'
  | 'tooLarge'
  | 'unauthorized'
  | 'rateLimited'
  | 'server'
  | 'crypto'
  | 'failed'
  /** The server holds a newer copy another install wrote; an automatic run leaves it (backupPolicy.mayReplace). */
  | 'newerElsewhere';

/**
 * - `done`: the server has this phone's data as of now.
 * - `unchanged`: an automatic run found nothing new since the last upload.
 * - `newerElsewhere` (automatic runs only): another install wrote a newer copy, and it
 *   is left alone.
 * - `off`: the user turned the backup off; nothing was read or sent.
 */
export type BackupOutcome = 'done' | 'unchanged' | 'off' | BackupError;

/**
 * - `restored`: the database is the backup's now, and the stores show it.
 * - `none`: this account has no backup on the server.
 * - `newerApp`: the backup was written by a newer Vesper; update the app first.
 * - `undecryptable`: the key does not open it (another key, or damaged bytes).
 * - `failed`: no connection, a server error, or the database refused; nothing changed.
 */
export type RestoreOutcome = 'restored' | 'none' | 'newerApp' | 'undecryptable' | 'failed';

const ERRORS: readonly BackupError[] = [
  'offline',
  'tooLarge',
  'unauthorized',
  'rateLimited',
  'server',
  'crypto',
  'failed',
  'newerElsewhere',
];

function isBackupError(value: string | null): value is BackupError {
  return value !== null && (ERRORS as readonly string[]).includes(value);
}

export function devicePlatform(): BackupPlatform {
  return isAndroid ? 'android' : 'ios';
}

// --- What the screen subscribes to -----------------------------------------------------------

export type BackupState = BackupSetting & {
  /** An upload or a restore is on its way. */
  running: boolean;
};

/** The upload running now, with whose key and whether it was forced. */
type Flight = { promise: Promise<BackupOutcome>; key: string; force: boolean };

const listeners = new Set<() => void>();
let snapshot: BackupState | null = null;
let flight: Flight | null = null;
let restoring = false;
/** A 429 asked for quiet until this instant. */
let notBefore = 0;

function changed(): void {
  snapshot = null;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * For `useSyncExternalStore`. Every subscription reads the setting again: the database
 * may have been replaced (a restore, "Borrar todo") while nobody was watching.
 */
export function subscribeBackup(listener: () => void): () => void {
  snapshot = null;
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The stored state and whether a trip is running. The same object until something changes. */
export function getBackupState(): BackupState {
  if (snapshot === null) {
    let stored: BackupSetting;
    try {
      stored = settingsRepo.getBackup();
    } catch {
      stored = settingsRepo.DEFAULT_BACKUP;
    }
    snapshot = { ...stored, running: flight !== null || restoring };
  }
  return snapshot;
}

/** Ajustes › Respaldo's switch. On is the default (ADR-0048). */
export function setBackupEnabled(enabled: boolean, now: number): void {
  try {
    settingsRepo.updateBackup({ enabled }, now);
  } catch {
    // A write that fails leaves the switch where the database has it.
  }
  changed();
}

/**
 * A new identity took this install's place (ADR-0048): the server has no copy of its
 * own yet, so what the setting says about the last one — when, its fingerprint, the
 * server's date — belongs to the old identity and would keep the first backup waiting
 * until tomorrow. The switch stays where the user put it.
 */
export function forgetLastBackup(now: number): void {
  try {
    settingsRepo.updateBackup({ lastAt: null, lastError: null, fingerprint: null, remoteAt: null }, now);
  } catch {
    // The next backup finds the old fingerprint and goes anyway: it is another account.
  }
  changed();
}

/** Until when a 429 asked for quiet; 0 when it did not. */
export function backupQuietUntil(): number {
  return notBefore;
}

/** "Borrar todo y reiniciar" and tests: the quiet a 429 asked for, and the cached state. */
export function forgetBackupState(): void {
  notBefore = 0;
  changed();
}

// --- Backing up -----------------------------------------------------------------------------------

function errorOf(failure: BackupFailure): BackupError {
  switch (failure.kind) {
    case 'offline':
    case 'tooLarge':
    case 'unauthorized':
    case 'rateLimited':
      return failure.kind;
    default:
      return 'server';
  }
}

function recordError(error: BackupError): BackupError {
  try {
    settingsRepo.updateBackup({ lastError: error }, Date.now());
  } catch {
    // The attempt failed and so did writing that down: the line keeps its last fact.
  }
  return error;
}

async function upload(credentials: Credentials, now: number, force: boolean): Promise<BackupOutcome> {
  const stored = settingsRepo.getBackup();
  if (!stored.enabled) {
    return 'off';
  }
  if (restoring && !force) {
    // The database is about to be replaced: what is here now is not worth sending.
    return 'unchanged';
  }
  if (Date.now() < notBefore) {
    return 'rateLimited';
  }
  const engine = expoEngine();
  if (engine === null) {
    return recordError('crypto');
  }
  let payload;
  try {
    payload = exportBackup(now, devicePlatform());
  } catch {
    return recordError('failed');
  }
  const fingerprint = fingerprintOf(payload, credentials.id);
  if (!force && stored.lastError === null && stored.fingerprint === fingerprint) {
    return 'unchanged';
  }
  if (!force) {
    // Before replacing the server's copy on its own, make sure this install wrote it.
    const meta = await getBackupMeta(credentials);
    if (!meta.ok) {
      if (meta.failure.kind === 'rateLimited') {
        notBefore = Date.now() + meta.failure.retryAfterMs;
      }
      return recordError(errorOf(meta.failure));
    }
    if (!mayReplace(meta.value, stored.remoteAt)) {
      return recordError('newerElsewhere');
    }
  }
  let blob: Uint8Array;
  try {
    blob = await sealBackup(engine, credentials, JSON.stringify(payload));
  } catch {
    return recordError('crypto');
  }
  const result = await putBackup(credentials, blob, {
    format: BACKUP_FORMAT,
    schema: payload.schema,
    platform: payload.platform,
  });
  if (!result.ok) {
    if (result.failure.kind === 'rateLimited') {
      notBefore = Date.now() + result.failure.retryAfterMs;
    }
    return recordError(errorOf(result.failure));
  }
  try {
    settingsRepo.updateBackup(
      { lastAt: Date.now(), lastError: null, fingerprint, remoteAt: result.value.updatedAt },
      Date.now(),
    );
  } catch {
    // Uploaded, but not written down: the next run sends it again, which is harmless.
  }
  return 'done';
}

/**
 * One trip at a time. A caller with the same key shares the trip in flight, unless it
 * asks for more than that trip does (a forced upload behind an automatic one); anything
 * else waits for it and then goes. So the upload with a new key after a restore never
 * gets the answer of an automatic run that was already on its way with the old one.
 */
function run(credentials: Credentials, now: number, force: boolean): Promise<BackupOutcome> {
  const key = backupKeyOf(credentials);
  const current = flight;
  if (current !== null && current.key === key && (current.force || !force)) {
    return current.promise;
  }
  const before: Promise<unknown> = current === null ? Promise.resolve() : current.promise.catch(() => undefined);
  const promise: Promise<BackupOutcome> = before
    .then(() => upload(credentials, now, force))
    .catch((): BackupOutcome => 'failed')
    .finally(() => {
      if (flight?.promise === promise) {
        flight = null;
        changed();
      }
    });
  flight = { promise, key, force };
  changed();
  return promise;
}

/**
 * Backs up now, whether or not anything changed: "Respaldar ahora", and the upload with
 * the new key right after a restore rotated the secret (ADR-0048 §5, §7). Respects the
 * switch: with the backup off it answers `off` and sends nothing. Never throws.
 */
export function backupNow(credentials: Credentials, now: number): Promise<BackupOutcome> {
  return run(credentials, now, true);
}

/** The automatic run (useBackupSync): the same, but nothing goes out when nothing changed. */
export function backupIfChanged(credentials: Credentials, now: number): Promise<BackupOutcome> {
  return run(credentials, now, false);
}

/** `GET /backup/meta`: whether this account has a backup, from when, how big, from which platform. */
export function fetchBackupMeta(credentials: Credentials): Promise<ApiResult<BackupMeta | null>> {
  return getBackupMeta(credentials);
}

/** Whether a copy may still be on the server: this install uploaded one, or saw one there. */
export function remoteCopyMayExist(state: Pick<BackupSetting, 'lastAt' | 'remoteAt'>): boolean {
  return state.lastAt !== null || state.remoteAt !== null;
}

/**
 * The switch turned off (ADR-0048 §7): off means no copy anywhere, so the server's goes
 * too. Offline is not a failure the user has to act on: the switch stays off, the copy
 * may still be there, and useBackupSync tries again on the next return to the front.
 */
export async function deleteRemoteBackup(credentials: Credentials, now: number): Promise<'deleted' | BackupError> {
  const result = await deleteBackup(credentials);
  if (!result.ok) {
    if (result.failure.kind === 'rateLimited') {
      notBefore = Date.now() + result.failure.retryAfterMs;
    }
    const error = recordError(errorOf(result.failure));
    changed();
    return error;
  }
  try {
    settingsRepo.updateBackup({ lastAt: null, remoteAt: null, fingerprint: null, lastError: null }, now);
  } catch {
    // Deleted there, not written down here: the next front deletes again, which is harmless.
  }
  changed();
  return 'deleted';
}

// --- Restoring ----------------------------------------------------------------------------------

function formatOf(raw: unknown): number | null {
  return typeof raw === 'object' && raw !== null && 'format' in raw && typeof raw.format === 'number'
    ? raw.format
    : null;
}

async function restore(credentials: Credentials, now: number): Promise<RestoreOutcome> {
  const download = await getBackup(credentials);
  if (!download.ok) {
    return 'failed';
  }
  if (download.value === null) {
    return 'none';
  }
  const { format, schema, bytes, updatedAt } = download.value;
  // The headers say it before a byte is decrypted; the payload says it again below.
  if (format > BACKUP_FORMAT || schema > LATEST_SCHEMA) {
    return 'newerApp';
  }
  const engine = expoEngine();
  if (engine === null) {
    return 'failed';
  }
  const opened = await openBackup(engine, credentials, bytes);
  if (!opened.ok) {
    return 'undecryptable';
  }
  let raw: unknown;
  try {
    raw = JSON.parse(opened.json) as unknown;
  } catch {
    return 'failed';
  }
  const payload = readPayload(raw);
  if (payload === null) {
    const written = formatOf(raw);
    return written !== null && written > BACKUP_FORMAT ? 'newerApp' : 'failed';
  }
  try {
    if (importBackup(payload, now, devicePlatform()) === 'newerApp') {
      return 'newerApp';
    }
  } catch {
    // Rolled back: the database is what it was.
    return 'failed';
  }
  try {
    // The server's copy is what this phone holds now: the next automatic run may
    // replace it, and it has no upload of its own to compare against yet.
    settingsRepo.updateBackup({ remoteAt: updatedAt, fingerprint: null, lastError: null }, Date.now());
  } catch {
    // Unwritten, the next automatic run is only more careful than it needs to be.
  }
  rehydrateStores(now);
  return 'restored';
}

/**
 * Replaces this phone's data with the backup of `credentials`' account (ADR-0048 §7):
 * download with those credentials, decrypt with their key, import, and the stores read
 * the database again. The caller rotates the secret afterwards and then calls
 * `backupNow` with the new credentials, so the server's copy is under the new key.
 *
 * This install's identity, its backup switch and the circle's sync stamp are kept; the
 * circle's cursor goes back to zero. Never throws.
 */
export async function restoreBackup(credentials: Credentials, now: number): Promise<RestoreOutcome> {
  restoring = true;
  changed();
  try {
    // An upload already on its way finishes first, so the download is never raced by
    // this phone's own older data.
    await flight?.promise.catch(() => undefined);
    return await restore(credentials, now);
  } catch {
    return 'failed';
  } finally {
    restoring = false;
    changed();
  }
}

// --- What the screens are told ------------------------------------------------------------------

export type BackupStatus = {
  /** Backups go out from this phone: switched on, with an identity the server knows, and a cipher. */
  available: boolean;
  /** One line, always true, in the current language. */
  reason: string;
  enabled: boolean;
  lastAt: number | null;
};

/** The short local date and time of an instant, in the app's language (ADR-0020). */
function whenText(at: number): string {
  return new Intl.DateTimeFormat(getLocaleTag(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(at));
}

/** The values `status()` looks at. A screen passes what it subscribed to. */
export type BackupFacts = {
  state: BackupSetting;
  /** The server has this install's identity (`identity.registeredAt`). */
  registered: boolean;
};

function currentFacts(): BackupFacts {
  let registered = false;
  try {
    const identity = readIdentity();
    registered = identity !== null && identity.registeredAt !== null;
  } catch {
    registered = false;
  }
  return { state: getBackupState(), registered };
}

/**
 * Where the backup stands, in one line (rule 8, ADR-0017): off by the user, no cipher on
 * this build, no identity on the server yet, never backed up, the last backup, or why
 * the last attempt failed next to the last time it worked.
 */
export function status(facts: BackupFacts = currentFacts()): BackupStatus {
  const t = getStrings().backup;
  const { state, registered } = facts;
  const base = { enabled: state.enabled, lastAt: state.lastAt };
  if (!state.enabled) {
    return { ...base, available: false, reason: t.status.off };
  }
  if (expoEngine() === null) {
    return { ...base, available: false, reason: t.status.noCrypto };
  }
  if (!registered) {
    return { ...base, available: false, reason: t.status.noIdentity };
  }
  if (isBackupError(state.lastError)) {
    const why = t.errors[state.lastError];
    return {
      ...base,
      available: true,
      reason: state.lastAt === null ? t.status.failedNever(why) : t.status.failed(why, whenText(state.lastAt)),
    };
  }
  return {
    ...base,
    available: true,
    reason: state.lastAt === null ? t.status.never : t.status.last(whenText(state.lastAt)),
  };
}
