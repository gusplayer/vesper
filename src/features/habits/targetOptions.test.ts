import { describe, expect, it } from 'vitest';

import { HABIT_TARGET_OPTIONS } from '../../domain/habits';
import { targetOptions } from './targetOptions';

describe('targetOptions', () => {
  it('offers the usual chips for a new habit', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, undefined)).toEqual([2, 4, 6]);
  });

  it('keeps a saved target the chips do not offer, in order', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, 5)).toEqual([2, 4, 5, 6]);
    expect(targetOptions(HABIT_TARGET_OPTIONS, 3)).toEqual([2, 3, 4, 6]);
  });

  it('does not repeat a saved target that is already offered', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, 4)).toEqual([2, 4, 6]);
  });

  it('ignores a zero target', () => {
    expect(targetOptions(HABIT_TARGET_OPTIONS, 0)).toEqual([2, 4, 6]);
  });
});
