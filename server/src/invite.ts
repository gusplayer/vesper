/**
 * The invite code, checked on the server (ADR-0021, ADR-0033).
 *
 * The phone derives its code from its circle profile — `inviteCodeFor` in
 * `src/domain/circle.ts` — so the code is not a secret the server hands out but a claim
 * the device makes when it registers. This file is that derivation, ported, so the
 * server can ask one question before writing the claim down: does this code really come
 * out of this account's id?
 *
 * The contract that makes the check possible: **the account id is the circle profile's
 * id**. Both are the same UUID v7 the phone generated the first time it made a profile.
 *
 * The check is not the whole defence, and pretending otherwise would be a lie: FNV-1a is
 * not a secret (the phone's own comment says so), so grinding UUIDs until one derives to
 * a code somebody screenshotted costs about a billion hashes — minutes on a laptop. What
 * actually protects a code is that `invite_code` is unique and the first account to
 * claim it keeps it. This turns "paste the code you saw" into "grind for it", and costs
 * six hashes to do.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * How many times "Generar código nuevo" can be tapped before the server stops
 * recognising the result. Each generation is six hashes, so the scan is free; the cap is
 * there so a caller cannot ask for an unbounded one.
 */
export const MAX_CODE_GENERATION = 128;

/** FNV-1a, 32 bits. Enough to spread a UUID over six symbols; not a secret. */
function hash32(text: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The same six symbols the phone shows, for an id and a generation. */
export function inviteCodeFor(accountId: string, generation: number): string {
  const source = `${accountId}:${generation}`;
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = hash32(source, i * 0x9e3779b9) % CODE_ALPHABET.length;
    code += CODE_ALPHABET[index] ?? 'A';
  }
  return code;
}

/** Trimmed and uppercased, or null when it is not shaped like a code. */
export function normalizeInviteCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * Whether `code` is one this account ever showed. With a generation given the check is
 * exact; without one it scans the history, which is derived and not stored — the phone
 * only keeps the counter.
 */
export function derivesFrom(accountId: string, code: string, generation?: number): boolean {
  if (generation !== undefined) {
    if (!Number.isInteger(generation) || generation < 0 || generation > MAX_CODE_GENERATION) {
      return false;
    }
    return inviteCodeFor(accountId, generation) === code;
  }
  for (let i = 0; i <= MAX_CODE_GENERATION; i += 1) {
    if (inviteCodeFor(accountId, i) === code) {
      return true;
    }
  }
  return false;
}
