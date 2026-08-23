import type { Activity } from '../../domain/types';
import { getDb } from '../client';
import { uuidv7 } from '../../lib/uuid';

/**
 * Activities are the chips in session config and the grouping key of the ledger.
 * Keys are stable slugs so a future i18n pass can translate labels without touching
 * stored rows.
 */

const DEFAULT_ACTIVITIES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'trabajo', label: 'trabajo' },
  { key: 'lectura', label: 'lectura' },
  { key: 'aprender', label: 'aprender' },
  { key: 'gym', label: 'gym' },
  { key: 'familia', label: 'familia' },
  { key: 'amigos', label: 'amigos' },
];

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
  const result = getDb().executeSync(
    'SELECT * FROM activities WHERE archived_at IS NULL ORDER BY created_at',
  );
  return (result.rows as unknown as ActivityRow[]).map(toActivity);
}

export function findByKey(key: string): Activity | null {
  const result = getDb().executeSync('SELECT * FROM activities WHERE key = ?', [key]);
  const row = (result.rows as unknown as ActivityRow[])[0];
  return row === undefined ? null : toActivity(row);
}

export function insert(key: string, label: string, now: number): Activity {
  const activity: Activity = {
    id: uuidv7(now),
    key,
    label,
    isDefault: false,
    archivedAt: null,
    createdAt: now,
  };

  getDb().executeSync(
    `INSERT INTO activities (id, key, label, is_default, archived_at, created_at)
     VALUES (?, ?, ?, 0, NULL, ?)`,
    [activity.id, activity.key, activity.label, activity.createdAt],
  );

  return activity;
}

/**
 * Seeds the default activities. Idempotent through the UNIQUE key, so it can run on
 * every boot without a "has it been seeded" flag.
 */
export function seedDefaults(now: number): void {
  const db = getDb();
  for (const { key, label } of DEFAULT_ACTIVITIES) {
    db.executeSync(
      `INSERT OR IGNORE INTO activities (id, key, label, is_default, archived_at, created_at)
       VALUES (?, ?, ?, 1, NULL, ?)`,
      [uuidv7(now), key, label, now],
    );
  }
}
