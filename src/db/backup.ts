import { getDb, runMigrations, type SqlHandle } from './client';
import { migrations } from './migrations';
import { SETTING_KEYS } from './repositories/settings';

/**
 * The encrypted backup's contents (ADR-0048 §7): the whole database as JSON, and the
 * way back in. This file never encrypts and never talks to a server; that is
 * src/platform/backup.ts. What it decides is **what travels and how it lands**.
 *
 * The payload is every table but `_migrations`, row by row, with the id of the last
 * migration the rows were written under. Restoring drops every table, migrates a fresh
 * schema up to that id, puts the rows in, and only then runs the migrations this app
 * has and the backup did not: an old backup is upgraded by the same SQL that upgrades
 * an old phone, so there is no second path to keep correct. A backup from a newer app
 * than this one is refused, never guessed at.
 *
 * What never travels, and why:
 * - The settings of this install (`LOCAL_SETTING_KEYS`): the identity, its last ping,
 *   the backup's own state and the circle's sync cursor. They say where this phone is,
 *   not who the person is.
 * - A session still running: it is this phone's present, not history. Restored, it
 *   would start a blocked session on the new phone that nobody asked for.
 * - On iPhone, `modes.selection_token`: a Screen Time token only works on the device
 *   that made it (ADR-0004, ADR-0048 §9). An Android selection is package names and
 *   lands on another Android intact. Every mode whose selection is emptied — at the
 *   export on iPhone, at the import anywhere but Android to Android — goes on the
 *   `modes_repick` list, so its card says to pick the apps again.
 *
 * Nothing here reads `DeviceActivityReport`: nothing in the database ever came from it
 * (rule 10).
 */

export const BACKUP_FORMAT = 1;

export type BackupPlatform = 'ios' | 'android';

/** SQLite gives back text, integers, reals and null; the schema has no BLOB column. */
export type BackupValue = string | number | null;

export type BackupRow = Record<string, BackupValue>;

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  /** The highest migration id the rows were written under. */
  schema: number;
  platform: BackupPlatform;
  createdAt: number;
  tables: Record<string, BackupRow[]>;
};

/** The highest migration this app knows. A backup above it comes from a newer app. */
export const LATEST_SCHEMA = migrations.reduce((max, migration) => Math.max(max, migration.id), 0);

/** Settings that belong to this install. They are left out of the export and kept on import. */
export const LOCAL_SETTING_KEYS: readonly string[] = [
  SETTING_KEYS.identity,
  SETTING_KEYS.identityPingAt,
  SETTING_KEYS.backup,
  SETTING_KEYS.circleSyncSince,
  SETTING_KEYS.circleSyncedAt,
];

/**
 * The fields of `prototype_settings` that describe this phone rather than the person:
 * which permissions it granted and when it last read Health. A restore keeps this
 * phone's values, because a permission is never "granted" by a flag from another
 * device (rule 8, ADR-0048 §9): on a new phone they are asked again in their flow.
 */
export const DEVICE_SETTING_FIELDS = [
  'screenTimeConnected',
  'healthConnected',
  'notificationsAllowed',
  'healthSyncedAt',
] as const;

/** What a device field reads as on a phone that never set it. */
const DEVICE_SETTING_DEFAULTS: Record<(typeof DEVICE_SETTING_FIELDS)[number], boolean | null> = {
  screenTimeConnected: false,
  healthConnected: false,
  notificationsAllowed: false,
  healthSyncedAt: null,
};

// --- Pure: values and shapes ------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** A cell as JSON can carry it. Booleans become 0/1 like SQLite stores them; anything binary is dropped. */
export function toBackupValue(value: unknown): BackupValue {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return null;
}

function toRow(raw: Record<string, unknown>): BackupRow {
  const row: BackupRow = {};
  for (const [column, value] of Object.entries(raw)) {
    row[column] = toBackupValue(value);
  }
  return row;
}

/**
 * A decrypted payload, checked before anything is dropped. Null for anything that is
 * not a backup this code wrote: a wrong format, a schema that is not a positive
 * integer, a table that is not a list of rows.
 */
