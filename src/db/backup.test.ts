import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  exportBackup,
  fingerprintOf,
  hashText,
  importBackup,
  LATEST_SCHEMA,
  LOCAL_SETTING_KEYS,
  payloadFromTables,
  planImport,
  readPayload,
  toBackupValue,
  withDeviceFields,
  withRepick,
  type BackupPayload,
} from './backup';
import { closeDb, getDb, runMigrations } from './client';
import { migrations } from './migrations';
import { createFakeDb, type FakeDb } from './testing/fakeDb';

/**
 * The backup's contents (ADR-0048 §7) against the fake handle. The fake runs no SQL, so
 * what is guarded is the order of the statements and what each one carries: the rules
 * of what travels, the schema rebuilt up to the backup's migration before a row goes
 * in, the rest of the migrations after, and a failure that leaves nothing half done.
 *
 * The real client runs on top of the fake, with op-sqlite's `open` handing it over, so
 * the bounded migration runner is exercised as it is shipped.
 */

let fake: FakeDb = createFakeDb();

vi.mock('@op-engineering/op-sqlite', () => ({
  open: () => Object.assign(fake, { close: () => undefined }),
}));

const T0 = 1_700_000_000_000;

/** A fresh fake, opened and migrated, with the boot's statements forgotten. */
function freshDb(): FakeDb {
  closeDb();
  fake = createFakeDb();
  getDb();
  fake.calls.length = 0;
  return fake;
}

function sqls(db: FakeDb): string[] {
  return db.calls.map((call) => call.sql.trim());
}

function indexOf(db: FakeDb, pattern: RegExp | string, from = 0): number {
  const all = sqls(db);
  for (let i = from; i < all.length; i += 1) {
    const sql = all[i] ?? '';
    if (typeof pattern === 'string' ? sql.includes(pattern) : pattern.test(sql)) {
      return i;
    }
  }
  return -1;
}

/** The migration ids recorded in `_migrations`, in the order they were applied. */
function appliedIds(db: FakeDb): number[] {
  return db.calls
    .filter((call) => call.sql.startsWith('INSERT INTO _migrations'))
    .map((call) => (call.params ?? [])[0] as number);
}

function payload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    format: 1,
    schema: LATEST_SCHEMA,
    platform: 'android',
    createdAt: T0,
    tables: {
      settings: [
        { key: 'prototype_settings', value: JSON.stringify({ onboardingDone: true, healthConnected: true, lastOpenedAt: T0 }), updated_at: T0 },
        { key: 'active_mode_id', value: 'mode-1', updated_at: T0 },
      ],
      modes: [{ id: 'mode-1', name: 'Trabajo', selection_token: 'com.instagram.android', created_at: T0 }],
      sessions: [
        { id: 's1', outcome: 'completed', started_at: T0 },
        { id: 's2', outcome: 'running', started_at: T0 },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  freshDb();
});

describe('LATEST_SCHEMA', () => {
  it('is the highest migration id this app has', () => {
    expect(LATEST_SCHEMA).toBe(migrations.length);
  });
});

describe('toBackupValue', () => {
  it('keeps text and finite numbers, stores booleans as SQLite does and drops the rest', () => {
    expect(toBackupValue('a')).toBe('a');
    expect(toBackupValue(3.5)).toBe(3.5);
    expect(toBackupValue(true)).toBe(1);
    expect(toBackupValue(false)).toBe(0);
    expect(toBackupValue(Number.NaN)).toBeNull();
    expect(toBackupValue(new ArrayBuffer(2))).toBeNull();
    expect(toBackupValue(undefined)).toBeNull();
  });
});

