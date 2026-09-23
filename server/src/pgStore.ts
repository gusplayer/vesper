import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import type { Account, Challenge, Link, Store } from './store.ts';

/**
 * Postgres behind the same contract as the memory store (ADR-0033). Plain SQL on a
 * pool: the server does five things and all of them are rows with an owner, so a BaaS
 * would bring its SDK and its auth model to save two hundred lines.
 *
 * `bigint` comes back as a string from node-postgres, so every epoch is parsed here
 * and never leaks as text into the API.
 */

const { Pool } = pg;

function ms(value: unknown): number {
  return typeof value === 'string' ? Number(value) : Number(value ?? 0);
}

function msOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : ms(value);
}

type AccountRow = {
  id: string;
  secret_hash: string;
  name: string;
  handle: string;
  invite_code: string | null;
  push_token: string | null;
  time_zone: string | null;
  nudges_on: boolean;
  created_at: string;
  updated_at: string;
};

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    secretHash: row.secret_hash,
    name: row.name,
    handle: row.handle,
    inviteCode: row.invite_code,
    pushToken: row.push_token,
    timeZone: row.time_zone,
    nudgesOn: row.nudges_on,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
  };
}

export type PgStore = Store & { migrate(): Promise<void>; close(): Promise<void> };

export function createPgStore(connectionString: string): PgStore {
  const pool = new Pool({
    connectionString,
    // Neon and Railway both terminate TLS in front; a plain local Postgres has none.
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });

  const query = async <T>(text: string, values: unknown[] = []): Promise<T[]> => {
    const result = await pool.query(text, values);
    return result.rows as T[];
  };

  return {
    async migrate() {
      const path = fileURLToPath(new URL('./schema.sql', import.meta.url));
      await pool.query(await readFile(path, 'utf8'));
    },
    async close() {
      await pool.end();
    },

    async getAccount(id) {
      const rows = await query<AccountRow>('select * from accounts where id = $1', [id]);
      return rows[0] === undefined ? null : toAccount(rows[0]);
    },
    async getAccountByHandle(handle) {
      const rows = await query<AccountRow>('select * from accounts where handle = $1', [handle]);
      return rows[0] === undefined ? null : toAccount(rows[0]);
    },
    async getAccountByInviteCode(code) {
      const rows = await query<AccountRow>('select * from accounts where invite_code = $1', [code]);
      return rows[0] === undefined ? null : toAccount(rows[0]);
    },
    async putAccount(account) {
      await query(
        `insert into accounts (id, secret_hash, name, handle, invite_code, push_token, time_zone, nudges_on, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (id) do update set
           secret_hash = excluded.secret_hash, name = excluded.name, handle = excluded.handle,
           invite_code = excluded.invite_code, push_token = excluded.push_token,
           time_zone = excluded.time_zone, nudges_on = excluded.nudges_on, updated_at = excluded.updated_at`,
        [
          account.id,
          account.secretHash,
          account.name,
          account.handle,
          account.inviteCode,
          account.pushToken,
          account.timeZone,
          account.nudgesOn,
          account.createdAt,
          account.updatedAt,
        ],
      );
    },
    async deleteAccount(id) {
      // The cascades take the links, weeks, marks, cheers and nudges with it; a
      // challenge someone else made keeps running without this participant.
      await query(
        `update challenges set participant_ids = (
           select coalesce(jsonb_agg(value), '[]'::jsonb) from jsonb_array_elements(participant_ids)
           where value <> to_jsonb($1::text)
         ) where participant_ids @> to_jsonb($1::text)`,
        [id],
      );
      await query('delete from accounts where id = $1', [id]);
    },

    async getLink(ownerId, memberId) {
      const rows = await query<{ owner_id: string; member_id: string; status: Link['status']; created_at: string; updated_at: string }>(
        'select * from links where owner_id = $1 and member_id = $2',
        [ownerId, memberId],
      );
      const row = rows[0];
      return row === undefined
        ? null
        : {
            ownerId: row.owner_id,
            memberId: row.member_id,
            status: row.status,
            createdAt: ms(row.created_at),
            updatedAt: ms(row.updated_at),
          };
    },
    async putLink(link) {
      await query(
        `insert into links (owner_id, member_id, status, created_at, updated_at)
         values ($1,$2,$3,$4,$5)
         on conflict (owner_id, member_id) do update set status = excluded.status, updated_at = excluded.updated_at`,
        [link.ownerId, link.memberId, link.status, link.createdAt, link.updatedAt],
      );
    },
    async linksOf(id) {
      const rows = await query<{ owner_id: string; member_id: string; status: Link['status']; created_at: string; updated_at: string }>(
        'select * from links where owner_id = $1 or member_id = $1',
        [id],
      );
      return rows.map((row) => ({
        ownerId: row.owner_id,
        memberId: row.member_id,
        status: row.status,
        createdAt: ms(row.created_at),
        updatedAt: ms(row.updated_at),
      }));
    },

    async putWeek(week) {
      await query(
        `insert into weeks (account_id, week_key, focus_ms, social_ms, habits_done, habits_target, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (account_id, week_key) do update set
           focus_ms = excluded.focus_ms, social_ms = excluded.social_ms,
           habits_done = excluded.habits_done, habits_target = excluded.habits_target,
           updated_at = excluded.updated_at`,
        [week.accountId, week.weekKey, week.focusMs, week.socialMs, week.habitsDone, week.habitsTarget, week.updatedAt],
      );
    },
    async weeksOf(accountIds, since) {
      if (accountIds.length === 0) {
        return [];
      }
      const rows = await query<{ account_id: string; week_key: string; focus_ms: string | null; social_ms: string | null; habits_done: number | null; habits_target: number | null; updated_at: string }>(
        'select * from weeks where account_id = any($1) and updated_at > $2',
        [[...accountIds], since],
      );
      return rows.map((row) => ({
        accountId: row.account_id,
        weekKey: row.week_key,
        focusMs: msOrNull(row.focus_ms),
        socialMs: msOrNull(row.social_ms),
        habitsDone: row.habits_done,
        habitsTarget: row.habits_target,
        updatedAt: ms(row.updated_at),
      }));
    },

    async getChallenge(id) {
      const rows = await query<ChallengeRow>('select * from challenges where id = $1', [id]);
      return rows[0] === undefined ? null : toChallenge(rows[0]);
    },
    async putChallenge(challenge) {
      await query(
        `insert into challenges (id, created_by, name, weekly_target, start_week_key, end_day_key, participant_ids, archived_at, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (id) do update set
           name = excluded.name, weekly_target = excluded.weekly_target,
           start_week_key = excluded.start_week_key, end_day_key = excluded.end_day_key,
           participant_ids = excluded.participant_ids, archived_at = excluded.archived_at,
           updated_at = excluded.updated_at`,
        [
          challenge.id,
          challenge.createdBy,
          challenge.name,
          challenge.weeklyTarget,
          challenge.startWeekKey,
          challenge.endDayKey,
          JSON.stringify(challenge.participantIds),
          challenge.archivedAt,
          challenge.createdAt,
          challenge.updatedAt,
        ],
      );
    },
    async challengesOf(id, since) {
      const rows = await query<ChallengeRow>(
        `select * from challenges
         where updated_at > $2 and (created_by = $1 or participant_ids @> to_jsonb($1::text))`,
        [id, since],
      );
      return rows.map(toChallenge);
    },

    async putMark(mark) {
      await query(
        `insert into challenge_marks (challenge_id, account_id, day_key, updated_at)
         values ($1,$2,$3,$4)
         on conflict (challenge_id, account_id, day_key) do update set updated_at = excluded.updated_at`,
        [mark.challengeId, mark.accountId, mark.dayKey, mark.updatedAt],
      );
    },
    async deleteMark(mark) {
      await query(
        'delete from challenge_marks where challenge_id = $1 and account_id = $2 and day_key = $3',
        [mark.challengeId, mark.accountId, mark.dayKey],
      );
    },
    async marksOf(challengeIds, since) {
      if (challengeIds.length === 0) {
        return [];
      }
      const rows = await query<{ challenge_id: string; account_id: string; day_key: string; updated_at: string }>(
        'select * from challenge_marks where challenge_id = any($1) and updated_at > $2',
        [[...challengeIds], since],
      );
      return rows.map((row) => ({
        challengeId: row.challenge_id,
        accountId: row.account_id,
        dayKey: row.day_key,
        updatedAt: ms(row.updated_at),
      }));
    },

    async putKudos(kudos) {
      await query(
        `insert into kudos (id, from_id, to_id, day_key, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (from_id, to_id, day_key) do update set updated_at = excluded.updated_at`,
        [kudos.id, kudos.fromId, kudos.toId, kudos.dayKey, kudos.createdAt, kudos.updatedAt],
      );
    },
    async kudosFor(id, since) {
      const rows = await query<{ id: string; from_id: string; to_id: string; day_key: string; created_at: string; updated_at: string }>(
        'select * from kudos where updated_at > $2 and (to_id = $1 or from_id = $1)',
        [id, since],
      );
      return rows.map((row) => ({
        id: row.id,
        fromId: row.from_id,
        toId: row.to_id,
        dayKey: row.day_key,
        createdAt: ms(row.created_at),
        updatedAt: ms(row.updated_at),
      }));
    },

    async putNudge(nudge) {
      await query(
        `insert into nudges (id, from_id, to_id, challenge_id, day_key, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (from_id, to_id, challenge_id, day_key) do update set updated_at = excluded.updated_at`,
        [nudge.id, nudge.fromId, nudge.toId, nudge.challengeId, nudge.dayKey, nudge.createdAt, nudge.updatedAt],
      );
    },
    async nudgesFor(id, since) {
      const rows = await query<{ id: string; from_id: string; to_id: string; challenge_id: string; day_key: string; created_at: string; updated_at: string }>(
        'select * from nudges where updated_at > $2 and (to_id = $1 or from_id = $1)',
        [id, since],
      );
      return rows.map((row) => ({
        id: row.id,
        fromId: row.from_id,
        toId: row.to_id,
        challengeId: row.challenge_id,
        dayKey: row.day_key,
        createdAt: ms(row.created_at),
        updatedAt: ms(row.updated_at),
      }));
    },
  };
}

type ChallengeRow = {
  id: string;
  created_by: string;
  name: string;
  weekly_target: number;
  start_week_key: string;
  end_day_key: string | null;
  participant_ids: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    weeklyTarget: row.weekly_target,
    startWeekKey: row.start_week_key,
    endDayKey: row.end_day_key,
    participantIds: row.participant_ids,
    archivedAt: msOrNull(row.archived_at),
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
  };
}
