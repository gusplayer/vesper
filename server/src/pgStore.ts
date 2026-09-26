import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  ConflictError,
  isMediaOrigin,
  isPlatform,
  isReportAction,
  isReportReason,
  markSourceOf,
} from './store.ts';
import type {
  Account,
  BackupMeta,
  Challenge,
  CodePurpose,
  EndedLink,
  Link,
  Media,
  MediaWrap,
  Recovery,
  RecoveryCode,
  Report,
  Store,
} from './store.ts';

/**
 * Postgres behind the same contract as the memory store (ADR-0033). Plain SQL on a
 * pool: the server does five things and all of them are rows with an owner, so a BaaS
 * would bring its SDK and its auth model to save two hundred lines.
 *
 * `bigint` comes back as a string from node-postgres, so every epoch is parsed here
 * and never leaks as text into the API.
 */

const { Pool } = pg;

/** Loopback: a Postgres on the same machine speaks plaintext and has no certificate. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type TlsChoice = false | true | { ca: string };

/**
 * What TLS to ask for, and why it is never `rejectUnauthorized: false`.
 *
 * `ssl: true` reaches `tls.connect` untouched (pg/lib/connection.js hands the value over
 * and sets `servername` to the host), so the certificate is checked against Node's trust
 * store and against the hostname. Neon needs nothing else: it serves a certificate from
 * a public CA (ISRG / Let's Encrypt) that Node already carries.
 *
 * Turning the check off leaves the connection encrypted against someone listening and
 * wide open to anyone able to answer in the database's place — and since the connection
 * string carries its own password, answering in its place is how you collect it.
 *
 * `DATABASE_CA_CERT` is for the day the database sits behind a private CA; it is then
 * the only anchor trusted, which is stricter and not weaker.
 */
export function tlsFor(
  hostname: string,
  ca: string | undefined = process.env.DATABASE_CA_CERT,
): TlsChoice {
  if (LOOPBACK.has(hostname)) {
    return false;
  }
  const trimmed = ca?.trim();
  return trimmed === undefined || trimmed === '' ? true : { ca: trimmed };
}

/**
 * `sslmode` and friends in the URL win over the `ssl` option — node-postgres parses the
 * connection string last (`Object.assign({}, config, parse(connectionString))`), so a
 * `?sslmode=no-verify` inherited from a provider's copy button would silently undo the
 * decision above. Strip those, and only those.
 *
 * By hand, on the query string alone: `new URL(...).toString()` would re-encode the
 * password on its way through, and a password that arrives changed is an outage.
 */
export function withoutSslParams(connectionString: string): { url: string; hostname: string } {
  const hostname = new URL(connectionString).hostname;
  const mark = connectionString.indexOf('?');
  if (mark === -1) {
    return { url: connectionString, hostname };
  }
  const kept = connectionString
    .slice(mark + 1)
    .split('&')
    .filter((pair) => pair !== '' && !(pair.split('=')[0] ?? '').toLowerCase().startsWith('ssl'));
  const base = connectionString.slice(0, mark);
  return { url: kept.length === 0 ? base : `${base}?${kept.join('&')}`, hostname };
}

/** Postgres says 23505 for a unique violation, and names the constraint it broke. */
function asConflict(error: unknown): ConflictError | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== '23505') {
    return null;
  }
  if (constraint === 'accounts_invite_code_key') {
    return new ConflictError('inviteCode');
  }
  if (constraint === 'accounts_handle_key') {
    return new ConflictError('handle');
  }
  return null;
}

/** A unique violation of any constraint: the one `putRecovery` retries once on. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

/** The pair of an ended link in the fixed order `ended_links` keys on (a_id < b_id). */
export function pairOf(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

function ms(value: unknown): number {
  return typeof value === 'string' ? Number(value) : Number(value ?? 0);
}

function msOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : ms(value);
}

