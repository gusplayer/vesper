import { describe, expect, it } from 'vitest';

import {
  additionalData,
  deriveKey,
  hasSealedShape,
  IV_LENGTH,
  keyMaterial,
  openBackup,
  sealBackup,
  TAG_LENGTH,
  utf8Decode,
  utf8Encode,
  type AesEngine,
} from './backupCrypto';
import type { Credentials } from './circleApi';

/**
 * The backup's encryption (ADR-0048 §7) run on WebCrypto, which Node has and vitest
 * lacks expo-crypto's native module for. The code under test is the same the app runs;
 * only the engine differs, and the last test opens a blob with nothing but WebCrypto
 * to prove the format is the standard one (nonce | ciphertext | tag).
 */

const subtle = globalThis.crypto.subtle;

const webEngine: AesEngine = {
  sha256: async (bytes) => new Uint8Array(await subtle.digest('SHA-256', bytes)),
  seal: async (keyBytes, plaintext, aad) => {
    const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const sealed = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext));
    const out = new Uint8Array(IV_LENGTH + sealed.length);
    out.set(iv);
    out.set(sealed, IV_LENGTH);
    return out;
  },
  open: async (keyBytes, blob, aad) => {
    const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(
      await subtle.decrypt(
        { name: 'AES-GCM', iv: blob.slice(0, IV_LENGTH), additionalData: aad },
        key,
        blob.slice(IV_LENGTH),
      ),
    );
  },
};

const ME: Credentials = { id: '0199a1b2-c3d4-7e5f-8a9b-000000000001', secret: 'a-long-secret' };
const JSON_TEXT = JSON.stringify({ format: 1, tables: { habits: [{ name: 'Gimnasio 🏋️', note: 'canción' }] } });

describe('utf8Encode', () => {
  it('writes the same bytes TextEncoder does, accents, emoji and all', () => {
    for (const text of ['', 'hola', 'canción ñandú', 'Gimnasio 🏋️‍♀️', '漢字', '\u0000\u007f\u0080߿ࠀ￿']) {
      expect(Array.from(utf8Encode(text))).toEqual(Array.from(new TextEncoder().encode(text)));
    }
  });

  it('turns a lone surrogate into U+FFFD, like TextEncoder', () => {
    for (const text of ['\ud800', 'a\udc00b', '\ud83c']) {
      expect(Array.from(utf8Encode(text))).toEqual(Array.from(new TextEncoder().encode(text)));
    }
  });
});

describe('utf8Decode', () => {
  it('reads back what was written', () => {
    for (const text of ['', 'canción ñandú', 'Gimnasio 🏋️‍♀️', '漢字', JSON_TEXT, 'x'.repeat(20_000)]) {
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });

  it('is null for bytes that are not UTF-8, never a guess', () => {
    expect(utf8Decode(new Uint8Array([0xff]))).toBeNull();
    expect(utf8Decode(new Uint8Array([0xe2, 0x82]))).toBeNull(); // cut short
    expect(utf8Decode(new Uint8Array([0xc0, 0x80]))).toBeNull(); // overlong
    expect(utf8Decode(new Uint8Array([0xed, 0xa0, 0x80]))).toBeNull(); // a surrogate
    expect(utf8Decode(new Uint8Array([0xf4, 0x90, 0x80, 0x80]))).toBeNull(); // past U+10FFFF
    expect(utf8Decode(new Uint8Array([0x61, 0x80]))).toBeNull(); // a stray continuation
  });
});

describe('the key', () => {
  it('is SHA-256 of the label and the secret, never the secret alone', async () => {
    const expected = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`vesper-backup-v1:${ME.secret}`)));
    const bare = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(ME.secret)));

    const key = await deriveKey(webEngine, ME.secret);

    expect(Array.from(key)).toEqual(Array.from(expected));
    expect(Array.from(key)).not.toEqual(Array.from(bare));
    expect(key).toHaveLength(32);
    expect(new TextDecoder().decode(keyMaterial('s'))).toBe('vesper-backup-v1:s');
    expect(new TextDecoder().decode(additionalData(ME.id))).toBe(ME.id);
  });
});

describe('sealBackup and openBackup', () => {
  it('round-trip, with a fresh nonce every time', async () => {
    const one = await sealBackup(webEngine, ME, JSON_TEXT);
    const two = await sealBackup(webEngine, ME, JSON_TEXT);

    expect(one).toHaveLength(IV_LENGTH + utf8Encode(JSON_TEXT).length + TAG_LENGTH);
    expect(Array.from(one.slice(0, IV_LENGTH))).not.toEqual(Array.from(two.slice(0, IV_LENGTH)));
    await expect(openBackup(webEngine, ME, one)).resolves.toEqual({ ok: true, json: JSON_TEXT });
  });

  it('does not open with another secret, under another account, or with one byte changed', async () => {
    const blob = await sealBackup(webEngine, ME, JSON_TEXT);
    const tampered = new Uint8Array(blob);
    tampered[IV_LENGTH + 3] = (tampered[IV_LENGTH + 3] ?? 0) ^ 0x01;

    await expect(openBackup(webEngine, { ...ME, secret: 'another' }, blob)).resolves.toEqual({
      ok: false,
      reason: 'undecryptable',
    });
    await expect(openBackup(webEngine, { ...ME, id: 'someone-else' }, blob)).resolves.toMatchObject({ ok: false });
    await expect(openBackup(webEngine, ME, tampered)).resolves.toMatchObject({ ok: false });
    await expect(openBackup(webEngine, ME, new Uint8Array(IV_LENGTH + TAG_LENGTH - 1))).resolves.toMatchObject({
      ok: false,
    });
  });

  it('writes the standard layout: plain WebCrypto opens it with the derived key', async () => {
    const blob = await sealBackup(webEngine, ME, JSON_TEXT);
    const rawKey = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`vesper-backup-v1:${ME.secret}`)));
    const key = await subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);

    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: blob.slice(0, 12), additionalData: new TextEncoder().encode(ME.id), tagLength: 128 },
      key,
      blob.slice(12),
    );

    expect(new TextDecoder().decode(plain)).toBe(JSON_TEXT);
  });
});

describe('hasSealedShape', () => {
  it('needs room for a nonce and a tag', () => {
    expect(hasSealedShape(new Uint8Array(IV_LENGTH + TAG_LENGTH))).toBe(true);
    expect(hasSealedShape(new Uint8Array(IV_LENGTH + TAG_LENGTH - 1))).toBe(false);
  });
});
