import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aDoneSession, aHabit, aMark } from '../../domain/fixtures';
import { HOUR } from '../../domain/time';
import * as habitsRepo from '../repositories/habits';
import * as sessionsRepo from '../repositories/sessions';
import * as settingsRepo from '../repositories/settings';
import { loadWeekSnapshot } from './week';

vi.mock('../repositories/habits', () => ({
  listActive: vi.fn(() => []),
  listMarksBetween: vi.fn(() => []),
}));

vi.mock('../repositories/sessions', () => ({
  listBetween: vi.fn(() => []),
}));

vi.mock('../repositories/settings', () => ({
  getWeeklyTargetMs: vi.fn(() => null),
}));

// Wednesday 2026-08-19, 15:00 local. The week started on Monday the 17th.
const NOW = new Date(2026, 7, 19, 15).getTime();
const MONDAY = new Date(2026, 7, 17).getTime();
const END_OF_TODAY = new Date(2026, 7, 20).getTime();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('loadWeekSnapshot', () => {
  it('reads sessions from Monday to the end of today', () => {
    loadWeekSnapshot(NOW);

    expect(sessionsRepo.listBetween).toHaveBeenCalledWith(MONDAY, END_OF_TODAY);
  });

  it('reads marks by day key from Monday to today', () => {
    loadWeekSnapshot(NOW);

    expect(habitsRepo.listMarksBetween).toHaveBeenCalledWith('2026-08-17', '2026-08-19');
  });

  it('counts every session and measures focus against the stored target', () => {
    vi.mocked(sessionsRepo.listBetween).mockReturnValue([
      aDoneSession(2 * HOUR, MONDAY),
      aDoneSession(2 * HOUR, MONDAY + 3 * HOUR, { outcome: 'cancelled', actualMs: HOUR }),
    ]);
    vi.mocked(settingsRepo.getWeeklyTargetMs).mockReturnValue(10 * HOUR);

    const snapshot = loadWeekSnapshot(NOW);

    expect(snapshot.sessionCount).toBe(2);
    expect(snapshot.week).toEqual({
      focusMs: 3 * HOUR,
      targetMs: 10 * HOUR,
      met: false,
      daysLeft: 5,
    });
  });

  it('has no target when none is stored', () => {
    const snapshot = loadWeekSnapshot(NOW);

    expect(snapshot.week.targetMs).toBeNull();
    expect(snapshot.week.met).toBe(false);
    expect(snapshot.sessionCount).toBe(0);
  });

  it('measures every active habit against its own week of marks', () => {
    vi.mocked(habitsRepo.listActive).mockReturnValue([aHabit(), aHabit({ id: 'habit-gym' })]);
    vi.mocked(habitsRepo.listMarksBetween).mockReturnValue([
      aMark({ dayKey: '2026-08-17' }),
      aMark({ dayKey: '2026-08-19' }),
      aMark({ habitId: 'habit-gym', dayKey: '2026-08-18' }),
    ]);

    const snapshot = loadWeekSnapshot(NOW);

    expect(snapshot.habits.map((h) => [h.habit.id, h.markedDays, h.markedToday])).toEqual([
      ['habit-read', 2, true],
      ['habit-gym', 1, false],
    ]);
  });
});