type AccountRow = {
  id: string;
  secret_hash: string;
  name: string | null;
  handle: string | null;
  invite_code: string | null;
  push_token: string | null;
  time_zone: string | null;
  nudges_on: boolean;
  platform: string | null;
  app_version: string | null;
  last_seen_at: string | null;
  box_key: string | null;
  box_key_id: string | null;
  banned_at: string | null;
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
    platform: isPlatform(row.platform) ? row.platform : null,
    appVersion: row.app_version,
    lastSeenAt: msOrNull(row.last_seen_at),
    boxKey: row.box_key ?? null,
    boxKeyId: row.box_key_id ?? null,
    bannedAt: msOrNull(row.banned_at),
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
  };
}

type MediaRow = {
  id: string;
  challenge_id: string;
  owner_id: string;
  day_key: string;
  width: number;
  height: number;
  origin: string;
  epk: string;
  caption_box: string | null;
  wraps: unknown;
  thumb_size: number;
  full_size: number;
  state: string;
  thumb_at: string | null;
  full_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  deleted_at: string | null;
};

/** jsonb comes back parsed; only the API writes it, but a row is read defensively. */
function toWraps(value: unknown): MediaWrap[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const { recipientId, keyId, box } = item as Record<string, unknown>;
    return typeof recipientId === 'string' && typeof keyId === 'string' && typeof box === 'string'
      ? [{ recipientId, keyId, box }]
      : [];
  });
}

function toMedia(row: MediaRow): Media {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    ownerId: row.owner_id,
    dayKey: row.day_key,
    width: row.width,
    height: row.height,
    origin: isMediaOrigin(row.origin) ? row.origin : 'library',
    epk: row.epk,
    captionBox: row.caption_box,
    wraps: toWraps(row.wraps),
    thumbSize: row.thumb_size,
    fullSize: row.full_size,
    state: row.state === 'ready' ? 'ready' : 'pending',
    thumbAt: msOrNull(row.thumb_at),
    fullAt: msOrNull(row.full_at),
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    expiresAt: ms(row.expires_at),
    deletedAt: msOrNull(row.deleted_at),
  };
}

type ReportRow = {
  id: string;
  media_id: string;
  reporter_id: string | null;
  owner_id: string;
  challenge_id: string;
  day_key: string;
  reason: string;
  note: string | null;
  content_key: string | null;
  created_at: string;
  resolved_at: string | null;
  action: string | null;
  preserved_until: string | null;
};

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    mediaId: row.media_id,
    reporterId: row.reporter_id,
    ownerId: row.owner_id,
    challengeId: row.challenge_id,
    dayKey: row.day_key,
    // The columns have checks; nothing else can be in them.
    reason: isReportReason(row.reason) ? row.reason : 'other',
    note: row.note,
    contentKey: row.content_key,
    createdAt: ms(row.created_at),
    resolvedAt: msOrNull(row.resolved_at),
    action: isReportAction(row.action) ? row.action : null,
    preservedUntil: msOrNull(row.preserved_until),
  };
}

/** The columns of `media`, in the order `putMediaReplacing` inserts them. */
const MEDIA_COLUMNS =
  'id, challenge_id, owner_id, day_key, width, height, origin, epk, caption_box, wraps, thumb_size, full_size, state, thumb_at, full_at, created_at, updated_at, expires_at, deleted_at';

function mediaValues(media: Media): unknown[] {
  return [
    media.id,
    media.challengeId,
    media.ownerId,
    media.dayKey,
    media.width,
    media.height,
    media.origin,
    media.epk,
    media.captionBox,
    JSON.stringify(media.wraps),
    media.thumbSize,
    media.fullSize,
    media.state,
    media.thumbAt,
    media.fullAt,
    media.createdAt,
    media.updatedAt,
    media.expiresAt,
    media.deletedAt,
  ];
}

type BackupMetaRow = {
  account_id: string;
  format: number;
  schema: number;
  platform: string;
  size: number;
  updated_at: string;
};

