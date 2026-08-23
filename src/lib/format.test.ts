import { describe, expect, it } from 'vitest';

import { durationText, minutesText, timerText } from './format';

const MINUTE = 60_000;
const HOUR = 3_600_000;

describe('timerText', () => {
  it('is mm:ss under an hour', () => {
    expect(timerText(24 * MINUTE + 13_000)).toBe('24:13');
    expect(timerText(9_000)).toBe('0:09');
  });

  it('grows to h:mm:ss past an hour', () => {
    expect(timerText(HOUR + 2 * MINUTE + 3_000)).toBe('1:02:03');
  });

  it('floors instead of rounding, so it never shows a second that has not passed', () => {
    expect(timerText(1_999)).toBe('0:01');
  });

  it('clamps negatives to zero', () => {
    expect(timerText(-5_000)).toBe('0:00');
  });
});

describe('durationText', () => {
  it('drops the hour when there is none and the minutes when there are none', () => {
    expect(durationText(45 * MINUTE)).toBe('45m');
    expect(durationText(2 * HOUR)).toBe('2h');
    expect(durationText(2 * HOUR + 15 * MINUTE)).toBe('2h 15m');
  });

  it('shows 0m rather than an empty string', () => {
    expect(durationText(0)).toBe('0m');
  });
});

describe('minutesText', () => {
  it('rounds to whole minutes', () => {
    expect(minutesText(25 * MINUTE)).toBe('25');
    expect(minutesText(90 * MINUTE)).toBe('90');
  });
});
