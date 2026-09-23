import * as Crypto from 'expo-crypto';

import { KEY_ID_CHARS } from '../domain/key';
import { toHex } from '../lib/sha256';
import type { CapabilityStatus } from './capabilities';
import { getStrings } from '../i18n';

/**
 * Where a key's secret lives (ADR-0034): the keychain, never SQLite.
 *
 * Thirty-two bytes that end a session do not belong in a file a backup can copy, so
 * `paired_keys` holds the name and the date and this holds the secret, under the same
 * id. Losing the keychain loses the key, and pairing again is the answer — the same
 * bargain the account secret of ADR-0033 takes.
 *
 * Every call resolves and never rejects: a phone without a keychain is a phone whose
 * keys do not work, which `status()` says, not a phone that crashes.
 */

type Module = typeof import('expo-secure-store');

/** Undefined until the first load; null when the module is not in this build. */
let cached: Module | null | undefined;

/** 32 bytes as hex, the length domain/key.ts expects. */
const SECRET_BYTES = 32;

const PREFIX = 'vesper.key.';

function load(): Module | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    cached = require('expo-secure-store') as Module;
  } catch {
    cached = null;
  }
  return cached;
}

export function status(): CapabilityStatus {
  const t = getStrings().keys.platform;
  return load() === null ? { available: false, reason: t.noKeychain } : { available: true, reason: null };
}

/** A fresh secret for a key being paired, as hex. Native randomness, never Math.random. */
export function newSecret(): string {
  return toHex(Crypto.getRandomBytes(SECRET_BYTES));
}

/**
 * A fresh key id: short, because the pairing code has to fit a QR this app draws
 * itself (domain/key.ts). Not a UUID v7 for once — 48 random bits are enough to tell
 * apart the five keys a phone can hold, and a UUID would not fit.
 */
export function newKeyId(): string {
  return toHex(Crypto.getRandomBytes(KEY_ID_CHARS / 2));
}

/** Stores a key's secret. False when the keychain refused it. */
export async function saveSecret(keyId: string, secret: string): Promise<boolean> {
  const module = load();
  if (module === null) {
    return false;
  }
  try {
    await module.setItemAsync(PREFIX + keyId, secret);
    return true;
  } catch {
    return false;
  }
}

/** A key's secret, or null when it is gone — a restored backup, a cleared keychain. */
export async function readSecret(keyId: string): Promise<string | null> {
  const module = load();
  if (module === null) {
    return null;
  }
  try {
    return await module.getItemAsync(PREFIX + keyId);
  } catch {
    return null;
  }
}

/** Forgets a key's secret. Called when the key is removed, before its row goes. */
export async function forgetSecret(keyId: string): Promise<void> {
  const module = load();
  if (module === null) {
    return;
  }
  try {
    await module.deleteItemAsync(PREFIX + keyId);
  } catch {
    // Already gone is the outcome we wanted.
  }
}
