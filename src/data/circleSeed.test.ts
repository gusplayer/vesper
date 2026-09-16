import { describe, expect, it } from 'vitest';

import { HOUR } from '../domain/time';
import { ME } from '../domain/types';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import {
  DEMO_CHALLENGE_ID,
  DEMO_MEMBER_IDS,
  demoChallenge,
  demoChallengeMarks,
  demoKudos,
  demoMembers,
  demoMemberWeeks,
} from './circleSeed';
import { demoHabits } from './seed';

// Wednesday 2026-08-19, 15:00 local. The week is 2026-08-17 .. 2026-08-23.
const NOW = new Date(2026, 7, 19, 15).getTime();
const MONDAY = new Date(2026, 7, 17, 15).getTime();
const SUNDAY = new Date(2026, 7, 23, 15).getTime();

describe('demoMembers', () => {
  it('has Ana, Luis and Sofía in the circle and Mateo waiting for an answer', () => {
    const members = demoMembers(NOW);

    expect(members.map((m) => m.id)).toEqual([...DEMO_MEMBER_IDS]);
    expect(members.map((m) => m.name)).toEqual(['Ana', 'Luis', 'Sofía', 'Mateo']);
    expect(members.map((m) => m.handle)).toEqual(['ana', 'luis', 'sofia', 'mateo']);
    expect(members.map((m) => m.status)).toEqual(['member', 'member', 'member', 'pending']);
    expect(members[3]?.joinedAt).toBeNull();
    expect(members.slice(0, 3).every((m) => m.joinedAt !== null && m.joinedAt < NOW)).toBe(true);
  });

  it('is deterministic', () => {
    expect(demoMembers(NOW)).toEqual(demoMembers(NOW));
  });
});

describe('demoMemberWeeks', () => {
  it('has this week and last week for the three members, keyed by their Mondays', () => {
    const weeks = demoMemberWeeks(NOW);

    expect(weeks).toHaveLength(6);
    for (const id of ['ana', 'luis', 'sofia']) {
      const keys = weeks.filter((w) => w.memberId === id).map((w) => w.weekKey).sort();
      expect(keys).toEqual(['2026-08-10', '2026-08-17']);
    }
    expect(weeks.some((w) => w.memberId === 'mateo')).toBe(false);
  });

  it('keeps last week between 2 h and 9 h and this week no larger', () => {
    const weeks = demoMemberWeeks(NOW);
    for (const id of ['ana', 'luis', 'sofia']) {
      const last = weeks.find((w) => w.memberId === id && w.weekKey === '2026-08-10');
      const current = weeks.find((w) => w.memberId === id && w.weekKey === '2026-08-17');
      expect(last?.focusMs).toBeGreaterThanOrEqual(2 * HOUR);
      expect(last?.focusMs).toBeLessThanOrEqual(9 * HOUR);
      expect(current?.focusMs).toBeLessThanOrEqual(last?.focusMs ?? 0);
      expect(current?.focusMs).toBeGreaterThan(0);
      expect(current?.habitsDone).toBeLessThanOrEqual(current?.habitsTarget ?? 0);
    }
  });

  it('scales this week to the days elapsed: a Monday shows less than a Sunday', () => {
    const monday = demoMemberWeeks(MONDAY).find((w) => w.memberId === 'ana' && w.weekKey === '2026-08-17');
    const sunday = demoMemberWeeks(SUNDAY).find((w) => w.memberId === 'ana' && w.weekKey === '2026-08-17');
    const lastWeek = demoMemberWeeks(SUNDAY).find((w) => w.memberId === 'ana' && w.weekKey === '2026-08-10');

    expect(monday?.focusMs).toBeLessThan(sunday?.focusMs ?? 0);
    expect(sunday?.focusMs).toBe(lastWeek?.focusMs);
  });

  it('shares Ana\'s social floor and nobody else\'s', () => {
    const weeks = demoMemberWeeks(NOW);

    expect(weeks.filter((w) => w.memberId === 'ana').every((w) => w.socialMs !== null)).toBe(true);
    expect(weeks.filter((w) => w.memberId !== 'ana').every((w) => w.socialMs === null)).toBe(true);
  });

  it('is deterministic', () => {
    expect(demoMemberWeeks(NOW)).toEqual(demoMemberWeeks(NOW));
  });
});

describe('demoKudos', () => {
  it('has Ana two days ago and Luis yesterday, both to me', () => {
    const kudos = demoKudos(NOW);

    expect(kudos.map((k) => [k.fromId, k.toId, k.dayKey])).toEqual([
      ['ana', ME, '2026-08-17'],
      ['luis', ME, '2026-08-18'],
    ]);
    expect(kudos.every((k) => k.fromId !== ME)).toBe(true);
  });

  it('never repeats an id and gives the same ids on every call', () => {
    const ids = demoKudos(NOW).map((k) => k.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(demoKudos(NOW).map((k) => k.id)).toEqual(ids);
  });
});

describe('demoChallenge', () => {
  it('starts this Monday, runs two weeks, and links the demo reading habit', () => {
    const challenge = demoChallenge(NOW, es.demo);

    expect(challenge).toMatchObject({
      id: DEMO_CHALLENGE_ID,
      weeklyTarget: 4,
      startWeekKey: '2026-08-17',
      endWeekKey: '2026-08-24',
      createdBy: 'ana',
      participantIds: [ME, 'ana', 'luis'],
      habitId: 'habit-read',
      archivedAt: null,
    });
    expect(demoHabits(es.demo).some((h) => h.id === challenge.habitId)).toBe(true);
  });

  it('names the challenge in the language it is given, with the same id', () => {
    expect(demoChallenge(NOW, es.demo).name).toBe('Leer');
    expect(demoChallenge(NOW, en.demo).name).toBe('Read');
    expect(demoChallenge(NOW, en.demo).id).toBe(demoChallenge(NOW, es.demo).id);
  });

  it('points at members that exist', () => {
    const memberIds = new Set<string>(demoMembers(NOW).map((m) => m.id));
    const challenge = demoChallenge(NOW, es.demo);

    expect(memberIds.has(challenge.createdBy)).toBe(true);
    expect(challenge.participantIds.filter((id) => id !== ME).every((id) => memberIds.has(id))).toBe(true);
  });
});

describe('demoChallengeMarks', () => {
  it('gives Ana three days and Luis one, this week, on a Wednesday', () => {
    const marks = demoChallengeMarks(NOW);

    expect(marks.filter((m) => m.memberId === 'ana').map((m) => m.dayKey)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
    ]);
    expect(marks.filter((m) => m.memberId === 'luis').map((m) => m.dayKey)).toEqual(['2026-08-17']);
    expect(marks.every((m) => m.challengeId === DEMO_CHALLENGE_ID)).toBe(true);
  });

  it('never marks a day after today', () => {
    const marks = demoChallengeMarks(MONDAY);

    expect(marks.map((m) => [m.memberId, m.dayKey])).toEqual([
      ['ana', '2026-08-17'],
      ['luis', '2026-08-17'],
    ]);
  });

  it('never repeats a (challenge, member, day) triple', () => {
    const keys = demoChallengeMarks(SUNDAY).map((m) => `${m.challengeId}|${m.memberId}|${m.dayKey}`);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
