import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Challenge, ChallengeMark, Kudos, Member, MemberWeek, Nudge } from '../../domain/types';
import { CIRCLE_SQL } from '../migrations/004_circle';
import { STREAK_NUDGES_SQL } from '../migrations/007_streak_nudges';
import { CHALLENGE_MARK_SOURCE_SQL } from '../migrations/009_challenge_mark_source';
import { MEMBER_WEEKS_NOT_SHARED_SQL } from '../migrations/010_member_weeks_not_shared';
import { createFakeDb, ddlColumns, insertColumns, transactionOn, type FakeRows } from '../testing/fakeDb';
import * as circle from './circle';
import * as settings from './settings';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

const T0 = 1_700_000_000_000;

const member: Member = {
  id: 'ana',
  name: 'Ana',
  handle: 'ana',
  status: 'member',
  joinedAt: T0,
  createdAt: T0 - 1,
};

const memberRow = {
  id: 'ana',
  name: 'Ana',
  handle: 'ana',
  status: 'member',
  joined_at: T0,
  created_at: T0 - 1,
};

const week: MemberWeek = {
  memberId: 'ana',
  weekKey: '2026-08-17',
  focusMs: 3_600_000,
  socialMs: null,
  habitsDone: 3,
  habitsTarget: 5,
  updatedAt: T0,
};

const weekRow = {
  member_id: 'ana',
  week_key: '2026-08-17',
  focus_ms: 3_600_000,
  focus_ms_shared: 3_600_000,
  social_ms: null,
  habits_done: 3,
  habits_done_shared: 3,
  habits_target: 5,
  habits_target_shared: 5,
  updated_at: T0,
};

const kudos: Kudos = { id: 'k-1', fromId: 'ana', toId: 'me', dayKey: '2026-08-18', createdAt: T0 };

const nudge: Nudge = {
  id: 'n-1',
  fromId: 'ana',
  toId: 'me',
  challengeId: 'challenge-read',
  dayKey: '2026-08-18',
  createdAt: T0,
};

const nudgeRow = {
  id: 'n-1',
  from_id: 'ana',
  to_id: 'me',
  challenge_id: 'challenge-read',
  day_key: '2026-08-18',
  created_at: T0,
};

/** Two weeks from Monday the 17th: the last day is Sunday the 30th. */
const challenge: Challenge = {
  id: 'challenge-read',
  name: 'leer',
  weeklyTarget: 4,
  startWeekKey: '2026-08-17',
  endDayKey: '2026-08-30',
  createdBy: 'ana',
  participantIds: ['me', 'ana', 'luis'],
  habitId: 'habit-read',
  createdAt: T0,
  archivedAt: null,
};

const challengeRow = {
  id: 'challenge-read',
  name: 'leer',
  weekly_target: 4,
  start_week_key: '2026-08-17',
  end_week_key: '2026-08-24',
  end_day_key: '2026-08-30',
  created_by: 'ana',
  participant_ids: '["me","ana","luis"]',
  habit_id: 'habit-read',
  created_at: T0,
  archived_at: null,
};

const mark: ChallengeMark = {
  id: 'cm-1',
  challengeId: 'challenge-read',
  memberId: 'ana',
  dayKey: '2026-08-18',
  source: 'health',
  markedAt: T0,
};

beforeEach(() => {
  fake = createFakeDb();
});

describe('parseParticipantIds', () => {
  it('reads a JSON array of strings, dropping anything that is not a string', () => {
    expect(circle.parseParticipantIds('["me","ana",3,null,{"id":"x"}]')).toEqual(['me', 'ana']);
  });

  it('is empty for corrupt JSON, a non-array or a non-string', () => {
    expect(circle.parseParticipantIds('["me"')).toEqual([]);
    expect(circle.parseParticipantIds('{"me":true}')).toEqual([]);
    expect(circle.parseParticipantIds('"me"')).toEqual([]);
    expect(circle.parseParticipantIds(7)).toEqual([]);
    expect(circle.parseParticipantIds(null)).toEqual([]);
  });
});

