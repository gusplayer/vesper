import type { Mode, ModeBehavior } from '../../data/types';
import { isDepth } from '../../domain/session';
import { getDb, rowsAs } from '../client';

/**
 * Modes: what a session blocks, and how hard it is to leave. One row per mode, the
 * app and website lists stored as JSON text — they are short catalogue ids, never
 * queried individually.
 */

type ModeRow = {
  id: string;
  name: string;
  behavior: string;
  app_ids: string;
  website_ids: string;
  depth: string;
  activity_id: string;
  selection_token: string | null;
  created_at: number;
};

/** A JSON array of strings, or nothing: a corrupt list reads as empty, never throws. */
export function parseStringList(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function toBehavior(value: string): ModeBehavior {
  return value === 'allow' ? 'allow' : 'block';
}

function toMode(row: ModeRow): Mode {
  return {
    id: row.id,
    name: row.name,
    behavior: toBehavior(row.behavior),
    appIds: parseStringList(row.app_ids),
    websiteIds: parseStringList(row.website_ids),
    depth: isDepth(row.depth) ? row.depth : 'soft',
    activityId: row.activity_id,
    selectionToken: row.selection_token,
    createdAt: row.created_at,
  };
}

/** Every mode, oldest first: the order the list shows them in. */
export function list(): Mode[] {
  return rowsAs<ModeRow>(getDb().executeSync('SELECT * FROM modes ORDER BY created_at, id')).map(
    toMode,
  );
}

export function findById(id: string): Mode | null {
  const row = rowsAs<ModeRow>(getDb().executeSync('SELECT * FROM modes WHERE id = ?', [id]))[0];
  return row === undefined ? null : toMode(row);
}

/** Inserts or replaces the whole row by id. created_at is kept on an update. */
export function upsert(mode: Mode): void {
  getDb().executeSync(
    `INSERT INTO modes
       (id, name, behavior, app_ids, website_ids, depth, activity_id, selection_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       behavior = excluded.behavior,
       app_ids = excluded.app_ids,
       website_ids = excluded.website_ids,
       depth = excluded.depth,
       activity_id = excluded.activity_id,
       selection_token = excluded.selection_token`,
    [
      mode.id,
      mode.name,
      mode.behavior,
      JSON.stringify(mode.appIds),
      JSON.stringify(mode.websiteIds),
      mode.depth,
      mode.activityId,
      mode.selectionToken,
      mode.createdAt,
    ],
  );
}

/** Stores the native Screen Time selection. Null clears it. */
export function setSelectionToken(id: string, selectionToken: string | null): void {
  getDb().executeSync('UPDATE modes SET selection_token = ? WHERE id = ?', [selectionToken, id]);
}

export function remove(id: string): void {
  getDb().executeSync('DELETE FROM modes WHERE id = ?', [id]);
}
