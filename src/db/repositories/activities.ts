import type { Activity } from '../../domain/types';
import { getDb, rowsAs } from '../client';
import { uuidv7 } from '../../lib/uuid';

/**
 * Activities are the chips in session config and the grouping key of the ledger.
 *
 * Default activities have stable slug keys so a future i18n pass can translate their
 * labels without touching stored rows. User-created ones use the label itself as key
 * (see domain/activities.ts): they are the user's own words and have no translation.
 */

type ActivityRow = {
  id: string;
  key: string;
  label: string;
  is_default: number;
  archived_at: number | null;
  created_at: number;
};

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    isDefault: row.is_default === 1,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function listActive(): Activity[] {
  return rowsAs<ActivityRow>(
    getDb().executeSync('SELECT * FROM activities WHERE archived_at IS NULL ORDER BY created_at'),
  ).map(toActivity);
}

export function findById(id: string): Activity | null {
  const row = rowsAs<ActivityRow>(
    getDb().executeSync('SELECT * FROM activities WHERE id = ?', [id]),
  )[0];
  return row === undefined ? null : toActivity(row);
}

export function findByKey(key: string): Activity | null {
  const row = rowsAs<ActivityRow>(
    getDb().executeSync('SELECT * FROM activities WHERE key = ?', [key]),
  )[0];
  return row === undefined ? null : toActivity(row);
}

/**
 * Seeds the default activities, labelled in the language of the fresh install
 * (ADR-0020); `defaults` comes from `demoActivities(t.demo)` and the ids are the
 * keys. Idempotent through the UNIQUE key, so it can run on every boot without a
 * "has it been seeded" flag.
 */
export function seedDefaults(now: number, defaults: readonly { id: string; label: string }[]): void {
  const db = getDb();
  for (const { id: key, label } of defaults) {
    db.executeSync(
      `INSERT OR IGNORE INTO activities (id, key, label, is_default, archived_at, created_at)
       VALUES (?, ?, ?, 1, NULL, ?)`,
      [uuidv7(now), key, label, now],
    );
  }
}