export function readPayload(raw: unknown): BackupPayload | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { format, schema, platform, createdAt, tables } = raw;
  if (format !== BACKUP_FORMAT) {
    return null;
  }
  if (typeof schema !== 'number' || !Number.isInteger(schema) || schema < 1) {
    return null;
  }
  if (platform !== 'ios' && platform !== 'android') {
    return null;
  }
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || !isRecord(tables)) {
    return null;
  }
  const clean: Record<string, BackupRow[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows) || !rows.every(isRecord)) {
      return null;
    }
    clean[table] = rows.map(toRow);
  }
  return { format: BACKUP_FORMAT, schema, platform, createdAt, tables: clean };
}

/**
 * The export's rules over rows read straight from SQLite: this install's settings out,
 * a running session out, and on iPhone the Screen Time tokens emptied.
 */
export function payloadFromTables(input: {
  schema: number;
  platform: BackupPlatform;
  createdAt: number;
  tables: Record<string, Record<string, unknown>[]>;
}): BackupPayload {
  const tables: Record<string, BackupRow[]> = {};
  for (const [table, raw] of Object.entries(input.tables)) {
    let rows = raw.map(toRow);
    if (table === 'settings') {
      rows = rows.filter((row) => typeof row.key !== 'string' || !LOCAL_SETTING_KEYS.includes(row.key));
    }
    if (table === 'sessions') {
      rows = rows.filter((row) => row.outcome !== 'running');
    }
    if (table === 'modes' && input.platform === 'ios') {
      rows = rows.map((row) => (hasOwn(row, 'selection_token') ? { ...row, selection_token: null } : row));
    }
    tables[table] = rows;
  }
  if (input.platform === 'ios') {
    const emptied = pickedModeIds(input.tables.modes?.map(toRow) ?? []);
    tables.settings = withRepick(tables.settings ?? [], emptied, input.createdAt);
  }
  return { format: BACKUP_FORMAT, schema: input.schema, platform: input.platform, createdAt: input.createdAt, tables };
}

/** The ids of the mode rows that carry a selection token. */
function pickedModeIds(rows: readonly BackupRow[]): string[] {
  return rows
    .filter((row) => typeof row.selection_token === 'string' && row.selection_token !== '')
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string');
}

/**
 * The settings rows with `ids` added to the `modes_repick` list (ADR-0048 §9). The list
 * the rows already carry is kept: a phone restored from another and not yet re-picked
 * still owes those modes their apps.
 */
export function withRepick(rows: readonly BackupRow[], ids: readonly string[], at: number): BackupRow[] {
  if (ids.length === 0) {
    return [...rows];
  }
  const current = rows.find((row) => row.key === SETTING_KEYS.modesRepick);
  let listed: string[] = [];
  if (current !== undefined && typeof current.value === 'string') {
    try {
      const parsed = JSON.parse(current.value) as unknown;
      listed = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      listed = [];
    }
  }
  const value = JSON.stringify([...new Set([...listed, ...ids])]);
  const others = rows.filter((row) => row.key !== SETTING_KEYS.modesRepick);
  return [...others, { key: SETTING_KEYS.modesRepick, value, updated_at: at }];
}

/**
 * `prototype_settings` from the backup, with this phone's own permission fields put
 * back. `local` is this install's stored value, or null when it has none. A value
 * that is not JSON on either side is left as the backup had it.
 */
export function withDeviceFields(backupValue: string, local: string | null): string {
  let restored: unknown;
  try {
    restored = JSON.parse(backupValue) as unknown;
  } catch {
    return backupValue;
  }
  if (!isRecord(restored)) {
    return backupValue;
  }
  let here: Record<string, unknown> = {};
  if (local !== null) {
    try {
      const parsed = JSON.parse(local) as unknown;
      here = isRecord(parsed) ? parsed : {};
    } catch {
      here = {};
    }
  }
  const merged: Record<string, unknown> = { ...restored };
  for (const field of DEVICE_SETTING_FIELDS) {
    merged[field] = hasOwn(here, field) ? here[field] : DEVICE_SETTING_DEFAULTS[field];
  }
  return JSON.stringify(merged);
}

