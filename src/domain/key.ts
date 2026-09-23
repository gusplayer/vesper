import { fromHex, hmacSha256, toHex, utf8 } from '../lib/sha256';
import type { Millis, PairedKey } from './types';

/**
 * The key (ADR-0034): the code another device shows to open and close a session.
 *
 * The code is derived from a secret shared once at pairing and from the clock, like a
 * TOTP. Two consequences the product depends on: a photograph of the code is worth one
 * step and no more, and checking a code needs no network — the phone holds the same
 * secret and reads its own clock. That is what keeps rule 7 intact while a session's
 * end depends on somebody else.
 *
 * Pure: no React, no database, no platform. The secret arrives as hex from wherever it
 * is stored; generating it is the caller's job, because randomness is native.
 */

/** How long one code is valid. Thirty seconds, like every authenticator. */
export const KEY_STEP_MS = 30_000;

/**
 * How many steps either side of now are accepted. Two phones with a minute of drift
 * between them should still work; a photograph should not. One step each way is the
 * usual compromise and gives a code a life of at most 90 s.
 */
export const KEY_SKEW_STEPS = 1;

/** Marks a session the key opened, in `exitReason`, next to EMERGENCY_EXIT_REASON. */
export const KEY_EXIT_REASON = 'key';

const CODE_PREFIX = 'VK1';
const PAIRING_PREFIX = 'VKP1';
/** Six bytes of the HMAC: 48 bits is far past guessing inside a 30 s window. */
const CODE_BYTES = 6;
const SECRET_BYTES = 32;

export type KeyCode = {
  keyId: string;
  code: string;
  /** The time step the code belongs to; a session remembers the one that opened it. */
  step: number;
};

export type Pairing = {
  keyId: string;
  /** Hex, 32 bytes. */
  secret: string;
};

/** Which 30 s window `now` falls in. */
export function keyStep(now: Millis): number {
  return Math.floor(now / KEY_STEP_MS);
}

/**
 * What the key device shows right now: `VK1:<keyId>:<code>`. Short on purpose — 25
 * bytes fits a version 2 QR, which has fewer modules and is easier to read across a
 * table than a dense one.
 */
export function keyCodeAt(key: PairedKey, now: Millis): string {
  return `${CODE_PREFIX}:${key.id}:${codeFor(key, keyStep(now))}`;
}

/** The payload as its parts, or null when it is not one of ours. */
export function parseKeyCode(text: string): Omit<KeyCode, 'step'> | null {
  const parts = text.trim().split(':');
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) {
    return null;
  }
  const [, keyId, code] = parts;
  if (keyId === undefined || code === undefined || keyId === '' || code.length !== CODE_BYTES * 2) {
    return null;
  }
  return { keyId, code };
}

/**
 * The step a scanned code belongs to, or null when it is not this key's code or is
 * outside the accepted window. `after` rejects a step already used, so the code that
 * opened a session cannot also close it: scanning twice in the same half minute would
 * otherwise start and end a session in one breath.
 */
export function verifyKeyCode(key: PairedKey, text: string, now: Millis, after: number | null = null): number | null {
  const parsed = parseKeyCode(text);
  if (parsed === null || parsed.keyId !== key.id) {
    return null;
  }
  const current = keyStep(now);
  for (let offset = -KEY_SKEW_STEPS; offset <= KEY_SKEW_STEPS; offset += 1) {
    const step = current + offset;
    if (after !== null && step <= after) {
      continue;
    }
    if (equals(codeFor(key, step), parsed.code)) {
      return step;
    }
  }
  return null;
}

/**
 * What the key device shows once, while pairing: the secret itself. The same shape as
 * an authenticator's enrolment code, and safe for the same reason — it is shown for a
 * moment, to a camera, at arm's length. 77 bytes, a version 5 QR.
 */
export function pairingCode(pairing: Pairing): string {
  return `${PAIRING_PREFIX}:${pairing.keyId}:${pairing.secret}`;
}

/** The pairing payload as its parts, or null when it is malformed. */
export function parsePairingCode(text: string): Pairing | null {
  const parts = text.trim().split(':');
  if (parts.length !== 3 || parts[0] !== PAIRING_PREFIX) {
    return null;
  }
  const [, keyId, secret] = parts;
  if (keyId === undefined || secret === undefined || keyId === '') {
    return null;
  }
  if (secret.length !== SECRET_BYTES * 2 || fromHex(secret) === null) {
    return null;
  }
  return { keyId, secret };
}

/** HMAC of the step under the secret, first six bytes as hex. */
function codeFor(key: PairedKey, step: number): string {
  const secret = fromHex(key.secret);
  if (secret === null) {
    // A stored secret that is not hex is a corrupt row, not a wrong code: no code
    // matches, so the key simply stops working and the screen says to pair again.
    return '';
  }
  const mac = hmacSha256(secret, utf8(`${key.id}:${step}`));
  return toHex(mac.slice(0, CODE_BYTES));
}

/** Compares without returning early, so the time it takes says nothing about the code. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length || a === '') {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
