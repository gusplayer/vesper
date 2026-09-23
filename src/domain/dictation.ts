/**
 * The alphabet for a code a person says out loud (ADR-0037).
 *
 * Thirty-two symbols with no 0, O, 1 or I, because the two codes this app asks anyone to
 * read or type — the circle's invite code and the key's dictated code — both end up in a
 * phone call or in a screenshot. It lived inside `circle.ts` until the key needed it too;
 * one definition is the point.
 *
 * Pure: no imports.
 */

export const DICTATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A pattern for `length` symbols of the alphabet, anchored. */
export function dictationPattern(length: number): RegExp {
  return new RegExp(`^[${DICTATION_ALPHABET}]{${length}}$`);
}

/**
 * What someone typed, as the code they meant: trimmed, uppercased, and with the spaces
 * and hyphens taken out, because a code shown as `K7QM-3PFX` gets typed back every way.
 * Returns null when what is left is not `length` symbols of the alphabet — which also
 * catches the four characters the alphabet leaves out on purpose.
 */
export function normalizeDictated(text: string, length: number): string | null {
  const code = text.replace(/[\s-]/g, '').trim().toUpperCase();
  return dictationPattern(length).test(code) ? code : null;
}

/**
 * The code as it is shown to be read aloud: `K7QM-3PFX`. Two groups are easier to say in
 * one breath than eight loose characters, and the hyphen never has to be typed back.
 */
export function groupDictated(code: string): string {
  const half = Math.ceil(code.length / 2);
  return code.length <= 4 ? code : `${code.slice(0, half)}-${code.slice(half)}`;
}

/**
 * `bytes` rendered as `length` digits (ADR-0038). Digits, not symbols, for anything read
 * out over a phone: the alphabet drops 0, O, 1 and I but keeps B and V, M and N, which
 * sound the same down a line in Spanish. "Tres, cuatro, ocho" does not.
 *
 * Taken from the whole value modulo 10^length rather than digit by digit, so every digit
 * depends on every byte and the space is the full 10^length.
 */
export function toDigits(bytes: Uint8Array, length: number): string {
  let value = 0;
  for (const byte of bytes) {
    // Kept under 2^53 so the arithmetic stays exact: shift, add, and fold by the modulus.
    value = (value * 256 + byte) % 10 ** length;
  }
  return value.toString().padStart(length, '0');
}

/** Digits in two groups, for reading aloud: `348-291`. */
export function groupDigits(code: string): string {
  const half = Math.ceil(code.length / 2);
  return code.length <= 4 ? code : `${code.slice(0, half)}-${code.slice(half)}`;
}

/**
 * What someone typed, as the digits they meant. Spaces and hyphens come out, and
 * anything that is not `length` digits is refused rather than guessed.
 */
export function normalizeDigits(text: string, length: number): string | null {
  const code = text.replace(/[\s-]/g, '').trim();
  return new RegExp(`^[0-9]{${length}}$`).test(code) ? code : null;
}

/**
 * `bytes` rendered as `length` symbols of the alphabet, five bits at a time, most
 * significant first. Needs `ceil(length * 5 / 8)` bytes; anything shorter is padded with
 * zeros rather than wrapping, so a short input never repeats itself.
 */
export function toDictation(bytes: Uint8Array, length: number): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  let at = 0;
  while (out.length < length) {
    if (bits < 5) {
      acc = (acc << 8) | (bytes[at] ?? 0);
      bits += 8;
      at += 1;
    }
    bits -= 5;
    const index = (acc >> bits) & 0x1f;
    out += DICTATION_ALPHABET[index] ?? DICTATION_ALPHABET[0];
  }
  return out;
}
