import { describe, expect, it, vi } from 'vitest';

import { uuidv7 } from './uuid';

// expo-crypto is native. Zero random bytes make the fixed bits easy to read; a test
// that needs the random part to differ sets `fill` and puts it back.
const crypto = vi.hoisted(() => ({ fill: 0 }));
vi.mock('expo-crypto', () => ({
  getRandomBytes: (byteCount: number) => new Uint8Array(byteCount).fill(crypto.fill),
}));

const T0 = 1_700_000_000_000;

describe('uuidv7', () => {
  it('is 36 characters with dashes at 8, 13, 18 and 23', () => {
    const id = uuidv7(T0);

    expect(id).toHaveLength(36);
    expect([id[8], id[13], id[18], id[23]]).toEqual(['-', '-', '-', '-']);
    expect(id).toMatch(/^[0-9a-f-]+$/);
  });

  it('carries version 7 in the high nibble of byte 6', () => {
    expect(uuidv7(T0)[14]).toBe('7');
  });

  it('carries the RFC variant in the high bits of byte 8', () => {
    expect(uuidv7(T0)[19]).toMatch(/^[89ab]$/);
  });

  it('encodes the timestamp big-endian in the first 12 hex digits', () => {
    const id = uuidv7(T0);
    const timestampHex = id.slice(0, 8) + id.slice(9, 13);

    expect(timestampHex).toBe('018bcfe56800');
    expect(timestampHex).toBe(T0.toString(16).padStart(12, '0'));
  });

  it('encodes an instant past 2^32 ms without overflowing', () => {
    const now = 0x100000000; // 4_294_967_296
    const id = uuidv7(now);
    const timestampHex = id.slice(0, 8) + id.slice(9, 13);

    expect(timestampHex).toBe('000100000000');
    expect(id.slice(0, 4)).toBe('0001');
  });

  it('sorts by time', () => {
    const ids = [uuidv7(T0 + 2_000), uuidv7(T0), uuidv7(T0 + 1)];

    expect([...ids].sort()).toEqual([uuidv7(T0), uuidv7(T0 + 1), uuidv7(T0 + 2_000)]);
    expect(uuidv7(T0) < uuidv7(T0 + 1)).toBe(true);
  });

  it('keeps the timestamp prefix and the fixed bits whatever the random bytes are', () => {
    const zeros = uuidv7(T0);
    crypto.fill = 0xff;
    try {
      const ones = uuidv7(T0);

      expect(ones.slice(0, 8) + ones.slice(9, 13)).toBe('018bcfe56800');
      expect(ones[14]).toBe('7');
      expect(ones[19]).toBe('b');
      expect(ones.slice(20)).toBe('fff-ffffffffffff');
      // Same millisecond, different random bits: distinct ids that still sort together.
      expect(ones).not.toBe(zeros);
      expect(ones.slice(0, 13)).toBe(zeros.slice(0, 13));
    } finally {
      crypto.fill = 0;
    }
  });

  it('never grows past 12 hex digits of timestamp: 2^48 - 1 ms is the last instant', () => {
    const last = 2 ** 48 - 1;
    const id = uuidv7(last);

    expect(id.slice(0, 8) + id.slice(9, 13)).toBe('ffffffffffff');
    expect(id[14]).toBe('7');
  });
});
