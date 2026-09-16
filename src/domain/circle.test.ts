import { describe, expect, it } from 'vitest';

import {
  challengeStandings,
  challengeStatus,
  challengeWeeks,
  challengeWeeksLeft,
  circleWeek,
  dayKeyStart,
  DEFAULT_SHARE_PREFS,
  endWeekKeyFor,
  codeFromInviteLink,
  inviteCodeFor,
  inviteLinkFor,
  kudosGivenToday,
  kudosReceivedInWeek,
  kudosSenderNames,
  normalizeInviteCode,
  shiftDayKey,
  weekDayKeys,
  weekKeyOf,
} from './circle';
import { dayKeyOf } from './day';
import { aMark } from './fixtures';
import { HOUR } from './time';
import { ME, type Challenge, type Kudos, type Member, type MemberWeek, type Profile } from './types';

// Monday 2026-08-17 .. Sunday 2026-08-23. Wednesday is the 19th.
const WEEK = '2026-08-17';
const LAST_WEEK = '2026-08-10';
const TODAY = '2026-08-19';

const profile: Profile = { id: 'profile-1', name: 'Gus', handle: 'gus', codeGeneration: 0, createdAt: 0 };

function member(id: string, name: string, status: Member['status'] = 'member'): Member {
  return { id, name, handle: id, status, joinedAt: status === 'member' ? 1 : null, createdAt: 1 };
}

function week(memberId: string, focusMs: number, overrides: Partial<MemberWeek> = {}): MemberWeek {
  return {
    memberId,
    weekKey: WEEK,
    focusMs,
    socialMs: null,
    habitsDone: 2,
    habitsTarget: 4,
    updatedAt: 0,
    ...overrides,
  };
}

function kudos(fromId: string, toId: string, dayKey: string): Kudos {
  return { id: `${fromId}-${toId}-${dayKey}`, fromId, toId, dayKey, createdAt: 0 };
}

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'challenge-1',
    name: 'leer',
    weeklyTarget: 4,
    startWeekKey: WEEK,
    endWeekKey: '2026-08-24',
    createdBy: 'ana',
    participantIds: ['ana', ME, 'luis'],
    habitId: 'habit-read',
    createdAt: 0,
    archivedAt: null,
    ...overrides,
  };
}

const members = [member('ana', 'Ana'), member('luis', 'Luis'), member('sofia', 'Sofía')];

describe('defaults', () => {
  it('shares focus and habits, never social use, until told otherwise', () => {
    expect(DEFAULT_SHARE_PREFS).toEqual({ focus: true, habits: true, social: false });
  });
});

