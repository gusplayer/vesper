import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aDoneSession, aRunningSession } from '../../domain/fixtures';
import { STREAK_WINDOW_DAYS } from '../../domain/streak';
import { DAY, HOUR, MINUTE } from '../../domain/time';
import * as sessionsRepo from '../repositories/sessions';
import { loadDayFocus } from './streak';

vi.mock('../repositories/sessions', () => ({
  listBetween: vi.fn(() => []),
}));

// Wednesday 2026-08-19, 15:00 local.
const NOW = new Date(2026, 7, 19, 15).getTime();
const TODAY = new Date(2026, 7, 19).getTime();
const YESTERDAY = new Date(2026, 7, 18).getTime();
const END_OF_TODAY = new Date(2026, 7, 20).getTime();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sessionsRepo.listBetween).mockReturnValue([]);
});

describe('loadDayFocus', () => {
  it('asks for the sessions started between local midnight `days - 1` days ago and the end of today', () => {
    loadDayFocus(NOW, 3);

    expect(sessionsRepo.listBetween).toHaveBeenCalledWith(new Date(2026, 7, 17).getTime(), END_OF_TODAY);
  });

  it('defaults to the window the streak is computed over, the same one the store loads', () => {
    expect(loadDayFocus(NOW)).toHaveLength(STREAK_WINDOW_DAYS);
  });

  it('returns one day per day, oldest first, today included, with zero for the empty ones', () => {
    const days = loadDayFocus(NOW, 3);

    expect(days).toEqual([
      { dayKey: '2026-08-17', focusMs: 0 },
      { dayKey: '2026-08-18', focusMs: 0 },
      { dayKey: '2026-08-19', focusMs: 0 },
    ]);
  });

  it('adds up every session of a day, whatever it was worth', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aDoneSession(2 * HOUR, YESTERDAY + 6 * HOUR, { id: 's-1' }),
      // A cancelled session still served half an hour, and half an hour is focus.
      aDoneSession(HOUR, YESTERDAY + 12 * HOUR, { id: 's-2', outcome: 'cancelled', actualMs: HOUR / 2 }),
      aDoneSession(10 * MINUTE, TODAY + 9 * HOUR, { id: 's-3' }),
    ]);

    const [, yesterday, today] = loadDayFocus(NOW, 3);

    expect(yesterday).toEqual({ dayKey: '2026-08-18', focusMs: 2.5 * HOUR });
    expect(today).toEqual({ dayKey: '2026-08-19', focusMs: 10 * MINUTE });
  });

  it('leaves the running session out: today is still open and the home counter adds it live', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aRunningSession({ startedAt: NOW - HOUR, plannedMs: 2 * HOUR }),
    ]);

    expect(loadDayFocus(NOW, 1)).toEqual([{ dayKey: '2026-08-19', focusMs: 0 }]);
  });

  it('credits a session that crosses midnight whole to the day it started, without splitting it', () => {
    // 23:40 to 00:20: forty minutes, all of them yesterday's. Split in two, neither
    // day would reach the streak's ten minutes twice over — and the night would count
    // for a day the user was asleep in.
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aDoneSession(40 * MINUTE, YESTERDAY + 23 * HOUR + 40 * MINUTE),
    ]);

    const [, yesterday, today] = loadDayFocus(NOW, 3);

    expect(yesterday?.focusMs).toBe(40 * MINUTE);
    expect(today?.focusMs).toBe(0);
  });

  it('ignores a session outside the window even if the repository returns it', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([aDoneSession(HOUR, TODAY - 10 * DAY)]);

    expect(loadDayFocus(NOW, 3).every((day) => day.focusMs === 0)).toBe(true);
  });
});
