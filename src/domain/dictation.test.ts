import { describe, expect, it } from 'vitest';

import {
  DICTATION_ALPHABET,
  dictationPattern,
  groupDictated,
  groupDigits,
  normalizeDictated,
  normalizeDigits,
  toDictation,
  toDigits,
} from './dictation';

describe('the alphabet', () => {
  it('leaves out exactly the four characters that get misheard or misread', () => {
    expect(DICTATION_ALPHABET).toHaveLength(32);
    for (const banned of ['0', 'O', '1', 'I']) {
      expect(DICTATION_ALPHABET.includes(banned)).toBe(false);
    }
    expect(new Set(DICTATION_ALPHABET).size).toBe(32);
  });

  it('is a power of two, so five bits map to one symbol with nothing left over', () => {
    expect(Math.log2(DICTATION_ALPHABET.length)).toBe(5);
  });
});

describe('normalizeDictated', () => {
  it('takes a code however it comes back from a person', () => {
    for (const typed of ['K7QM3PFX', 'k7qm3pfx', 'K7QM-3PFX', ' k7qm 3pfx ', 'K7QM 3PFX']) {
      expect(normalizeDictated(typed, 8)).toBe('K7QM3PFX');
    }
  });

  it('refuses the characters the alphabet leaves out, instead of guessing', () => {
    // A person who hears "oh" may type O or 0; neither is a code, and saying so is
    // better than deciding for them which one they meant.
    expect(normalizeDictated('K7QM3PFO', 8)).toBeNull();
    expect(normalizeDictated('K7QM3PF0', 8)).toBeNull();
    expect(normalizeDictated('K7QM3PFI', 8)).toBeNull();
    expect(normalizeDictated('K7QM3PF1', 8)).toBeNull();
  });

  it('refuses the wrong length and rubbish, without throwing', () => {
    for (const bad of ['', 'K7QM3PF', 'K7QM3PFXX', '!!!!!!!!', 'ñññññññññ']) {
      expect(normalizeDictated(bad, 8)).toBeNull();
    }
  });
});

describe('groupDictated', () => {
  it('splits a code in two halves so it reads in two breaths', () => {
    expect(groupDictated('K7QM3PFX')).toBe('K7QM-3PFX');
    expect(groupDictated('ABC234')).toBe('ABC-234');
  });

  it('leaves a short code alone', () => {
    expect(groupDictated('AB')).toBe('AB');
    expect(groupDictated('ABCD')).toBe('ABCD');
  });

  it('round-trips through normalize, so the hyphen never has to be typed', () => {
    const code = 'K7QM3PFX';
    expect(normalizeDictated(groupDictated(code), 8)).toBe(code);
  });
});

describe('toDictation', () => {
  it('renders five bits per symbol, most significant first', () => {
    // 0x00 0x00 ... is all zeros, so every symbol is the alphabet's first.
    expect(toDictation(new Uint8Array([0, 0, 0, 0, 0]), 8)).toBe('AAAAAAAA');
    // 0xff repeated is all ones: every symbol is the last.
    expect(toDictation(new Uint8Array([255, 255, 255, 255, 255]), 8)).toBe('99999999');
  });

  it('only ever emits alphabet symbols', () => {
    const pattern = dictationPattern(8);
    for (let seed = 0; seed < 64; seed += 1) {
      const bytes = new Uint8Array([seed, seed * 7, seed * 31, seed * 131, seed * 251]);
      expect(pattern.test(toDictation(bytes, 8))).toBe(true);
    }
  });

  it('spreads: different bytes give different codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      codes.add(toDictation(new Uint8Array([i, i >> 1, i * 3, i * 5, i * 7]), 8));
    }
    expect(codes.size).toBe(200);
  });

  it('pads a short input with zeros rather than wrapping round', () => {
    // One 0xff byte: the first symbol takes five ones (31, '9'), the second takes the
    // three left over plus two padded zeros (11100 = 28, '6'), and the rest are zeros.
    // Wrapping would repeat the input instead and shrink the real space.
    expect(toDictation(new Uint8Array([255]), 8)).toBe('96AAAAAA');
  });
});

describe('toDigits', () => {
  it('gives exactly the asked-for digits, zero-padded', () => {
    expect(toDigits(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]), 6)).toBe('000000');
    expect(toDigits(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 7]), 6)).toBe('000007');
    expect(toDigits(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]), 6)).toMatch(/^\d{6}$/);
  });

  it('lets every byte reach every digit', () => {
    // Changing only the first byte must move the answer, or the leading bytes would be
    // decoration and the real space smaller than 10^6.
    const a = toDigits(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 6);
    const b = toDigits(new Uint8Array([2, 2, 3, 4, 5, 6, 7, 8]), 6);
    expect(a).not.toBe(b);
  });

  it('spreads over the space without obvious collisions', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(toDigits(new Uint8Array([i, i >> 3, i * 7, i * 13, i * 29, i * 53, i * 97, i * 131]), 6));
    }
    // A handful of collisions in 500 draws over a million values would be bad luck;
    // a systematic bias would show up as far fewer.
    expect(seen.size).toBeGreaterThan(495);
  });

  it('stays exact: the arithmetic never leaves the safe integer range', () => {
    const big = new Uint8Array(32).fill(255);
    expect(toDigits(big, 6)).toMatch(/^\d{6}$/);
    expect(Number.isSafeInteger(Number(toDigits(big, 6)))).toBe(true);
  });
});

describe('normalizeDigits', () => {
  it('takes the code however it comes back', () => {
    for (const typed of ['348291', '348-291', ' 348 291 ']) {
      expect(normalizeDigits(typed, 6)).toBe('348291');
    }
  });

  it('refuses letters, the wrong length and rubbish', () => {
    for (const bad of ['', '34829', '3482911', '34829O', 'abcdef', '34.291']) {
      expect(normalizeDigits(bad, 6)).toBeNull();
    }
  });
});

describe('groupDigits', () => {
  it('splits six digits into two threes', () => {
    expect(groupDigits('348291')).toBe('348-291');
    expect(normalizeDigits(groupDigits('348291'), 6)).toBe('348291');
  });
});
