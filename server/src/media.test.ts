import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  base64Bytes,
  dayKeyIn,
  dayStartIn,
  isRecentDay,
  keyIdOf,
  mediaExpiresAt,
  mediaIdOfKey,
  mediaObjectKey,
  openPhoto,
  parseMediaUpload,
  parsePublicKey,
  reportIdOfKey,
  shiftDayKey,
} from './media.ts';

/**
 * The rules of a photo that need no server: key shapes, where objects live, when a photo
 * expires, and opening a reported one with the key the reporter handed over.
 */

const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const MEDIA = '0199a1b2-c3d4-7e5f-8a9b-0000000000e1';
const CH1 = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';

/** What the phone does (`sealPhoto`): AES-256-GCM, nonce | ciphertext | tag. */
function seal(key: Uint8Array, mediaId: string, variant: string, plain: Uint8Array): Uint8Array {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`vesper-photo-v1|${mediaId}|${variant}`, 'utf8'));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]);
}

describe('keys', () => {
  it('takes 32 bytes of base64, padded or not, standard or url-safe, and nothing else', () => {
    const key = randomBytes(32);
    const standard = key.toString('base64');
    const urlSafe = key.toString('base64url');

    expect(parsePublicKey(standard)).toBe(standard);
    expect(parsePublicKey(` ${urlSafe}\n`)).toBe(urlSafe);
    expect(parsePublicKey(randomBytes(31).toString('base64'))).toBeNull();
    expect(parsePublicKey(`${standard.slice(0, -3)}!!=`)).toBeNull();
    expect(parsePublicKey(42)).toBeNull();
    expect(base64Bytes('')).toBeNull();
  });

  it('names a key by the first 8 bytes of its SHA-256, whatever the spelling', () => {
    const key = randomBytes(32);
    const expected = createHash('sha256').update(key).digest('hex').slice(0, 16);

    expect(keyIdOf(key.toString('base64'))).toBe(expected);
    expect(keyIdOf(key.toString('base64url'))).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('where the objects live', () => {
  it('keeps a photo under its owner, and reads the ids back from a key', () => {
    const key = mediaObjectKey({ ownerId: GUS, id: MEDIA }, 'thumb');

    expect(key).toBe(`m/${GUS}/${MEDIA}/thumb`);
    expect(mediaIdOfKey(key)).toBe(MEDIA);
    expect(mediaIdOfKey(`m/${GUS}/stray`)).toBeNull();
    expect(reportIdOfKey('r/abc/full')).toBe('abc');
    expect(reportIdOfKey('r/abc')).toBeNull();
  });
});

describe('opening a reported photo', () => {
  const key = randomBytes(32);
  const jpeg = Buffer.from('not really a jpeg, but bytes');

  it('opens with the right key, photo and variant', () => {
    expect(openPhoto(key, MEDIA, 'thumb', seal(key, MEDIA, 'thumb', jpeg))?.toString()).toBe(jpeg.toString());
  });

  it('refuses another key, another photo, another variant, or changed bytes', () => {
    const sealed = seal(key, MEDIA, 'thumb', jpeg);
    const tampered = Buffer.from(sealed);
    tampered[20] = (tampered[20] ?? 0) ^ 1;

    expect(openPhoto(randomBytes(32), MEDIA, 'thumb', sealed)).toBeNull();
    expect(openPhoto(key, CH1, 'thumb', sealed)).toBeNull();
    expect(openPhoto(key, MEDIA, 'full', sealed)).toBeNull();
    expect(openPhoto(key, MEDIA, 'thumb', tampered)).toBeNull();
    expect(openPhoto(key, MEDIA, 'thumb', new Uint8Array(10))).toBeNull();
  });
});

describe('when a photo expires', () => {
  it('ends at the local midnight after the 14th day past the last day', () => {
    // Bogotá is UTC−5 all year: the 25th starts at 05:00 UTC.
    expect(mediaExpiresAt({ endDayKey: '2026-10-10' }, Date.UTC(2026, 9, 1), 'America/Bogota')).toBe(
      Date.UTC(2026, 9, 25, 5),
    );
  });

  it('gives a photo 28 days of its own in a challenge with no end', () => {
    // Shared at 23:00 in Bogotá on the 1st, which is already the 2nd in UTC: the day is
    // the owner's, so the photo is kept through the 29th and gone at the 30th's midnight.
    const sharedAt = Date.UTC(2026, 9, 2, 4);
    expect(dayKeyIn(sharedAt, 'America/Bogota')).toBe('2026-10-01');
    expect(mediaExpiresAt({ endDayKey: null }, sharedAt, 'America/Bogota')).toBe(Date.UTC(2026, 9, 30, 5));
  });

  it('counts calendar days across a change of clocks', () => {
    // Madrid leaves summer time on 25 October 2026: the 26th starts at 23:00 UTC of the 25th.
    expect(dayStartIn('2026-10-26', 'Europe/Madrid')).toBe(Date.UTC(2026, 9, 25, 23));
    expect(dayStartIn('2026-10-24', 'Europe/Madrid')).toBe(Date.UTC(2026, 9, 23, 22));
  });

  it('falls back to UTC for a zone nobody said, or one that does not exist', () => {
    expect(mediaExpiresAt({ endDayKey: '2026-10-10' }, 0, null)).toBe(Date.UTC(2026, 9, 25));
    expect(mediaExpiresAt({ endDayKey: '2026-10-10' }, 0, 'Mars/Olympus')).toBe(Date.UTC(2026, 9, 25));
  });

  it('shifts day keys by the calendar', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('today or yesterday, loosely', () => {
  it('takes two days either side of the server’s UTC day, for the zones in between', () => {
    const at = Date.UTC(2026, 8, 23, 12);

    expect(isRecentDay('2026-09-23', at)).toBe(true);
    expect(isRecentDay('2026-09-21', at)).toBe(true);
    expect(isRecentDay('2026-09-25', at)).toBe(true);
    expect(isRecentDay('2026-09-20', at)).toBe(false);
    expect(isRecentDay('2026-09-26', at)).toBe(false);
  });
});

describe('the upload’s body', () => {
  const wrapBox = randomBytes(60).toString('base64');
  const valid = {
    id: MEDIA,
    challengeId: CH1,
    dayKey: '2026-09-23',
    width: 1280,
    height: 960,
    origin: 'camera',
    epk: randomBytes(32).toString('base64'),
    captionBox: randomBytes(40).toString('base64'),
    wraps: [{ recipientId: GUS, keyId: 'aa'.repeat(8), box: wrapBox }],
    thumbSize: 20_000,
    fullSize: 200_000,
  };

  it('takes a well-formed one', () => {
    const parsed = parseMediaUpload(valid);

    expect('error' in parsed).toBe(false);
    expect(parsed).toEqual(expect.objectContaining({ id: MEDIA, origin: 'camera', thumbSize: 20_000 }));
  });

  it('says what is wrong with each field', () => {
    const bad = (patch: Record<string, unknown>) => parseMediaUpload({ ...valid, ...patch });

    expect(bad({ id: 'photo-1' })).toHaveProperty('error');
    expect(bad({ dayKey: '2026-02-30' })).toHaveProperty('error');
    expect(bad({ width: 0 })).toHaveProperty('error');
    expect(bad({ origin: 'screenshot' })).toHaveProperty('error');
    expect(bad({ epk: 'short' })).toHaveProperty('error');
    expect(bad({ captionBox: 'x'.repeat(2000) })).toHaveProperty('error');
    expect(bad({ wraps: [] })).toHaveProperty('error');
    expect(bad({ wraps: [valid.wraps[0], valid.wraps[0]] })).toHaveProperty('error');
    expect(bad({ wraps: [{ recipientId: GUS, keyId: 'nothex', box: wrapBox }] })).toHaveProperty('error');
    expect(
      bad({ wraps: Array.from({ length: 14 }, (_, n) => ({ ...valid.wraps[0], recipientId: `${GUS.slice(0, -2)}${String(n).padStart(2, '0')}` })) }),
    ).toHaveProperty('error');
    expect(bad({ thumbSize: 100 * 1024 + 1 })).toHaveProperty('error');
    expect(bad({ fullSize: 1536 * 1024 + 1 })).toHaveProperty('error');
    expect(parseMediaUpload({ ...valid, captionBox: null })).not.toHaveProperty('error');
  });
});