describe('readPayload', () => {
  it('accepts a backup this code wrote', () => {
    const read = readPayload(JSON.parse(JSON.stringify(payload())));

    expect(read?.schema).toBe(LATEST_SCHEMA);
    expect(read?.tables.modes?.[0]?.name).toBe('Trabajo');
  });

  it('refuses anything else before a table is dropped', () => {
    expect(readPayload(null)).toBeNull();
    expect(readPayload([])).toBeNull();
    expect(readPayload({ ...payload(), format: 2 })).toBeNull();
    expect(readPayload({ ...payload(), schema: 0 })).toBeNull();
    expect(readPayload({ ...payload(), schema: 2.5 })).toBeNull();
    expect(readPayload({ ...payload(), platform: 'web' })).toBeNull();
    expect(readPayload({ ...payload(), createdAt: 'yesterday' })).toBeNull();
    expect(readPayload({ ...payload(), tables: [] })).toBeNull();
    expect(readPayload({ ...payload(), tables: { modes: 'nope' } })).toBeNull();
    expect(readPayload({ ...payload(), tables: { modes: [1, 2] } })).toBeNull();
  });
});

describe('payloadFromTables', () => {
  const tables = {
    settings: [
      ...LOCAL_SETTING_KEYS.map((key) => ({ key, value: 'here', updated_at: T0 })),
      { key: 'language', value: 'es', updated_at: T0 },
    ],
    sessions: [
      { id: 's1', outcome: 'completed' },
      { id: 's2', outcome: 'running' },
    ],
    modes: [{ id: 'm1', selection_token: 'opaque', created_at: T0 }],
  };

  it('leaves out the settings of this install and a session still running', () => {
    const built = payloadFromTables({ schema: 10, platform: 'android', createdAt: T0, tables });

    expect(built.tables.settings?.map((row) => row.key)).toEqual(['language']);
    expect(built.tables.sessions?.map((row) => row.id)).toEqual(['s1']);
    expect(built).toMatchObject({ format: 1, schema: 10, platform: 'android', createdAt: T0 });
  });

  it('empties the Screen Time token on iPhone and keeps an Android selection', () => {
    expect(payloadFromTables({ schema: 10, platform: 'ios', createdAt: T0, tables }).tables.modes?.[0]?.selection_token).toBeNull();
    expect(payloadFromTables({ schema: 10, platform: 'android', createdAt: T0, tables }).tables.modes?.[0]?.selection_token).toBe(
      'opaque',
    );
  });

  it('lists every mode whose token it empties, so the new phone asks for its apps again', () => {
    const ios = payloadFromTables({ schema: 10, platform: 'ios', createdAt: T0, tables });
    const android = payloadFromTables({ schema: 10, platform: 'android', createdAt: T0, tables });

    expect(ios.tables.settings?.find((row) => row.key === 'modes_repick')?.value).toBe('["m1"]');
    expect(android.tables.settings?.some((row) => row.key === 'modes_repick')).toBe(false);
  });
});

describe('withRepick', () => {
  it('adds to the list a restored phone still carries, once each', () => {
    const rows = [{ key: 'modes_repick', value: '["m0","m1"]', updated_at: 1 }];

    expect(withRepick(rows, ['m1', 'm2'], T0)).toEqual([{ key: 'modes_repick', value: '["m0","m1","m2"]', updated_at: T0 }]);
    expect(withRepick(rows, [], T0)).toEqual(rows);
  });
});

