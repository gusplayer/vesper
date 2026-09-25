import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  codeKey,
  codeMatches,
  hashCode,
  newCode,
  normalizeCode,
  normalizeEmail,
  openSecret,
  parseRecoveryKey,
  sealSecret,
} from './recovery.ts';

/**
 * ADR-0050 §2 and §5: the sealed copy of a secret and the codes. What matters is that
 * the copy opens only with the key and only for its account, and that a key with a typo
 * is refused rather than read as a shorter one.
 */

const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';

describe('RECOVERY_KEY', () => {
  it('takes what `openssl rand -base64 32` prints, and base64url', () => {
    const bytes = randomBytes(32);

    expect(parseRecoveryKey(bytes.toString('base64'))).toEqual(bytes);
    expect(parseRecoveryKey(`${bytes.toString('base64')}\n`)).toEqual(bytes);
    expect(parseRecoveryKey(bytes.toString('base64url'))).toEqual(bytes);
  });

  it('refuses anything that is not exactly 32 bytes', () => {
    const good = randomBytes(32).toString('base64');

    expect(parseRecoveryKey(undefined)).toBeNull();
    expect(parseRecoveryKey('')).toBeNull();
    expect(parseRecoveryKey(randomBytes(16).toString('base64'))).toBeNull();
    expect(parseRecoveryKey(randomBytes(33).toString('base64'))).toBeNull();
    // Node would skip the stray characters and decode the rest; the key is refused instead.
    expect(parseRecoveryKey(`${good.slice(0, 10)}!${good.slice(11)}`)).toBeNull();
    expect(parseRecoveryKey(`${good.slice(0, 20)} ${good.slice(20)}`)).toBeNull();
  });
});

describe('the sealed secret', () => {
  const key = randomBytes(32);

  it('opens with its key and for its account, and for nothing else', () => {
    const sealed = sealSecret(key, GUS, 'the-secret');

    expect(openSecret(key, GUS, sealed)).toBe('the-secret');
    expect(openSecret(key, ANA, sealed)).toBeNull();
    expect(openSecret(randomBytes(32), GUS, sealed)).toBeNull();
    expect(openSecret(key, GUS, '')).toBeNull();
    expect(openSecret(key, GUS, 'not base64 at all')).toBeNull();
  });

  it('refuses a copy that was changed', () => {
    const bytes = Buffer.from(sealSecret(key, GUS, 'the-secret'), 'base64');
    bytes[14] = (bytes[14] ?? 0) ^ 1;

    expect(openSecret(key, GUS, bytes.toString('base64'))).toBeNull();
  });

  it('never seals the same secret the same way twice', () => {
    expect(sealSecret(key, GUS, 'the-secret')).not.toBe(sealSecret(key, GUS, 'the-secret'));
  });
});

describe('the codes', () => {
  it('are six digits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newCode()).toMatch(/^\d{6}$/);
    }
  });

  it('are read as typed, spaces and all, and nothing else', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode(' 012345 ')).toBe('012345');
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('1234567')).toBeNull();
    expect(normalizeCode('12345a')).toBeNull();
    expect(normalizeCode(123456)).toBeNull();
  });

  it('hash apart for another purpose, another subject and another key', () => {
    const key = codeKey(randomBytes(32));
    const hash = hashCode(key, 'recover', 'gus@example.com', '123456');

    expect(codeMatches(hashCode(key, 'recover', 'gus@example.com', '123456'), hash)).toBe(true);
    expect(codeMatches(hashCode(key, 'verify', 'gus@example.com', '123456'), hash)).toBe(false);
    expect(codeMatches(hashCode(key, 'recover', 'ana@example.com', '123456'), hash)).toBe(false);
    expect(codeMatches(hashCode(codeKey(randomBytes(32)), 'recover', 'gus@example.com', '123456'), hash)).toBe(false);
    expect(codeMatches('', hash)).toBe(false);
  });

  it('are not hashed with the key that seals the secrets', () => {
    const recoveryKey = randomBytes(32);

    expect(codeKey(recoveryKey).equals(recoveryKey)).toBe(false);
    expect(codeKey(recoveryKey)).toHaveLength(32);
  });
});

describe('an email', () => {
  it('is trimmed and lowercased', () => {
    expect(normalizeEmail('  Gus@Example.COM ')).toBe('gus@example.com');
    expect(normalizeEmail('gus.moreno+vesper@mail.example.co')).toBe('gus.moreno+vesper@mail.example.co');
    expect(normalizeEmail('josé@correo.co')).toBe('josé@correo.co');
  });

  it('is one mailbox, with a dot in its domain, and at most 254 characters', () => {
    for (const bad of [
      'gus',
      'gus@',
      '@example.com',
      'gus@example',
      'gus@.example.com',
      'gus@example..com',
      'gus@example.com.',
      'gus@@example.com',
      'a@b@example.com',
      'gus @example.com',
      'a,b@example.com',
      'a;b@example.com',
      '"gus"@example.com',
      'Gus <gus@example.com>',
      'gus@exa\nmple.com',
      'gus\u0000@example.com',
      `${'x'.repeat(243)}@example.com`,
      null,
      42,
    ]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
    expect(normalizeEmail(`${'x'.repeat(242)}@example.com`)).toHaveLength(254);
  });
});
