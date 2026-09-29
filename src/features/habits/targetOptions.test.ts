import { describe, expect, it } from 'vitest';

import { HABIT_TARGET_OPTIONS } from '../../domain/habits';
import { CHALLENGE_TARGET_OPTIONS } from '../../domain/types';
import { targetOptions } from './targetOptions';

describe('targetOptions', () => {
  it('offers 1 to 6 for a new habit', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, undefined)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('adds no chip for any target a challenge can ask for', () => {
    for (const target of CHALLENGE_TARGET_OPTIONS) {
      expect(targetOptions(HABIT_TARGET_OPTIONS, target)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('keeps a saved target the chips do not offer, in order', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(targetOptions([2, 4, 6], 3)).toEqual([2, 3, 4, 6]);
  });

  it('ignores a zero target', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, 0)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
