/**
 * ADR-0034: the key — another device that opens and closes a session by showing a code.
 *
 * paired_keys holds what a key is called and when it was paired. The secret is not
 * here on purpose: 32 bytes that end a session belong in the keychain, not in a file
 * a backup can copy. `src/platform/keyStore.ts` owns it, under this id.
 *
 * sessions.key_id marks a session the key opened: it runs as deep, without a footer,
 * and the only way out besides the timer and the emergency is that key's next code.
 * sessions.key_step is the 30 s window the opening code belonged to, so the same code
 * cannot also close it (domain/key.ts).
 *
 * A shipped migration is never edited. Add 009_*.ts instead.
 */
export const KEYS_SQL = `
CREATE TABLE paired_keys (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  paired_at  INTEGER NOT NULL
);

ALTER TABLE sessions ADD COLUMN key_id TEXT;
ALTER TABLE sessions ADD COLUMN key_step INTEGER;
`;
