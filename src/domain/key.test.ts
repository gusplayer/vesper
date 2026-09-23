import { describe, expect, it } from 'vitest';

import {
  KEY_STEP_MS,
  keyCodeAt,
  keyStep,
  pairingCode,
  parseKeyCode,
  parsePairingCode,
  verifyKeyCode,
} from './key';
import type { PairedKey } from './types';

const SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);

const key: PairedKey = { id: 'k1', name: 'El teléfono de Ana', secret: SECRET, pairedAt: 0 };
const other: PairedKey = { id: 'k2', name: 'La tableta', secret: OTHER_SECRET, pairedAt: 0 };

// Tuesday 2026-09-22, 21:00:00 local, and the middle of its 30 s step.
const NOW = new Date(2026, 8, 22, 21, 0, 0).getTime();

describe('keyStep', () => {
  it('moves once every 30 s and not before', () => {
    const step = keyStep(NOW);
    expect(keyStep(NOW + KEY_STEP_MS - 1)).toBe(step);
    expect(keyStep(NOW + KEY_STEP_MS)).toBe(step + 1);
  });
});

describe('keyCodeAt', () => {
  it('is stable inside a step and different in the next', () => {
    const code = keyCodeAt(key, NOW);
    expect(keyCodeAt(key, NOW + 1)).toBe(code);
    expect(keyCodeAt(key, NOW + KEY_STEP_MS)).not.toBe(code);
  });

  it('is short enough for a small QR and shaped as expected', () => {
    const code = keyCodeAt(key, NOW);
    expect(code.startsWith('VK1:k1:')).toBe(true);
    expect(code.length).toBeLessThanOrEqual(26);
    expect(parseKeyCode(code)).toEqual({ keyId: 'k1', code: code.split(':')[2] });
  });

  it('differs per key, so one key never opens what another locked', () => {
    expect(keyCodeAt(key, NOW)).not.toBe(keyCodeAt({ ...other, id: 'k1' }, NOW));
    expect(keyCodeAt(key, NOW)).not.toBe(keyCodeAt({ ...key, id: 'k2' }, NOW));
  });
});

describe('verifyKeyCode', () => {
  it('accepts the code of this moment', () => {
    expect(verifyKeyCode(key, keyCodeAt(key, NOW), NOW)).toBe(keyStep(NOW));
  });

  it('forgives a step of drift either way', () => {
    const early = keyCodeAt(key, NOW - KEY_STEP_MS);
    const late = keyCodeAt(key, NOW + KEY_STEP_MS);
    expect(verifyKeyCode(key, early, NOW)).toBe(keyStep(NOW) - 1);
    expect(verifyKeyCode(key, late, NOW)).toBe(keyStep(NOW) + 1);
  });

  it('refuses a photograph taken two minutes ago', () => {
    const old = keyCodeAt(key, NOW - 2 * 60_000);
    expect(verifyKeyCode(key, old, NOW)).toBeNull();
  });

  it('refuses another key, and its own code under another key', () => {
    expect(verifyKeyCode(other, keyCodeAt(key, NOW), NOW)).toBeNull();
    expect(verifyKeyCode(key, keyCodeAt(other, NOW), NOW)).toBeNull();
  });

  it('refuses the step that opened the session, so one scan cannot also close it', () => {
    const scanned = keyCodeAt(key, NOW);
    const opened = verifyKeyCode(key, scanned, NOW);
    expect(opened).not.toBeNull();
    expect(verifyKeyCode(key, scanned, NOW, opened)).toBeNull();

    // Half a minute later the next code closes it.
    const later = NOW + KEY_STEP_MS;
    expect(verifyKeyCode(key, keyCodeAt(key, later), later, opened)).toBe(keyStep(later));
  });

  it('refuses rubbish without throwing', () => {
    for (const text of ['', 'VK1', 'VK1:k1', 'VK1:k1:', 'VK1:k1:zz', 'nope', 'VK1:k1:abcdef', `VKP1:k1:${SECRET}`]) {
      expect(verifyKeyCode(key, text, NOW)).toBeNull();
    }
  });

  it('stops working rather than misbehaving when the stored secret is corrupt', () => {
    const broken: PairedKey = { ...key, secret: 'not hex' };
    expect(verifyKeyCode(broken, keyCodeAt(key, NOW), NOW)).toBeNull();
    expect(verifyKeyCode(broken, keyCodeAt(broken, NOW), NOW)).toBeNull();
  });
});

describe('pairing', () => {
  it('round-trips', () => {
    const text = pairingCode({ keyId: 'k1', secret: SECRET });
    expect(text).toBe(`VKP1:k1:${SECRET}`);
    expect(parsePairingCode(text)).toEqual({ keyId: 'k1', secret: SECRET });
  });

  it('fits a version 5 QR', () => {
    expect(pairingCode({ keyId: 'k1', secret: SECRET }).length).toBeLessThanOrEqual(84);
  });

  it('refuses a secret that is short, long or not hex', () => {
    expect(parsePairingCode(`VKP1:k1:${'a'.repeat(62)}`)).toBeNull();
    expect(parsePairingCode(`VKP1:k1:${'a'.repeat(66)}`)).toBeNull();
    expect(parsePairingCode(`VKP1:k1:${'z'.repeat(64)}`)).toBeNull();
    expect(parsePairingCode(`VKP1::${SECRET}`)).toBeNull();
    expect(parsePairingCode(keyCodeAt(key, NOW))).toBeNull();
  });
});
