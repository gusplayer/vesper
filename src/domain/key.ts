import { fromHex, hmacSha256, toHex, utf8 } from '../lib/sha256';
import { groupDictated, normalizeDictated, toDictation } from './dictation';
import type { Millis, PairedKey } from './types';

/**
 * The key (ADR-0035): the code another device shows to open and close a session.
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

/**
 * A key's id is short on purpose. The pairing code carries the whole secret, and
 * `src/lib/qr.ts` stops at 84 bytes: 'VKP1:' + id + ':' + 64 hex leaves 14 characters
 * for the id. Twelve hex is 48 bits, which is plenty to tell apart the handful of keys
 * one phone ever has, and it keeps the rotating code inside a small, easy-to-read QR.
 * A UUID here would overflow the encoder and take the pairing screen down with it.
 */
export const KEY_ID_CHARS = 12;

/**
 * How long a key session must run before its key may close it.
 *
 * Without this, someone standing at the key device can photograph two consecutive
 * codes, scan the first to start and the second to end, and serve nothing. A code is
 * only ever valid for the window it belongs to, so a photograph goes stale: making the
 * session refuse to close for two minutes outlives every code that could already have
 * been captured when it started. The emergency unlock is still there for the person
 * who genuinely has to leave in the first two minutes.
 */
export const KEY_MIN_SESSION_MS = 2 * 60_000;

// --- The dictated code (ADR-0037) ---------------------------------------------------

/**
 * Eight symbols of the dictation alphabet: forty bits. Six digits fall to a bluetooth
 * keyboard and a macro in nine hours; forty bits still hold when every other defence —
 * the counter, the throttle, the clock — has been tampered with by the phone's owner.
 */
export const TYPED_CODE_LENGTH = 8;

/**
 * Five minutes, with one window either side: a dictated code lives ten to fifteen
 * minutes, because a phone call does not fit in ninety seconds. A longer *step*, never a
 * wider skew: keeping 30 s steps and accepting twenty either way would leave forty-one
 * codes alive at once and give away five bits for the same result.
 */
export const TYPED_STEP_MS = 5 * 60_000;

/**
 * How long a session must run before a dictated code may close it. Fifteen minutes, not
 * two: the two-minute rule of ADR-0035 was arithmetic against a code that lived ninety
 * seconds, and the invariant it encodes is that the minimum age outlives the longest
 * code that could already have been captured when the session began.
 */
export const TYPED_MIN_SESSION_MS = 15 * 60_000;

/**
 * Wrong entries allowed in one session before the dictated code stops working until the
 * next one. Counted per session and not per hour on purpose: the attacker owns the
 * clock, so any "wait ten minutes" is skipped by moving it, and a counter in memory is
 * cleared by relaunching. At ten tries a blind guess lands with probability 2.7e-11.
 */
export const MAX_TYPED_TRIES = 10;

const TYPED_PREFIX = 'VKT1';
/** Forty bits, five per symbol. */
const TYPED_BYTES = 5;

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

/** Which five-minute window `now` falls in. The dictated code's clock. */
export function typedStep(now: Millis): number {
  return Math.floor(now / TYPED_STEP_MS);
}

/**
 * The code the key device shows to be read out loud, already grouped: `K7QM-3PFX`.
 * Derived from its own message, so it is never a slice of the scanned one and seeing
 * either says nothing about the other.
 */
export function typedCodeAt(key: PairedKey, now: Millis): string {
  return groupDictated(typedCodeFor(key, typedStep(now)));
}

/**
 * The window a dictated code belongs to, or null when it is not this key's, is outside
 * the accepted range, or falls at or below a window this key has already spent.
 * Accepts the code however it was typed: lowercase, spaced, hyphenated.
 */
export function verifyTypedCode(key: PairedKey, text: string, now: Millis): number | null {
  const typed = normalizeDictated(text, TYPED_CODE_LENGTH);
  if (typed === null) {
    return null;
  }
  const current = typedStep(now);
  for (let offset = -KEY_SKEW_STEPS; offset <= KEY_SKEW_STEPS; offset += 1) {
    const step = current + offset;
    if (step <= key.lastTypedStep) {
      continue;
    }
    if (equals(typedCodeFor(key, step), typed)) {
      return step;
    }
  }
  return null;
}

/**
 * Which key a dictated code belongs to, among the ones this phone holds. Only keys whose
 * holder turned dictation on are considered: a key is scan-only until someone says
 * otherwise (ADR-0037).
 */
export function matchTypedKey(keys: readonly PairedKey[], text: string, now: Millis): KeyCode | null {
  for (const key of keys) {
    if (!key.typedEnabled) {
      continue;
    }
    const step = verifyTypedCode(key, text, now);
    if (step !== null) {
      // The code itself is not returned: nothing needs it, and a caller that logged the
      // result would be logging a live credential.
      return { keyId: key.id, code: '', step };
    }
  }
  return null;
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
 * outside the accepted window.
 *
 * Two floors, and both matter. `key.lastStep` is the newest step this key was ever
 * accepted in: time only moves forward for a key, so a code recorded once cannot be
 * replayed by winding the phone's clock back to its window. `after` is the step that
 * opened the current session, so the code that started it cannot also end it.
 */
export function verifyKeyCode(key: PairedKey, text: string, now: Millis, after: number | null = null): number | null {
  const parsed = parseKeyCode(text);
  if (parsed === null || parsed.keyId !== key.id) {
    return null;
  }
  const floor = Math.max(key.lastStep, after ?? 0);
  const current = keyStep(now);
  for (let offset = -KEY_SKEW_STEPS; offset <= KEY_SKEW_STEPS; offset += 1) {
    const step = current + offset;
    if (step <= floor) {
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
 * moment, to a camera, at arm's length. 82 bytes with a 12-character id: a version 5
 * QR, the largest this encoder makes.
 */
export function pairingCode(pairing: Pairing): string {
  return `${PAIRING_PREFIX}:${pairing.keyId}:${pairing.secret}`;
}

/** True when an id is short enough for its pairing code to fit the encoder. */
export function isKeyIdUsable(keyId: string): boolean {
  return keyId.length > 0 && keyId.length <= KEY_ID_CHARS + 2;
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
  if (secret.length !== SECRET_BYTES * 2 || fromHex(secret) === null || !isKeyIdUsable(keyId)) {
    return null;
  }
  return { keyId, secret };
}

/**
 * Which of several keys a scanned code belongs to, and in which step. The store reads
 * the secrets out of the keychain and hands them here; the choosing is the domain's,
 * so it can be tested without a keychain and without a phone.
 */
export function matchKey(keys: readonly PairedKey[], text: string, now: Millis, after: number | null = null): KeyCode | null {
  const parsed = parseKeyCode(text);
  if (parsed === null) {
    return null;
  }
  for (const key of keys) {
    if (key.id !== parsed.keyId) {
      continue;
    }
    const step = verifyKeyCode(key, text, now, after);
    if (step !== null) {
      return { keyId: key.id, code: parsed.code, step };
    }
  }
  return null;
}

/** HMAC of the window under the secret, forty bits as dictation symbols. */
function typedCodeFor(key: PairedKey, step: number): string {
  const secret = fromHex(key.secret);
  if (secret === null) {
    return '';
  }
  const mac = hmacSha256(secret, utf8(`${TYPED_PREFIX}:${key.id}:${step}`));
  return toDictation(mac.slice(0, TYPED_BYTES), TYPED_CODE_LENGTH);
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
