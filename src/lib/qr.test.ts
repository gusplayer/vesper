import { describe, expect, it } from 'vitest';

import { encodeQr, QR_MAX_BYTES, qrPath, qrVersionFor, reedSolomon, utf8Bytes } from './qr';

/**
 * 'hola' as version 1-M, mask chosen by penalty. This exact matrix was rendered to a
 * PNG and decoded by macOS Vision (VNDetectBarcodesRequest) on 2026-09-16, so a change
 * that alters it is a change a phone camera may not read.
 */
const HOLA = `
111111100110101111111
100000100010101000001
101110101110001011101
101110101100001011101
101110101111101011101
100000101100101000001
111111101010101111111
000000001001100000000
101111100000101111100
111010001110100101001
010001111001010011010
101110011000000111100
001001101011010010001
000000001101111001001
111111100110101100110
100000101111111001100
101110101100100100010
101110101010100100100
101110101101010011100
100000100010000110100
111111101001010010110`
  .trim()
  .split('\n')
  .map((row) => [...row].map((cell) => cell === '1'));

function text(matrix: ReadonlyArray<ReadonlyArray<boolean>>): string {
  return matrix.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('\n');
}

describe('reedSolomon', () => {
  it('matches the published HELLO WORLD example (version 1-M, 10 codewords)', () => {
    const data = [0x20, 0x5b, 0x0b, 0x78, 0xd1, 0x72, 0xdc, 0x4d, 0x43, 0x40, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];

    expect(reedSolomon(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

describe('utf8Bytes', () => {
  it('encodes ASCII, accents and an astral character', () => {
    expect(utf8Bytes('ab')).toEqual([0x61, 0x62]);
    expect(utf8Bytes('é')).toEqual([0xc3, 0xa9]);
    expect(utf8Bytes('€')).toEqual([0xe2, 0x82, 0xac]);
    expect(utf8Bytes('𝄞')).toEqual([0xf0, 0x9d, 0x84, 0x9e]);
  });
});

describe('qrVersionFor', () => {
  it('picks the smallest version that holds the bytes, up to 5', () => {
    expect(QR_MAX_BYTES).toEqual([14, 26, 42, 62, 84]);
    expect(qrVersionFor('')).toBe(1);
    expect(qrVersionFor('a'.repeat(14))).toBe(1);
    expect(qrVersionFor('a'.repeat(15))).toBe(2);
    expect(qrVersionFor('a'.repeat(42))).toBe(3);
    expect(qrVersionFor('a'.repeat(43))).toBe(4);
    expect(qrVersionFor('a'.repeat(84))).toBe(5);
    expect(qrVersionFor('a'.repeat(85))).toBeNull();
  });

  it('counts bytes, not characters', () => {
    expect(qrVersionFor('é'.repeat(7))).toBe(1);
    expect(qrVersionFor('é'.repeat(8))).toBe(2);
  });
});

describe('encodeQr', () => {
  it('produces the verified matrix for "hola"', () => {
    expect(text(encodeQr('hola'))).toBe(text(HOLA));
  });

  it('is square, 17 + 4 × version wide, and deterministic', () => {
    for (const [length, size] of [
      [1, 21],
      [20, 25],
      [30, 29],
      [50, 33],
      [80, 37],
    ] as const) {
      const matrix = encodeQr('x'.repeat(length));
      expect(matrix.length).toBe(size);
      expect(matrix.every((row) => row.length === size)).toBe(true);
      expect(text(encodeQr('x'.repeat(length)))).toBe(text(matrix));
    }
  });

  it('draws the three finder patterns and the timing lines', () => {
    const matrix = encodeQr('vesper://circle/join?code=3C5STM');
    const size = matrix.length;
    const finder = (x0: number, y0: number): boolean => {
      for (let dy = 0; dy < 7; dy += 1) {
        for (let dx = 0; dx < 7; dx += 1) {
          const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
          if (matrix[y0 + dy]?.[x0 + dx] !== (ring !== 2)) {
            return false;
          }
        }
      }
      return true;
    };

    expect(finder(0, 0)).toBe(true);
    expect(finder(size - 7, 0)).toBe(true);
    expect(finder(0, size - 7)).toBe(true);
    for (let i = 8; i < size - 8; i += 1) {
      expect(matrix[6]?.[i]).toBe(i % 2 === 0);
      expect(matrix[i]?.[6]).toBe(i % 2 === 0);
    }
  });

  it('refuses a payload longer than version 5 holds', () => {
    expect(() => encodeQr('a'.repeat(85))).toThrow(/too long/);
  });
});

describe('qrPath', () => {
  it('draws one unit square per dark module', () => {
    expect(qrPath([[true, false], [false, true]])).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
    expect(qrPath([[false]])).toBe('');
  });
});
