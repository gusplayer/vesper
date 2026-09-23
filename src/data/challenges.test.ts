import { describe, expect, it } from 'vitest';

import { aMark } from '../domain/fixtures';
import { ME, type Challenge, type HabitMark } from '../domain/types';
import { challengeReminders, myChallengeWeeks } from './challenges';

/** Monday the 17th of August 2026 through Sunday the 30th: two weeks. */
const WEEK = '2026-08-17';
const WEDNESDAY = new Date(2026, 7, 19, 12, 0).getTime();

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'challenge-1',
    name: 'Leer',
    weeklyTarget: 4,
    startWeekKey: WEEK,
    endDayKey: '2026-08-30',
    createdBy: ME,
    participantIds: [ME, 'ana'],
    habitId: 'habit-read',
    createdAt: 0,
    archivedAt: null,
    ...overrides,
  };
}

function marks(...dayKeys: string[]): HabitMark[] {
  return dayKeys.map((dayKey) => aMark({ habitId: 'habit-read', dayKey }));
}

describe('challengeReminders', () => {
  it('counts what is missing this week and the days that are left', () => {
    const [reminder] = challengeReminders([challenge()], marks(WEEK), WEDNESDAY);

    // Wednesday: five days left, one of four marks delivered.
    expect(reminder).toMatchObject({ id: 'challenge-1', name: 'Leer', needed: 3, daysLeft: 5, atRisk: false });
  });

  it('is at risk only when every remaining day has to be marked', () => {
    const risky = challengeReminders([challenge({ weeklyTarget: 5 })], marks(), WEDNESDAY);
    const lost = challengeReminders([challenge({ weeklyTarget: 6 })], marks(), WEDNESDAY);

    expect(risky[0]?.atRisk).toBe(true);
    expect(lost[0]?.atRisk).toBe(false);
    expect(lost[0]?.needed).toBe(6);
  });

  it('knows whether today is already marked', () => {
    expect(challengeReminders([challenge()], marks('2026-08-19'), WEDNESDAY)[0]?.markedToday).toBe(true);
    expect(challengeReminders([challenge()], marks('2026-08-18'), WEDNESDAY)[0]?.markedToday).toBe(false);
  });

  it('leaves out what is not the user own: archived, not joined, or without a habit', () => {
    const notMine = challenge({ participantIds: ['ana'], habitId: null });

    expect(challengeReminders([challenge({ archivedAt: 1 })], marks(), WEDNESDAY)).toEqual([]);
    expect(challengeReminders([notMine], marks(), WEDNESDAY)).toEqual([]);
    expect(challengeReminders([challenge({ habitId: null })], marks(), WEDNESDAY)).toEqual([]);
  });

  it('reports nothing to chase for a challenge that has not started or already ended', () => {
    const upcoming = challengeReminders([challenge({ startWeekKey: '2026-08-24' })], marks(), WEDNESDAY);
    const over = challengeReminders([challenge({ endDayKey: '2026-08-16' })], marks(), WEDNESDAY);

    expect(upcoming[0]).toMatchObject({ needed: 0, daysLeft: 0, atRisk: false });
    expect(over[0]?.atRisk).toBe(false);
  });

  it('carries the last day and the weeks met once the challenge ran out', () => {
    const over = challenge({ endDayKey: '2026-08-18' });

    const [reminder] = challengeReminders([over], marks(WEEK, '2026-08-18'), WEDNESDAY);

    expect(reminder?.endedOn).toEqual({ dayKey: '2026-08-18', met: 0, total: 1 });
  });

  it('leaves endedOn null while the challenge still runs', () => {
    expect(challengeReminders([challenge()], marks(), WEDNESDAY)[0]?.endedOn).toBeNull();
    expect(challengeReminders([challenge({ endDayKey: null })], marks(), WEDNESDAY)[0]?.endedOn).toBeNull();
  });
});

describe('myChallengeWeeks', () => {
  it('draws the week as seven days, Monday first, and counts what is done', () => {
    const [week] = myChallengeWeeks([challenge()], marks(WEEK, '2026-08-19'), WEDNESDAY);

    expect(week?.days).toEqual([true, false, true, false, false, false, false]);
    expect(week).toMatchObject({ id: 'challenge-1', name: 'Leer', done: 2, target: 4, markedToday: true });
    expect(week?.outlook).toEqual({ risk: 'onTrack', needed: 2, daysLeft: 5 });
  });

  it('keeps only the user own live challenges, active ones first', () => {
    const weeks = myChallengeWeeks(
      [
        challenge({ id: 'ended', endDayKey: '2026-08-18' }),
        challenge({ id: 'active' }),
        challenge({ id: 'theirs', participantIds: ['ana'] }),
        challenge({ id: 'archived', archivedAt: 1 }),
      ],
      marks(),
      WEDNESDAY,
    );

    expect(weeks.map((week) => week.id)).toEqual(['active', 'ended']);
  });
});
