import { describe, expect, it } from 'vitest';

import {
  challengeDays,
  challengeDaysLeft,
  challengeOutlook,
  challengeStandings,
  challengeStatus,
  challengeWeeks,
  challengeWeeksMet,
  circleFull,
  circleWeek,
  dayKeyStart,
  DEFAULT_SHARE_PREFS,
  endDayKeyFor,
  codeFromInviteLink,
  inviteCodeFor,
  inviteCodeOutcome,
  inviteLinkFor,
  isOwnInviteCode,
  kudosGivenToday,
  kudosReceivedInWeek,
  kudosSenderNames,
  normalizeInviteCode,
  nudgeGivenToday,
  nudgesReceivedToday,
  seatsTaken,
  shiftDayKey,
  weekDayKeys,
  weekKeyOf,
  weekSource,
} from './circle';
import { dayKeyOf } from './day';
import { aMark } from './fixtures';
import { HOUR } from './time';
import {
  MAX_CIRCLE,
  ME,
  type Challenge,
  type Kudos,
  type Member,
  type MemberWeek,
  type Nudge,
  type Profile,
} from './types';

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

function nudge(fromId: string, toId: string, dayKey: string, challengeId = 'challenge-1'): Nudge {
  return { id: `${fromId}-${toId}-${challengeId}-${dayKey}`, fromId, toId, challengeId, dayKey, createdAt: 0 };
}

