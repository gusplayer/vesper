import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aDoneSession, aRunningSession } from '../../domain/fixtures';
import { DAY, HOUR } from '../../domain/time';
import * as sessionsRepo from '../repositories/sessions';
import { EMPTY_LIFETIME, loadLifetimeTotals } from './lifetime';

vi.mock('../repositories/sessions', () => ({
  listBetween: vi.fn(() => []),
}));

// Wednesday 2026-08-19, 15:00 local.
const NOW = new Date(2026, 7, 19, 15).getTime();
const END_OF_TODAY = new Date(2026, 7, 20).getTime();
const TWO_YEARS_AGO = new Date(2024, 7, 19).getTime();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sessionsRepo.listBetween).mockReturnValue([]);
});

describe('loadLifetimeTotals', () => {
  it('reads the whole table, not the cached window', () => {
    loadLifetimeTotals(NOW);
    expect(sessionsRepo.listBetween).toHaveBeenCalledWith(0, END_OF_TODAY);
  });

  it('is empty with no sessions', () => {
    expect(loadLifetimeTotals(NOW)).toEqual(EMPTY_LIFETIME);
  });

  it('counts sessions older than a year, by the day each started', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aDoneSession(HOUR, TWO_YEARS_AGO + 9 * HOUR, { id: 'old' }),
      aDoneSession(2 * HOUR, NOW - DAY, { id: 'a' }),
      aDoneSession(HOUR, NOW - DAY + 3 * HOUR, { id: 'b' }),
    ]);

    const totals = loadLifetimeTotals(NOW);

    expect(totals.totalMs).toBe(4 * HOUR);
    expect(totals.daysFocused).toBe(2);
    expect(totals.bestDayMs).toBe(3 * HOUR);
    expect(totals.firstAt).toBe(TWO_YEARS_AGO);
  });

  it('leaves the running session out: the focus store adds it live', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([aRunningSession({ id: 'r', startedAt: NOW - HOUR })]);
    expect(loadLifetimeTotals(NOW)).toEqual(EMPTY_LIFETIME);
  });
});
