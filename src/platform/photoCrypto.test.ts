import { x25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';

import { IV_LENGTH, type AesEngine } from './backupCrypto';
import {
  boxPublicKey,
  boxSecretKey,
  fromBase64,
  keyIdOf,
  newContentKey,
  openCaption,
  openPhoto,
  photoAad,
  readBoxKey,
  sealCaption,
  sealPhoto,
  toBase64,
  unwrapContentKey,
  unwrapKey,
  WRAP_BOX_LENGTH,
  wrapForRecipients,
  wrapKey,
} from './photoCrypto';

/**
 * The photos' encryption (ADR-0051 §16) on WebCrypto, the engine the backup's tests use.
 * X25519 is checked against RFC 7748 before anything is built on it, and the last tests
 * open what this module seals with nothing but WebCrypto (X25519, HKDF, AES-GCM), to
 * prove the formats are the standard ones the header describes.
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

const hex = (text: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array((text.match(/../g) ?? []).map((pair) => parseInt(pair, 16)));
const toHexString = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

const MEDIA = '0199a1b2-c3d4-7e5f-8a9b-00000000aaaa';
const OTHER_MEDIA = '0199a1b2-c3d4-7e5f-8a9b-00000000bbbb';
const ME = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const LUIS = '0199a1b2-c3d4-7e5f-8a9b-000000000003';

async function identity(secret: string) {
  const secretKey = await boxSecretKey(webEngine, secret);
  const publicKey = boxPublicKey(secretKey);
  return { secretKey, publicKey, boxKey: toBase64(publicKey) };
}

/** A small JPEG-shaped blob: the cipher does not care what is inside. */
function fakeJpeg(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = (i * 31 + 7) & 0xff;
  }
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
}

function flip(bytes: Uint8Array, at: number): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes);
  copy[at] = (copy[at] ?? 0) ^ 0x01;
  return copy;
}

