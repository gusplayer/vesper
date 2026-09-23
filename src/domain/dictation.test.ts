import { describe, expect, it } from 'vitest';

import {
  DICTATION_ALPHABET,
  dictationPattern,
  groupDictated,
  normalizeDictated,
  toDictation,
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
