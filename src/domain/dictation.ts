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
