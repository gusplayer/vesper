import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeDb, transactionOn, type FakeRows } from '../../db/testing/fakeDb';
import { ME, type Challenge, type ChallengeMark, type Member, type MemberWeek } from '../../domain/types';
import { DEMO_CHALLENGE_ID } from '../circleSeed';
import { useCircleStore } from './circle';

/**
 * The circle store against a fake database handle, for the three things ADR-0044 added
 * to it: the account marker, what a sync writes, and the demo circle being withdrawn
 * the moment the account exists (ADR-0033 §8).
 *
 * Everything here goes through the repositories, like every other write in this store:
 * a cache that holds a row the database does not is a circle that disappears on the
 * next launch.
 */

let fake = createFakeDb();

vi.mock('../../db/client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

vi.mock('../../lib/uuid', () => ({ uuidv7: (now: number) => `id-${now}` }));

const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const CHALLENGE = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const PROFILE_ID = '0199a1b2-c3d4-7e5f-8a9b-000000000001';

function demoMemberRow(id: string) {
  return { id, name: id, handle: id, status: 'member', joined_at: 1, created_at: 1 };
}

/** A database that looks like a fresh install: the demo circle, no account. */
function seedFakeDb(): void {
  fake = createFakeDb();
  fake.whenSql(/FROM circle_members/, [demoMemberRow('ana'), demoMemberRow('luis')]);
  fake.whenSql(/FROM member_weeks/, [
    {
      member_id: 'ana',
      week_key: '2026-09-21',
      focus_ms: 100,
      social_ms: null,
      habits_done: 1,
      habits_target: 2,
      updated_at: 1,
    },
  ]);
  fake.whenSql(/FROM challenges/, [
    {
      id: DEMO_CHALLENGE_ID,
      name: 'Leer',
      weekly_target: 4,
      start_week_key: '2026-09-21',
      end_week_key: '2026-10-05',
      end_day_key: '2026-10-11',
      created_by: 'ana',
      participant_ids: JSON.stringify([ME, 'ana', 'luis']),
      habit_id: 'habit-read',
      created_at: 1,
      archived_at: null,
    },
  ]);
  useCircleStore.getState().hydrate(1);
}

beforeEach(() => {
  seedFakeDb();
});

const ANA_MEMBER: Member = {
  id: ANA,
  name: 'Ana',
  handle: 'ana',
  status: 'member',
  joinedAt: 10,
  createdAt: 10,
};

const ANA_WEEK: MemberWeek = {
  memberId: ANA,
  weekKey: '2026-09-21',
  focusMs: 3600,
  socialMs: null,
  habitsDone: 2,
  habitsTarget: 4,
  updatedAt: 20,
};

const REMOTE_CHALLENGE: Challenge = {
  id: CHALLENGE,
  name: 'Caminar',
  weeklyTarget: 4,
  startWeekKey: '2026-09-21',
  endDayKey: null,
  createdBy: ANA,
  participantIds: [ANA],
  habitId: null,
  createdAt: 20,
  archivedAt: null,
};

const REMOTE_MARK: ChallengeMark = {
  id: `${CHALLENGE}/${ANA}/2026-09-22`,
  challengeId: CHALLENGE,
  memberId: ANA,
  dayKey: '2026-09-22',
  source: 'health',
  markedAt: 20,
};

const EMPTY = { members: [], weeks: [], challenges: [], marks: [], kudos: [], nudges: [] };

describe('the account marker', () => {
  it('is written to settings and remembered', () => {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);

    expect(useCircleStore.getState().account).toEqual({ id: PROFILE_ID, createdAt: 50 });
    const call = fake.callMatching(/INSERT INTO settings/);
    expect(call.params?.[0]).toBe('circle_account');
    expect(String(call.params?.[1])).toContain(PROFILE_ID);
  });

  it('is not replaced by a second account', () => {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);
    useCircleStore.getState().setAccount({ id: ANA, createdAt: 60 }, 60);

    expect(useCircleStore.getState().account?.id).toBe(PROFILE_ID);
  });

  it('withdraws the demo circle, because from here on the people are people', () => {
    expect(useCircleStore.getState().members).toHaveLength(2);

    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);

    const state = useCircleStore.getState();
    expect(state.members).toEqual([]);
    expect(state.memberWeeks).toEqual([]);
    // The seeded challenge is archived, not deleted: the user's own marks in it are
    // habit marks of theirs, and those are not demo data.
    expect(state.challenges[0]?.archivedAt).toBe(50);
  });

  it('empties the circle again when the account is deleted', () => {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [ANA_MEMBER], weeks: [ANA_WEEK] });

    useCircleStore.getState().clearAccount(90);

    const state = useCircleStore.getState();
    expect(state.account).toBeNull();
    expect(state.syncSince).toBe(0);
    expect(state.syncedAt).toBeNull();
    expect(state.members).toEqual([]);
    expect(state.memberWeeks).toEqual([]);
    expect(fake.calls.some((call) => /DELETE FROM settings/.test(call.sql))).toBe(true);
  });
});

