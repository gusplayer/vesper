import { describe, expect, it } from 'vitest';

import { seededRandom, seedFromString } from './random';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed, on every call', () => {
    const first = Array.from({ length: 5 }, seededRandom(42));
    const second = Array.from({ length: 5 }, seededRandom(42));

    expect(first).toEqual(second);
  });

  it('gives a different sequence for a different seed', () => {
    const a = Array.from({ length: 5 }, seededRandom(1));
    const b = Array.from({ length: 5 }, seededRandom(2));

    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1) and does not repeat itself early', () => {
    const next = seededRandom(7);
    const values = Array.from({ length: 1000 }, next);

    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });

  it('treats the seed as an unsigned 32-bit number', () => {
    expect(seededRandom(-1)()).toBe(seededRandom(0xffffffff)());
    expect(seededRandom(2 ** 32 + 5)()).toBe(seededRandom(5)());
  });
});

describe('seedFromString', () => {
  it('is stable for the same text and unsigned 32-bit', () => {
    const seed = seedFromString('session-1');

    expect(seedFromString('session-1')).toBe(seed);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it('is the FNV-1a offset basis for the empty string', () => {
    expect(seedFromString('')).toBe(2166136261);
  });

  it('separates near-identical ids, so two sessions do not share an artwork by accident', () => {
    const seeds = new Set(['a', 'b', 'a:dots', 'b:dots', 'session-1', 'session-2'].map(seedFromString));

    expect(seeds.size).toBe(6);
  });
});
