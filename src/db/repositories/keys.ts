import type { KeyRole, PairedKey } from '../../domain/types';
import { getDb, rowsAs } from '../client';

/**
 * The keys paired with this phone (ADR-0035), without their secrets: the name, the
 * side this phone is on and the newest step ever accepted live here, the 32 bytes live
 * in the keychain under the same id (`src/platform/keyStore.ts`). A row read from here
 * always comes back with an empty `secret`; whoever needs to derive a code asks the
 * keychain for it.
 *
 * That split is the reason `PairedKey` is not simply selected and returned: a caller
 * who forgets to fill the secret gets a key that derives nothing, never a key that
 * derives the wrong code.
 */

type KeyRow = {
  id: string;
  name: string;
  role: KeyRole;
  last_step: number;
  typed_enabled: number;
  last_typed_step: number;
  paired_at: number;
};

function toKey(row: KeyRow): PairedKey {
  return {
    id: row.id,
    name: row.name,
    secret: '',
    role: row.role,
    lastStep: row.last_step,
    typedEnabled: row.typed_enabled === 1,
    lastTypedStep: row.last_typed_step,
    pairedAt: row.paired_at,
  };
}

/** Oldest first, the order they were paired. */
export function list(): PairedKey[] {
  return rowsAs<KeyRow>(getDb().executeSync('SELECT * FROM paired_keys ORDER BY paired_at')).map(toKey);
}

export function findById(id: string): PairedKey | null {
  const row = rowsAs<KeyRow>(getDb().executeSync('SELECT * FROM paired_keys WHERE id = ?', [id]))[0];
  return row === undefined ? null : toKey(row);
}

/** Pairing the same id twice renames it rather than failing: the second scan wins. */
export function insert(key: Pick<PairedKey, 'id' | 'name' | 'role' | 'pairedAt'>): void {
  getDb().executeSync(
    `INSERT INTO paired_keys (id, name, role, last_step, paired_at) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role`,
    [key.id, key.name, key.role, key.pairedAt],
  );
}

export function rename(id: string, name: string): void {
  getDb().executeSync('UPDATE paired_keys SET name = ? WHERE id = ?', [name, id]);
}

/**
 * Moves the key's high-water mark. `MAX` rather than `=`: a step is only ever raised,
 * so winding the clock back cannot reopen a window that has already been used.
 */
export function markStep(id: string, step: number): void {
  getDb().executeSync('UPDATE paired_keys SET last_step = MAX(last_step, ?) WHERE id = ?', [step, id]);
}

/** The same, for the dictated code's five-minute clock. Also only ever raised. */
export function markTypedStep(id: string, step: number): void {
  getDb().executeSync('UPDATE paired_keys SET last_typed_step = MAX(last_typed_step, ?) WHERE id = ?', [step, id]);
}

/** Turns the dictated code on or off for one key. Off is what a new key gets. */
export function setTypedEnabled(id: string, enabled: boolean): void {
  getDb().executeSync('UPDATE paired_keys SET typed_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

/** The row only. The secret is the keychain's, and the caller forgets it first. */
export function remove(id: string): void {
  getDb().executeSync('DELETE FROM paired_keys WHERE id = ?', [id]);
}

export function count(): number {
  const result = getDb().executeSync('SELECT COUNT(*) AS n FROM paired_keys');
  const n = result.rows[0]?.n;
  return typeof n === 'number' ? n : 0;
}
