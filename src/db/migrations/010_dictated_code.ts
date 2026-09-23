/**
 * ADR-0037: the dictated code, a second transport for the same key.
 *
 * paired_keys.typed_enabled: a key is scan-only until its holder says otherwise.
 * Dictation trades the friction that makes the lock mean something —walking to the
 * kitchen— for convenience, so a household chooses it per key. Existing rows are 0: no
 * key ever gains a second way in without somebody asking for it.
 *
 * paired_keys.last_typed_step: the newest five-minute window this key was accepted in.
 * The scanned code's mark is in 30 s units and the two cannot share one integer.
 *
 * sessions.key_tries: wrong dictated codes in this session. A camera cannot enumerate
 * and a keyboard can, so this is the first attempt counter in the app. It lives on the
 * session and not on a clock because the phone's owner controls the clock.
 *
 * A shipped migration is never edited. Add 011_*.ts instead.
 */
export const DICTATED_CODE_SQL = `
ALTER TABLE paired_keys ADD COLUMN typed_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paired_keys ADD COLUMN last_typed_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN key_tries INTEGER NOT NULL DEFAULT 0;
`;
