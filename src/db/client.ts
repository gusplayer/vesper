import { open, type DB } from '@op-engineering/op-sqlite';

import { migrations } from './migrations';
import { splitStatements } from './sql';

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

  const pending = migrations
    .filter((migration) => !applied.has(migration.id))
    .sort((a, b) => a.id - b.id);

  for (const migration of pending) {
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

/** Test and debug only. The app never closes the database. */
export function closeDb(): void {
  if (handle !== null) {
    handle.close();
    handle = null;
  }
}