/**
 * The rows a restore writes, by table: the payload with the import's rules applied.
 * This install's settings are dropped from it (they are kept, not overwritten), a
 * Screen Time token is emptied unless it goes from Android to Android, and the
 * permission fields of `prototype_settings` are this phone's.
 */
export function planImport(
  payload: BackupPayload,
  device: { platform: BackupPlatform; localPrototypeSettings: string | null },
): Record<string, BackupRow[]> {
  const keepTokens = payload.platform === 'android' && device.platform === 'android';
  const plan: Record<string, BackupRow[]> = {};
  for (const [table, rows] of Object.entries(payload.tables)) {
    let planned = rows;
    if (table === 'settings') {
      planned = planned
        .filter((row) => typeof row.key !== 'string' || !LOCAL_SETTING_KEYS.includes(row.key))
        .map((row) =>
          row.key === SETTING_KEYS.prototypeSettings && typeof row.value === 'string'
            ? { ...row, value: withDeviceFields(row.value, device.localPrototypeSettings) }
            : row,
        );
    }
    if (table === 'sessions') {
      planned = planned.filter((row) => row.outcome !== 'running');
    }
    if (table === 'modes' && !keepTokens) {
      planned = planned.map((row) => (hasOwn(row, 'selection_token') ? { ...row, selection_token: null } : row));
    }
    plan[table] = planned;
  }
  if (!keepTokens) {
    const emptied = pickedModeIds(payload.tables.modes ?? []);
    if (emptied.length > 0) {
      plan.settings = withRepick(plan.settings ?? [], emptied, payload.createdAt);
    }
  }
  return plan;
}

/**
 * A cheap fingerprint of what a backup holds, for "nothing changed since the last
 * one". It leaves out what moves without the person doing anything: when the payload
 * was made, when a settings row was last written, and `lastOpenedAt`, which every
 * foreground rewrites. The account id is part of it: the same rows under another
 * account are another backup.
 */
export function fingerprintOf(payload: BackupPayload, accountId: string): string {
  const tables: Record<string, BackupRow[]> = {};
  for (const table of Object.keys(payload.tables).sort()) {
    const rows = payload.tables[table] ?? [];
    tables[table] =
      table === 'settings'
        ? rows.map((row) => {
            const { updated_at: _ignored, ...rest } = row;
            return row.key === SETTING_KEYS.prototypeSettings && typeof rest.value === 'string'
              ? { ...rest, value: withoutField(rest.value, 'lastOpenedAt') }
              : rest;
          })
        : rows;
  }
  return hashText(`${accountId}|${payload.format}|${payload.schema}|${payload.platform}|${JSON.stringify(tables)}`);
}

function withoutField(json: string, field: string): string {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isRecord(parsed)) {
      return json;
    }
    const { [field]: _dropped, ...rest } = parsed;
    return JSON.stringify(rest);
  } catch {
    return json;
  }
}

/**
 * A 64-bit non-cryptographic hash (cyrb53's mixing, both halves kept), as 16 hex
 * characters. It only tells "same" from "changed"; nothing secret depends on it.
 */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

// --- The database ---------------------------------------------------------------------------

/** Every table SQLite holds for the app, `_migrations` included; never SQLite's own. */
function listTables(db: SqlHandle): string[] {
  return db
    .executeSync("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .rows.map((row) => row.name)
    .filter((name): name is string => typeof name === 'string');
}

function columnsOf(db: SqlHandle, table: string): string[] {
  return db
    .executeSync(`PRAGMA table_info("${table}")`)
    .rows.map((row) => row.name)
    .filter((name): name is string => typeof name === 'string');
}

function schemaOf(db: SqlHandle): number {
  const id = db.executeSync('SELECT MAX(id) AS id FROM _migrations').rows[0]?.id;
  return typeof id === 'number' ? id : 0;
}

/**
 * The whole database as a payload, under the export's rules. Synchronous, like every
 * read here; a year of use is well under a megabyte of JSON.
 */
export function exportBackup(now: number, platform: BackupPlatform): BackupPayload {
  const db = getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of listTables(db)) {
    if (table === '_migrations') {
      continue;
    }
    tables[table] = db.executeSync(`SELECT * FROM "${table}" ORDER BY rowid`).rows;
  }
  return payloadFromTables({ schema: schemaOf(db), platform, createdAt: now, tables });
}

