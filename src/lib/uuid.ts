import * as Crypto from 'expo-crypto';

/**
 * UUID v7 — 48-bit millisecond timestamp followed by 74 random bits.
 *
 * Hand-written on purpose: the `uuid` package would also drag in
 * react-native-get-random-values, and expo-crypto is already a dependency.
 * See docs/adr/0002-local-first-sqlite.md for why every id is v7 from day one.
 *
 * Layout (RFC 9562):
 *   0-5   unix_ts_ms, big endian
 *   6     version 0111 in the high nibble, then random
 *   8     variant 10 in the two high bits, then random
 *   9-15  random
 */
export function uuidv7(now: number = Date.now()): string {
  const view = new DataView(new ArrayBuffer(16));

  // 48-bit timestamp. Split by hand: setUint32 would overflow at 2^32 ms.
  view.setUint16(0, Math.floor(now / 0x100000000));
  view.setUint32(2, now % 0x100000000);

  const random = Crypto.getRandomBytes(10);
  for (let i = 0; i < 10; i += 1) {
    view.setUint8(6 + i, random[i] ?? 0);
  }

  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x70);
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);

  let hex = '';
  for (let i = 0; i < 16; i += 1) {
    hex += view.getUint8(i).toString(16).padStart(2, '0');
  }

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