describe('members', () => {
  it('lists rows mapped to camelCase, keeping a null joined_at', () => {
    fake.whenSql('FROM circle_members', [memberRow, { ...memberRow, id: 'mateo', status: 'pending', joined_at: null }]);

    const listed = circle.listMembers();

    expect(listed[0]).toEqual(member);
    expect(listed[1]).toMatchObject({ id: 'mateo', status: 'pending', joinedAt: null });
  });

  it('is empty without rows', () => {
    expect(circle.listMembers()).toEqual([]);
  });

  it('upserts the whole row by id without touching created_at', () => {
    circle.upsertMember(member);

    const call = fake.callMatching(/INSERT INTO circle_members/);
    expect(call.sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(call.sql).not.toMatch(/created_at = excluded/);
    expect(call.params).toEqual(['ana', 'Ana', 'ana', 'member', T0, T0 - 1]);
  });

  it('removes by id', () => {
    circle.removeMember('ana');

    expect(fake.callMatching(/DELETE FROM circle_members/).params).toEqual(['ana']);
  });
});

describe('member weeks', () => {
  it('lists rows mapped to camelCase, social_ms null staying null', () => {
    fake.whenSql('FROM member_weeks', [weekRow, { ...weekRow, member_id: 'luis', social_ms: 900_000 }]);

    const listed = circle.listMemberWeeks();

    expect(listed[0]).toEqual(week);
    expect(listed[1]).toMatchObject({ memberId: 'luis', socialMs: 900_000 });
  });

  it('reads a metric the member does not share as null, never as zero', () => {
    // What a sync writes for someone with focus and habits switched off: the legacy
    // NOT NULL columns of 004 hold 0, and the columns of 010 hold the answer.
    fake.whenSql('FROM member_weeks', [
      {
        ...weekRow,
        focus_ms: 0,
        focus_ms_shared: null,
        habits_done: 0,
        habits_done_shared: null,
        habits_target: 0,
        habits_target_shared: null,
      },
    ]);

    expect(circle.listMemberWeeks()[0]).toMatchObject({
      focusMs: null,
      habitsDone: null,
      habitsTarget: null,
    });
  });

  it('reads a shared zero as zero: a week someone really had', () => {
    fake.whenSql('FROM member_weeks', [
      { ...weekRow, focus_ms: 0, focus_ms_shared: 0, habits_done: 0, habits_done_shared: 0 },
    ]);

    expect(circle.listMemberWeeks()[0]).toMatchObject({ focusMs: 0, habitsDone: 0 });
  });

  it('upserts on the (member, week) pair', () => {
    circle.upsertMemberWeek({ ...week, socialMs: 1_000 });

    const call = fake.callMatching(/INSERT INTO member_weeks/);
    expect(call.sql).toContain('ON CONFLICT(member_id, week_key) DO UPDATE');
    expect(call.params).toEqual(['ana', '2026-08-17', 3_600_000, 3_600_000, 1_000, 3, 3, 5, 5, T0]);
  });

  it('writes a null metric as null, and as 0 into the legacy NOT NULL column', () => {
    circle.upsertMemberWeek({ ...week, focusMs: null, habitsDone: null, habitsTarget: null });

    // focus_ms, focus_ms_shared, social_ms, habits_done, habits_done_shared,
    // habits_target, habits_target_shared.
    expect(fake.callMatching(/INSERT INTO member_weeks/).params).toEqual([
      'ana',
      '2026-08-17',
      0,
      null,
      null,
      0,
      null,
      0,
      null,
      T0,
    ]);
  });

  it('deletes every week of a member', () => {
    circle.deleteWeeksByMember('ana');

    expect(fake.callMatching(/DELETE FROM member_weeks/).params).toEqual(['ana']);
  });
});

describe('kudos', () => {
  it('lists rows mapped to camelCase', () => {
    fake.whenSql('FROM kudos', [{ id: 'k-1', from_id: 'ana', to_id: 'me', day_key: '2026-08-18', created_at: T0 }]);

    expect(circle.listKudos()).toEqual([kudos]);
  });

  it('inserts with OR IGNORE so a second tap on the same day is a no-op', () => {
    circle.insertKudos(kudos);

    const call = fake.callMatching(/INSERT OR IGNORE INTO kudos/);
    expect(call.params).toEqual(['k-1', 'ana', 'me', '2026-08-18', T0]);
  });

  it('deletes what a member sent and received', () => {
    circle.deleteKudosByMember('ana');

    const call = fake.callMatching(/DELETE FROM kudos/);
    expect(call.sql).toContain('from_id = ? OR to_id = ?');
    expect(call.params).toEqual(['ana', 'ana']);
  });
});

describe('nudges', () => {
  it('lists rows mapped to camelCase', () => {
    fake.whenSql('FROM nudges', [nudgeRow]);

    expect(circle.listNudges()).toEqual([nudge]);
  });

  it('inserts the whole row', () => {
    circle.insertNudge(nudge);

    const call = fake.callMatching(/INSERT INTO nudges/);
    expect(call.params).toEqual(['n-1', 'ana', 'me', 'challenge-read', '2026-08-18', T0]);
  });

  it('deletes what a member sent and received', () => {
    circle.deleteNudgesOf('ana');

    const call = fake.callMatching(/DELETE FROM nudges/);
    expect(call.sql).toContain('from_id = ? OR to_id = ?');
    expect(call.params).toEqual(['ana', 'ana']);
  });
});

describe('challenges', () => {
  it('lists rows, reading participant_ids from JSON and a corrupt one as nobody', () => {
    fake.whenSql('FROM challenges', [challengeRow, { ...challengeRow, id: 'c-2', participant_ids: '[me', habit_id: null, archived_at: T0 }]);

    const listed = circle.listChallenges();

    expect(listed[0]).toEqual(challenge);
    expect(listed[1]).toMatchObject({ id: 'c-2', participantIds: [], habitId: null, archivedAt: T0 });
  });

  it('reads a NULL end_day_key as a challenge with no end, and a missing one too', () => {
    const { end_day_key: _dropped, ...before007 } = challengeRow;
    fake.whenSql('FROM challenges', [{ ...challengeRow, end_day_key: null }, { ...before007, id: 'c-old' }]);

    const [endless, old] = circle.listChallenges();

    expect(endless?.endDayKey).toBeNull();
    expect(old?.endDayKey).toBeNull();
  });

  it('upserts the whole row by id, participant_ids as JSON, keeping created_at', () => {
    circle.upsertChallenge(challenge);

    const call = fake.callMatching(/INSERT INTO challenges/);
    expect(call.sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(call.sql).not.toMatch(/created_at = excluded/);
    expect(call.params).toEqual([
      'challenge-read',
      'leer',
      4,
      '2026-08-17',
      '2026-08-24',
      '2026-08-30',
      'ana',
      '["me","ana","luis"]',
      'habit-read',
      T0,
      null,
    ]);
  });

  it('derives the legacy end_week_key from the last day, or the start week without an end', () => {
    expect(circle.legacyEndWeekKey(challenge)).toBe('2026-08-24');
    expect(circle.legacyEndWeekKey({ startWeekKey: '2026-08-17', endDayKey: '2026-09-06' })).toBe('2026-08-31');
    expect(circle.legacyEndWeekKey({ startWeekKey: '2026-08-17', endDayKey: '2026-08-17' })).toBe('2026-08-17');
    expect(circle.legacyEndWeekKey({ startWeekKey: '2026-08-17', endDayKey: null })).toBe('2026-08-17');

    circle.upsertChallenge({ ...challenge, endDayKey: null });

    const params = fake.callMatching(/INSERT INTO challenges/).params;
    expect(params?.[4]).toBe('2026-08-17');
    expect(params?.[5]).toBeNull();
  });

  it('archives one or every open challenge with an UPDATE', () => {
    circle.archiveChallenge('challenge-read', T0);
    circle.archiveAllChallenges(T0 + 1);

    expect(fake.callMatching('SET archived_at = ? WHERE id = ?').params).toEqual([T0, 'challenge-read']);
    expect(fake.callMatching('WHERE archived_at IS NULL').params).toEqual([T0 + 1]);
  });
});

describe('challenge marks', () => {
  it('lists rows mapped to camelCase', () => {
    fake.whenSql('FROM challenge_marks', [{ id: 'cm-1', challenge_id: 'challenge-read', member_id: 'ana', day_key: '2026-08-18', source: 'health', marked_at: T0 }]);

    expect(circle.listChallengeMarks()).toEqual([mark]);
  });

  it('inserts with OR IGNORE on the (challenge, member, day) triple', () => {
    circle.upsertChallengeMark(mark);

    expect(fake.callMatching(/INSERT OR IGNORE INTO challenge_marks/).params).toEqual([
      'cm-1',
      'challenge-read',
      'ana',
      '2026-08-18',
      'health',
      T0,
    ]);
  });

  it('reads a source it does not know, or a row from before 009, as manual', () => {
    fake.whenSql('FROM challenge_marks', [
      { id: 'cm-2', challenge_id: 'challenge-read', member_id: 'luis', day_key: '2026-08-18', source: 'watch', marked_at: T0 },
    ]);

    expect(circle.listChallengeMarks()[0]?.source).toBe('manual');
  });

  it('deletes every mark of a member', () => {
    circle.deleteChallengeMarksByMember('ana');

    expect(fake.callMatching(/DELETE FROM challenge_marks/).params).toEqual(['ana']);
  });
});

describe('clearAll', () => {
  it('empties the five people tables, children first, and leaves challenges alone', () => {
    circle.clearAll();

    expect(fake.calls.map((call) => call.sql)).toEqual([
      'DELETE FROM challenge_marks',
      'DELETE FROM kudos',
      'DELETE FROM nudges',
      'DELETE FROM member_weeks',
      'DELETE FROM circle_members',
    ]);
  });
});

describe('profile in settings', () => {
  const profile = { id: 'p-1', name: 'Gus', handle: 'gus', codeGeneration: 0, createdAt: T0 };

  it('reads a well-formed profile from circle_profile', () => {
    fake.whenSql('SELECT value', [{ value: JSON.stringify(profile) }]);

    expect(settings.getProfile()).toEqual(profile);
    expect(fake.callMatching('SELECT value').params).toEqual(['circle_profile']);
  });

  it('is null when missing, corrupt, or missing any field', () => {
    expect(settings.getProfile()).toBeNull();
    expect(settings.parseProfile('{not json')).toBeNull();
    expect(settings.parseProfile(null)).toBeNull();
    expect(settings.parseProfile(['p-1'])).toBeNull();
    expect(settings.parseProfile({ ...profile, id: '' })).toBeNull();
    expect(settings.parseProfile({ ...profile, name: 3 })).toBeNull();
    expect(settings.parseProfile({ ...profile, handle: undefined })).toBeNull();
    expect(settings.parseProfile({ ...profile, createdAt: 'ayer' })).toBeNull();
  });

  it('ignores unknown fields', () => {
    expect(settings.parseProfile({ ...profile, email: 'x@y' })).toEqual(profile);
  });

  it('writes the profile as JSON under circle_profile', () => {
    settings.setProfile(profile, T0);

    expect(fake.callMatching(/INSERT INTO settings/).params).toEqual([
      'circle_profile',
      JSON.stringify(profile),
      T0,
    ]);
  });
});

describe('share preferences in settings', () => {
  it('reads the defaults when missing or corrupt', () => {
    expect(settings.getSharePrefs()).toEqual({ focus: true, habits: true, social: false });
    expect(fake.callMatching('SELECT value').params).toEqual(['circle_share']);
    expect(settings.parseSharePrefs('nope')).toEqual({ focus: true, habits: true, social: false });
  });

  it('falls back switch by switch', () => {
    expect(settings.parseSharePrefs({ focus: false, habits: 'yes', social: true })).toEqual({
      focus: false,
      habits: true,
      social: true,
    });
  });

  it('round-trips through circle_share', () => {
    const prefs = { focus: false, habits: false, social: true };
    settings.setSharePrefs(prefs, T0);
    expect(fake.callMatching(/INSERT INTO settings/).params).toEqual(['circle_share', JSON.stringify(prefs), T0]);

    fake = createFakeDb();
    fake.whenSql('SELECT value', [{ value: JSON.stringify(prefs) }]);
    expect(settings.getSharePrefs()).toEqual(prefs);
  });
});

describe('schema', () => {
  it('only inserts columns that exist in each table', () => {
    circle.upsertMember(member);
    circle.upsertMemberWeek(week);
    circle.insertKudos(kudos);
    circle.insertNudge(nudge);
    circle.upsertChallenge(challenge);
    circle.upsertChallengeMark(mark);

    const inserts = fake.calls.filter((call) => /INSERT/.test(call.sql));
    expect(inserts).toHaveLength(6);
    for (const call of inserts) {
      const { table, columns } = insertColumns(call.sql);
      const declared = ddlColumns(
        `${CIRCLE_SQL}\n${STREAK_NUDGES_SQL}\n${CHALLENGE_MARK_SOURCE_SQL}\n${MEMBER_WEEKS_NOT_SHARED_SQL}`,
        table,
      );
      expect(declared).not.toContain('PRIMARY');
      for (const column of columns) {
        expect(declared).toContain(column);
      }
      expect(call.params).toHaveLength(columns.length);
    }
    expect(inserts.map((call) => insertColumns(call.sql).table)).toEqual([
      'circle_members',
      'member_weeks',
      'kudos',
      'nudges',
      'challenges',
      'challenge_marks',
    ]);
  });
});

describe('removeMemberEverywhere', () => {
  const challenge: Challenge = {
    id: 'c-1',
    name: 'Leer',
    weeklyTarget: 4,
    startWeekKey: '2026-08-17',
    endDayKey: '2026-08-30',
    createdBy: 'me',
    participantIds: ['me'],
    habitId: null,
    createdAt: T0,
    archivedAt: null,
  };

  it('deletes marks, kudos, nudges, weeks and the row, rewrites the challenges, all in one transaction', () => {
    circle.removeMemberEverywhere('ana', [challenge]);

    const verbs = fake.calls.map((call) => call.sql.trim().split(/\s+/)[0]);
    expect(verbs).toEqual(['BEGIN', 'DELETE', 'DELETE', 'DELETE', 'DELETE', 'DELETE', 'INSERT', 'COMMIT']);
    expect(fake.calls[1]?.sql).toContain('challenge_marks');
    expect(fake.calls[2]?.sql).toContain('kudos');
    expect(fake.calls[3]?.sql).toContain('nudges');
    expect(fake.calls[4]?.sql).toContain('member_weeks');
    expect(fake.calls[5]?.sql).toContain('circle_members');
    expect(fake.calls[6]?.params?.[7]).toBe('["me"]');
  });

  it('rolls back when a statement throws, so a person is never half removed', () => {
    const failing = createFakeDb();
    const original = failing.executeSync;
    failing.executeSync = (sql, params) => {
      if (sql.includes('circle_members')) {
        throw new Error('locked');
      }
      return original(sql, params);
    };
    fake = failing;

    expect(() => circle.removeMemberEverywhere('ana', [])).toThrow('locked');
    expect(fake.calls.at(-1)?.sql).toBe('ROLLBACK');
  });
});
