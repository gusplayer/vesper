import type { PairedKey } from '../../domain/types';
import { getDb, rowsAs } from '../client';

/**
 * The keys paired with this phone (ADR-0034), without their secrets: the name and the
 * date live here, the 32 bytes live in the keychain under the same id
 * (`src/platform/keyStore.ts`). A row read from here always comes back with an empty
 * `secret`; whoever needs to derive a code asks the keychain for it.
 *
 * That split is the reason `PairedKey` is not simply selected and returned: a caller
 * who forgets to fill the secret gets a key that derives nothing, never a key that
 * derives the wrong code.
 */

type KeyRow = {
  id: string;
  name: string;
  paired_at: number;
};

function toKey(row: KeyRow): PairedKey {
  return { id: row.id, name: row.name, secret: '', pairedAt: row.paired_at };
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
export function insert(key: Pick<PairedKey, 'id' | 'name' | 'pairedAt'>): void {
  getDb().executeSync(
    `INSERT INTO paired_keys (id, name, paired_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    [key.id, key.name, key.pairedAt],
  );
}

export function rename(id: string, name: string): void {
  getDb().executeSync('UPDATE paired_keys SET name = ? WHERE id = ?', [name, id]);
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
