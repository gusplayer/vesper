import { dayKeyStart, weekKeyOf } from '../../domain/day';
import type {
  Challenge,
  ChallengeMark,
  Kudos,
  Member,
  MemberStatus,
  MemberWeek,
  Nudge,
} from '../../domain/types';
import { getDb, rowsAs, transaction } from '../client';

/**
 * The circle's six tables (ADR-0021, nudges from ADR-0027). One repository: a
 * member's weeks, kudos, nudges and marks have no meaning without the member, and
 * leaving the circle empties them all. Every list reads a whole table; a circle is
 * at most twelve people and the rows grow by one per person per week.
 */

// --- Members -----------------------------------------------------------------------

type MemberRow = {
  id: string;
  name: string;
  handle: string;
  status: MemberStatus;
  joined_at: number | null;
  created_at: number;
};

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    status: row.status,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  };
}

/** Every member, whatever the status, oldest first. */
export function listMembers(): Member[] {
  return rowsAs<MemberRow>(
    getDb().executeSync('SELECT * FROM circle_members ORDER BY created_at, id'),
  ).map(toMember);
}

/** Inserts or replaces the whole row by id; created_at stays on an update. */
export function upsertMember(member: Member): void {
  getDb().executeSync(
    `INSERT INTO circle_members
       (id, name, handle, status, joined_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       handle = excluded.handle,
       status = excluded.status,
       joined_at = excluded.joined_at`,
    [member.id, member.name, member.handle, member.status, member.joinedAt, member.createdAt],
  );
}

/** The member row only. The store removes their weeks, kudos and marks alongside. */
export function removeMember(id: string): void {
  getDb().executeSync('DELETE FROM circle_members WHERE id = ?', [id]);
}

// --- Member weeks ------------------------------------------------------------------

type MemberWeekRow = {
  member_id: string;
  week_key: string;
  focus_ms: number | null;
  social_ms: number | null;
  habits_done: number | null;
  habits_target: number | null;
  updated_at: number;
};

function toMemberWeek(row: MemberWeekRow): MemberWeek {
  return {
    memberId: row.member_id,
    weekKey: row.week_key,
    focusMs: row.focus_ms,
    socialMs: row.social_ms,
    habitsDone: row.habits_done,
    habitsTarget: row.habits_target,
    updatedAt: row.updated_at,
  };
}

/** Every week of every member, newest week first. */
export function listMemberWeeks(): MemberWeek[] {
  return rowsAs<MemberWeekRow>(
    getDb().executeSync('SELECT * FROM member_weeks ORDER BY week_key DESC, member_id'),
  ).map(toMemberWeek);
}

/** Replaces the week by (member, week): what a sync would do when a number changes. */
export function upsertMemberWeek(week: MemberWeek): void {
  getDb().executeSync(
    `INSERT INTO member_weeks
       (member_id, week_key, focus_ms, social_ms, habits_done, habits_target, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_id, week_key) DO UPDATE SET
       focus_ms = excluded.focus_ms,
       social_ms = excluded.social_ms,
       habits_done = excluded.habits_done,
       habits_target = excluded.habits_target,
       updated_at = excluded.updated_at`,
    [
      week.memberId,
      week.weekKey,
      week.focusMs,
      week.socialMs,
      week.habitsDone,
      week.habitsTarget,
      week.updatedAt,
    ],
  );
}

export function deleteWeeksByMember(memberId: string): void {
  getDb().executeSync('DELETE FROM member_weeks WHERE member_id = ?', [memberId]);
}

// --- Kudos -------------------------------------------------------------------------

type KudosRow = {
  id: string;
  from_id: string;
  to_id: string;
  day_key: string;
  created_at: number;
};

function toKudos(row: KudosRow): Kudos {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    dayKey: row.day_key,
    createdAt: row.created_at,
  };
}

/** Every kudos, oldest first. */
export function listKudos(): Kudos[] {
  return rowsAs<KudosRow>(
    getDb().executeSync('SELECT * FROM kudos ORDER BY day_key, created_at, id'),
  ).map(toKudos);
}

/**
 * Records a kudos. INSERT OR IGNORE plus the UNIQUE index is what makes "once a day"
 * hold even if the store's cache is behind.
 */
export function insertKudos(kudos: Kudos): void {
  getDb().executeSync(
    `INSERT OR IGNORE INTO kudos
       (id, from_id, to_id, day_key, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [kudos.id, kudos.fromId, kudos.toId, kudos.dayKey, kudos.createdAt],
  );
}

/** Both directions: what they sent and what they received. */
export function deleteKudosByMember(memberId: string): void {
  getDb().executeSync('DELETE FROM kudos WHERE from_id = ? OR to_id = ?', [memberId, memberId]);
}

// --- Nudges ------------------------------------------------------------------------

type NudgeRow = {
  id: string;
  from_id: string;
  to_id: string;
  challenge_id: string;
  day_key: string;
  created_at: number;
};

function toNudge(row: NudgeRow): Nudge {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    challengeId: row.challenge_id,
    dayKey: row.day_key,
    createdAt: row.created_at,
  };
}

/** Every nudge, oldest first. */
export function listNudges(): Nudge[] {
  return rowsAs<NudgeRow>(
    getDb().executeSync('SELECT * FROM nudges ORDER BY day_key, created_at, id'),
  ).map(toNudge);
}

/** Records a nudge. "Once a day" is the store's rule; the table has no UNIQUE for it. */
export function insertNudge(nudge: Nudge): void {
  getDb().executeSync(
    `INSERT INTO nudges
       (id, from_id, to_id, challenge_id, day_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nudge.id, nudge.fromId, nudge.toId, nudge.challengeId, nudge.dayKey, nudge.createdAt],
  );
}