/** `newerApp`: the backup was written by an app with migrations this one does not have. */
export type ImportOutcome = 'imported' | 'newerApp';

type KeptSetting = { key: string; value: string; updatedAt: number };

function keptSettings(db: SqlHandle): KeptSetting[] {
  const keys = LOCAL_SETTING_KEYS.filter((key) => key !== SETTING_KEYS.circleSyncSince);
  const placeholders = keys.map(() => '?').join(', ');
  const kept: KeptSetting[] = [];
  for (const row of db.executeSync(
    `SELECT key, value, updated_at FROM settings WHERE key IN (${placeholders})`,
    keys,
  ).rows) {
    if (typeof row.key === 'string' && typeof row.value === 'string') {
      kept.push({ key: row.key, value: row.value, updatedAt: typeof row.updated_at === 'number' ? row.updated_at : 0 });
    }
  }
  return kept;
}

function localPrototypeSettings(db: SqlHandle): string | null {
  const value = db.executeSync('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.prototypeSettings]).rows[0]
    ?.value;
  return typeof value === 'string' ? value : null;
}

const UPSERT_SETTING = `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`;

/**
 * Only into tables and columns the migrated schema has. Names come from SQLite, never
 * from the payload: the payload only supplies values, and those are bound.
 */
function insertRows(db: SqlHandle, plan: Record<string, BackupRow[]>): void {
  for (const table of listTables(db)) {
    if (table === '_migrations' || !hasOwn(plan, table)) {
      continue;
    }
    const rows = plan[table] ?? [];
    if (rows.length === 0) {
      continue;
    }
    const existing = new Set(columnsOf(db, table));
    for (const row of rows) {
      const columns = Object.keys(row).filter((column) => existing.has(column));
      if (columns.length === 0) {
        continue;
      }
      const names = columns.map((column) => `"${column}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      db.executeSync(
        `INSERT INTO "${table}" (${names}) VALUES (${placeholders})`,
        columns.map((column) => row[column] ?? null),
      );
    }
  }
}

/**
 * Replaces the database with a backup, in one transaction: every table dropped, the
 * schema rebuilt up to the backup's migration, its rows written, the remaining
 * migrations run over them. This install's own settings are kept as they were, and
 * the circle's cursor goes back to 0 so the next `/sync` brings everything.
 *
 * Foreign keys are off while it runs: dropping a parent before its child, and writing
 * a child before its parent, are both normal here. SQLite only switches them outside
 * a transaction, so the pragma wraps it.
 *
 * Throws when SQLite refuses, after the rollback: the database is then exactly what it
 * was. The caller rehydrates the stores on `imported`; this file knows nothing of them.
 */
export function importBackup(payload: BackupPayload, now: number, platform: BackupPlatform): ImportOutcome {
  if (payload.schema > LATEST_SCHEMA) {
    return 'newerApp';
  }
  const db = getDb();
  const kept = keptSettings(db);
  const plan = planImport(payload, { platform, localPrototypeSettings: localPrototypeSettings(db) });

  db.executeSync('PRAGMA foreign_keys = OFF');
  try {
    db.executeSync('BEGIN');
    try {
      for (const table of listTables(db)) {
        db.executeSync(`DROP TABLE "${table}"`);
      }
      runMigrations(db, { upTo: payload.schema, transaction: 'caller' });
      insertRows(db, plan);
      runMigrations(db, { transaction: 'caller' });
      for (const setting of kept) {
        db.executeSync(UPSERT_SETTING, [setting.key, setting.value, setting.updatedAt]);
      }
      db.executeSync(UPSERT_SETTING, [SETTING_KEYS.circleSyncSince, '0', now]);
      db.executeSync('COMMIT');
    } catch (error) {
      db.executeSync('ROLLBACK');
      throw error;
    }
  } finally {
    db.executeSync('PRAGMA foreign_keys = ON');
  }
  return 'imported';
}
