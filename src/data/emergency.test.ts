import { describe, expect, it } from 'vitest';

import { emergencyMonthOf, nextEmergencyRefill, settledEmergency } from './emergency';

const SEPT_24 = new Date(2026, 8, 24, 15).getTime();
const OCT_1_EARLY = new Date(2026, 9, 1, 0, 5).getTime();

describe('emergencyMonthOf', () => {
  it('names the local month', () => {
    expect(emergencyMonthOf(SEPT_24)).toBe('2026-09');
    expect(emergencyMonthOf(OCT_1_EARLY)).toBe('2026-10');
  });
});

describe('settledEmergency', () => {
  it('changes nothing inside the same month', () => {
    expect(
      settledEmergency({ emergencyLeft: 2, emergencyTotal: 5, emergencyMonthKey: '2026-09' }, SEPT_24),
    ).toBeNull();
  });

  it('fills the count again when a new month begins, and stamps it', () => {
    expect(
      settledEmergency({ emergencyLeft: 0, emergencyTotal: 5, emergencyMonthKey: '2026-09' }, OCT_1_EARLY),
    ).toEqual({ emergencyLeft: 5, emergencyMonthKey: '2026-10' });
  });

  it('fills a count that never had a month, as after an upgrade', () => {
    expect(
      settledEmergency({ emergencyLeft: 0, emergencyTotal: 5, emergencyMonthKey: null }, SEPT_24),
    ).toEqual({ emergencyLeft: 5, emergencyMonthKey: '2026-09' });
  });

  it('follows the total, not a fixed five', () => {
    expect(
      settledEmergency({ emergencyLeft: 1, emergencyTotal: 3, emergencyMonthKey: '2026-08' }, SEPT_24),
    ).toEqual({ emergencyLeft: 3, emergencyMonthKey: '2026-09' });
  });
});

describe('nextEmergencyRefill', () => {
  it('is local midnight of the first of next month', () => {
    expect(nextEmergencyRefill(SEPT_24)).toBe(new Date(2026, 9, 1).getTime());
  });

  it('rolls over the year in December', () => {
    expect(nextEmergencyRefill(new Date(2026, 11, 31, 23, 59).getTime())).toBe(new Date(2027, 0, 1).getTime());
  });

  it('on the first itself points at the following month', () => {
    expect(nextEmergencyRefill(OCT_1_EARLY)).toBe(new Date(2026, 10, 1).getTime());
  });
});
