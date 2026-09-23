import { describe, expect, it } from 'vitest';

import { createRateLimiter } from './rateLimit.ts';

const MINUTE = 60 * 1000;

function at(start: number) {
  let clock = start;
  return { now: () => clock, jump: (by: number) => (clock += by) };
}

describe('the rate limiter', () => {
  it('counts a key up to its limit and then says no', () => {
    const clock = at(1000);
    const limiter = createRateLimiter(clock.now);

    const answers = Array.from({ length: 4 }, () => limiter.take('redeem:ana', 3, MINUTE));

    expect(answers).toEqual([true, true, true, false]);
  });

  it('keeps one key clear of the next', () => {
    const clock = at(1000);
    const limiter = createRateLimiter(clock.now);

    limiter.take('redeem:ana', 1, MINUTE);

    expect(limiter.take('redeem:ana', 1, MINUTE)).toBe(false);
    expect(limiter.take('redeem:gus', 1, MINUTE)).toBe(true);
  });

  it('opens a new window when the old one has run out', () => {
    const clock = at(1000);
    const limiter = createRateLimiter(clock.now);

    limiter.take('redeem:ana', 1, MINUTE);
    expect(limiter.take('redeem:ana', 1, MINUTE)).toBe(false);

    clock.jump(MINUTE);

    expect(limiter.take('redeem:ana', 1, MINUTE)).toBe(true);
  });

  it('gives back an allowance that was not used', () => {
    const clock = at(1000);
    const limiter = createRateLimiter(clock.now);

    limiter.take('push:gus:ana', 1, MINUTE);
    limiter.refund('push:gus:ana');

    expect(limiter.take('push:gus:ana', 1, MINUTE)).toBe(true);
  });

  it('does not grow without a bound when a caller mints keys', () => {
    const clock = at(1000);
    const limiter = createRateLimiter(clock.now);

    for (let i = 0; i < 25_000; i += 1) {
      limiter.take(`ip:${i}`, 1, MINUTE);
    }

    // Nothing has expired, so the map was cleared instead of grown: honest callers get
    // their budget back, which is the safe direction to fail.
    expect(limiter.take('ip:0', 1, MINUTE)).toBe(true);
  });
});
