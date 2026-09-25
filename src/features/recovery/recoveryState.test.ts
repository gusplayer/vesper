import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import type { RecoveryFailure } from '../../platform/recoveryApi';
import { isLeftBehind, recoveryErrorLine, recoveryRowValue } from './recoveryState';

describe('recoveryErrorLine', () => {
  const failures: RecoveryFailure[] = [
    { kind: 'badEmail' },
    { kind: 'wrongCode' },
    { kind: 'codeExpired' },
    { kind: 'rateLimited', retryAfterMs: 60_000 },
    { kind: 'tooManyAttempts' },
    { kind: 'notSent' },
    { kind: 'escrowUnreadable' },
    { kind: 'offline' },
    { kind: 'notConfigured' },
    { kind: 'unauthorized' },
    { kind: 'serverError', status: 500 },
  ];

  it('says a different sentence for each refusal, in both languages', () => {
    for (const copy of [es.identity.recoveryErrors, en.identity.recoveryErrors]) {
      const lines = failures.map((failure) => recoveryErrorLine(failure, copy));
      expect(new Set(lines).size).toBe(failures.length);
      for (const line of lines) {
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toContain('!');
      }
    }
  });

  it('reads a server without the routes as "not available yet"', () => {
    const copy = es.identity.recoveryErrors;
    expect(recoveryErrorLine({ kind: 'notFound' }, copy)).toBe(copy.notConfigured);
    expect(recoveryErrorLine({ kind: 'notConfigured' }, copy)).toBe(copy.notConfigured);
  });

  it('reads too many attempts, and any other refusal, as what they are', () => {
    const copy = en.identity.recoveryErrors;
    expect(recoveryErrorLine({ kind: 'rateLimited', retryAfterMs: 1 }, copy)).toBe(copy.tooMany);
    expect(recoveryErrorLine({ kind: 'tooManyAttempts' }, copy)).toBe(copy.tooManyAttempts);
    expect(recoveryErrorLine({ kind: 'escrowUnreadable' }, copy)).toMatch(/I have a key/);
    expect(recoveryErrorLine({ kind: 'rejected', message: 'bad body' }, copy)).toBe(copy.server);
    expect(recoveryErrorLine({ kind: 'conflict', message: '' }, copy)).toBe(copy.server);
  });

  it('never says whether an email has a Vesper (ADR-0050 §4)', () => {
    for (const copy of [es.identity.recoveryErrors, en.identity.recoveryErrors]) {
      expect(recoveryErrorLine({ kind: 'wrongCode' }, copy)).not.toMatch(/no existe|does not exist|unknown|desconocido/i);
    }
    expect(es.identity.email.sent('a@b.co')).toMatch(/^Si a@b\.co tiene un Vesper/);
    expect(en.identity.email.sent('a@b.co')).toMatch(/^If a@b\.co has a Vesper/);
  });
});

describe('isLeftBehind (ADR-0050 §10)', () => {
  const base = { registered: true, keyFound: true, keyRejected: false, lastError: null };

  it('is a registered device whose key the server refuses', () => {
    expect(isLeftBehind({ ...base, keyRejected: true })).toBe(true);
    expect(isLeftBehind({ ...base, lastError: 'unauthorized' })).toBe(true);
  });

  it('is not a device whose key works, is missing, or was never registered', () => {
    expect(isLeftBehind(base)).toBe(false);
    expect(isLeftBehind({ ...base, lastError: 'offline' })).toBe(false);
    expect(isLeftBehind({ ...base, keyFound: false, keyRejected: true })).toBe(false);
    expect(isLeftBehind({ ...base, registered: false, keyRejected: true })).toBe(false);
  });
});

describe('recoveryRowValue', () => {
  it('shows the email, "Ninguno", or nothing while it is not known', () => {
    expect(recoveryRowValue('gus@example.com', es.backup.recoveryNone)).toBe('gus@example.com');
    expect(recoveryRowValue(null, es.backup.recoveryNone)).toBe('Ninguno');
    expect(recoveryRowValue(null, en.backup.recoveryNone)).toBe('None');
    expect(recoveryRowValue(undefined, es.backup.recoveryNone)).toBeUndefined();
  });
});