describe('X25519 from @noble/curves (RFC 7748)', () => {
  it('matches the two scalar-multiplication vectors of §5.2', () => {
    expect(
      toHexString(
        x25519.scalarMult(
          hex('a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4'),
          hex('e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c'),
        ),
      ),
    ).toBe('c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552');
    expect(
      toHexString(
        x25519.scalarMult(
          hex('4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d'),
          hex('e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493'),
        ),
      ),
    ).toBe('95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957');
  });

  it('matches the iterated vector of §5.2 after 1 and 1,000 iterations', () => {
    let k = hex('0900000000000000000000000000000000000000000000000000000000000000');
    let u = new Uint8Array(k);
    for (let i = 1; i <= 1000; i += 1) {
      const next = new Uint8Array(x25519.scalarMult(k, u));
      u = k;
      k = next;
      if (i === 1) {
        expect(toHexString(k)).toBe('422c8e7a6227d7bca1350b3e2bb7279f7897b87bb6854b783c60e80311ae3079');
      }
    }
    expect(toHexString(k)).toBe('684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51');
  });

  it("matches Alice's and Bob's keys and their shared secret in §6.1", () => {
    const alice = hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
    const bob = hex('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb');

    expect(toHexString(boxPublicKey(alice))).toBe('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
    expect(toHexString(boxPublicKey(bob))).toBe('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
    const shared = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';
    expect(toHexString(x25519.getSharedSecret(alice, boxPublicKey(bob)))).toBe(shared);
    expect(toHexString(x25519.getSharedSecret(bob, boxPublicKey(alice)))).toBe(shared);
  });
});

describe('base64', () => {
  it('writes what btoa writes, for every length up to 70', () => {
    for (let length = 0; length <= 70; length += 1) {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
      const text = toBase64(bytes);
      expect(text).toBe(btoa(String.fromCharCode(...bytes)));
      expect(Array.from(fromBase64(text) ?? [])).toEqual(Array.from(bytes));
    }
  });

  it('reads unpadded base64 too', () => {
    expect(Array.from(fromBase64('QQ') ?? [])).toEqual([0x41]);
    expect(Array.from(fromBase64('QUI') ?? [])).toEqual([0x41, 0x42]);
    expect(fromBase64('')).toEqual(new Uint8Array(0));
  });

  it('is null for anything that is not standard base64', () => {
    for (const text of ['Q', 'QUJD=', 'Q=Q=', 'QU=I', 'QUJ-', 'QUJ_', 'QU I', 'QUJDñ', '====', 'QQ=']) {
      expect(fromBase64(text)).toBeNull();
    }
  });
});

describe('box keys', () => {
  it('derives the secret key as SHA-256 of the label and the secret, never the secret alone', async () => {
    const expected = new Uint8Array(await subtle.digest('SHA-256', utf8('vesper-box-v1:a-long-secret')));
    const bare = new Uint8Array(await subtle.digest('SHA-256', utf8('a-long-secret')));
    const backup = new Uint8Array(await subtle.digest('SHA-256', utf8('vesper-backup-v1:a-long-secret')));

    const secretKey = await boxSecretKey(webEngine, 'a-long-secret');

    expect(toHexString(secretKey)).toBe(toHexString(expected));
    expect(toHexString(secretKey)).not.toBe(toHexString(bare));
    expect(toHexString(secretKey)).not.toBe(toHexString(backup));
    expect(boxPublicKey(secretKey)).toHaveLength(32);
    expect(toHexString(boxPublicKey(secretKey))).toBe(toHexString(x25519.getPublicKey(secretKey)));
  });

  it('refuses a secret key that is not 32 bytes', () => {
    expect(() => boxPublicKey(new Uint8Array(31))).toThrow();
  });

  it('names a key by the first 8 bytes of its SHA-256, the same from bytes or base64, every time', async () => {
    const me = await identity('mine');
    const ana = await identity('ana');
    const digest = new Uint8Array(await subtle.digest('SHA-256', me.publicKey));

    const id = await keyIdOf(webEngine, me.publicKey);

    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(id).toBe(toHexString(digest.slice(0, 8)));
    await expect(keyIdOf(webEngine, me.boxKey)).resolves.toBe(id);
    await expect(keyIdOf(webEngine, (await identity('mine')).publicKey)).resolves.toBe(id);
    await expect(keyIdOf(webEngine, ana.publicKey)).resolves.not.toBe(id);
    await expect(keyIdOf(webEngine, new Uint8Array(31))).rejects.toThrow();
    await expect(keyIdOf(webEngine, 'not base64!')).rejects.toThrow();
  });

  it('reads a box key from bytes or base64, only when it is 32 bytes', () => {
    const bytes = new Uint8Array(32).fill(7);
    expect(Array.from(readBoxKey(bytes) ?? [])).toEqual(Array.from(bytes));
    expect(Array.from(readBoxKey(toBase64(bytes)) ?? [])).toEqual(Array.from(bytes));
    expect(readBoxKey(new Uint8Array(33))).toBeNull();
    expect(readBoxKey(toBase64(new Uint8Array(16)))).toBeNull();
    expect(readBoxKey('%%%')).toBeNull();
  });
});

describe('newContentKey', () => {
  it('is 32 random bytes, a new one every time', () => {
    const one = newContentKey();
    const two = newContentKey();

    expect(one).toHaveLength(32);
    expect(toHexString(one)).not.toBe(toHexString(two));
    expect(one.some((byte) => byte !== 0)).toBe(true);
  });
});

describe('sealPhoto and openPhoto', () => {
  it('round-trip the full image and the thumbnail, with a fresh nonce every time', async () => {
    const key = newContentKey();
    const full = fakeJpeg(200_000);
    const thumb = fakeJpeg(12_000);

    const sealedFull = await sealPhoto(webEngine, key, MEDIA, 'full', full);
    const sealedThumb = await sealPhoto(webEngine, key, MEDIA, 'thumb', thumb);
    const again = await sealPhoto(webEngine, key, MEDIA, 'thumb', thumb);

    expect(sealedFull).toHaveLength(12 + full.length + 16);
    expect(toHexString(sealedThumb.slice(0, 12))).not.toBe(toHexString(again.slice(0, 12)));
    expect(toHexString((await openPhoto(webEngine, key, MEDIA, 'full', sealedFull)) ?? new Uint8Array())).toBe(
      toHexString(full),
    );
    expect(toHexString((await openPhoto(webEngine, key, MEDIA, 'thumb', sealedThumb)) ?? new Uint8Array())).toBe(
      toHexString(thumb),
    );
  });

  it('is null with another key, another photo, the other variant, a changed byte or too few bytes', async () => {
    const key = newContentKey();
    const sealed = await sealPhoto(webEngine, key, MEDIA, 'thumb', fakeJpeg(4_000));

    await expect(openPhoto(webEngine, newContentKey(), MEDIA, 'thumb', sealed)).resolves.toBeNull();
    await expect(openPhoto(webEngine, key, OTHER_MEDIA, 'thumb', sealed)).resolves.toBeNull();
    await expect(openPhoto(webEngine, key, MEDIA, 'full', sealed)).resolves.toBeNull();
    await expect(openPhoto(webEngine, key, MEDIA, 'thumb', flip(sealed, 100))).resolves.toBeNull();
    await expect(openPhoto(webEngine, key, MEDIA, 'thumb', flip(sealed, 3))).resolves.toBeNull();
    await expect(openPhoto(webEngine, key, MEDIA, 'thumb', sealed.slice(0, 27))).resolves.toBeNull();
    await expect(openPhoto(webEngine, key.slice(0, 16), MEDIA, 'thumb', sealed)).resolves.toBeNull();
  });

  it('refuses to seal with a key that is not 32 bytes or a media id with a separator', async () => {
    await expect(sealPhoto(webEngine, new Uint8Array(16), MEDIA, 'full', fakeJpeg(10))).rejects.toThrow();
    await expect(sealPhoto(webEngine, newContentKey(), `${MEDIA}|x`, 'full', fakeJpeg(10))).rejects.toThrow();
  });

  it('writes the standard layout the server checks a report with: WebCrypto opens the thumbnail', async () => {
    const key = newContentKey();
    const thumb = fakeJpeg(3_000);
    const sealed = await sealPhoto(webEngine, key, MEDIA, 'thumb', thumb);
    const aesKey = await subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);

    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.slice(0, 12), additionalData: utf8(`vesper-photo-v1|${MEDIA}|thumb`), tagLength: 128 },
      aesKey,
      sealed.slice(12),
    );

    expect(toHexString(new Uint8Array(plain))).toBe(toHexString(thumb));
    expect(new TextDecoder().decode(photoAad(MEDIA, 'full'))).toBe(`vesper-photo-v1|${MEDIA}|full`);
  });
});

