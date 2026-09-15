import { describe, expect, it } from 'vitest';

import { activityKeyOf } from './activities';

describe('activityKeyOf', () => {
  it('trims and lowercases', () => {
    expect(activityKeyOf('  Gym ')).toBe('gym');
  });

  it('makes a duplicate name a duplicate activity', () => {
    expect(activityKeyOf('Gym ')).toBe(activityKeyOf('gym'));
  });
});