/** Two weeks: Monday the 17th to Sunday the 30th. */
function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'challenge-1',
    name: 'leer',
    weeklyTarget: 4,
    startWeekKey: WEEK,
    endDayKey: '2026-08-30',
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

  it('endDayKeyFor is the last day inclusive: a week from Monday ends on Sunday', () => {
    expect(endDayKeyFor(WEEK, 7)).toBe('2026-08-23');
    expect(endDayKeyFor(WEEK, 14)).toBe('2026-08-30');
    expect(endDayKeyFor(WEEK, 21)).toBe('2026-09-06');
    expect(endDayKeyFor(WEEK, 28)).toBe('2026-09-13');
    expect(endDayKeyFor(WEEK, 1)).toBe(WEEK);
    expect(endDayKeyFor(WEEK, 0)).toBe(WEEK);
  });

  it('endDayKeyFor is null for a challenge with no end', () => {
    expect(endDayKeyFor(WEEK, null)).toBeNull();
  });

  it('endDayKeyFor stays on a Sunday across a DST change, whatever the zone', () => {
    // 2026-03-08 (US) and 2026-03-29 (EU) are DST Sundays; both windows cross one.
    expect(endDayKeyFor('2026-03-02', 14)).toBe('2026-03-15');
    expect(endDayKeyFor('2026-03-23', 14)).toBe('2026-04-05');
    expect(endDayKeyFor('2026-10-26', 14)).toBe('2026-11-08');
    expect(new Date(dayKeyStart('2026-03-15')).getDay()).toBe(0);
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

describe('nudges', () => {
  const given = [
    nudge(ME, 'ana', TODAY),
    nudge(ME, 'luis', '2026-08-18'),
    nudge(ME, 'sofia', TODAY, 'other'),
    nudge('ana', ME, TODAY),
  ];

  it('nudgeGivenToday is true only for my nudge to that person on that challenge and day', () => {
    expect(nudgeGivenToday(given, 'ana', 'challenge-1', TODAY)).toBe(true);
    expect(nudgeGivenToday(given, 'luis', 'challenge-1', TODAY)).toBe(false);
    expect(nudgeGivenToday(given, 'luis', 'challenge-1', '2026-08-18')).toBe(true);
    expect(nudgeGivenToday(given, 'sofia', 'challenge-1', TODAY)).toBe(false);
    expect(nudgeGivenToday(given, 'sofia', 'other', TODAY)).toBe(true);
    expect(nudgeGivenToday(given, 'ana', 'other', TODAY)).toBe(false);
    expect(nudgeGivenToday([], 'ana', 'challenge-1', TODAY)).toBe(false);
  });

  it('nudgesReceivedToday keeps what came to me today, on any challenge', () => {
    const received = [
      nudge('ana', ME, TODAY),
      nudge('luis', ME, TODAY, 'other'),
      nudge('sofia', ME, '2026-08-18'),
      nudge(ME, 'ana', TODAY),
    ];

    expect(nudgesReceivedToday(received, TODAY).map((n) => n.fromId)).toEqual(['ana', 'luis']);
    expect(nudgesReceivedToday(received, '2026-08-20')).toEqual([]);
  });

  it('the sender names come out through kudosSenderNames, since a nudge is shaped like a kudos', () => {
    expect(kudosSenderNames(nudgesReceivedToday([nudge('luis', ME, TODAY), nudge('gone', ME, TODAY)], TODAY), members)).toEqual(['Luis']);
  });
});

describe('challengeStatus / days', () => {
  const twoWeeks = challenge();
  const endless = challenge({ endDayKey: null });

  it('is upcoming before the start, active through the last day, ended the day after', () => {
    expect(challengeStatus(twoWeeks, '2026-08-16')).toBe('upcoming');
    expect(challengeStatus(twoWeeks, LAST_WEEK)).toBe('upcoming');
    expect(challengeStatus(twoWeeks, WEEK)).toBe('active');
    expect(challengeStatus(twoWeeks, TODAY)).toBe('active');
    expect(challengeStatus(twoWeeks, '2026-08-30')).toBe('active');
    expect(challengeStatus(twoWeeks, '2026-08-31')).toBe('ended');
  });

  it('never ends a challenge without an end', () => {
    expect(challengeStatus(endless, LAST_WEEK)).toBe('upcoming');
    expect(challengeStatus(endless, WEEK)).toBe('active');
    expect(challengeStatus(endless, '2036-01-01')).toBe('active');
  });

  it('counts the total days, both ends included, and null for no end', () => {
    expect(challengeDays(challenge({ endDayKey: WEEK }))).toBe(1);
    expect(challengeDays(challenge({ endDayKey: '2026-08-23' }))).toBe(7);
    expect(challengeDays(twoWeeks)).toBe(14);
    expect(challengeDays(challenge({ endDayKey: '2026-09-06' }))).toBe(21);
    expect(challengeDays(endless)).toBeNull();
  });

  it('counts days left with today included: all before the start, 1 on the last day, 0 after', () => {
    expect(challengeDaysLeft(twoWeeks, LAST_WEEK)).toBe(14);
    expect(challengeDaysLeft(twoWeeks, WEEK)).toBe(14);
    expect(challengeDaysLeft(twoWeeks, TODAY)).toBe(12);
    expect(challengeDaysLeft(twoWeeks, '2026-08-30')).toBe(1);
    expect(challengeDaysLeft(twoWeeks, '2026-08-31')).toBe(0);
    expect(challengeDaysLeft(endless, TODAY)).toBeNull();
  });

  it('counts days across a DST change', () => {
    const spring = challenge({ startWeekKey: '2026-03-02', endDayKey: '2026-03-22' });

    expect(challengeDays(spring)).toBe(21);
    expect(challengeDaysLeft(spring, '2026-03-16')).toBe(7);
  });
});

describe('weekSource', () => {
  it('lets the least verified mark of the week decide', () => {
    expect(weekSource([])).toBeNull();
    expect(weekSource(['health', 'health'])).toBe('health');
    expect(weekSource(['health', 'session'])).toBe('session');
    expect(weekSource(['health', 'session', 'manual'])).toBe('manual');
  });
});

describe('challengeStandings', () => {
  const marks = [
    { id: 'c1', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-17', source: 'health' as const, markedAt: 0 },
    { id: 'c2', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-18', source: 'health' as const, markedAt: 0 },
    { id: 'c3', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-19', source: 'health' as const, markedAt: 0 },
    { id: 'c4', challengeId: 'challenge-1', memberId: 'ana', dayKey: '2026-08-20', source: 'health' as const, markedAt: 0 },
    { id: 'c5', challengeId: 'challenge-1', memberId: 'luis', dayKey: '2026-08-18', source: 'manual' as const, markedAt: 0 },
    { id: 'c6', challengeId: 'other', memberId: 'luis', dayKey: '2026-08-19', source: 'manual' as const, markedAt: 0 },
    { id: 'c7', challengeId: 'challenge-1', memberId: 'luis', dayKey: '2026-08-11', source: 'manual' as const, markedAt: 0 },
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

  it('says how each week was counted, mine from my habit marks', () => {
    const standings = challengeStandings(challenge(), members, marks, myMarks, profile, WEEK);

    expect(standings.find((s) => s.id === 'ana')?.source).toBe('health');
    expect(standings.find((s) => s.id === 'luis')?.source).toBe('manual');
    expect(standings.find((s) => s.isMe)?.source).toBe(aMark({}).source);
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

describe('challengeOutlook', () => {
  /** Wednesday the 19th: five days left in the week, today included. */
  const wednesday = dayKeyStart(TODAY) + 10 * HOUR;
  const sunday = dayKeyStart('2026-08-23') + 10 * HOUR;
  const outlook = (done: number, at = wednesday) => challengeOutlook({ done, target: 4 }, at, false);

  it('counts the days left in the week with today inside', () => {
    expect(outlook(0).daysLeft).toBe(5);
    expect(outlook(0, dayKeyStart(WEEK) + HOUR).daysLeft).toBe(7);
    expect(outlook(0, sunday).daysLeft).toBe(1);
  });

  it('is met once the target is reached, whatever is left of the week', () => {
    expect(outlook(4).risk).toBe('met');
    expect(outlook(6).risk).toBe('met');
    expect(outlook(4).needed).toBe(0);
    expect(outlook(4, sunday).risk).toBe('met');
  });

  it('turns tight, then at risk, as the slack runs out', () => {
    // Wednesday, five days left: three needed still has slack, four is tight, five is the wall.
    expect(challengeOutlook({ done: 1, target: 4 }, wednesday, false).risk).toBe('onTrack');
    expect(challengeOutlook({ done: 0, target: 4 }, wednesday, false).risk).toBe('tight');
    expect(challengeOutlook({ done: 0, target: 5 }, wednesday, false).risk).toBe('atRisk');
  });

  it('is missed when more marks are needed than there are days', () => {
    expect(challengeOutlook({ done: 0, target: 6 }, wednesday, false).risk).toBe('missed');
    expect(challengeOutlook({ done: 3, target: 4 }, sunday, false).risk).toBe('atRisk');
    expect(challengeOutlook({ done: 2, target: 4 }, sunday, false).risk).toBe('missed');
    expect(challengeOutlook({ done: 2, target: 4 }, sunday, false).needed).toBe(2);
  });

  it('drops today from the days left once it is marked: the mark is already in done', () => {
    // A challenge of six, Sunday, marked Monday to Thursday and again today. Counting
    // today twice would read as 'atRisk' — "only marking today saves it" — with today
    // already marked and the week out of reach.
    const marked = challengeOutlook({ done: 5, target: 6 }, sunday, true);

    expect(marked).toEqual({ risk: 'missed', needed: 1, daysLeft: 0 });
    // The same week with today still free is the wall it is supposed to be.
    expect(challengeOutlook({ done: 4, target: 6 }, sunday, false).risk).toBe('missed');
    expect(challengeOutlook({ done: 5, target: 6 }, sunday, false).risk).toBe('atRisk');
  });

  it('shifts every state by a day when today is marked', () => {
    // Wednesday with today marked: four days can still take a mark, not five.
    expect(challengeOutlook({ done: 1, target: 4 }, wednesday, true).daysLeft).toBe(4);
    expect(challengeOutlook({ done: 1, target: 4 }, wednesday, true).risk).toBe('tight');
    expect(challengeOutlook({ done: 1, target: 5 }, wednesday, true).risk).toBe('atRisk');
    expect(challengeOutlook({ done: 1, target: 6 }, wednesday, true).risk).toBe('missed');
    expect(challengeOutlook({ done: 4, target: 4 }, wednesday, true).risk).toBe('met');
  });
});

describe('challengeWeeks', () => {
  const myMarks = [
    aMark({ habitId: 'habit-read', dayKey: '2026-08-17' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-08-18' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-08-19' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-08-20' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-08-25' }),
    // Another habit, and a day outside the challenge: neither counts.
    aMark({ habitId: 'habit-gym', dayKey: '2026-08-26' }),
    aMark({ habitId: 'habit-read', dayKey: '2026-09-02' }),
  ];

  it('gives one week per Monday from the start to the last day', () => {
    const weeks = challengeWeeks(challenge(), myMarks, '2026-08-31');

    expect(weeks.map((w) => w.weekKey)).toEqual([WEEK, '2026-08-24']);
    expect(weeks.map((w) => w.done)).toEqual([4, 1]);
    expect(weeks.map((w) => w.met)).toEqual([true, false]);
    expect(challengeWeeksMet(weeks)).toEqual({ met: 1, total: 2 });
  });

  it('marks a week closed only once its Sunday has passed', () => {
    const weeks = challengeWeeks(challenge(), myMarks, TODAY);

    expect(weeks.map((w) => w.closed)).toEqual([false, false]);
    // Its own Sunday is the day that tells the two apart: the user can still mark it.
    expect(challengeWeeks(challenge(), myMarks, '2026-08-23').map((w) => w.closed)).toEqual([false, false]);
    expect(challengeWeeks(challenge(), myMarks, '2026-08-24').map((w) => w.closed)).toEqual([true, false]);
  });

  it('counts a challenge with no end up to today, and counts nothing without a habit', () => {
    expect(challengeWeeks(challenge({ endDayKey: null }), myMarks, TODAY).map((w) => w.done)).toEqual([3]);
    expect(challengeWeeks(challenge({ habitId: null }), myMarks, '2026-08-31').map((w) => w.done)).toEqual([0, 0]);
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

describe('typing a code (no server yet)', () => {
  it('recognises the user\'s own code, current or from any earlier generation', () => {
    const regenerated = { ...profile, codeGeneration: 2 };
    const current = inviteCodeFor(regenerated);
    const first = inviteCodeFor({ ...profile, codeGeneration: 0 });
    const second = inviteCodeFor({ ...profile, codeGeneration: 1 });

    expect(isOwnInviteCode(regenerated, current)).toBe(true);
    expect(isOwnInviteCode(regenerated, first)).toBe(true);
    expect(isOwnInviteCode(regenerated, second)).toBe(true);
    // A generation that does not exist yet is not the user's.
    expect(isOwnInviteCode(regenerated, inviteCodeFor({ ...profile, codeGeneration: 3 }))).toBe(false);
    expect(isOwnInviteCode(regenerated, inviteCodeFor({ ...profile, id: 'someone-else' }))).toBe(false);
  });

  it('answers self for an own code, typed in any case, after a new code was generated', () => {
    const regenerated = { ...profile, codeGeneration: 1 };
    const previous = inviteCodeFor(profile);

    expect(inviteCodeOutcome(regenerated, previous)).toBe('self');
    expect(inviteCodeOutcome(regenerated, ` ${previous.toLowerCase()} `)).toBe('self');
    expect(inviteCodeOutcome(regenerated, inviteCodeFor(regenerated))).toBe('self');
  });

  it('answers unavailable for any other well-formed code: nobody can look it up', () => {
    expect(inviteCodeOutcome(profile, 'AAAAAA')).toBe('unavailable');
    expect(inviteCodeOutcome(profile, inviteCodeFor({ ...profile, id: 'someone-else' }))).toBe('unavailable');
    expect(inviteCodeOutcome(null, 'AAAAAA')).toBe('unavailable');
  });

  it('answers invalid only for text that is not shaped like a code', () => {
    expect(inviteCodeOutcome(profile, 'ABC01O')).toBe('invalid');
    expect(inviteCodeOutcome(profile, 'ABCDE')).toBe('invalid');
    expect(inviteCodeOutcome(profile, '')).toBe('invalid');
    expect(inviteCodeOutcome(null, 'nope')).toBe('invalid');
  });
});

describe('seats', () => {
  it('counts everyone with a row: in the circle, invited, or asking to join', () => {
    const members = [member('a', 'Ana'), member('b', 'Luis', 'invited'), member('c', 'Mateo', 'pending')];

    expect(seatsTaken(members)).toBe(3);
    expect(seatsTaken([])).toBe(0);
  });

  it('is full at MAX_CIRCLE, whatever the mix of statuses', () => {
    const eleven = Array.from({ length: MAX_CIRCLE - 1 }, (_, i) => member(`m${i}`, `M${i}`));

    expect(circleFull(eleven)).toBe(false);
    expect(circleFull([...eleven, member('p', 'Pending', 'pending')])).toBe(true);
    expect(circleFull([...eleven, member('i', 'Invited', 'invited')])).toBe(true);
  });
});
