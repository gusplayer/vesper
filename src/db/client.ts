import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';

import { migrations } from './migrations';
import { pendingMigrations, splitStatements } from './sql';

/**
 * The single database handle. op-sqlite is synchronous, so there is no pool and no
 * connection lifecycle to manage — one open call for the life of the process.
 *
 * Nothing outside src/db/ imports this. Components never run SQL; repositories do.
 */

const DB_NAME = 'vesper.db';

let handle: DB | null = null;

export function getDb(): DB {
  if (handle === null) {
    handle = open({ name: DB_NAME });
    handle.executeSync('PRAGMA journal_mode = WAL');
    handle.executeSync('PRAGMA foreign_keys = ON');
    runMigrations(handle);
  }
  return handle;
}

/**
 * What running a migration needs of a handle: op-sqlite's `DB`, or the fake of
 * src/db/testing in a test.
 */
export type SqlHandle = {
  executeSync: (sql: string, params?: Scalar[]) => { rows: Record<string, unknown>[] };
};

export type MigrateOptions = {
  /**
   * The last migration id to apply. Omitted, every migration. Restoring a backup stops
   * at the backup's own schema, puts its rows in, and only then runs the rest, so an
   * old backup is upgraded exactly the way an old phone is (ADR-0048 §7).
   */
  upTo?: number;
  /**
   * `'each'` (boot): every migration commits on its own, so a failure halfway leaves
   * the database on the last good version. `'caller'`: the caller already holds one
   * transaction and wants all of it or nothing, which SQLite cannot nest.
   */
  transaction?: 'each' | 'caller';
};

/**
 * Applies pending migrations in id order, up to `upTo`, and returns the ids it applied.
 */
export function runMigrations(db: SqlHandle, options: MigrateOptions = {}): number[] {
  const { upTo = Number.POSITIVE_INFINITY, transaction: mode = 'each' } = options;
  db.executeSync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  INTEGER NOT NULL
    )
  `);

  const applied = new Set<number>();
  for (const row of db.executeSync('SELECT id FROM _migrations').rows) {
    if (typeof row.id === 'number') {
      applied.add(row.id);
    }
  }

  const done: number[] = [];
  for (const migration of pendingMigrations(migrations, applied)) {
    if (migration.id > upTo) {
      break;
    }
    if (mode === 'each') {
      db.executeSync('BEGIN');
    }
    try {
      // A migration holds several statements, which executeSync does not split.
      for (const statement of splitStatements(migration.sql)) {
        db.executeSync(statement);
      }
      db.executeSync('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)', [
        migration.id,
        migration.name,
        Date.now(),
      ]);
      if (mode === 'each') {
        db.executeSync('COMMIT');
      }
    } catch (error) {
      // The caller's transaction is the caller's to roll back.
      if (mode === 'each') {
        db.executeSync('ROLLBACK');
      }
      throw new Error(`migration ${migration.id} (${migration.name}) failed: ${String(error)}`);
    }
    done.push(migration.id);
  }
  return done;
}

/**
 * Runs `work` inside one transaction, rolling back on any throw. For a write that is
 * several statements and must be all or nothing: replacing every health mark, taking
 * a person out of the circle, seeding the demo data.
 */
export function transaction(work: () => void): void {
  const db = getDb();
  db.executeSync('BEGIN');
  try {
    work();
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}

/**
 * The rows of a query, typed by the caller. op-sqlite returns untyped records; the
 * repositories know their table shape, and this is the one place the cast happens.
 */
export function rowsAs<T>(result: { rows: Record<string, unknown>[] }): T[] {
  return result.rows as unknown as T[];
}

/** Test and debug only. The app never closes the database. */
export function closeDb(): void {
  if (handle !== null) {
    handle.close();
    handle = null;
  }
}