/** Both directions: what they sent and what they received. */
export function deleteNudgesOf(memberId: string): void {
  getDb().executeSync('DELETE FROM nudges WHERE from_id = ? OR to_id = ?', [memberId, memberId]);
}

// --- Challenges --------------------------------------------------------------------

type ChallengeRow = {
  id: string;
  name: string;
  weekly_target: number;
  start_week_key: string;
  end_week_key: string;
  /** NULL for a challenge with no end. Missing on a row written before 007. */
  end_day_key?: string | null;
  created_by: string;
  participant_ids: string;
  habit_id: string | null;
  created_at: number;
  archived_at: number | null;
};

/** A JSON array of strings. Anything malformed reads as nobody, never as a throw. */
export function parseParticipantIds(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    name: row.name,
    weeklyTarget: row.weekly_target,
    startWeekKey: row.start_week_key,
    endDayKey: row.end_day_key ?? null,
    createdBy: row.created_by,
    participantIds: parseParticipantIds(row.participant_ids),
    habitId: row.habit_id,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

/** Every challenge, archived ones included, oldest first. */
export function listChallenges(): Challenge[] {
  return rowsAs<ChallengeRow>(
    getDb().executeSync('SELECT * FROM challenges ORDER BY created_at, id'),
  ).map(toChallenge);
}

/**
 * The Monday of the week holding the last day, for the legacy NOT NULL column that
 * nothing reads any more: the start week for a challenge with no end.
 */
export function legacyEndWeekKey(challenge: Pick<Challenge, 'startWeekKey' | 'endDayKey'>): string {
  return challenge.endDayKey === null ? challenge.startWeekKey : weekKeyOf(dayKeyStart(challenge.endDayKey));
}

/** Inserts or replaces the whole row by id; created_at stays on an update. */
export function upsertChallenge(challenge: Challenge): void {
  getDb().executeSync(
    `INSERT INTO challenges
       (id, name, weekly_target, start_week_key, end_week_key, end_day_key, created_by, participant_ids, habit_id, created_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       weekly_target = excluded.weekly_target,
       start_week_key = excluded.start_week_key,
       end_week_key = excluded.end_week_key,
       end_day_key = excluded.end_day_key,
       created_by = excluded.created_by,
       participant_ids = excluded.participant_ids,
       habit_id = excluded.habit_id,
       archived_at = excluded.archived_at`,
    [
      challenge.id,
      challenge.name,
      challenge.weeklyTarget,
      challenge.startWeekKey,
      legacyEndWeekKey(challenge),
      challenge.endDayKey,
      challenge.createdBy,
      JSON.stringify(challenge.participantIds),
      challenge.habitId,
      challenge.createdAt,
      challenge.archivedAt,
    ],
  );
}

/** Challenges are archived, never deleted: their marks are history. */
export function archiveChallenge(id: string, now: number): void {
  getDb().executeSync('UPDATE challenges SET archived_at = ? WHERE id = ?', [now, id]);
}

/** Archives every challenge still open. Leaving the circle. */
export function archiveAllChallenges(now: number): void {
  getDb().executeSync('UPDATE challenges SET archived_at = ? WHERE archived_at IS NULL', [now]);
}

// --- Challenge marks ---------------------------------------------------------------

type ChallengeMarkRow = {
  id: string;
  challenge_id: string;
  member_id: string;
  day_key: string;
  marked_at: number;
};

function toChallengeMark(row: ChallengeMarkRow): ChallengeMark {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    memberId: row.member_id,
    dayKey: row.day_key,
    markedAt: row.marked_at,
  };
}

/** Every mark of every challenge, oldest day first. */
export function listChallengeMarks(): ChallengeMark[] {
  return rowsAs<ChallengeMarkRow>(
    getDb().executeSync('SELECT * FROM challenge_marks ORDER BY day_key, id'),
  ).map(toChallengeMark);
}

/** One mark per (challenge, member, day); a repeat is ignored, like a habit mark. */
export function upsertChallengeMark(mark: ChallengeMark): void {
  getDb().executeSync(
    `INSERT OR IGNORE INTO challenge_marks
       (id, challenge_id, member_id, day_key, marked_at)
     VALUES (?, ?, ?, ?, ?)`,
    [mark.id, mark.challengeId, mark.memberId, mark.dayKey, mark.markedAt],
  );
}

export function deleteChallengeMarksByMember(memberId: string): void {
  getDb().executeSync('DELETE FROM challenge_marks WHERE member_id = ?', [memberId]);
}

// --- Leaving -----------------------------------------------------------------------

/**
 * Takes a person out of the circle in one transaction: their marks, kudos, nudges
 * and weeks, their member row, and the challenges they were in, rewritten without
 * them (the store hands those over). All or nothing: a person half removed would be
 * a ghost in a challenge.
 */
export function removeMemberEverywhere(memberId: string, challengesWithoutThem: readonly Challenge[]): void {
  transaction(() => {
    deleteChallengeMarksByMember(memberId);
    deleteKudosByMember(memberId);
    deleteNudgesOf(memberId);
    deleteWeeksByMember(memberId);
    removeMember(memberId);
    for (const challenge of challengesWithoutThem) {
      upsertChallenge(challenge);
    }
  });
}

/**
 * Empties the people tables: marks, kudos, nudges, weeks, members, children first.
 * The challenges stay, archived by the caller, and so do the profile and the share
 * preferences: leaving a circle is not forgetting who you are.
 */
export function clearAll(): void {
  const db = getDb();
  db.executeSync('DELETE FROM challenge_marks');
  db.executeSync('DELETE FROM kudos');
  db.executeSync('DELETE FROM nudges');
  db.executeSync('DELETE FROM member_weeks');
  db.executeSync('DELETE FROM circle_members');
}
