import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The account is a secret in the phone's keychain (ADR-0033): the device sends
 * `Authorization: Bearer <id>.<secret>` and the server keeps only the secret's hash,
 * like a password. There is no email, no password and no identity provider, because
 * the circle needs a row to have an owner and that owner to come back tomorrow —
 * nothing else.
 */

export type Credentials = { id: string; secret: string };

/** 32 bytes, base64url: what the device stores and shows as a recovery phrase. */
export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Constant time, so a wrong secret takes as long as a right one. */
export function secretMatches(secret: string, hash: string): boolean {
  const given = Buffer.from(hashSecret(secret), 'hex');
  const known = Buffer.from(hash, 'hex');
  return given.length === known.length && timingSafeEqual(given, known);
}

/** `Bearer <id>.<secret>`, or null for anything else. The id never contains a dot. */
export function credentialsFrom(header: string | undefined): Credentials | null {
  if (header === undefined || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) {
    return null;
  }
  return { id: token.slice(0, dot), secret: token.slice(dot + 1) };
}

/** Lowercase, 3 to 20 of `[a-z0-9_]`: unique across accounts (ADR-0032 §4). */
export function normalizeHandle(handle: string): string | null {
  const clean = handle.trim().toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(clean) ? clean : null;
}
