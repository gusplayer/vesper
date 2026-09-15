import { describe, expect, it } from 'vitest';

import { DAY, HOUR, MINUTE, SECOND, WEEK } from './time';

describe('time units', () => {
  it('derive from one another', () => {
    expect(SECOND).toBe(1_000);
    expect(MINUTE).toBe(60 * SECOND);
    expect(HOUR).toBe(60 * MINUTE);
    expect(DAY).toBe(24 * HOUR);
    expect(WEEK).toBe(7 * DAY);
  });
});
