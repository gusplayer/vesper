import { describe, expect, it } from 'vitest';

import {
  CYCLE_MS,
  EXIT_SENTENCE,
  breathCyclesFor,
  breathState,
  breathTotalMs,
  exitStepsFor,
  normalizeSentence,
  sentenceMatches,
} from './exitRitual';
import { SECOND } from './time';

describe('breathState', () => {
  it('starts inhaling with the full four seconds', () => {
    expect(breathState(0)).toMatchObject({ phase: 'inhale', cycle: 1, secondsLeft: 4, done: false });
  });

  it('walks inhale, hold, exhale inside a cycle', () => {
    expect(breathState(3_999).phase).toBe('inhale');
    expect(breathState(4_000).phase).toBe('hold');
    expect(breathState(8_000).phase).toBe('exhale');
    expect(breathState(13_999).phase).toBe('exhale');
    expect(breathState(14_000, 2)).toMatchObject({ phase: 'inhale', cycle: 2 });
  });

  it('counts seconds down to 1, never 0, while a phase runs', () => {
    expect(breathState(0).secondsLeft).toBe(4);
    expect(breathState(3_001).secondsLeft).toBe(1);
    expect(breathState(3_999).secondsLeft).toBe(1);
  });

  it('is done after its cycles and clamps beyond', () => {
    expect(CYCLE_MS).toBe(14 * SECOND);
    expect(breathTotalMs(2)).toBe(28 * SECOND);
    expect(breathState(14 * SECOND, 1)).toMatchObject({ done: true, progress: 1, cycle: 1 });
    expect(breathState(28 * SECOND, 2)).toMatchObject({ done: true, progress: 1, cycle: 2 });
    expect(breathState(40 * SECOND, 2).done).toBe(true);
    expect(breathState(-5).phase).toBe('inhale');
  });

  it('reports progress over the whole step', () => {
    expect(breathState(7 * SECOND, 1).progress).toBeCloseTo(0.5, 5);
    expect(breathState(14 * SECOND, 2).progress).toBeCloseTo(0.5, 5);
  });

  it('asks one round in soft and two in firm', () => {
    expect(breathCyclesFor('soft')).toBe(1);
    expect(breathCyclesFor('firm')).toBe(2);
    expect(breathCyclesFor('deep')).toBe(1);
  });
});

describe('exitStepsFor', () => {
  it('asks more the deeper the mode, and nothing at all in deep', () => {
    expect(exitStepsFor('soft')).toEqual(['breathe']);
    expect(exitStepsFor('firm')).toEqual(['breathe', 'commit']);
    expect(exitStepsFor('deep')).toEqual([]);
  });
});

describe('sentenceMatches', () => {
  it('ignores case, accents, spacing and punctuation but not words', () => {
    expect(sentenceMatches('elijo dejar esto ahora')).toBe(true);
    expect(sentenceMatches('  Elijo   dejar esto ahora. ')).toBe(true);
    expect(sentenceMatches('Elíjo dejár ésto ahorá')).toBe(true);
    expect(sentenceMatches('Elijo dejar esto')).toBe(false);
    expect(sentenceMatches('')).toBe(false);
  });

  it('normalizes the target the same way', () => {
    expect(normalizeSentence(EXIT_SENTENCE)).toBe('elijo dejar esto ahora');
  });
});
