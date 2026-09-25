import { describe, expect, it } from 'vitest';

import { ME, type Challenge, type Habit } from '../../domain/types';
import { challengeLink } from './challengeLink';

const HABIT: Habit = {
  id: 'habit-read',
  name: 'Leer',
  activityId: null,
  weeklyTarget: 4,
  countMode: 'declared',
  healthType: null,
  createdAt: 1,
  archivedAt: null,
};

const CHALLENGE: Challenge = {
  id: 'c1',
  name: 'Leer',
  weeklyTarget: 4,
  startWeekKey: '2026-09-21',
  endDayKey: null,
  createdBy: 'ana',
  participantIds: [ME, 'ana'],
  habitId: HABIT.id,
  createdAt: 1,
  archivedAt: null,
};

describe('challengeLink', () => {
  it('is linked with an active habit behind it', () => {
    expect(challengeLink(CHALLENGE, [HABIT])).toBe('linked');
  });

  it('is invited when someone added the user and no habit of theirs is behind it yet', () => {
    expect(challengeLink({ ...CHALLENGE, habitId: null }, [HABIT])).toBe('invited');
  });

  it('is invited again when the habit behind it was archived: it no longer holds a slot', () => {
    expect(challengeLink(CHALLENGE, [{ ...HABIT, archivedAt: 5 }])).toBe('invited');
  });

  it('is out when the user is not a participant', () => {
    expect(challengeLink({ ...CHALLENGE, participantIds: ['ana'] }, [HABIT])).toBe('out');
  });
});