function toBackupMeta(row: BackupMetaRow): BackupMeta {
  return {
    accountId: row.account_id,
    format: row.format,
    schema: row.schema,
    // Only the API writes this column, and it writes one of the two.
    platform: row.platform === 'android' ? 'android' : 'ios',
    size: row.size,
    updatedAt: ms(row.updated_at),
  };
}

type RecoveryRow = {
  account_id: string;
  email: string;
  secret_enc: string;
  verified_at: string;
  updated_at: string;
};

function toRecovery(row: RecoveryRow): Recovery {
  return {
    accountId: row.account_id,
    email: row.email,
    secretEnc: row.secret_enc,
    verifiedAt: ms(row.verified_at),
    updatedAt: ms(row.updated_at),
  };
}

type RecoveryCodeRow = {
  purpose: string;
  subject: string;
  account_id: string | null;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  created_at: string;
};

function toRecoveryCode(row: RecoveryCodeRow): RecoveryCode {
  return {
    // The column has a check; nothing else can be in it.
    purpose: row.purpose === 'recover' ? 'recover' : 'verify',
    subject: row.subject,
    accountId: row.account_id,
    email: row.email,
    codeHash: row.code_hash,
    attempts: row.attempts,
    expiresAt: ms(row.expires_at),
    createdAt: ms(row.created_at),
  };
}

export type PgStore = Store & { migrate(): Promise<void>; close(): Promise<void> };

