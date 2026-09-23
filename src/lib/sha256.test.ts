import { describe, expect, it } from 'vitest';

import { fromHex, hmacSha256, sha256, toHex, utf8 } from './sha256';

/**
 * The published vectors, because a hash that is almost right is worse than no hash:
 * FIPS 180-4 for SHA-256 and RFC 4231 for HMAC. If a change here goes green against
 * these, the key of ADR-0035 still derives the same code on both phones.
 */

function hash(text: string): string {
  return toHex(sha256(utf8(text)));
}

describe('sha256', () => {
  it('matches the FIPS 180-4 examples', () => {
    expect(hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hash('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('hashes the empty message', () => {
    expect(hash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('pads correctly around the block boundary', () => {
    // 55, 56 and 64 bytes: the three lengths where the length field moves to a new block.
    expect(hash('a'.repeat(55))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318');
    expect(hash('a'.repeat(56))).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a');
    expect(hash('a'.repeat(64))).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb');
  });

  it('hashes a million a, the long FIPS vector', () => {
    expect(hash('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });
});

describe('hmacSha256', () => {
  it('matches RFC 4231 case 1', () => {
    const key = fromHex('0b'.repeat(20));
    expect(key).not.toBeNull();
    expect(toHex(hmacSha256(key ?? new Uint8Array(), utf8('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
  });

  it('matches RFC 4231 case 2, a short key', () => {
    expect(toHex(hmacSha256(utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('matches RFC 4231 case 6, a key longer than the block', () => {
    const key = new Uint8Array(131).fill(0xaa);
    const message = utf8('Test Using Larger Than Block-Size Key - Hash Key First');
    expect(toHex(hmacSha256(key, message))).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    );
  });
});

describe('hex', () => {
  it('round-trips', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 127, 128, 255]);
    expect(toHex(bytes)).toBe('00010f107f80ff');
    expect(fromHex('00010f107f80ff')).toEqual(bytes);
  });

  it('refuses what is not clean hex', () => {
    expect(fromHex('abc')).toBeNull();
    expect(fromHex('zz')).toBeNull();
    expect(fromHex('ab cd')).toBeNull();
  });

  it('reads uppercase', () => {
    expect(fromHex('ABCD')).toEqual(new Uint8Array([0xab, 0xcd]));
  });
});

describe('utf8', () => {
  it('encodes beyond ascii, including astral planes', () => {
    expect(utf8('a')).toEqual(new Uint8Array([0x61]));
    expect(utf8('ñ')).toEqual(new Uint8Array([0xc3, 0xb1]));
    expect(utf8('€')).toEqual(new Uint8Array([0xe2, 0x82, 0xac]));
    expect(utf8('𝄞')).toEqual(new Uint8Array([0xf0, 0x9d, 0x84, 0x9e]));
  });
});
