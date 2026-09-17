import { open, type DB } from '@op-engineering/op-sqlite';

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
 * Applies pending migrations in id order, each one inside its own transaction so a
 * failure halfway through leaves the database on the last good version.
 */
function runMigrations(db: DB): void {
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

  for (const migration of pendingMigrations(migrations, applied)) {
    db.executeSync('BEGIN');
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
      db.executeSync('COMMIT');
    } catch (error) {
      db.executeSync('ROLLBACK');
      throw new Error(`migration ${migration.id} (${migration.name}) failed: ${String(error)}`);
    }
  }
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