describe('sealCaption and openCaption', () => {
  it('round-trip text, accents and emoji included, as base64', async () => {
    const key = newContentKey();
    for (const text of ['', 'Corrí 5 km antes del trabajo', 'Gimnasio 🏋️‍♀️ con Ana', '漢字']) {
      const box = await sealCaption(webEngine, key, MEDIA, text);
      expect(fromBase64(box)).not.toBeNull();
      await expect(openCaption(webEngine, key, MEDIA, box)).resolves.toBe(text);
    }
  });

  it('is null with another key, another photo, as a photo part, or for bytes that are not base64', async () => {
    const key = newContentKey();
    const box = await sealCaption(webEngine, key, MEDIA, 'hola');

    await expect(openCaption(webEngine, newContentKey(), MEDIA, box)).resolves.toBeNull();
    await expect(openCaption(webEngine, key, OTHER_MEDIA, box)).resolves.toBeNull();
    await expect(openPhoto(webEngine, key, MEDIA, 'thumb', fromBase64(box) ?? new Uint8Array())).resolves.toBeNull();
    await expect(openCaption(webEngine, key, MEDIA, `${box}!`)).resolves.toBeNull();
    await expect(openCaption(webEngine, key, MEDIA, '')).resolves.toBeNull();
  });
});

describe('wrapForRecipients and unwrapContentKey', () => {
  it('give each recipient, the owner included, the same content key', async () => {
    const me = await identity('mine');
    const ana = await identity('ana');
    const luis = await identity('luis');
    const key = newContentKey();

    const wrapped = await wrapForRecipients(webEngine, key, MEDIA, [
      { id: ME, publicKey: me.publicKey },
      { id: ANA, publicKey: ana.boxKey },
      { id: LUIS, publicKey: luis.boxKey },
    ]);

    expect(wrapped.skipped).toEqual([]);
    expect(wrapped.wraps.map((wrap) => wrap.recipientId)).toEqual([ME, ANA, LUIS]);
    expect(readBoxKey(wrapped.epk)).not.toBeNull();
    for (const [person, who] of [
      [me, ME],
      [ana, ANA],
      [luis, LUIS],
    ] as const) {
      const wrap = wrapped.wraps.find((w) => w.recipientId === who);
      expect(wrap?.keyId).toBe(await keyIdOf(webEngine, person.publicKey));
      expect(fromBase64(wrap?.box ?? '')).toHaveLength(WRAP_BOX_LENGTH);
      const opened = await unwrapContentKey(webEngine, person.secretKey, wrapped.epk, MEDIA, who, wrap?.box ?? '');
      expect(toHexString(opened ?? new Uint8Array())).toBe(toHexString(key));
    }
  });

  it('uses a new ephemeral key for every photo', async () => {
    const ana = await identity('ana');
    const one = await wrapForRecipients(webEngine, newContentKey(), MEDIA, [{ id: ANA, publicKey: ana.publicKey }]);
    const two = await wrapForRecipients(webEngine, newContentKey(), MEDIA, [{ id: ANA, publicKey: ana.publicKey }]);

    expect(one.epk).not.toBe(two.epk);
  });

  it('is null for the wrong recipient, another identity, another photo or a changed byte', async () => {
    const ana = await identity('ana');
    const luis = await identity('luis');
    const stranger = await identity('stranger');
    const key = newContentKey();
    const { epk, wraps } = await wrapForRecipients(webEngine, key, MEDIA, [
      { id: ANA, publicKey: ana.publicKey },
      { id: LUIS, publicKey: luis.publicKey },
    ]);
    const anaBox = wraps[0]?.box ?? '';
    const luisBox = wraps[1]?.box ?? '';

    // Ana opening Luis's wrap, as herself or as him.
    await expect(unwrapContentKey(webEngine, ana.secretKey, epk, MEDIA, ANA, luisBox)).resolves.toBeNull();
    await expect(unwrapContentKey(webEngine, ana.secretKey, epk, MEDIA, LUIS, luisBox)).resolves.toBeNull();
    // Her own wrap, claimed for someone else, or opened by someone who got none.
    await expect(unwrapContentKey(webEngine, ana.secretKey, epk, MEDIA, LUIS, anaBox)).resolves.toBeNull();
    await expect(unwrapContentKey(webEngine, stranger.secretKey, epk, MEDIA, ANA, anaBox)).resolves.toBeNull();
    // Moved to another photo, a changed box, another ephemeral key.
    await expect(unwrapContentKey(webEngine, ana.secretKey, epk, OTHER_MEDIA, ANA, anaBox)).resolves.toBeNull();
    const tampered = toBase64(flip(fromBase64(anaBox) ?? new Uint8Array(), 20));
    await expect(unwrapContentKey(webEngine, ana.secretKey, epk, MEDIA, ANA, tampered)).resolves.toBeNull();
    await expect(unwrapContentKey(webEngine, ana.secretKey, luis.boxKey, MEDIA, ANA, anaBox)).resolves.toBeNull();
  });

  it('does not open with the key of a rotated secret, and does with the old one', async () => {
    const before = await identity('ana-before-restore');
    const after = await identity('ana-after-restore');
    const key = newContentKey();
    const { epk, wraps } = await wrapForRecipients(webEngine, key, MEDIA, [{ id: ANA, publicKey: before.publicKey }]);
    const box = wraps[0]?.box ?? '';

    await expect(unwrapContentKey(webEngine, after.secretKey, epk, MEDIA, ANA, box)).resolves.toBeNull();
    const opened = await unwrapContentKey(webEngine, before.secretKey, epk, MEDIA, ANA, box);
    expect(toHexString(opened ?? new Uint8Array())).toBe(toHexString(key));
  });

  it('is null, never a rejection, for malformed input', async () => {
    const ana = await identity('ana');
    const { epk, wraps } = await wrapForRecipients(webEngine, newContentKey(), MEDIA, [
      { id: ANA, publicKey: ana.publicKey },
    ]);
    const box = wraps[0]?.box ?? '';
    const lowOrder = toBase64(new Uint8Array(32)); // u = 0: every shared secret is zero

    for (const [secretKey, e, mediaId, recipientId, b] of [
      [ana.secretKey, 'not-base64', MEDIA, ANA, box],
      [ana.secretKey, epk, MEDIA, ANA, 'not-base64'],
      [ana.secretKey, epk, MEDIA, ANA, toBase64((fromBase64(box) ?? new Uint8Array()).slice(0, 59))],
      [ana.secretKey, toBase64(new Uint8Array(31)), MEDIA, ANA, box],
      [ana.secretKey, lowOrder, MEDIA, ANA, box],
      [ana.secretKey.slice(0, 31), epk, MEDIA, ANA, box],
      [ana.secretKey, epk, MEDIA, `${ANA}|x`, box],
      [ana.secretKey, epk, '', ANA, box],
    ] as const) {
      await expect(unwrapContentKey(webEngine, secretKey, e, mediaId, recipientId, b)).resolves.toBeNull();
    }
  });

  it('leaves out, and names, a recipient whose box key cannot be used; wraps a repeated one once', async () => {
    const ana = await identity('ana');
    const { wraps, skipped } = await wrapForRecipients(webEngine, newContentKey(), MEDIA, [
      { id: ANA, publicKey: ana.publicKey },
      { id: ANA, publicKey: ana.boxKey },
      { id: 'short', publicKey: new Uint8Array(31) },
      { id: 'garbage', publicKey: '***' },
      { id: 'low-order', publicKey: new Uint8Array(32) },
    ]);

    expect(wraps.map((wrap) => wrap.recipientId)).toEqual([ANA]);
    expect(skipped).toEqual(['short', 'garbage', 'low-order']);
  });

  it('refuses a content key that is not 32 bytes and ids with a separator', async () => {
    const ana = await identity('ana');
    const recipients = [{ id: ANA, publicKey: ana.publicKey }];

    await expect(wrapForRecipients(webEngine, new Uint8Array(16), MEDIA, recipients)).rejects.toThrow();
    await expect(wrapForRecipients(webEngine, newContentKey(), `${MEDIA}|x`, recipients)).rejects.toThrow();
    await expect(
      wrapForRecipients(webEngine, newContentKey(), MEDIA, [{ id: `${ANA}|x`, publicKey: ana.publicKey }]),
    ).rejects.toThrow();
  });

  it('are the functions the guide calls wrapKey and unwrapKey', () => {
    expect(wrapKey).toBe(wrapForRecipients);
    expect(unwrapKey).toBe(unwrapContentKey);
  });

  it('writes the standard ECIES the header describes: WebCrypto alone opens a wrap', async () => {
    const ana = await identity('ana');
    const key = newContentKey();
    const { epk, wraps } = await wrapForRecipients(webEngine, key, MEDIA, [{ id: ANA, publicKey: ana.publicKey }]);
    const epkBytes = fromBase64(epk) ?? new Uint8Array();
    const box = fromBase64(wraps[0]?.box ?? '') ?? new Uint8Array();

    // X25519(sk_ana, epk) in WebCrypto: the secret key goes in as PKCS#8.
    const pkcs8 = new Uint8Array([...hex('302e020100300506032b656e04220420'), ...ana.secretKey]);
    const privateKey = await subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, false, ['deriveBits']);
    const publicKey = await subtle.importKey('raw', epkBytes, { name: 'X25519' }, false, []);
    const shared = await subtle.deriveBits({ name: 'X25519', public: publicKey }, privateKey, 256);
    // HKDF-SHA256(shared, salt = epk ‖ pk_ana, info = "vesper-photo-wrap-v1|media|ana").
    const ikm = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
    const kek = await subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array([...epkBytes, ...ana.publicKey]),
        info: utf8(`vesper-photo-wrap-v1|${MEDIA}|${ANA}`),
      },
      ikm,
      256,
    );
    const aesKey = await subtle.importKey('raw', kek, 'AES-GCM', false, ['decrypt']);
    const opened = await subtle.decrypt(
      { name: 'AES-GCM', iv: box.slice(0, 12), additionalData: utf8(`${MEDIA}|${ANA}`), tagLength: 128 },
      aesKey,
      box.slice(12),
    );

    expect(toHexString(new Uint8Array(opened))).toBe(toHexString(key));
  });

  it('wraps for a full challenge of 12 in well under a second', async () => {
    const people = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => ({ id: `member-${i}`, publicKey: (await identity(`s${i}`)).boxKey })),
    );
    const started = performance.now();

    const { wraps } = await wrapForRecipients(webEngine, newContentKey(), MEDIA, people);

    expect(wraps).toHaveLength(12);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
