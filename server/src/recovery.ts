import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * The recovery email (ADR-0050): the one place where the server can give a secret back.
 *
 * For an email alone to be enough, the server has to hold the secret. It holds it sealed
 * with AES-256-GCM under `RECOVERY_KEY`, a key that lives in Railway's variables and never
 * in the database, with the account id as authenticated data: a leak of the database
 * alone opens nothing, and a sealed secret moved to another account's row does not open
 * either. The codes are hashed under a key derived from the same one, for the same
 * reason — six digits are a million values, and a plain hash of them is read back in a
 * second by anyone holding the table.
 */

/** Six digits, as they are typed. */
export const CODE_DIGITS = 6;
/** How long a code lives (ADR-0050 §5). */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Wrong codes a code survives; the next attempt answers 429 and the code is burned. */
export const CODE_ATTEMPTS = 5;

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * `RECOVERY_KEY` as `openssl rand -base64 32` prints it (base64url is taken too), or null
 * for anything that is not exactly 32 bytes. `Buffer.from(..., 'base64')` skips what it
 * cannot read instead of refusing it, so the value is decoded and encoded again and has
 * to come back the same: a key with a typo is refused, never quietly shortened.
 */
export function parseRecoveryKey(value: string | undefined): Buffer | null {
  if (value === undefined) {
    return null;
  }
  const clean = value.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (clean === '') {
    return null;
  }
  const bytes = Buffer.from(clean, 'base64');
  if (bytes.length !== KEY_BYTES || bytes.toString('base64').replace(/=+$/, '') !== clean) {
    return null;
  }
  return bytes;
}

export function isRecoveryKey(key: Uint8Array | null): key is Uint8Array {
  return key !== null && key.byteLength === KEY_BYTES;
}

/**
 * The secret, sealed for one account: base64(iv | ciphertext | tag). A fresh IV every
 * time, so sealing the same secret twice gives two different strings.
 */
export function sealSecret(key: Uint8Array, accountId: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(accountId, 'utf8'));
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64');
}

/**
 * The secret back, or null when it does not open: another key (a lost or replaced
 * `RECOVERY_KEY`), another account's id, or bytes that were changed.
 */
export function openSecret(key: Uint8Array, accountId: string, sealed: string): string | null {
  const bytes = Buffer.from(sealed, 'base64');
  if (bytes.length <= IV_BYTES + TAG_BYTES) {
    return null;
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(accountId, 'utf8'));
    decipher.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));
    const body = bytes.subarray(IV_BYTES, bytes.length - TAG_BYTES);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** `000000` to `999999`, from the system's CSPRNG. */
export function newCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0');
}

/** What a caller typed, as six digits, or null. Spaces are how people copy a code. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const clean = value.replace(/\s/g, '');
  return new RegExp(`^\\d{${CODE_DIGITS}}$`).test(clean) ? clean : null;
}

/**
 * The key the codes are hashed with: derived from `RECOVERY_KEY`, so the escrow key is
 * never used for two things, and so the table of hashes is useless without it.
 */
export function codeKey(recoveryKey: Uint8Array): Buffer {
  return Buffer.from(hkdfSync('sha256', recoveryKey, Buffer.alloc(0), 'vesper recovery code', KEY_BYTES));
}

/**
 * HMAC-SHA256 of the code, salted with what it is for and who it is for: the same six
 * digits sent to two people, or twice to one, never hash alike.
 */
export function hashCode(key: Uint8Array, purpose: string, subject: string, code: string): string {
  return createHmac('sha256', key).update(`${purpose}\0${subject}\0${code}`).digest('hex');
}

/** Constant time, like `secretMatches`. */
export function codeMatches(hash: string, known: string): boolean {
  const given = Buffer.from(hash, 'hex');
  const stored = Buffer.from(known, 'hex');
  return given.length === stored.length && timingSafeEqual(given, stored);
}

/**
 * No spaces or control characters, and none of what turns an address into a list or a
 * display name (`,;:<>()[]\"`): the address goes to the mail provider as a recipient,
 * and one string must be one mailbox. One `@`, and a domain with a dot inside it.
 */
const EMAIL =
  /^[^\s@,;:<>()[\]\\"\x00-\x1f\x7f]+@(?:[^\s@,;:<>()[\]\\".\x00-\x1f\x7f]+\.)+[^\s@,;:<>()[\]\\".\x00-\x1f\x7f]+$/;
const MAX_EMAIL = 254;

/** Trimmed and lowercased, at most 254 characters, or null. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const clean = value.trim().toLowerCase();
  return clean.length <= MAX_EMAIL && EMAIL.test(clean) ? clean : null;
}
