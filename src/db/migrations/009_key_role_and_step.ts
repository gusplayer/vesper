/**
 * ADR-0035, after the first threat review: three holes the key had.
 *
 * paired_keys.role says which side of the key this phone is on. 'shows' is a key this
 * phone *is* — it holds the secret to draw codes for somebody else. 'scans' is a key
 * that opens *this* phone. They were indistinguishable, so Ajustes › Llaves would
 * happily draw the live code of the very key that locks you, which is a lock whose key
 * hangs on the inside of the door. Existing rows are 'scans': that is what pairing from
 * a code produced, and it is the safe reading of an unknown row.
 *
 * paired_keys.last_step is the newest 30 s window this key has ever been accepted in.
 * Without it, a code recorded once replays forever on a phone whose clock is moved
 * back. With it, time only goes forward for a key, whatever the clock says.
 *
 * A shipped migration is never edited. Add 010_*.ts instead.
 */
export const KEY_ROLE_AND_STEP_SQL = `
ALTER TABLE paired_keys ADD COLUMN role TEXT NOT NULL DEFAULT 'scans';
ALTER TABLE paired_keys ADD COLUMN last_step INTEGER NOT NULL DEFAULT 0;
`;
