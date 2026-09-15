import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aDoneSession, aRunningSession } from '../../domain/fixtures';
import { DAY, HOUR } from '../../domain/time';
import * as sessionsRepo from '../repositories/sessions';
import { loadDayStats } from './dayStats';

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

describe('loadDayStats', () => {
  it('reads from local midnight `days - 1` days ago to the end of today', () => {
    loadDayStats(NOW, 3);

    expect(sessionsRepo.listBetween).toHaveBeenCalledWith(new Date(2026, 7, 17).getTime(), END_OF_TODAY);
  });

  it('returns one empty stat per day, oldest first, today included', () => {
    const stats = loadDayStats(NOW, 3);

    expect(stats.map((s) => s.dayKey)).toEqual(['2026-08-17', '2026-08-18', '2026-08-19']);
    expect(stats.every((s) => s.focusMs === 0 && s.sessions === 0 && s.segments.length === 0)).toBe(true);
  });

  it('folds sessions into the day they started, with segments as fractions of the day', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aDoneSession(2 * HOUR, YESTERDAY + 6 * HOUR, { id: 's-1' }),
      aDoneSession(HOUR, YESTERDAY + 12 * HOUR, { id: 's-2', outcome: 'cancelled', actualMs: HOUR / 2 }),
      aDoneSession(HOUR, TODAY + 9 * HOUR, { id: 's-3' }),
    ]);

    const [, yesterday, today] = loadDayStats(NOW, 3);

    expect(yesterday).toEqual({
      dayKey: '2026-08-18',
      focusMs: 2.5 * HOUR,
      sessions: 2,
      segments: [
        { start: 6 / 24, end: 8 / 24 },
        { start: 12 / 24, end: 12.5 / 24 },
      ],
    });
    expect(today?.focusMs).toBe(HOUR);
    expect(today?.sessions).toBe(1);
  });

  it('leaves a running session out: the home counter adds it live', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aRunningSession({ startedAt: NOW - HOUR, plannedMs: 2 * HOUR }),
    ]);

    const stats = loadDayStats(NOW, 1);

    expect(stats[0]).toMatchObject({ dayKey: '2026-08-19', focusMs: 0, sessions: 0 });
  });

  it('clips a session that crosses midnight to the day it started', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aDoneSession(3 * HOUR, YESTERDAY + 23 * HOUR),
    ]);

    const [, yesterday, today] = loadDayStats(NOW, 3);

    expect(yesterday?.focusMs).toBe(3 * HOUR);
    expect(yesterday?.segments).toEqual([{ start: 23 / 24, end: 1 }]);
    expect(today?.focusMs).toBe(0);
  });

  it('ignores a session outside the window even if the repository returns it', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([aDoneSession(HOUR, TODAY - 10 * DAY)]);

    const stats = loadDayStats(NOW, 3);

    expect(stats.every((s) => s.sessions === 0)).toBe(true);
  });
});
