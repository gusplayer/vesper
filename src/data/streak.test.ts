import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDayStats } from '../db/queries/dayStats';
import * as sessionsRepo from '../db/repositories/sessions';
import { dayKeyOf, dayStartShifted } from '../domain/day';
import { aDoneSession } from '../domain/fixtures';
import { computeStreak, STREAK_DAY_MIN_MS, STREAK_WINDOW_DAYS } from '../domain/streak';
import { HOUR } from '../domain/time';
import type { GraceDay, Session } from '../domain/types';
import { readStreak } from './streak';

vi.mock('../db/repositories/sessions', () => ({
  listBetween: vi.fn(() => []),
}));

const graceDays: GraceDay[] = [];

// The store is a native module away (op-sqlite); the streak only reads its grace rows.
vi.mock('./stores/app', () => ({
  useAppStore: { getState: () => ({ graceDays }) },
}));

// Wednesday 2026-08-19, 15:00 local.
const NOW = new Date(2026, 7, 19, 15).getTime();

beforeEach(() => {
  vi.mocked(sessionsRepo.listBetween).mockReturnValue([]);
});

/** One session of exactly the streak's minimum on each of the last `days` days. */
function aRunOfDays(days: number): Session[] {
  const sessions: Session[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    sessions.push(
      aDoneSession(STREAK_DAY_MIN_MS, dayStartShifted(NOW, -offset) + 10 * HOUR, {
        id: `s-${offset}`,
      }),
    );
  }
  return sessions;
}

describe('readStreak', () => {
  it('counts the run of days that reach the minimum, today included', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue(aRunOfDays(4));

    expect(readStreak(NOW)).toMatchObject({ days: 4, todayCounts: true });
  });

  it('reads the same streak as the screens, which fold the same window into day stats', () => {
    // Focus takes the streak from the store's day stats (HISTORY_DAYS) and the
    // reminder planner takes it from loadDayFocus. Both fold `sessions` over
    // STREAK_WINDOW_DAYS, and `computeStreak` stops at the edge of its window, so a
    // run longer than a year is where two different spans would disagree.
    const run = aRunOfDays(STREAK_WINDOW_DAYS);
    vi.mocked(sessionsRepo.listBetween).mockReturnValue(run);

    const fromDayStats = computeStreak(loadDayStats(NOW, STREAK_WINDOW_DAYS), graceDays, dayKeyOf(NOW));

    expect(readStreak(NOW)).toEqual(fromDayStats);
    expect(readStreak(NOW).days).toBe(STREAK_WINDOW_DAYS);
  });
});