export function createPgStore(connectionString: string): PgStore {
  const { url, hostname } = withoutSslParams(connectionString);
  const pool = new Pool({ connectionString: url, ssl: tlsFor(hostname) });

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
      // `invite_code` is unique, so there is at most one row. The order and the limit are
      // what makes that true of the answer as well and not only of the intention: an
      // unordered `select *` picked whichever row Postgres reached first, which on a
      // database written before the constraint meant the code's owner and the account
      // that copied it took turns.
      const rows = await query<AccountRow>(
        'select * from accounts where invite_code = $1 order by created_at asc, id asc limit 1',
        [code],
      );
      return rows[0] === undefined ? null : toAccount(rows[0]);
    },
    async putAccount(account) {
      try {
        // `last_seen_at` goes in on the insert and never in the update: `touchAccount` is
        // its only writer afterwards, so a write that began from an older read of the
        // row cannot move it back.
        await query(
          // `banned_at` is in neither: `banAccount` is its one writer.
          `insert into accounts (id, secret_hash, name, handle, invite_code, push_token, time_zone, nudges_on, platform, app_version, last_seen_at, created_at, updated_at, box_key, box_key_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           on conflict (id) do update set
             secret_hash = excluded.secret_hash, name = excluded.name, handle = excluded.handle,
             invite_code = excluded.invite_code, push_token = excluded.push_token,
             time_zone = excluded.time_zone, nudges_on = excluded.nudges_on,
             platform = excluded.platform, app_version = excluded.app_version,
             box_key = excluded.box_key, box_key_id = excluded.box_key_id,
             updated_at = excluded.updated_at`,
          [
            account.id,
            account.secretHash,
            account.name,
            account.handle,
            account.inviteCode,
            account.pushToken,
            account.timeZone,
            account.nudgesOn,
            account.platform,
            account.appVersion,
            account.lastSeenAt,
            account.createdAt,
            account.updatedAt,
            account.boxKey,
            account.boxKeyId,
          ],
        );
      } catch (error) {
        // The unique constraints are the ones that decide, not the read before the
        // write: two phones can claim one code in the same millisecond and only one
        // insert lands. The loser gets a 409 instead of a 500.
        const conflict = asConflict(error);
        if (conflict !== null) {
          throw conflict;
        }
        throw error;
      }
    },
    async touchAccount(id, at) {
      await query(
        'update accounts set last_seen_at = $2 where id = $1 and (last_seen_at is null or last_seen_at < $2)',
        [id, at],
      );
    },
    async banAccount(id, at) {
      await query('update accounts set banned_at = $2 where id = $1 and banned_at is null', [id, at]);
    },
    async deleteAccount(id) {
      // The cascades take the links, weeks, marks, cheers, nudges, the backup and the
      // recovery email with its codes; a challenge someone else made keeps running
      // without this participant.
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
      // A new link between the two supersedes an end (ADR-0049).
      await query('delete from ended_links where a_id = $1 and b_id = $2', pairOf(link.ownerId, link.memberId));
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

    async endLink(a, b, at) {
      await query(
        'delete from links where (owner_id = $1 and member_id = $2) or (owner_id = $2 and member_id = $1)',
        [a, b],
      );
      await query(
        `insert into ended_links (a_id, b_id, ended_at) values ($1,$2,$3)
         on conflict (a_id, b_id) do update set ended_at = excluded.ended_at`,
        [...pairOf(a, b), at],
      );
    },
    async endedLinksOf(id, since) {
      const rows = await query<{ a_id: string; b_id: string; ended_at: string }>(
        'select * from ended_links where ended_at > $2 and (a_id = $1 or b_id = $1)',
        [id, since],
      );
      return rows.map(
        (row): EndedLink => ({ otherId: row.a_id === id ? row.b_id : row.a_id, endedAt: ms(row.ended_at) }),
      );
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
        `insert into challenges (id, created_by, name, weekly_target, start_week_key, end_day_key, participant_ids, archived_at, created_at, updated_at, photos)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do update set
           name = excluded.name, weekly_target = excluded.weekly_target,
           start_week_key = excluded.start_week_key, end_day_key = excluded.end_day_key,
           participant_ids = excluded.participant_ids, archived_at = excluded.archived_at,
           photos = excluded.photos, updated_at = excluded.updated_at`,
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
          challenge.photos,
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
        `insert into challenge_marks (challenge_id, account_id, day_key, source, updated_at)
         values ($1,$2,$3,$4,$5)
         on conflict (challenge_id, account_id, day_key)
           do update set source = excluded.source, updated_at = excluded.updated_at`,
        [mark.challengeId, mark.accountId, mark.dayKey, mark.source, mark.updatedAt],
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
      const rows = await query<{ challenge_id: string; account_id: string; day_key: string; source: string; updated_at: string }>(
        'select * from challenge_marks where challenge_id = any($1) and updated_at > $2',
        [[...challengeIds], since],
      );
      return rows.map((row) => ({
        challengeId: row.challenge_id,
        accountId: row.account_id,
        dayKey: row.day_key,
        source: markSourceOf(row.source),
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

    async putBackup(backup) {
      // A Buffer, because that is what node-postgres sends as bytea without asking:
      // a bare Uint8Array would depend on the driver's version to be read as bytes.
      await query(
        `insert into backups (account_id, data, format, schema, platform, size, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (account_id) do update set
           data = excluded.data, format = excluded.format, schema = excluded.schema,
           platform = excluded.platform, size = excluded.size, updated_at = excluded.updated_at`,
        [
          backup.accountId,
          Buffer.from(backup.data.buffer, backup.data.byteOffset, backup.data.byteLength),
          backup.format,
          backup.schema,
          backup.platform,
          backup.size,
          backup.updatedAt,
        ],
      );
    },
    async getBackup(accountId) {
      const rows = await query<BackupMetaRow & { data: Buffer }>(
        'select * from backups where account_id = $1',
        [accountId],
      );
      const row = rows[0];
      // bytea comes back as a Buffer, which is already a Uint8Array.
      return row === undefined ? null : { ...toBackupMeta(row), data: row.data };
    },
    async getBackupMeta(accountId) {
      const rows = await query<BackupMetaRow>(
        'select account_id, format, schema, platform, size, updated_at from backups where account_id = $1',
        [accountId],
      );
      return rows[0] === undefined ? null : toBackupMeta(rows[0]);
    },
    async deleteBackup(accountId) {
      await query('delete from backups where account_id = $1', [accountId]);
    },

    async getRecovery(accountId) {
      const rows = await query<RecoveryRow>('select * from recovery where account_id = $1', [accountId]);
      return rows[0] === undefined ? null : toRecovery(rows[0]);
    },
    async getRecoveryByEmail(email) {
      const rows = await query<RecoveryRow>('select * from recovery where email = $1', [email]);
      return rows[0] === undefined ? null : toRecovery(rows[0]);
    },
    async putRecovery(recovery) {
      // One transaction, so the email is never on two accounts and never on none halfway
      // through. Two accounts confirming one address in the same instant: the second
      // insert waits on the unique index, fails when the first commits, and the retry
      // finds the row it has to take the email from.
      for (let attempt = 0; ; attempt += 1) {
        const client = await pool.connect();
        try {
          await client.query('begin');
          await client.query('delete from recovery where email = $1 and account_id <> $2', [
            recovery.email,
            recovery.accountId,
          ]);
          await client.query(
            `insert into recovery (account_id, email, secret_enc, verified_at, updated_at)
             values ($1,$2,$3,$4,$5)
             on conflict (account_id) do update set
               email = excluded.email, secret_enc = excluded.secret_enc,
               verified_at = excluded.verified_at, updated_at = excluded.updated_at`,
            [recovery.accountId, recovery.email, recovery.secretEnc, recovery.verifiedAt, recovery.updatedAt],
          );
          await client.query('commit');
          return;
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
          if (attempt === 0 && isUniqueViolation(error)) {
            continue;
          }
          throw error;
        } finally {
          client.release();
        }
      }
    },
    async deleteRecovery(accountId) {
      await query('delete from recovery_codes where account_id = $1', [accountId]);
      await query('delete from recovery where account_id = $1', [accountId]);
    },

    async putRecoveryCode(code) {
      await query(
        `insert into recovery_codes (purpose, subject, account_id, email, code_hash, attempts, expires_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (purpose, subject) do update set
           account_id = excluded.account_id, email = excluded.email, code_hash = excluded.code_hash,
           attempts = excluded.attempts, expires_at = excluded.expires_at, created_at = excluded.created_at`,
        [
          code.purpose,
          code.subject,
          code.accountId,
          code.email,
          code.codeHash,
          code.attempts,
          code.expiresAt,
          code.createdAt,
        ],
      );
    },
    async getRecoveryCode(purpose: CodePurpose, subject: string) {
      const rows = await query<RecoveryCodeRow>(
        'select * from recovery_codes where purpose = $1 and subject = $2',
        [purpose, subject],
      );
      return rows[0] === undefined ? null : toRecoveryCode(rows[0]);
    },
    async spendRecoveryAttempt(purpose, subject, max) {
      // The count and the check in one statement: the row lock serialises parallel
      // guesses, and each one sees the attempts the previous one spent.
      const rows = await query<RecoveryCodeRow>(
        `update recovery_codes set attempts = attempts + 1
         where purpose = $1 and subject = $2 and attempts < $3
         returning *`,
        [purpose, subject, max],
      );
      return rows[0] === undefined ? null : toRecoveryCode(rows[0]);
    },
    async consumeRecoveryCode(purpose, subject, codeHash) {
      const rows = await query<{ subject: string }>(
        'delete from recovery_codes where purpose = $1 and subject = $2 and code_hash = $3 returning subject',
        [purpose, subject, codeHash],
      );
      return rows.length > 0;
    },
    async deleteExpiredRecoveryCodes(before) {
      await query('delete from recovery_codes where expires_at < $1', [before]);
    },

    async getMedia(id) {
      const rows = await query<MediaRow>('select * from media where id = $1', [id]);
      return rows[0] === undefined ? null : toMedia(rows[0]);
    },
    async putMediaReplacing(media) {
      // One transaction: the tombstone on yesterday's photo and today's row land together.
      // Two uploads for one day in the same instant: the second insert trips the partial
      // unique index once the first commits, and the retry tombstones what it finds.
      for (let attempt = 0; ; attempt += 1) {
        const client = await pool.connect();
        try {
          await client.query('begin');
          const replaced = await client.query(
            `update media set deleted_at = $5, updated_at = $5
             where challenge_id = $1 and owner_id = $2 and day_key = $3 and id <> $4 and deleted_at is null
             returning *`,
            [media.challengeId, media.ownerId, media.dayKey, media.id, media.updatedAt],
          );
          await client.query(
            `insert into media (${MEDIA_COLUMNS})
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             on conflict (id) do update set
               width = excluded.width, height = excluded.height, origin = excluded.origin,
               epk = excluded.epk, caption_box = excluded.caption_box, wraps = excluded.wraps,
               thumb_size = excluded.thumb_size, full_size = excluded.full_size,
               state = excluded.state, thumb_at = excluded.thumb_at, full_at = excluded.full_at,
               updated_at = excluded.updated_at, expires_at = excluded.expires_at`,
            mediaValues(media),
          );
          await client.query('commit');
          return (replaced.rows as MediaRow[]).map((row) => {
            // `returning *` hands the row after the update; the caller wants what it was.
            const was = toMedia(row);
            return { ...was, deletedAt: null };
          });
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
          if (attempt === 0 && isUniqueViolation(error)) {
            continue;
          }
          throw error;
        } finally {
          client.release();
        }
      }
    },
    async markMediaObject(id, variant, at) {
      // One statement, so the two uploads racing each other both see the other's column:
      // whichever lands second turns the row ready.
      const column = variant === 'thumb' ? 'thumb_at' : 'full_at';
      const other = variant === 'thumb' ? 'full_at' : 'thumb_at';
      const rows = await query<MediaRow>(
        `update media set ${column} = $2,
           state = case when ${other} is not null then 'ready' else state end,
           updated_at = case when state = 'pending' and ${other} is not null then $2 else updated_at end
         where id = $1 and deleted_at is null
         returning *`,
        [id, at],
      );
      return rows[0] === undefined ? null : toMedia(rows[0]);
    },
    async tombstoneMedia(ids, at) {
      if (ids.length === 0) {
        return [];
      }
      const rows = await query<MediaRow>(
        `update media set deleted_at = $2, updated_at = $2
         where id = any($1) and deleted_at is null
         returning *`,
        [[...new Set(ids)], at],
      );
      return rows.map((row) => ({ ...toMedia(row), deletedAt: null }));
    },
    async liveMedia(filter) {
      const conditions = ['deleted_at is null'];
      const values: unknown[] = [];
      if (filter.ownerId !== undefined) {
        values.push(filter.ownerId);
        conditions.push(`owner_id = $${values.length}`);
      }
      if (filter.challengeId !== undefined) {
        values.push(filter.challengeId);
        conditions.push(`challenge_id = $${values.length}`);
      }
      const rows = await query<MediaRow>(`select * from media where ${conditions.join(' and ')}`, values);
      return rows.map(toMedia);
    },
    async mediaChangedFor(viewerId, since) {
      const rows = await query<MediaRow>(
        `select * from media
         where updated_at > $2
           and (state = 'ready' or deleted_at is not null)
           and (owner_id = $1 or wraps @> $3::jsonb)`,
        [viewerId, since, JSON.stringify([{ recipientId: viewerId }])],
      );
      return rows.map(toMedia);
    },
    async expiredMedia(at) {
      const rows = await query<MediaRow>(
        'select * from media where deleted_at is null and expires_at <= $1',
        [at],
      );
      return rows.map(toMedia);
    },
    async stalePendingMedia(before) {
      const rows = await query<MediaRow>(
        `select * from media where deleted_at is null and state = 'pending' and created_at < $1`,
        [before],
      );
      return rows.map(toMedia);
    },
    async deleteMediaRows(ids) {
      if (ids.length === 0) {
        return;
      }
      await query('delete from media where id = any($1)', [[...ids]]);
    },
    async purgeMediaTombstones(before) {
      const rows = await query<{ id: string }>(
        'delete from media where deleted_at is not null and deleted_at < $1 returning id',
        [before],
      );
      return rows.length;
    },
    async liveMediaIds(ids) {
      if (ids.length === 0) {
        return new Set();
      }
      const rows = await query<{ id: string }>(
        'select id from media where id = any($1) and deleted_at is null',
        [[...ids]],
      );
      return new Set(rows.map((row) => row.id));
    },

    async putReport(report) {
      // A second report by the same person on the same photo trips
      // `reports_one_per_reporter` and writes nothing: the first one stands.
      const rows = await query<{ id: string }>(
        `insert into reports (id, media_id, reporter_id, owner_id, challenge_id, day_key, reason, note, content_key, created_at, resolved_at, action, preserved_until)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         on conflict (id) do update set
           content_key = excluded.content_key, resolved_at = excluded.resolved_at,
           action = excluded.action, preserved_until = excluded.preserved_until
         returning id`,
        [
          report.id,
          report.mediaId,
          report.reporterId,
          report.ownerId,
          report.challengeId,
          report.dayKey,
          report.reason,
          report.note,
          report.contentKey,
          report.createdAt,
          report.resolvedAt,
          report.action,
          report.preservedUntil,
        ],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          return [];
        }
        throw error;
      });
      return rows.length > 0;
    },
    async getReport(id) {
      const rows = await query<ReportRow>('select * from reports where id = $1', [id]);
      return rows[0] === undefined ? null : toReport(rows[0]);
    },
    async findReport(reporterId, mediaId) {
      const rows = await query<ReportRow>(
        'select * from reports where reporter_id = $1 and media_id = $2',
        [reporterId, mediaId],
      );
      return rows[0] === undefined ? null : toReport(rows[0]);
    },
    async listReports(limit) {
      const rows = await query<ReportRow>(
        `select * from reports
         order by (resolved_at is not null) asc, created_at desc, id desc
         limit $1`,
        [limit],
      );
      return rows.map(toReport);
    },
    async expiredPreservedReports(at) {
      const rows = await query<ReportRow>(
        'select * from reports where preserved_until is not null and preserved_until <= $1',
        [at],
      );
      return rows.map(toReport);
    },
    async staleResolvedReports(before) {
      const rows = await query<ReportRow>(
        `select * from reports
         where resolved_at is not null and preserved_until is null and resolved_at < $1`,
        [before],
      );
      return rows.map(toReport);
    },
    async deleteReports(ids) {
      if (ids.length === 0) {
        return;
      }
      await query('delete from reports where id = any($1)', [[...ids]]);
    },
    async heldReportIds(ids, at) {
      if (ids.length === 0) {
        return new Set();
      }
      const rows = await query<{ id: string }>(
        `select id from reports
         where id = any($1) and (resolved_at is null or (preserved_until is not null and preserved_until > $2))`,
        [[...ids], at],
      );
      return new Set(rows.map((row) => row.id));
    },

    async putBlock(blockerId, blockedId, at) {
      await query(
        `insert into blocks (blocker_id, blocked_id, created_at) values ($1,$2,$3)
         on conflict (blocker_id, blocked_id) do nothing`,
        [blockerId, blockedId, at],
      );
    },
    async blockedWith(id) {
      const rows = await query<{ blocker_id: string; blocked_id: string }>(
        'select blocker_id, blocked_id from blocks where blocker_id = $1 or blocked_id = $1',
        [id],
      );
      return new Set(rows.map((row) => (row.blocker_id === id ? row.blocked_id : row.blocker_id)));
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
  photos: boolean | null;
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
    photos: row.photos !== false,
    archivedAt: msOrNull(row.archived_at),
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
  };
}