describe('what a sync writes', () => {
  it('puts every row through its repository before the cache', () => {
    useCircleStore.getState().applyRemote({
      ...EMPTY,
      members: [ANA_MEMBER],
      weeks: [ANA_WEEK],
      challenges: [REMOTE_CHALLENGE],
      marks: [REMOTE_MARK],
    });

    expect(fake.callMatching(/INSERT INTO circle_members/).params?.[0]).toBe(ANA);
    expect(fake.callMatching(/INSERT INTO member_weeks/).params?.[0]).toBe(ANA);
    expect(fake.callMatching(/INSERT INTO challenges/).params?.[0]).toBe(CHALLENGE);
    expect(fake.callMatching(/INSERT OR IGNORE INTO challenge_marks/).params?.[0]).toBe(REMOTE_MARK.id);
  });

  it('replaces a row by id and leaves the rest alone', () => {
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [ANA_MEMBER] });
    useCircleStore.getState().applyRemote({
      ...EMPTY,
      members: [{ ...ANA_MEMBER, name: 'Ana María' }],
    });

    const members = useCircleStore.getState().members;
    expect(members.filter((member) => member.id === ANA)).toHaveLength(1);
    expect(members.find((member) => member.id === ANA)?.name).toBe('Ana María');
    // The seeded people are still there: nothing but the account retires them.
    expect(members).toHaveLength(3);
  });

  it('keys a week on the person and the week, not on an id', () => {
    useCircleStore.getState().applyRemote({ ...EMPTY, weeks: [ANA_WEEK] });
    useCircleStore.getState().applyRemote({ ...EMPTY, weeks: [{ ...ANA_WEEK, focusMs: 7200 }] });

    const weeks = useCircleStore.getState().memberWeeks.filter((week) => week.memberId === ANA);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.focusMs).toBe(7200);
  });

  it('never inserts the same nudge twice', () => {
    const nudge = {
      id: CHALLENGE,
      fromId: ANA,
      toId: ME,
      challengeId: CHALLENGE,
      dayKey: '2026-09-22',
      createdAt: 20,
    };
    useCircleStore.getState().applyRemote({ ...EMPTY, nudges: [nudge] });
    useCircleStore.getState().applyRemote({ ...EMPTY, nudges: [nudge] });

    expect(useCircleStore.getState().nudges).toHaveLength(1);
    expect(fake.calls.filter((call) => /INSERT INTO nudges/.test(call.sql))).toHaveLength(1);
  });
});

describe('the cursor', () => {
  it('moves only when the server answered', () => {
    useCircleStore.getState().markSyncFailed();
    expect(useCircleStore.getState().syncSince).toBe(0);
    expect(useCircleStore.getState().syncFailed).toBe(true);

    useCircleStore.getState().markSynced(1234, 2000);

    expect(useCircleStore.getState().syncSince).toBe(1234);
    expect(useCircleStore.getState().syncedAt).toBe(2000);
    expect(useCircleStore.getState().syncFailed).toBe(false);
  });
});

describe('an acceptance the server has not heard yet', () => {
  const PENDING: Member = { ...ANA_MEMBER, status: 'pending', joinedAt: null };

  function settingsWrites(key: string): unknown[] {
    return fake.calls
      .filter((call) => /INSERT INTO settings/.test(call.sql) && call.params?.[0] === key)
      .map((call) => JSON.parse(String(call.params?.[1])) as unknown);
  }

  it('is queued and stored when there is an account, because /sync cannot carry it', () => {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [PENDING] });

    expect(useCircleStore.getState().acceptInvite(ANA, 60)).toBe('ok');

    expect(useCircleStore.getState().pendingAccepts).toEqual([ANA]);
    expect(settingsWrites('circle_pending_accepts').at(-1)).toEqual([ANA]);
  });

  it('is not queued for the demo circle, where nobody waits for an answer', () => {
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [PENDING] });

    useCircleStore.getState().acceptInvite(ANA, 60);

    expect(useCircleStore.getState().pendingAccepts).toEqual([]);
  });

  it('leaves the queue once settled, and when the person is removed first', () => {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [PENDING] });
    useCircleStore.getState().acceptInvite(ANA, 60);

    useCircleStore.getState().removeMember(ANA);

    expect(useCircleStore.getState().pendingAccepts).toEqual([]);
    expect(settingsWrites('circle_pending_accepts').at(-1)).toEqual([]);
  });

  it('is forgotten with the account', () => {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [PENDING] });
    useCircleStore.getState().acceptInvite(ANA, 60);
    useCircleStore.getState().markCodeConfirmed(2, 60);
    useCircleStore.getState().setProfileDirty(true, 60);

    useCircleStore.getState().clearAccount(90);

    const state = useCircleStore.getState();
    expect(state.pendingAccepts).toEqual([]);
    expect(state.confirmedGeneration).toBeNull();
    expect(state.profileDirty).toBe(false);
  });
});

