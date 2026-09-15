import { describe, expect, it } from 'vitest';

import { DEPTHS } from '../domain/types';
import { DEPTH_DESCRIPTION, DEPTH_LABEL, GIVE_UP_LABEL } from './labels';

describe('depth labels', () => {
  it('cover every depth with non-empty Spanish text', () => {
    for (const depth of DEPTHS) {
      expect(DEPTH_LABEL[depth].length).toBeGreaterThan(0);
      expect(DEPTH_DESCRIPTION[depth].length).toBeGreaterThan(0);
      expect(GIVE_UP_LABEL[depth].length).toBeGreaterThan(0);
    }
  });

  it('only in deep does the hold control say the timer is the only way out', () => {
    expect(GIVE_UP_LABEL.soft).toBe(GIVE_UP_LABEL.firm);
    expect(GIVE_UP_LABEL.deep).not.toBe(GIVE_UP_LABEL.soft);
    expect(GIVE_UP_LABEL.deep).toContain('timer');
  });
});