describe('planImport', () => {
  const tokenOf = (from: 'ios' | 'android', to: 'ios' | 'android') =>
    planImport(payload({ platform: from }), { platform: to, localPrototypeSettings: null }).modes?.[0]?.selection_token;

  it('keeps a selection only from Android to Android', () => {
    expect(tokenOf('android', 'android')).toBe('com.instagram.android');
    expect(tokenOf('android', 'ios')).toBeNull();
    expect(tokenOf('ios', 'android')).toBeNull();
    expect(tokenOf('ios', 'ios')).toBeNull();
  });

  it('puts a selection it empties on the repick list, and only then', () => {
    const repickOf = (to: 'ios' | 'android') =>
      planImport(payload({ platform: 'android' }), { platform: to, localPrototypeSettings: null }).settings?.find(
        (row) => row.key === 'modes_repick',
      )?.value;

    expect(repickOf('ios')).toMatch(/^\["[^"]+"\]$/);
    expect(repickOf('android')).toBeUndefined();
  });

  it('never writes over the settings of this install, even when a payload carries them', () => {
    const tampered = payload();
    tampered.tables.settings?.push({ key: 'identity', value: '{"id":"someone-else"}', updated_at: T0 });

    const plan = planImport(tampered, { platform: 'android', localPrototypeSettings: null });

    expect(plan.settings?.some((row) => row.key === 'identity')).toBe(false);
  });

  it("puts this phone's permissions back into the restored settings", () => {
    const local = JSON.stringify({ healthConnected: false, notificationsAllowed: true, healthSyncedAt: 5 });

    const plan = planImport(payload(), { platform: 'android', localPrototypeSettings: local });
    const restored = JSON.parse(String(plan.settings?.[0]?.value)) as Record<string, unknown>;

    expect(restored).toMatchObject({
      onboardingDone: true,
      healthConnected: false,
      notificationsAllowed: true,
      screenTimeConnected: false,
      healthSyncedAt: 5,
    });
  });

  it('drops a running session a hand-made payload might carry', () => {
    const plan = planImport(payload(), { platform: 'android', localPrototypeSettings: null });

    expect(plan.sessions?.map((row) => row.id)).toEqual(['s1']);
  });
});

describe('withDeviceFields', () => {
  it('reads every permission as not granted on a phone with no settings yet', () => {
    const merged = JSON.parse(withDeviceFields(JSON.stringify({ healthConnected: true, weeklyTargetMs: 9 }), null)) as Record<
      string,
      unknown
    >;

    expect(merged).toEqual({
      healthConnected: false,
      screenTimeConnected: false,
      notificationsAllowed: false,
      healthSyncedAt: null,
      weeklyTargetMs: 9,
    });
  });

  it('leaves a value that is not a JSON object as it came', () => {
    expect(withDeviceFields('{nope', null)).toBe('{nope');
    expect(withDeviceFields('[1]', null)).toBe('[1]');
  });

  it('ignores a local value that is not JSON', () => {
    const merged = JSON.parse(withDeviceFields('{"healthConnected":true}', '{nope')) as Record<string, unknown>;

    expect(merged.healthConnected).toBe(false);
  });
});

describe('fingerprintOf', () => {
  it('ignores what moves by itself: the time of the payload, of each settings write, and the last open', () => {
    const later = payload({ createdAt: T0 + 60_000 });
    later.tables.settings = [
      {
        key: 'prototype_settings',
        value: JSON.stringify({ onboardingDone: true, healthConnected: true, lastOpenedAt: T0 + 99 }),
        updated_at: T0 + 99,
      },
      { key: 'active_mode_id', value: 'mode-1', updated_at: T0 + 99 },
    ];

    expect(fingerprintOf(later, 'acc')).toBe(fingerprintOf(payload(), 'acc'));
  });

  it('changes when a row does, and with the account', () => {
    const edited = payload();
    edited.tables.modes = [{ id: 'mode-1', name: 'Estudio', selection_token: null, created_at: T0 }];

    expect(fingerprintOf(edited, 'acc')).not.toBe(fingerprintOf(payload(), 'acc'));
    expect(fingerprintOf(payload(), 'other')).not.toBe(fingerprintOf(payload(), 'acc'));
  });
});

describe('hashText', () => {
  it('is 16 hex characters, stable, and tells one character apart', () => {
    expect(hashText('vesper')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashText('vesper')).toBe(hashText('vesper'));
    expect(hashText('vesper')).not.toBe(hashText('vespeR'));
  });
});

describe('runMigrations', () => {
  it('stops at `upTo` and, inside a caller transaction, opens none of its own', () => {
    const db = freshDb();

    const done = runMigrations(db, { upTo: 3, transaction: 'caller' });

    expect(done).toEqual([1, 2, 3]);
    expect(appliedIds(db)).toEqual([1, 2, 3]);
    expect(sqls(db).some((sql) => sql === 'BEGIN' || sql === 'COMMIT')).toBe(false);
  });

  it('wraps each migration in its own transaction at boot', () => {
    const db = freshDb();

    runMigrations(db);

    expect(sqls(db).filter((sql) => sql === 'BEGIN')).toHaveLength(migrations.length);
    expect(sqls(db).filter((sql) => sql === 'COMMIT')).toHaveLength(migrations.length);
  });

  it('skips what `_migrations` already has', () => {
    const db = freshDb();
    db.whenSql('SELECT id FROM _migrations', migrations.slice(0, 8).map((m) => ({ id: m.id })));

    expect(runMigrations(db)).toEqual(migrations.slice(8).map((m) => m.id));
  });
});

describe('exportBackup', () => {
  it('reads every table but _migrations, with the schema it was written under', () => {
    const db = freshDb();
    db.whenSql('sqlite_master', [{ name: '_migrations' }, { name: 'modes' }, { name: 'settings' }]);
    db.whenSql('MAX(id)', [{ id: 7 }]);
    db.whenSql('FROM "settings"', [
      { key: 'identity', value: '{"id":"me"}', updated_at: T0 },
      { key: 'language', value: 'en', updated_at: T0 },
    ]);
    db.whenSql('FROM "modes"', [{ id: 'm1', selection_token: 'opaque' }]);

    const exported = exportBackup(T0, 'ios');

    expect(exported).toMatchObject({ format: 1, schema: 7, platform: 'ios', createdAt: T0 });
    expect(Object.keys(exported.tables).sort()).toEqual(['modes', 'settings']);
    // The emptied token leaves a note: m1's apps are picked again on the new phone.
    expect(exported.tables.settings?.map((row) => row.key)).toEqual(['language', 'modes_repick']);
    expect(exported.tables.modes?.[0]?.selection_token).toBeNull();
    expect(indexOf(db, 'FROM "_migrations"')).toBe(-1);
  });
});

describe('importBackup', () => {
  /** A database whose tables and columns the fake reports as they are after migrating. */
  function stubbedDb(): FakeDb {
    const db = freshDb();
    db.whenSql('sqlite_master', [{ name: '_migrations' }, { name: 'modes' }, { name: 'sessions' }, { name: 'settings' }]);
    db.whenSql('table_info("modes")', [{ name: 'id' }, { name: 'name' }, { name: 'selection_token' }, { name: 'created_at' }]);
    // `started_at` exists; the payload's `outcome` does too; a column the schema lacks does not.
    db.whenSql('table_info("sessions")', [{ name: 'id' }, { name: 'outcome' }, { name: 'started_at' }]);
    db.whenSql('table_info("settings")', [{ name: 'key' }, { name: 'value' }, { name: 'updated_at' }]);
    db.whenSql('SELECT key, value, updated_at FROM settings WHERE key IN', [
      { key: 'identity', value: '{"id":"this-phone","registeredAt":1}', updated_at: 42 },
      { key: 'backup', value: '{"enabled":false}', updated_at: 43 },
    ]);
    db.whenSql('SELECT value FROM settings WHERE key = ?', [{ value: JSON.stringify({ notificationsAllowed: true }) }]);
    // The one fact the fake has to remember: which migrations `_migrations` holds once
    // it was dropped and refilled, so the second run only applies the rest.
    const execute = db.executeSync;
    let applied: number[] = migrations.map((m) => m.id);
    db.executeSync = (sql, params) => {
      if (sql.startsWith('DROP TABLE "_migrations"')) {
        applied = [];
      }
      if (sql.startsWith('INSERT INTO _migrations')) {
        applied.push(Number(params?.[0]));
      }
      const result = execute(sql, params);
      return sql.startsWith('SELECT id FROM _migrations') ? { rows: applied.map((id) => ({ id })) } : result;
    };
    return db;
  }

  it('refuses a backup from a newer app and touches nothing', () => {
    const db = freshDb();

    expect(importBackup(payload({ schema: LATEST_SCHEMA + 1 }), T0, 'android')).toBe('newerApp');
    expect(db.calls).toHaveLength(0);
  });

  it('drops, rebuilds up to the backup, writes the rows, then runs the rest, in one transaction', () => {
    const db = stubbedDb();
    const old = payload({ schema: 4 });

    expect(importBackup(old, T0, 'android')).toBe('imported');

    const off = indexOf(db, 'PRAGMA foreign_keys = OFF');
    const begin = indexOf(db, /^BEGIN$/);
    const firstDrop = indexOf(db, 'DROP TABLE');
    const firstInsert = indexOf(db, 'INSERT INTO "');
    const commit = indexOf(db, /^COMMIT$/);
    const on = indexOf(db, 'PRAGMA foreign_keys = ON');
    expect(off).toBeGreaterThanOrEqual(0);
    expect(off).toBeLessThan(begin);
    expect(begin).toBeLessThan(firstDrop);
    expect(firstDrop).toBeLessThan(firstInsert);
    expect(firstInsert).toBeLessThan(commit);
    expect(commit).toBeLessThan(on);
    // One transaction: no migration opened its own.
    expect(sqls(db).filter((sql) => sql === 'BEGIN')).toHaveLength(1);

    // Every table the database had, `_migrations` included, is dropped.
    expect(sqls(db).filter((sql) => sql.startsWith('DROP TABLE'))).toEqual([
      'DROP TABLE "_migrations"',
      'DROP TABLE "modes"',
      'DROP TABLE "sessions"',
      'DROP TABLE "settings"',
    ]);

    // Migrations 1–4 before the rows, 5 onwards after them.
    const migrationInserts = db.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call.sql.startsWith('INSERT INTO _migrations'));
    const before = migrationInserts.filter(({ index }) => index < firstInsert).map(({ call }) => call.params?.[0]);
    const after = migrationInserts.filter(({ index }) => index > firstInsert).map(({ call }) => call.params?.[0]);
    expect(before).toEqual([1, 2, 3, 4]);
    expect(after).toEqual(migrations.filter((m) => m.id > 4).map((m) => m.id));
  });

  it('writes only the columns the schema has, and never a running session', () => {
    const db = stubbedDb();
    const old = payload();
    old.tables.sessions = [
      { id: 's1', outcome: 'completed', started_at: T0, from_the_future: 'x' },
      { id: 's2', outcome: 'running', started_at: T0 },
    ];
    old.tables.not_a_table = [{ id: 'x' }];

    importBackup(old, T0, 'android');

    const sessionInserts = db.calls.filter((call) => call.sql.startsWith('INSERT INTO "sessions"'));
    expect(sessionInserts).toHaveLength(1);
    expect(sessionInserts[0]?.sql).toBe('INSERT INTO "sessions" ("id", "outcome", "started_at") VALUES (?, ?, ?)');
    expect(sessionInserts[0]?.params).toEqual(['s1', 'completed', T0]);
    expect(indexOf(db, 'not_a_table')).toBe(-1);
  });

  it("keeps this install's own settings and sends the circle back to the start", () => {
    const db = stubbedDb();

    importBackup(payload(), T0, 'ios');

    const upserts = db.calls.filter((call) => call.sql.startsWith('INSERT INTO settings'));
    expect(upserts.map((call) => call.params)).toEqual([
      ['identity', '{"id":"this-phone","registeredAt":1}', 42],
      ['backup', '{"enabled":false}', 43],
      ['circle_sync_since', '0', T0],
    ]);
    // The token was Android's and this phone is an iPhone.
    const modeInsert = db.calls.find((call) => call.sql.startsWith('INSERT INTO "modes"'));
    expect(modeInsert?.params).toEqual(['mode-1', 'Trabajo', null, T0]);
    // This phone's permission, not the backup's.
    const settingsInsert = db.calls.find(
      (call) => call.sql.startsWith('INSERT INTO "settings"') && call.params?.[0] === 'prototype_settings',
    );
    expect(JSON.parse(String(settingsInsert?.params?.[1]))).toMatchObject({
      notificationsAllowed: true,
      healthConnected: false,
    });
  });

  it('rolls back and turns the foreign keys on again when SQLite refuses a row', () => {
    const db = stubbedDb();
    const execute = db.executeSync;
    db.executeSync = (sql, params) => {
      if (sql.startsWith('INSERT INTO "modes"')) {
        throw new Error('constraint failed');
      }
      return execute(sql, params);
    };

    expect(() => importBackup(payload(), T0, 'android')).toThrow('constraint failed');
    const rollback = indexOf(db, /^ROLLBACK$/);
    expect(rollback).toBeGreaterThan(0);
    expect(indexOf(db, /^COMMIT$/)).toBe(-1);
    expect(indexOf(db, 'PRAGMA foreign_keys = ON')).toBeGreaterThan(rollback);
  });
});