describe('the code generation the server confirmed', () => {
  it('is null on a fresh install and stored once confirmed', () => {
    expect(useCircleStore.getState().confirmedGeneration).toBeNull();

    useCircleStore.getState().markCodeConfirmed(1, 70);

    expect(useCircleStore.getState().confirmedGeneration).toBe(1);
    expect(
      fake.calls.some((c) => /INSERT INTO settings/.test(c.sql) && c.params?.[0] === 'circle_code_confirmed'),
    ).toBe(true);
  });

  it('is read back at boot', () => {
    fake.whenSql(/SELECT value FROM settings/, [{ value: '3' }]);
    useCircleStore.getState().hydrate(1);
    expect(useCircleStore.getState().confirmedGeneration).toBe(3);
  });

  it('reads anything unreadable as unconfirmed', () => {
    fake.whenSql(/SELECT value FROM settings/, [{ value: '"x"' }]);
    useCircleStore.getState().hydrate(1);
    expect(useCircleStore.getState().confirmedGeneration).toBeNull();
  });
});

describe('ending a link here (ADR-0049)', () => {
  const PENDING: Member = { ...ANA_MEMBER, status: 'pending', joinedAt: null };
  const ANA_CHALLENGE: Challenge = { ...REMOTE_CHALLENGE, participantIds: [ANA, ME], habitId: 'habit-walk' };

  function withAccount(): void {
    useCircleStore.getState().setAccount({ id: PROFILE_ID, createdAt: 50 }, 50);
  }

  it('queues Rechazar for the server, and not for the demo circle', () => {
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [PENDING] });
    useCircleStore.getState().declineInvite(ANA, 60);
    expect(useCircleStore.getState().pendingEnds).toEqual([]);

    withAccount();
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [PENDING] });
    useCircleStore.getState().declineInvite(ANA, 61);

    expect(useCircleStore.getState().pendingEnds).toEqual([ANA]);
    expect(useCircleStore.getState().members).toEqual([]);
  });

  it('queues Quitar and archives the challenges that person made here', () => {
    withAccount();
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [ANA_MEMBER], challenges: [ANA_CHALLENGE] });

    useCircleStore.getState().removeFromCircle(ANA, 70);

    const state = useCircleStore.getState();
    expect(state.pendingEnds).toEqual([ANA]);
    expect(state.members).toEqual([]);
    expect(state.challenges.find((challenge) => challenge.id === CHALLENGE)?.archivedAt).toBe(70);
  });

  it('turns every queued end into one for everyone when leaving the circle', () => {
    withAccount();
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [ANA_MEMBER] });
    useCircleStore.getState().removeFromCircle(ANA, 70);

    useCircleStore.getState().leaveCircle(80);

    expect(useCircleStore.getState().pendingEnds).toEqual(['*']);
  });

  it('queues Salir del reto', () => {
    withAccount();
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [ANA_MEMBER], challenges: [ANA_CHALLENGE] });

    useCircleStore.getState().leaveChallenge(CHALLENGE, 90);

    expect(useCircleStore.getState().pendingLeaves).toEqual([CHALLENGE]);
  });

  it('lets a person the server says is gone go, with the challenges they made', () => {
    withAccount();
    useCircleStore.getState().applyRemote({ ...EMPTY, members: [ANA_MEMBER], weeks: [ANA_WEEK], challenges: [ANA_CHALLENGE] });

    useCircleStore.getState().applyRemote({ ...EMPTY, ended: [ANA] });

    const state = useCircleStore.getState();
    expect(state.members).toEqual([]);
    expect(state.memberWeeks).toEqual([]);
    expect(state.challenges.find((challenge) => challenge.id === CHALLENGE)?.archivedAt).not.toBeNull();
  });

  it('remembers whether the server has the call, and forgets the queues with the account', () => {
    withAccount();
    useCircleStore.getState().setLinkEndSupport('no', 95);
    useCircleStore.getState().leaveCircle(96);

    useCircleStore.getState().clearAccount(99);

    const state = useCircleStore.getState();
    expect(state.pendingEnds).toEqual([]);
    expect(state.pendingLeaves).toEqual([]);
    expect(state.linkEndSupport).toBe('no');
  });
});