describe('week keys', () => {
  it('weekKeyOf is the Monday of the week containing now', () => {
    expect(weekKeyOf(new Date(2026, 7, 19, 15).getTime())).toBe(WEEK);
    expect(weekKeyOf(new Date(2026, 7, 23, 23).getTime())).toBe(WEEK);
    expect(weekKeyOf(new Date(2026, 7, 24, 0).getTime())).toBe('2026-08-24');
  });

  it('dayKeyStart inverts dayKeyOf at local midnight', () => {
    const midnight = new Date(2026, 7, 19).getTime();
    expect(dayKeyStart('2026-08-19')).toBe(midnight);
    expect(dayKeyOf(dayKeyStart(TODAY))).toBe(TODAY);
  });

  it('shiftDayKey moves by calendar days, across month and year ends', () => {
    expect(shiftDayKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDayKey(WEEK, 7)).toBe('2026-08-24');
    expect(shiftDayKey(WEEK, -7)).toBe(LAST_WEEK);
  });

  it('weekDayKeys lists Monday to Sunday', () => {
    expect(weekDayKeys(WEEK)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
  });

  it('endWeekKeyFor is the Monday of the last week, one week meaning the same Monday', () => {
    expect(endWeekKeyFor(WEEK, 1)).toBe(WEEK);
    expect(endWeekKeyFor(WEEK, 2)).toBe('2026-08-24');
    expect(endWeekKeyFor(WEEK, 4)).toBe('2026-09-07');
    expect(endWeekKeyFor(WEEK, 0)).toBe(WEEK);
  });

  it('endWeekKeyFor stays on a Monday across a DST change, whatever the zone', () => {
    // 2026-03-08 (US) and 2026-03-29 (EU) are DST Sundays; both windows cross one.
    expect(endWeekKeyFor('2026-03-02', 2)).toBe('2026-03-09');
    expect(endWeekKeyFor('2026-03-23', 2)).toBe('2026-03-30');
    expect(endWeekKeyFor('2026-10-26', 2)).toBe('2026-11-02');
    expect(new Date(dayKeyStart('2026-03-09')).getDay()).toBe(1);
  });
});

describe('circleWeek', () => {
  const me = { profile, week: { focusMs: 5 * HOUR, socialMs: null, habitsDone: 3, habitsTarget: 5 } };

  it('puts the user and every member in, sorted by focus, most first', () => {
    const weeks = [week('ana', 7 * HOUR), week('luis', 3 * HOUR), week('sofia', 6 * HOUR)];

    const rows = circleWeek(members, weeks, me, WEEK);

    expect(rows.map((r) => r.id)).toEqual(['ana', 'sofia', ME, 'luis']);
    expect(rows.find((r) => r.isMe)).toMatchObject({ name: 'Gus', handle: 'gus', focusMs: 5 * HOUR, hasData: true });
  });

  it('sorts a member without a row for that week last, with zeros and no social', () => {
    const rows = circleWeek(members, [week('luis', 1 * HOUR)], me, WEEK);

    expect(rows.map((r) => r.id)).toEqual([ME, 'luis', 'ana', 'sofia']);
    expect(rows[2]).toMatchObject({ hasData: false, focusMs: 0, socialMs: null, habitsDone: 0, habitsTarget: 0 });
  });

  it('reads only the rows of the requested week', () => {
    const weeks = [week('ana', 7 * HOUR, { weekKey: LAST_WEEK }), week('ana', 2 * HOUR)];

    const [thisWeek] = circleWeek([member('ana', 'Ana')], weeks, me, WEEK).filter((r) => !r.isMe);
    const [lastWeek] = circleWeek([member('ana', 'Ana')], weeks, me, LAST_WEEK).filter((r) => !r.isMe);

    expect(thisWeek?.focusMs).toBe(2 * HOUR);
    expect(lastWeek?.focusMs).toBe(7 * HOUR);
  });

  it('leaves out invited and pending people', () => {
    const all = [...members, member('mateo', 'Mateo', 'pending'), member('x', 'X', 'invited')];

    const rows = circleWeek(all, [], me, WEEK);

    expect(rows.map((r) => r.id)).toEqual([ME, 'ana', 'luis', 'sofia']);
  });

  it('carries a shared social floor and a null one as given', () => {
    const weeks = [week('ana', 1 * HOUR, { socialMs: 9 * HOUR }), week('luis', 1 * HOUR)];

    const rows = circleWeek(members.slice(0, 2), weeks, me, WEEK);

    expect(rows.find((r) => r.id === 'ana')?.socialMs).toBe(9 * HOUR);
    expect(rows.find((r) => r.id === 'luis')?.socialMs).toBeNull();
  });

  it('shows the user alone when there are no members', () => {
    expect(circleWeek([], [], me, WEEK).map((r) => r.id)).toEqual([ME]);
  });
});

describe('kudos', () => {
  const given = [kudos(ME, 'ana', TODAY), kudos(ME, 'luis', '2026-08-18'), kudos('ana', ME, TODAY)];

  it('kudosGivenToday is true only for my kudos to that person on that day', () => {
    expect(kudosGivenToday(given, 'ana', TODAY)).toBe(true);
    expect(kudosGivenToday(given, 'luis', TODAY)).toBe(false);
    expect(kudosGivenToday(given, 'luis', '2026-08-18')).toBe(true);
    expect(kudosGivenToday(given, 'sofia', TODAY)).toBe(false);
    expect(kudosGivenToday([], 'ana', TODAY)).toBe(false);
  });

  it('kudosReceivedInWeek keeps what came to me between Monday and today', () => {
    const received = [
      kudos('ana', ME, '2026-08-17'),
      kudos('luis', ME, TODAY),
      kudos('sofia', ME, '2026-08-16'),
      kudos('sofia', ME, '2026-08-20'),
      kudos(ME, 'ana', TODAY),
    ];

    expect(kudosReceivedInWeek(received, WEEK, TODAY).map((k) => k.fromId)).toEqual(['ana', 'luis']);
  });

  it('kudosSenderNames dedupes by person, first seen first, skipping unknown ids', () => {
    const received = [
      kudos('luis', ME, '2026-08-17'),
      kudos('ana', ME, '2026-08-18'),
      kudos('luis', ME, TODAY),
      kudos('gone', ME, TODAY),
    ];

    expect(kudosSenderNames(received, members)).toEqual(['Luis', 'Ana']);
    expect(kudosSenderNames([], members)).toEqual([]);
  });
});

describe('challengeStatus / weeks', () => {
  const twoWeeks = challenge();

  it('is upcoming before the start, active inside, ended after', () => {
    expect(challengeStatus(twoWeeks, LAST_WEEK)).toBe('upcoming');
    expect(challengeStatus(twoWeeks, WEEK)).toBe('active');
    expect(challengeStatus(twoWeeks, '2026-08-24')).toBe('active');
    expect(challengeStatus(twoWeeks, '2026-08-31')).toBe('ended');
  });

  it('counts the total weeks from the two Monday keys', () => {
    expect(challengeWeeks(challenge({ endWeekKey: WEEK }))).toBe(1);
    expect(challengeWeeks(twoWeeks)).toBe(2);
    expect(challengeWeeks(challenge({ endWeekKey: '2026-09-07' }))).toBe(4);
  });

  it('counts weeks left including the current one, all of them before the start, none after', () => {
    expect(challengeWeeksLeft(twoWeeks, LAST_WEEK)).toBe(2);
    expect(challengeWeeksLeft(twoWeeks, WEEK)).toBe(2);
    expect(challengeWeeksLeft(twoWeeks, '2026-08-24')).toBe(1);
    expect(challengeWeeksLeft(twoWeeks, '2026-08-31')).toBe(0);
  });

  it('counts weeks across a DST change', () => {
    const spring = challenge({ startWeekKey: '2026-03-02', endWeekKey: '2026-03-23' });

    expect(challengeWeeks(spring)).toBe(4);
    expect(challengeWeeksLeft(spring, '2026-03-16')).toBe(2);
  });
});

describe('challengeStandings', () => {
  const marks = [
    { id: 'c1', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-17', markedAt: 0 },
    { id: 'c2', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-18', markedAt: 0 },
    { id: 'c3', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-19', markedAt: 0 },
    { id: 'c4', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-20', markedAt: 0 },
    { id: 'c5', challengeId: 'challenge-1', memberId: 'luis', dayKey: '2026-08-18', markedAt: 0 },
    { id: 'c6', challengeId: 'other', memberId: 'luis', dayKey: '2026-08-19', markedAt: 0 },
    { id: 'c7', challengeId: 'challenge-1', memberId: 'luis', dayKey: '2026-08-11', markedAt: 0 },
  ];
  const myMarks = [
    aMark({ habitId: 'habit-read', dayKey: '2026-08-17' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-08-19' }),
    aMark({ habitId: 'habit-gym', dayKey: '2026-08-18' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-08-12' }),
  ];

  it('puts me first, then the others in the challenge order', () => {
    const standings = challengeStandings(challenge(), members, marks, myMarks, profile, WEEK);

    expect(standings.map((s) => s.id)).toEqual([ME, 'ana', 'luis']);
    expect(standings[0]).toMatchObject({ name: 'Gus', isMe: true });
  });

  it('counts my days from the habit marks of the linked habit, this week only', () => {
    const [mine] = challengeStandings(challenge(), members, marks, myMarks, profile, WEEK);

    expect(mine?.days).toEqual([true, false, true, false, false, false, false]);
    expect(mine).toMatchObject({ done: 2, target: 4, met: false });
  });

  it('counts a member from the challenge marks of this challenge and week', () => {
    const standings = challengeStandings(challenge(), members, marks, myMarks, profile, WEEK);
    const ana = standings.find((s) => s.id === 'ana');
    const luis = standings.find((s) => s.id === 'luis');

    expect(ana).toMatchObject({ name: 'Ana', done: 4, met: true });
    expect(ana?.days).toEqual([true, true, true, true, false, false, false]);
    expect(luis).toMatchObject({ done: 1, met: false });
    expect(luis?.days).toEqual([false, true, false, false, false, false, false]);
  });

  it('reads another week when asked', () => {
    const standings = challengeStandings(challenge(), members, marks, myMarks, profile, LAST_WEEK);

    expect(standings.find((s) => s.id === 'luis')?.days[1]).toBe(true);
    expect(standings.find((s) => s.id === ME)?.days[2]).toBe(true);
    expect(standings.find((s) => s.id === 'ana')?.done).toBe(0);
  });

  it('gives me no days without a linked habit, and an empty name without a profile', () => {
    const [mine] = challengeStandings(challenge({ habitId: null }), members, marks, myMarks, null, WEEK);

    expect(mine).toMatchObject({ id: ME, name: '', done: 0, met: false });
    expect(mine?.days.every((day) => !day)).toBe(true);
  });

  it('leaves me out when I am not a participant, and skips ids that are not members', () => {
    const standings = challengeStandings(
      challenge({ participantIds: ['ana', 'gone', 'luis'] }),
      members,
      marks,
      myMarks,
      profile,
      WEEK,
    );

    expect(standings.map((s) => s.id)).toEqual(['ana', 'luis']);
  });
});

describe('invite codes', () => {
  it('is six symbols from the alphabet, always the same for the same profile', () => {
    const code = inviteCodeFor(profile);

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(inviteCodeFor({ ...profile, name: 'Otro', createdAt: 99 })).toBe(code);
  });

  it('differs between profiles', () => {
    const codes = new Set(['a', 'b', 'c', 'profile-2', 'profile-3'].map((id) => inviteCodeFor({ ...profile, id })));

    expect(codes.size).toBe(5);
    expect(codes.has(inviteCodeFor(profile))).toBe(false);
  });

  it('changes with the code generation and nothing else', () => {
    const code = inviteCodeFor(profile);
    const next = inviteCodeFor({ ...profile, codeGeneration: 1 });

    expect(next).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(next).not.toBe(code);
    expect(inviteCodeFor({ ...profile, codeGeneration: 0 })).toBe(code);
  });

  it('builds the invite link around the code and reads the code back out of text', () => {
    const code = inviteCodeFor(profile);
    const link = inviteLinkFor(code);

    expect(link).toBe(`vesper://circle/join?code=${code}`);
    expect(codeFromInviteLink(link)).toBe(code);
    expect(codeFromInviteLink(`Únete a mi círculo. Toca ${link} o escribe el código ${code}.`)).toBe(code);
    expect(codeFromInviteLink(`vesper://circle/join?code=${code.toLowerCase()}`)).toBe(code);
    expect(codeFromInviteLink('vesper://circle/join?code=ABC0O1')).toBeNull();
    expect(codeFromInviteLink('vesper://circle/join?code=ABCDEFG')).toBeNull();
    expect(codeFromInviteLink('vesper://circle/join')).toBeNull();
    expect(codeFromInviteLink('')).toBeNull();
  });

  it('normalizes what the user typed and rejects anything that is not a code', () => {
    const code = inviteCodeFor(profile);

    expect(normalizeInviteCode(`  ${code.toLowerCase()} `)).toBe(code);
    expect(normalizeInviteCode('abc234')).toBe('ABC234');
    expect(normalizeInviteCode('')).toBeNull();
    expect(normalizeInviteCode('ABC12')).toBeNull();
    expect(normalizeInviteCode('ABCDEFG')).toBeNull();
    expect(normalizeInviteCode('ABC 23')).toBeNull();
    expect(normalizeInviteCode('ABC01O')).toBeNull();
    expect(normalizeInviteCode('ABCI23')).toBeNull();
    expect(normalizeInviteCode('ABCO23')).toBeNull();
    expect(normalizeInviteCode('ábc234')).toBeNull();
  });
});
