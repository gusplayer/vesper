import { describe, expect, it, vi } from 'vitest';

import { uuidv7 } from './uuid';

// expo-crypto is native. Zero random bytes make the fixed bits easy to read.
vi.mock('expo-crypto', () => ({
  getRandomBytes: (byteCount: number) => new Uint8Array(byteCount),
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
});
