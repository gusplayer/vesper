import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';
import type { Context } from 'hono';

import {
  credentialsFrom,
  hashSecret,
  isUuidV7,
  newSecret,
  normalizeHandle,
  secretMatches,
} from './auth.ts';
import { derivesFrom, normalizeInviteCode } from './invite.ts';
import { localeOf, type Mailer } from './mailer.ts';
import {
  base64Bytes,
  isChallengeDay,
  isRecentDay,
  keyIdOf,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  mediaExpiresAt,
  mediaObjectKey,
  mediaPrefix,
  openPhoto,
  parseMediaUpload,
  parsePublicKey,
  remoteMediaFor,
  reportPrefix,
  URL_TTL_MS,
} from './media.ts';
import { createMemoryObjectStore, LOCAL_MEDIA_PATH, type ObjectStore } from './objectStore.ts';
import type { Push } from './push.ts';
import { createRateLimiter } from './rateLimit.ts';
import {
  CODE_ATTEMPTS,
  CODE_TTL_MS,
  codeKey,
  codeMatches,
  hashCode,
  isRecoveryKey,
  newCode,
  normalizeCode,
  normalizeEmail,
  openSecret,
  sealSecret,
} from './recovery.ts';
import { ConflictError, isMediaVariant, isPlatform, isReportAction, isReportReason } from './store.ts';
import {
  markSourceOf,
  type Account,
  type Challenge,
  type ChallengeMark,
  type CodePurpose,
  type Kudos,
  type Media,
  type MediaVariant,
  type Nudge,
  type RecoveryCode,
  type Store,
  type Week,
} from './store.ts';

/**
 * The circle's API (ADR-0033). Five verbs and one sync, over rows that each have an
 * owner: the server's whole job is to check that a caller writes only what is theirs
 * and to hand back what the people in their circle wrote.
 *
 * What it never receives in the clear: sessions, intentions, modes, apps, anything from
 * Screen Time or Health. The phone aggregates; this takes totals (ADR-0004, ADR-0005,
 * ADR-0021). Since ADR-0048 it also keeps one opaque blob per account, `PUT /backup`:
 * the phone's database, encrypted on the phone with a key derived from its secret. The
 * server stores those bytes and cannot read them, and nothing here tries.
 *
 * Since ADR-0048 an account is also the person's identity, born on first launch with no
 * name and no handle. Such an account has nothing social: it is nobody's member and it
 * cannot redeem, accept or join until it claims a handle through `POST /account`.
 *
 * Since ADR-0050 it may also keep a recovery email, and with it a copy of the account's
 * secret sealed under a key that is not in the database (`/recovery/*`, recovery.ts).
 *
 * Since ADR-0051 it carries the photos of a challenge, end to end encrypted: rows here,
 * bytes in a bucket (`/media*`), both unreadable to the server. It opens one photo only
 * when a participant reports it and hands over that photo's key (`/report`, `/admin/*`).
 */

export type Deps = {
  store: Store;
  push: Push;
  /** Injected so the tests can hold time still. */
  now: () => number;
  /**
   * Who sends the recovery codes (ADR-0050). Null when `RESEND_API_KEY` or
   * `RECOVERY_FROM` is missing: every `/recovery` route that mails or reads a code then
   * answers `503 email not configured`, and the phone says it is not available yet.
   */
  mailer: Mailer | null;
  /**
   * `RECOVERY_KEY`, 32 bytes: what seals the recovery copy of each secret and what the
   * codes are hashed under. Null, or any other length, is the same 503. Rotating a secret
   * needs this alone, not the mailer.
   */
  recoveryKey: Uint8Array | null;
  /**
   * The bucket the photos' bytes live in (ADR-0051 §17). The memory one when absent,
   * which serves its own five-minute URLs at `GET /media-local/:token`.
   */
  objects?: ObjectStore;
  /**
   * `ADMIN_TOKEN`: what the moderation routes (`/admin/*`) take as `Bearer`. Null, absent
   * or shorter than 32 characters and those routes answer 404, as if they did not exist.
   */
  adminToken?: string | null;
};

type Authed = {
  account: Account;
  /**
   * `lastSeenAt` as it was before this request touched it (ADR-0050 §9). A phone that
   * finds an identity in the keychain asks `GET /account` when that identity was last
   * used; answering with the touch this very request made would always say "just now".
   */
  seenBefore: number | null;
};

/** node-server hands the raw request through `c.env`; nothing else uses it. */
type Bindings = { incoming?: { socket?: { remoteAddress?: string } } };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The budgets, in calls per hour, per address and per account.
 *
 * `redeem` is the one that matters: a code is six symbols out of an alphabet of 32, so
 * there are 32^6 ≈ 1.07 billion of them. At 10 guesses an hour per account and 30 per
 * address, reaching a one-in-a-hundred chance of hitting any single code takes around
 * forty years — and every guess costs an account, which costs the address one of its ten
 * creations. A person who was actually invited types one code, maybe twice.
 *
 * The rest are shaped by what the phone does: a sync every twenty seconds is already
 * more than the app asks for, and accepting or joining is a tap.
 */
const LIMITS = {
  /** Every call to `/account`, including the renames and the handle check. */
  accountPerIp: { limit: 30, windowMs: HOUR },
  /** New accounts only. Each one is a fresh identity, which is what guessing needs. */
  newAccountPerIp: { limit: 10, windowMs: HOUR },
  redeemPerAccount: { limit: 10, windowMs: HOUR },
  redeemPerIp: { limit: 30, windowMs: HOUR },
  acceptPerAccount: { limit: 60, windowMs: HOUR },
  joinPerAccount: { limit: 60, windowMs: HOUR },
  devicePerAccount: { limit: 60, windowMs: HOUR },
  syncPerAccount: { limit: 180, windowMs: HOUR },
  /**
   * A new phone rotates once, when it restores (ADR-0048). A caller rotating in a loop
   * is not restoring anything.
   */
  rotatePerAccount: { limit: 10, windowMs: HOUR },
  /**
   * Ending a link and leaving a challenge (ADR-0049) are taps, like accepting: at most
   * twelve people and five challenges, so sixty an hour is room for every retry.
   */
  endPerAccount: { limit: 60, windowMs: HOUR },
  /**
   * Uploads of the encrypted backup (ADR-0048 §7). The phone sends one when a session
   * closes and at most once a day otherwise, and each can be five megabytes: thirty an
   * hour is room for a busy afternoon, not for filling a disk.
   */
  backupPerAccount: { limit: 30, windowMs: HOUR },
  /**
   * Downloads of it. A new phone downloads once when it restores, maybe twice after a
   * failed decrypt; five megabytes a call is the cost the budget is for.
   */
  backupReadPerAccount: { limit: 30, windowMs: HOUR },
  /**
   * Pushes one person may cause on another. A nudge is allowed once a day per challenge
   * by ADR-0027, but the row upserts, so without this the same nudge re-synced is a
   * notification every time.
   *
   * Spent only when there is a token to send to: a phone with none gets nothing anyway
   * (push.ts), and charging for it would let a silent target eat a real one's allowance.
   */
  pushPerPair: { limit: 5, windowMs: HOUR },
  /**
   * Codes to confirm a recovery address (ADR-0050). A person types one address, maybe
   * twice with a typo in between.
   */
  recoveryEmailPerAccount: { limit: 5, windowMs: HOUR },
  /**
   * Asking for a code to recover. Nobody is signed in, so it is counted by address and by
   * the email asked for — known or not, so that the budget says nothing about which.
   */
  recoveryStartPerIp: { limit: 10, windowMs: HOUR },
  recoveryStartPerEmail: { limit: 5, windowMs: HOUR },
  /**
   * Trying a code to recover. Each code already dies after five wrong tries; this is the
   * address trying many emails.
   */
  recoveryFinishPerIp: { limit: 30, windowMs: HOUR },
  /**
   * Every message to one mailbox, whichever route asked for it. Vesper is not a way to
   * fill someone's inbox, and it caps guessing at ten codes a day for one email.
   */
  mailPerEmail: { limit: 10, windowMs: DAY },
  /**
   * Photos (ADR-0051). One per challenge and day, replaceable: five challenges and a few
   * second thoughts are well under sixty. Each has two uploads.
   */
  mediaPerAccount: { limit: 60, windowMs: HOUR },
  mediaPutPerAccount: { limit: 120, windowMs: HOUR },
  /**
   * Download URLs, one per object. The album of a finished challenge of twelve people
   * over three weeks is some 250 thumbnails, opened once and cached on the phone.
   */
  mediaUrlPerAccount: { limit: 1200, windowMs: HOUR },
  mediaDeletePerAccount: { limit: 60, windowMs: HOUR },
  /** Reports are expected to be zero (ADR-0051); twenty an hour is not a person. */
  reportPerAccount: { limit: 20, windowMs: HOUR },
  /** Wrong admin tokens from one address. The token is long; this keeps it that way. */
  adminFailPerIp: { limit: 20, windowMs: HOUR },
};

/** Lengths. Nothing a caller writes reaches the database without one. */
const MAX_NAME = 40;
const MAX_TIME_ZONE = 64;
const MAX_PUSH_TOKEN = 256;
const MAX_CHALLENGE_NAME = 60;
/** Rows of one kind in one sync. A phone's real batch is a handful. */
const MAX_ROWS = 500;
/** '1.4.0 (212)' is eleven characters. */
const MAX_APP_VERSION = 32;
/**
 * One encrypted backup. Years of use fit in under a megabyte (ADR-0048 §7); five is the
 * room for a heavy user, and the line past which the blob stops belonging in Postgres.
 */
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
/** How stale `lastSeenAt` may get before a request writes it again: one write an hour. */
const SEEN_EVERY_MS = HOUR;
/** How long an expired code still answers 410 before it is swept away. */
const EXPIRED_CODE_KEPT_MS = DAY;
/** How long a moderator's preserved report is kept: a year, what the REPORT Act asks. */
export const PRESERVE_MS = 365 * DAY;
/** A report's note, the reporter's words. */
const MAX_REPORT_NOTE = 200;
/** An admin token shorter than this is a mistake, and is treated as none. */
const MIN_ADMIN_TOKEN = 32;
/** Reports one listing hands back; open ones come first. */
const ADMIN_LIST_LIMIT = 200;

/** The routes nobody signs in to call. Everything else needs `Authorization`. */
const PUBLIC = new Set(['POST /account', 'POST /recovery/start', 'POST /recovery/finish']);

/** 'YYYY-MM-DD', which is what both a day key and a week key are (domain/day.ts). */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** Printable ASCII, no spaces: what an Expo token, an APNs one and an FCM one all are. */
const PUSH_TOKEN = /^[\x21-\x7e]+$/;
/** IANA zone names: 'America/Bogota', 'UTC', 'Etc/GMT+5'. */
const TIME_ZONE = /^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)*$/;
/** Printable ASCII, spaces allowed: '1.4.0 (212)'. */
const APP_VERSION = /^[\x20-\x7e]+$/;
/** A positive integer as a header carries it, without leading zeros or a sign. */
const POSITIVE_INT = /^[1-9][0-9]{0,8}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A non-empty string no longer than `max`, trimmed. Every caller states its `max`. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const clean = value.trim();
  return clean === '' || clean.length > max ? null : clean;
}

/** An id the phone made: UUID v7 and nothing else, for accounts and for rows alike. */
function id(value: unknown): string | null {
  return isUuidV7(value) ? value : null;
}

function dateKey(value: unknown): string | null {
  const clean = str(value, 10);
  return clean !== null && DATE_KEY.test(clean) ? clean : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The address the edge saw. Railway's proxy appends the real one to `x-forwarded-for`,
 * so the **last** entry is the one it wrote and everything before it is whatever the
 * caller decided to claim; reading the first would let a header buy a fresh budget.
 * With no proxy the socket answers, and a request with neither is counted as one caller.
 */
function clientIp(c: Context<{ Variables: Authed; Bindings: Bindings }>): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded !== undefined && forwarded.trim() !== '') {
    const hops = forwarded.split(',');
    const last = hops[hops.length - 1]?.trim();
    if (last !== undefined && last !== '') {
      return last;
    }
  }
  return c.env?.incoming?.socket?.remoteAddress ?? 'unknown';
}

/**
 * The body as bytes, or 'too large' as soon as it passes `max`. Counted while reading,
 * not after: a chunked upload has no Content-Length to check first, and waiting for the
 * whole thing before counting is holding in memory whatever a caller decides to send.
 */
async function readCapped(request: Request, max: number): Promise<Uint8Array | 'too large'> {
  if (request.body === null) {
    return new Uint8Array(0);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return 'too large';
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** A positive integer header, or null when it is missing or anything else. */
function positiveIntHeader(value: string | undefined): number | null {
  return value !== undefined && POSITIVE_INT.test(value.trim()) ? Number(value.trim()) : null;
}

/** An error's message for a log line, never its stack or its payload. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

export function createApp(deps: Deps) {
  const { store, push, now } = deps;
  const objects = deps.objects ?? createMemoryObjectStore(now);
  const adminToken =
    typeof deps.adminToken === 'string' && deps.adminToken.length >= MIN_ADMIN_TOKEN ? deps.adminToken : null;
  const app = new Hono<{ Variables: Authed; Bindings: Bindings }>();
  const limiter = createRateLimiter(now);

  // A key of any other length is a misconfiguration, and it answers like a missing one.
  const recoveryKey = isRecoveryKey(deps.recoveryKey) ? deps.recoveryKey : null;
  const recovery =
    deps.mailer !== null && recoveryKey !== null
      ? { mailer: deps.mailer, key: recoveryKey, codeSecret: codeKey(recoveryKey) }
      : null;

  /** True when the call fits its budget. `over` turns the refusal into a 429. */
  const fits = (key: string, rule: { limit: number; windowMs: number }): boolean =>
    limiter.take(key, rule.limit, rule.windowMs);

  const over = (
    c: Context<{ Variables: Authed; Bindings: Bindings }>,
    rule: { windowMs: number },
  ) =>
    c.json({ error: 'too many requests' }, 429, {
      'Retry-After': String(Math.ceil(rule.windowMs / 1000)),
    });

  /**
   * A bare identity asking for something social (ADR-0048). Without a handle there is
   * nothing to show the other person — a push names its sender by handle, a challenge
   * shows handles — so the phone claims one through `POST /account` first. 409 and not
   * 403: the caller may, once the account is in the right state.
   */
  const handleRequired = (c: Context<{ Variables: Authed; Bindings: Bindings }>) =>
    c.json({ error: 'handle required' }, 409);

  /**
   * Deletes the two objects of each photo. A failure is logged and not raised: the row is
   * what the phones see, and the weekly reconciliation deletes any object left without a
   * live row.
   */
  const dropObjects = async (rows: readonly Media[]): Promise<void> => {
    if (rows.length === 0) {
      return;
    }
    const keys = rows.flatMap((row) => [mediaObjectKey(row, 'thumb'), mediaObjectKey(row, 'full')]);
    try {
      await objects.delete(keys);
    } catch (error) {
      console.warn(`photo objects not deleted, the reconciliation will: ${messageOf(error)}`);
    }
  };

  /** Tombstones the live photos among `ids` and deletes their objects. How many went. */
  const tombstone = async (ids: readonly string[], at: number): Promise<number> => {
    const gone = await store.tombstoneMedia(ids, at);
    await dropObjects(gone);
    return gone.length;
  };

  /** The live photos of these people in one challenge, as tombstones (ADR-0051). */
  const tombstonePhotosOf = async (
    challengeId: string,
    ownerIds: readonly string[],
    at: number,
  ): Promise<void> => {
    const owners = new Set(ownerIds);
    const rows = await store.liveMedia({ challengeId });
    await tombstone(
      rows.filter((row) => owners.has(row.ownerId)).map((row) => row.id),
      at,
    );
  };

  /**
   * Ending links (ADR-0049), shared by `/link/end` and `/block`: both directions go, and
   * each person leaves the challenges the other one made, their photos in them with them
   * (ADR-0051). Challenges a third person made keep both. `record` writes the end for the
   * other phone to learn; a block between two people with no link writes none, since an
   * end recorded for a stranger would hand them the caller's id.
   */
  const endLinksWith = async (
    meId: string,
    others: readonly string[],
    at: number,
    record: boolean,
  ): Promise<void> => {
    if (record) {
      for (const otherId of others) {
        await store.endLink(meId, otherId, at);
      }
    }
    const gone = new Set(others);
    for (const challenge of await store.challengesOf(meId, 0)) {
      const leaving =
        challenge.createdBy === meId
          ? challenge.participantIds.filter((participant) => gone.has(participant))
          : gone.has(challenge.createdBy)
            ? [meId]
            : [];
      if (leaving.length === 0) {
        continue;
      }
      const participantIds = challenge.participantIds.filter((participant) => !leaving.includes(participant));
      if (participantIds.length !== challenge.participantIds.length) {
        await store.putChallenge({ ...challenge, participantIds, updatedAt: at });
      }
      // Whether or not they were still listed: a retry after a lost answer finishes this.
      await tombstonePhotosOf(challenge.id, leaving, at);
    }
  };

  /** Everything but `POST /account` needs a device that proves it owns its id. */
  const authenticate = async (header: string | undefined): Promise<Account | null> => {
    const credentials = credentialsFrom(header);
    if (credentials === null) {
      return null;
    }
    const account = await store.getAccount(credentials.id);
    if (account === null || !secretMatches(credentials.secret, account.secretHash)) {
      return null;
    }
    return account;
  };

  app.use('*', async (c, next) => {
    // The moderation routes check their own token, and a local media URL is its own
    // credential, like a presigned one: neither carries an account.
    if (
      PUBLIC.has(`${c.req.method} ${c.req.path}`) ||
      c.req.path === '/health' ||
      c.req.path.startsWith('/admin/') ||
      c.req.path.startsWith(LOCAL_MEDIA_PATH)
    ) {
      return next();
    }
    const account = await authenticate(c.req.header('Authorization'));
    if (account === null) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('seenBefore', account.lastSeenAt);
    // "When did we last see them" is the one question it answers (ADR-0048 §3), and an
    // hour is enough resolution for it: a sync every twenty seconds would otherwise be a
    // write every twenty seconds on the hottest row there is.
    //
    // Only what a phone does counts as use, never what it reads. A new iPad that found
    // this identity reads `GET /backup/meta` and `GET /account` to ask whether the other
    // device still uses it (ADR-0050 §9); counting those reads would answer "just now"
    // about itself.
    const at = now();
    const acts = c.req.method !== 'GET';
    if (acts && (account.lastSeenAt === null || at - account.lastSeenAt >= SEEN_EVERY_MS)) {
      await store.touchAccount(account.id, at);
      c.set('account', { ...account, lastSeenAt: at });
    } else {
      c.set('account', account);
    }
    return next();
  });

  app.get('/health', (c) => c.json({ ok: true }));

  /**
   * First call of a phone: it picks its own id (UUID v7, like everything else) and the
   * server hands back the secret it will keep in the keychain. Calling it again with
   * the same id and the right secret updates the profile, so a renamed handle is one
   * call and not a second concept.
   *
   * Since ADR-0048 the first call usually carries the id alone: the identity is born on
   * first launch, before the person has chosen to be anyone in a circle. The name and
   * the handle come later, through this same call with the secret, and they come
   * together — half a profile is not one.
   */
  app.post('/account', async (c) => {
    const ip = clientIp(c);
    if (!fits(`account:${ip}`, LIMITS.accountPerIp)) {
      return over(c, LIMITS.accountPerIp);
    }
    const body: unknown = await c.req.json().catch(() => null);
    if (!isObject(body)) {
      return c.json({ error: 'bad request' }, 400);
    }
    const accountId = id(body.id);

    const bare = (body.name ?? null) === null && (body.handle ?? null) === null;
    if (accountId !== null && bare) {
      // A code is how someone enters this account's circle, and without a handle there
      // is no circle to enter.
      if ((body.inviteCode ?? null) !== null) {
        return c.json({ error: 'inviteCode needs a name and a handle' }, 400);
      }
      const existing = await store.getAccount(accountId);
      if (existing === null) {
        // The same budget as any new account: a bare identity is just as good for
        // guessing codes once it claims a handle.
        if (!fits(`account:new:${ip}`, LIMITS.newAccountPerIp)) {
          return over(c, LIMITS.newAccountPerIp);
        }
        const secret = newSecret();
        const at = now();
        await store.putAccount({
          id: accountId,
          secretHash: hashSecret(secret),
          name: null,
          handle: null,
          inviteCode: null,
          pushToken: null,
          timeZone: null,
          nudgesOn: true,
          platform: null,
          appVersion: null,
          lastSeenAt: at,
          boxKey: null,
          boxKeyId: null,
          bannedAt: null,
          createdAt: at,
          updatedAt: at,
        });
        return c.json({ id: accountId, secret, handle: null }, 201);
      }
      // Registering again, with the secret, is a phone that was not sure the first call
      // landed. Nothing is written: a bare body never takes a profile away.
      const account = await authenticate(c.req.header('Authorization'));
      if (account === null || account.id !== accountId) {
        return c.json({ error: 'unauthorized' }, 401);
      }
      return c.json({ id: accountId, handle: account.handle });
    }

    const name = str(body.name, MAX_NAME);
    const handle = normalizeHandle(typeof body.handle === 'string' ? body.handle : '');
    if (accountId === null || name === null || handle === null) {
      return c.json(
        {
          error:
            'id must be a UUID v7; name is 1 to 40 characters; handle is [a-z0-9_]{3,20}',
        },
        400,
      );
    }

    // Absent leaves the code as it is, explicit null gives it up, a string claims one.
    // A claim has to be a code this account can actually show: the phone derives it from
    // the id of its circle profile, and that profile id is this account id (invite.ts).
    // Without the check, anyone who read a code off a screen, a QR or a `/join?code=`
    // link could register it as theirs and answer for its owner.
    let inviteCode: string | null = null;
    const existing = await store.getAccount(accountId);
    if (body.inviteCode === undefined) {
      inviteCode = existing?.inviteCode ?? null;
    } else if (body.inviteCode !== null) {
      const claimed =
        typeof body.inviteCode === 'string' ? normalizeInviteCode(body.inviteCode) : null;
      if (claimed === null) {
        return c.json({ error: 'inviteCode is six symbols of [A-HJ-NP-Z2-9]' }, 400);
      }
      const generation = typeof body.codeGeneration === 'number' ? body.codeGeneration : undefined;
      if (!derivesFrom(accountId, claimed, generation)) {
        return c.json({ error: 'inviteCode does not derive from this id' }, 400);
      }
      inviteCode = claimed;
    }

    const taken = await store.getAccountByHandle(handle);
    if (taken !== null && taken.id !== accountId) {
      // The alias is public by design — it is what a challenge shows instead of a name
      // (ADR-0032 §4) — so this says nothing that being in a circle would not. What it
      // does allow is asking, one alias at a time, which ones exist; the budget above is
      // what keeps that from becoming a list. See server/README.md.
      return c.json({ error: 'handle taken' }, 409);
    }
    if (inviteCode !== null) {
      const holder = await store.getAccountByInviteCode(inviteCode);
      if (holder !== null && holder.id !== accountId) {
        return c.json({ error: 'invite code taken' }, 409);
      }
    }

    const write = async (account: Account): Promise<Response | null> => {
      try {
        await store.putAccount(account);
        return null;
      } catch (error) {
        // Two phones can claim one code in the same millisecond: the database decides.
        if (error instanceof ConflictError) {
          return c.json(
            { error: error.field === 'handle' ? 'handle taken' : 'invite code taken' },
            409,
          );
        }
        throw error;
      }
    };

    if (existing === null) {
      if (!fits(`account:new:${ip}`, LIMITS.newAccountPerIp)) {
        return over(c, LIMITS.newAccountPerIp);
      }
      const secret = newSecret();
      const at = now();
      const conflict = await write({
        id: accountId,
        secretHash: hashSecret(secret),
        name,
        handle,
        inviteCode,
        pushToken: null,
        timeZone: null,
        nudgesOn: true,
        platform: null,
        appVersion: null,
        lastSeenAt: at,
        boxKey: null,
        boxKeyId: null,
        bannedAt: null,
        createdAt: at,
        updatedAt: at,
      });
      return conflict ?? c.json({ id: accountId, secret, handle }, 201);
    }

    // This is also how a bare identity claims its circle profile (ADR-0048): same call,
    // same checks, and its handle goes from null to the one it asked for.
    const account = await authenticate(c.req.header('Authorization'));
    if (account === null || account.id !== accountId) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const conflict = await write({ ...account, name, handle, inviteCode, updatedAt: now() });
    return conflict ?? c.json({ id: accountId, handle });
  });

  /**
   * The caller's own profile, for a phone that just proved it holds the key (ADR-0048):
   * a new phone knows the id and the secret and nothing else, and needs the name, the
   * handle and the invite code before it can show the circle as the same person. Never
   * the secret's hash nor the push token: the first is not the phone's to read, the
   * second belongs to whichever phone registered it. A bare identity answers with name
   * and handle null, which is how the new phone knows there is no circle to rebuild.
   */
  app.get('/account', async (c) => {
    const account = c.get('account');
    const escrow = await store.getRecovery(account.id);
    return c.json({
      id: account.id,
      name: account.name,
      handle: account.handle,
      inviteCode: account.inviteCode,
      timeZone: account.timeZone,
      nudgesOn: account.nudgesOn,
      createdAt: account.createdAt,
      // ADR-0050 §9: whether the Vesper found in the keychain is still in use elsewhere.
      // The last time it was seen before this call, and on which system.
      lastSeenAt: c.get('seenBefore'),
      platform: account.platform,
      recoveryEmail: escrow?.email ?? null,
    });
  });

  /**
   * A new secret for the same account, and the old one stops working (ADR-0048). A phone
   * calls this right after restoring with the backup key: the phone that was lost or
   * sold still holds the old secret, and restoring is the moment to shut it out. The
   * secret is handed back once, like on creation. The push token is dropped with it,
   * because it points at the old phone; the new one registers its own.
   */
  app.post('/account/secret', async (c) => {
    const account = c.get('account');
    if (!fits(`rotate:${account.id}`, LIMITS.rotatePerAccount)) {
      return over(c, LIMITS.rotatePerAccount);
    }
    const secret = newSecret();
    // The box key goes too (ADR-0051): it was derived from the old secret, which the lost
    // phone still holds. Nobody wraps a new photo for it; the new phone publishes its own
    // through `POST /device` right after, having opened what it could with the old one.
    await store.putAccount({
      ...account,
      secretHash: hashSecret(secret),
      pushToken: null,
      boxKey: null,
      boxKeyId: null,
      updatedAt: now(),
    });
    // The recovery copy follows the secret (ADR-0050 §2), or it would hand back one that
    // no longer opens anything. Without the key the new one cannot be sealed, and a copy
    // of a dead secret is worse than none: the email goes, and Ajustes offers it again.
    const escrow = await store.getRecovery(account.id);
    if (escrow !== null) {
      if (recoveryKey !== null) {
        await store.putRecovery({
          ...escrow,
          secretEnc: sealSecret(recoveryKey, account.id, secret),
          updatedAt: now(),
        });
      } else {
        console.warn(`no RECOVERY_KEY: the recovery email of ${account.id} went with its old secret`);
        await store.deleteRecovery(account.id);
      }
    }
    return c.json({ id: account.id, secret });
  });

  /**
   * Leaving for good: the account and every row of it, its backup and its recovery email
   * too. No soft delete.
   *
   * And its photos (ADR-0051): everything under `m/<id>/` in the bucket, and the photos
   * other people shared in the challenges it made, whose rows go with those challenges.
   * Other phones are not told: each one expires its copies on its own. A report on one of
   * its photos stays, evidence and all, until a moderator resolves it.
   */
  app.delete('/account', async (c) => {
    const me = c.get('account');
    try {
      const made = (await store.challengesOf(me.id, 0)).filter((challenge) => challenge.createdBy === me.id);
      for (const challenge of made) {
        await dropObjects(await store.liveMedia({ challengeId: challenge.id }));
      }
      await objects.deletePrefix(mediaPrefix(me.id));
    } catch (error) {
      // The rows go regardless; the weekly reconciliation finds objects left without one.
      console.warn(`photos of a deleted account left in the bucket: ${messageOf(error)}`);
    }
    await store.deleteAccount(me.id);
    return c.body(null, 204);
  });

  /**
   * The encrypted backup (ADR-0048 §7): one per account, and each upload replaces it.
   * The body is ciphertext the phone made with a key derived from its secret, so the
   * server keeps bytes it cannot read and does not try to — no parsing, no checks on
   * what is inside, nothing logged. The three headers are the only things it reads,
   * and they are what a new phone needs to decide whether it can open the bytes at all.
   */
  app.put('/backup', async (c) => {
    const account = c.get('account');
    if (!fits(`backup:${account.id}`, LIMITS.backupPerAccount)) {
      return over(c, LIMITS.backupPerAccount);
    }
    const format = positiveIntHeader(c.req.header('X-Backup-Format'));
    const schema = positiveIntHeader(c.req.header('X-Backup-Schema'));
    const platform = c.req.header('X-Backup-Platform')?.trim();
    if (format === null || schema === null || !isPlatform(platform)) {
      return c.json(
        {
          error:
            "X-Backup-Format and X-Backup-Schema are positive integers; X-Backup-Platform is 'ios' or 'android'",
        },
        400,
      );
    }
    // The header first, when there is one: a body announced as too large is refused
    // before a byte of it is read. Then the bytes themselves, counted as they arrive,
    // because a header is only what the caller says.
    const declared = c.req.header('Content-Length');
    if (declared !== undefined && Number(declared) > MAX_BACKUP_BYTES) {
      return c.json({ error: 'backup too large' }, 413);
    }
    const data = await readCapped(c.req.raw, MAX_BACKUP_BYTES);
    if (data === 'too large') {
      return c.json({ error: 'backup too large' }, 413);
    }
    if (data.byteLength === 0) {
      return c.json({ error: 'empty backup' }, 400);
    }
    const updatedAt = now();
    await store.putBackup({
      accountId: account.id,
      data,
      format,
      schema,
      platform,
      size: data.byteLength,
      updatedAt,
    });
    return c.json({ updatedAt, size: data.byteLength });
  });

  /** The bytes back, exactly as they came, with what was said about them. */
  app.get('/backup', async (c) => {
    const account = c.get('account');
    if (!fits(`backup:read:${account.id}`, LIMITS.backupReadPerAccount)) {
      return over(c, LIMITS.backupReadPerAccount);
    }
    const backup = await store.getBackup(account.id);
    if (backup === null) {
      return c.json({ error: 'no backup' }, 404);
    }
    return c.body(new Uint8Array(backup.data), 200, {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Backup-Format': String(backup.format),
      'X-Backup-Schema': String(backup.schema),
      'X-Backup-Platform': backup.platform,
      'X-Backup-Updated-At': String(backup.updatedAt),
    });
  });

  /**
   * When the last backup was made and what it is, without its bytes: what Ajustes shows
   * under the switch, and what a new phone asks before it downloads five megabytes.
   */
  app.get('/backup/meta', async (c) => {
    const meta = await store.getBackupMeta(c.get('account').id);
    if (meta === null) {
      return c.json({ error: 'no backup' }, 404);
    }
    return c.json({
      updatedAt: meta.updatedAt,
      size: meta.size,
      schema: meta.schema,
      platform: meta.platform,
      format: meta.format,
    });
  });

  /**
   * Turning the backup off (ADR-0048 §7). Off means no copy anywhere, not "no new
   * copies": the last one would otherwise sit here until the account is deleted, which
   * is not what a person who flipped the switch asked for. 204 whether or not there was
   * one, so a retry after a lost answer is the same request.
   */
  app.delete('/backup', async (c) => {
    await store.deleteBackup(c.get('account').id);
    return c.body(null, 204);
  });

  // --- The recovery email (ADR-0050) ----------------------------------------------------

  const notConfigured = (c: Context<{ Variables: Authed; Bindings: Bindings }>) =>
    c.json({ error: 'email not configured' }, 503);

  const wrongCode = (c: Context<{ Variables: Authed; Bindings: Bindings }>) =>
    c.json({ error: 'wrong code' }, 400);

  /**
   * One try at a code: the code as it stood if the digits were right, or why not. The
   * attempt is spent before the digits are compared, in one step at the store, so parallel
   * guesses each count. A code that already spent its five answers 'burned' until it
   * expires or a new one replaces it; the right digits no longer help.
   */
  const tryCode = async (
    codeSecret: Uint8Array,
    purpose: CodePurpose,
    subject: string,
    typed: string,
  ): Promise<RecoveryCode | 'wrong' | 'expired' | 'burned'> => {
    const at = now();
    const spent = await store.spendRecoveryAttempt(purpose, subject, CODE_ATTEMPTS);
    if (spent === null) {
      const code = await store.getRecoveryCode(purpose, subject);
      if (code === null) {
        return 'wrong';
      }
      return code.expiresAt <= at ? 'expired' : 'burned';
    }
    if (spent.expiresAt <= at) {
      return 'expired';
    }
    if (!codeMatches(hashCode(codeSecret, purpose, subject, typed), spent.codeHash)) {
      return 'wrong';
    }
    // Single use: of two right answers in flight, one gets it.
    return (await store.consumeRecoveryCode(purpose, subject, spent.codeHash)) ? spent : 'wrong';
  };

  const refuseCode = (
    c: Context<{ Variables: Authed; Bindings: Bindings }>,
    outcome: 'wrong' | 'expired' | 'burned',
  ) =>
    outcome === 'expired'
      ? c.json({ error: 'code expired' }, 410)
      : outcome === 'burned'
        ? c.json({ error: 'too many attempts' }, 429)
        : wrongCode(c);

  /**
   * Ajustes › Respaldo › Correo de recuperación, step one: a code to the address, to
   * prove the person reads it. Nothing is stored as theirs until the code comes back.
   * This one waits for the provider, so the phone can say when a message did not leave.
   */
  app.post('/recovery/email', async (c) => {
    if (recovery === null) {
      return notConfigured(c);
    }
    const account = c.get('account');
    const body: unknown = await c.req.json().catch(() => null);
    const email = isObject(body) ? normalizeEmail(body.email) : null;
    if (email === null || !isObject(body)) {
      return c.json({ error: 'bad email' }, 400);
    }
    // After the shape: the budget counts codes asked for, and a typo caught here sends none.
    if (!fits(`recovery:email:${account.id}`, LIMITS.recoveryEmailPerAccount)) {
      return over(c, LIMITS.recoveryEmailPerAccount);
    }
    if (!fits(`mail:${email}`, LIMITS.mailPerEmail)) {
      return over(c, LIMITS.mailPerEmail);
    }
    const code = newCode();
    const at = now();
    await store.putRecoveryCode({
      purpose: 'verify',
      subject: account.id,
      accountId: account.id,
      email,
      codeHash: hashCode(recovery.codeSecret, 'verify', account.id, code),
      attempts: 0,
      expiresAt: at + CODE_TTL_MS,
      createdAt: at,
    });
    try {
      await recovery.mailer.send({ to: email, code, purpose: 'verify', locale: localeOf(body.locale) });
    } catch (error) {
      console.warn(`recovery mail failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return c.json({ error: 'email not sent' }, 502);
    }
    return c.json({ sent: true }, 202);
  });

  /**
   * Step two: the code back. The address becomes the account's, and the secret this very
   * request authenticated with is sealed beside it (ADR-0050 §2). If another account had
   * the address, it loses it: whoever confirms it controls the mailbox (§6).
   */
  app.post('/recovery/email/verify', async (c) => {
    if (recovery === null) {
      return notConfigured(c);
    }
    const account = c.get('account');
    const body: unknown = await c.req.json().catch(() => null);
    const typed = isObject(body) ? normalizeCode(body.code) : null;
    if (typed === null) {
      return wrongCode(c);
    }
    const outcome = await tryCode(recovery.codeSecret, 'verify', account.id, typed);
    if (typeof outcome === 'string') {
      return refuseCode(c, outcome);
    }
    // The middleware authenticated with exactly this header.
    const credentials = credentialsFrom(c.req.header('Authorization'));
    if (credentials === null) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const at = now();
    await store.putRecovery({
      accountId: account.id,
      email: outcome.email,
      secretEnc: sealSecret(recovery.key, account.id, credentials.secret),
      verifiedAt: at,
      updatedAt: at,
    });
    return c.json({ email: outcome.email });
  });

  /**
   * Removing it (ADR-0050 §1): the address, the sealed secret and any code in flight.
   * 204 whether or not there was one. It works without the mail configured: taking your
   * data back never waits on a provider.
   */
  app.delete('/recovery/email', async (c) => {
    await store.deleteRecovery(c.get('account').id);
    return c.body(null, 204);
  });

  /**
   * "Recuperar con mi correo", step one, with nobody signed in. **It answers the same
   * whether or not an account has the email** (ADR-0050 §4): a code row is written either
   * way, so the next step fails alike, and the message goes out only for a verified
   * address — without waiting for it, so the answer takes the same time too.
   */
  app.post('/recovery/start', async (c) => {
    if (recovery === null) {
      return notConfigured(c);
    }
    if (!fits(`recovery:start:ip:${clientIp(c)}`, LIMITS.recoveryStartPerIp)) {
      return over(c, LIMITS.recoveryStartPerIp);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const email = isObject(body) ? normalizeEmail(body.email) : null;
    if (email === null || !isObject(body)) {
      return c.json({ error: 'bad email' }, 400);
    }
    if (!fits(`recovery:start:email:${email}`, LIMITS.recoveryStartPerEmail)) {
      return over(c, LIMITS.recoveryStartPerEmail);
    }
    if (!fits(`mail:${email}`, LIMITS.mailPerEmail)) {
      return over(c, LIMITS.mailPerEmail);
    }
    const at = now();
    await store.deleteExpiredRecoveryCodes(at - EXPIRED_CODE_KEPT_MS);
    const holder = await store.getRecoveryByEmail(email);
    const code = newCode();
    await store.putRecoveryCode({
      purpose: 'recover',
      subject: email,
      accountId: holder?.accountId ?? null,
      email,
      codeHash: hashCode(recovery.codeSecret, 'recover', email, code),
      attempts: 0,
      expiresAt: at + CODE_TTL_MS,
      createdAt: at,
    });
    if (holder !== null) {
      void recovery.mailer
        .send({ to: email, code, purpose: 'recover', locale: localeOf(body.locale) })
        .catch((error: unknown) => {
          console.warn(`recovery mail failed: ${error instanceof Error ? error.message : 'unknown'}`);
        });
    }
    return c.json({ sent: true }, 202);
  });

  /**
   * Step two: the email and the code, and back comes the identity — `{ id, secret }`, the
   * secret that opens the backup — for the phone to restore as with a key (ADR-0050 §3).
   * An email nobody has answers `wrong code`, like a wrong code, down to the path it takes.
   */
  app.post('/recovery/finish', async (c) => {
    if (recovery === null) {
      return notConfigured(c);
    }
    if (!fits(`recovery:finish:ip:${clientIp(c)}`, LIMITS.recoveryFinishPerIp)) {
      return over(c, LIMITS.recoveryFinishPerIp);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const email = isObject(body) ? normalizeEmail(body.email) : null;
    if (email === null) {
      return c.json({ error: 'bad email' }, 400);
    }
    const typed = isObject(body) ? normalizeCode(body.code) : null;
    if (typed === null) {
      return wrongCode(c);
    }
    const outcome = await tryCode(recovery.codeSecret, 'recover', email, typed);
    if (typeof outcome === 'string') {
      return refuseCode(c, outcome);
    }
    // The address must still be that account's: it may have moved or gone since the code
    // was sent. A row with no account behind it is an email nobody has.
    const escrow = outcome.accountId === null ? null : await store.getRecovery(outcome.accountId);
    const account = escrow === null ? null : await store.getAccount(escrow.accountId);
    if (escrow === null || account === null || escrow.email !== email) {
      return wrongCode(c);
    }
    const secret = openSecret(recovery.key, escrow.accountId, escrow.secretEnc);
    if (secret === null || !secretMatches(secret, account.secretHash)) {
      // Another RECOVERY_KEY than the one that sealed it, or a copy that missed a
      // rotation. Nothing the phone can fix; the person confirms the email again.
      console.error(`the recovery copy of ${escrow.accountId} does not open its account`);
      return c.json({ error: 'escrow unreadable' }, 500);
    }
    return c.json({ id: escrow.accountId, secret });
  });

  /**
   * Where a push goes and when it is allowed. `nudgesOn` is the receiver's switch from
   * Ajustes › Círculo: the server asks nobody else before sending.
   *
   * Also which system and which version of the app the identity runs (ADR-0048 §3),
   * which a phone without a circle reports and nothing else. Every field is optional,
   * and an absent one keeps what the account had: that is what lets that report leave
   * the push token alone. An explicit `pushToken: null` is what withdraws it.
   */
  app.post('/device', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isObject(body)) {
      return c.json({ error: 'bad request' }, 400);
    }
    const account = c.get('account');
    if (!fits(`device:${account.id}`, LIMITS.devicePerAccount)) {
      return over(c, LIMITS.devicePerAccount);
    }
    const token = str(body.pushToken, MAX_PUSH_TOKEN);
    if (body.pushToken !== undefined && body.pushToken !== null && token === null) {
      return c.json({ error: 'pushToken is too long or empty' }, 400);
    }
    if (token !== null && !PUSH_TOKEN.test(token)) {
      return c.json({ error: 'pushToken is not a token' }, 400);
    }
    const zone = str(body.timeZone, MAX_TIME_ZONE);
    if (body.timeZone !== undefined && (zone === null || !TIME_ZONE.test(zone))) {
      return c.json({ error: 'timeZone is not an IANA name' }, 400);
    }
    if (body.platform !== undefined && !isPlatform(body.platform)) {
      return c.json({ error: "platform is 'ios' or 'android'" }, 400);
    }
    const version = str(body.appVersion, MAX_APP_VERSION);
    if (body.appVersion !== undefined && (version === null || !APP_VERSION.test(version))) {
      return c.json({ error: 'appVersion is 1 to 32 printable characters' }, 400);
    }
    // The public half of the box key (ADR-0051): what the others wrap a photo's key for.
    // Absent keeps it; null withdraws it; anything else is exactly 32 bytes of base64.
    let boxKey = account.boxKey;
    let boxKeyId = account.boxKeyId;
    if (body.boxKey !== undefined) {
      const parsed = body.boxKey === null ? null : parsePublicKey(body.boxKey);
      if (body.boxKey !== null && parsed === null) {
        return c.json({ error: 'boxKey is 32 bytes of base64' }, 400);
      }
      boxKey = parsed;
      boxKeyId = parsed === null ? null : keyIdOf(parsed);
    }
    await store.putAccount({
      ...account,
      pushToken: body.pushToken === undefined ? account.pushToken : token,
      timeZone: zone ?? account.timeZone,
      nudgesOn: typeof body.nudgesOn === 'boolean' ? body.nudgesOn : account.nudgesOn,
      platform: isPlatform(body.platform) ? body.platform : account.platform,
      appVersion: version ?? account.appVersion,
      boxKey,
      boxKeyId,
      updatedAt: now(),
    });
    return c.json({ ok: true });
  });

  /**
   * A code is a request, not a key (ADR-0021 addendum): redeeming it leaves the caller
   * pending in the other person's circle, and they decide. A forwarded link cannot put
   * a stranger in anyone's circle.
   */
  app.post('/invite/redeem', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (me.bannedAt !== null) {
      return c.json({ error: 'banned' }, 403);
    }
    // Guessing is what this endpoint is exposed to, so it is counted twice: the account
    // is what a guess is made with, the address is what accounts are made from.
    if (!fits(`redeem:${me.id}`, LIMITS.redeemPerAccount)) {
      return over(c, LIMITS.redeemPerAccount);
    }
    if (!fits(`redeem:${clientIp(c)}`, LIMITS.redeemPerIp)) {
      return over(c, LIMITS.redeemPerIp);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const code =
      isObject(body) && typeof body.code === 'string' ? normalizeInviteCode(body.code) : null;
    if (code === null) {
      return c.json({ error: 'code is six symbols of [A-HJ-NP-Z2-9]' }, 400);
    }
    const owner = await store.getAccountByInviteCode(code);
    // A block works both ways, and it answers like a code nobody has: the blocked person
    // is not told they were blocked (ADR-0051 §18).
    if (owner === null || (await store.blockedWith(me.id)).has(owner.id)) {
      return c.json({ error: 'unknown code' }, 404);
    }
    if (owner.id === me.id) {
      return c.json({ error: 'own code' }, 409);
    }
    const existing = await store.getLink(owner.id, me.id);
    if (existing?.status === 'member') {
      return c.json({ ok: true, status: 'member' });
    }
    await store.putLink({
      ownerId: owner.id,
      memberId: me.id,
      status: 'pending',
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    });
    // Redeeming again is how one caller could wake the same person over and over. The
    // link is already written either way, and the message itself carries no text of
    // theirs to show: it is silent and data only (push.ts, ADR-0037).
    if (owner.pushToken !== null && fits(`push:${me.id}:${owner.id}`, LIMITS.pushPerPair)) {
      await push.send(owner, {
        data: { kind: 'invite', from: me.id, fromHandle: me.handle, at: String(now()) },
      });
    }
    return c.json({ ok: true, status: 'pending' });
  });

  /** Accepting is what makes it mutual: both directions become 'member' at once. */
  app.post('/invite/accept', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (me.bannedAt !== null) {
      return c.json({ error: 'banned' }, 403);
    }
    if (!fits(`accept:${me.id}`, LIMITS.acceptPerAccount)) {
      return over(c, LIMITS.acceptPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const memberId = isObject(body) ? id(body.memberId) : null;
    if (memberId === null) {
      return c.json({ error: 'memberId must be a UUID v7' }, 400);
    }
    const pending = await store.getLink(me.id, memberId);
    if (pending === null) {
      return c.json({ error: 'no request from that person' }, 404);
    }
    const other = await store.getAccount(memberId);
    if (other === null) {
      return c.json({ error: 'no request from that person' }, 404);
    }
    await store.putLink({ ...pending, status: 'member', updatedAt: now() });
    const back = await store.getLink(memberId, me.id);
    await store.putLink({
      ownerId: memberId,
      memberId: me.id,
      status: 'member',
      createdAt: back?.createdAt ?? now(),
      updatedAt: now(),
    });
    if (other.pushToken !== null && fits(`push:${me.id}:${other.id}`, LIMITS.pushPerPair)) {
      await push.send(other, {
        data: { kind: 'accepted', from: me.id, fromHandle: me.handle, at: String(now()) },
      });
    }
    return c.json({ ok: true });
  });

  /**
   * Joining a challenge someone else made. The server only checks that the caller is in
   * the circle of whoever created it: a challenge is not public (that is ADR-0032).
   */
  app.post('/challenge/join', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (!fits(`join:${me.id}`, LIMITS.joinPerAccount)) {
      return over(c, LIMITS.joinPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const challengeId = isObject(body) ? id(body.challengeId) : null;
    if (challengeId === null) {
      return c.json({ error: 'challengeId must be a UUID v7' }, 400);
    }
    const challenge = await store.getChallenge(challengeId);
    if (challenge === null || challenge.archivedAt !== null) {
      return c.json({ error: 'unknown challenge' }, 404);
    }
    const link = await store.getLink(challenge.createdBy, me.id);
    if (challenge.createdBy !== me.id && link?.status !== 'member') {
      return c.json({ error: 'not in that circle' }, 403);
    }
    if (!challenge.participantIds.includes(me.id)) {
      await store.putChallenge({
        ...challenge,
        participantIds: [...challenge.participantIds, me.id],
        updatedAt: now(),
      });
    }
    return c.json({ ok: true });
  });

  /**
   * Ending a link (ADR-0049): Rechazar, Quitar, and — with `everyone: true` — Salir del
   * círculo. Both directions go, whatever their status, and each person leaves the
   * challenges the other one made: a challenge is among people in a circle, and a mark
   * that kept flowing to someone you removed is the "still sees you" this call exists to
   * end. Challenges a third person made keep both, because both are still in theirs.
   *
   * It answers 200 for any well-formed body, including a link that is already gone: the
   * phone retries after a lost answer, and a 404 is how it tells a server that does not
   * have this call yet (deployed before ADR-0049) from one that does.
   */
  app.post('/link/end', async (c) => {
    const me = c.get('account');
    if (!fits(`end:${me.id}`, LIMITS.endPerAccount)) {
      return over(c, LIMITS.endPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const everyone = isObject(body) && body.everyone === true;
    const memberId = isObject(body) ? id(body.memberId) : null;
    let others: string[];
    if (everyone) {
      const links = await store.linksOf(me.id);
      others = [...new Set(links.map((link) => (link.ownerId === me.id ? link.memberId : link.ownerId)))];
    } else if (memberId === null || memberId === me.id) {
      return c.json({ error: 'memberId must be a UUID v7 other than yours, or everyone: true' }, 400);
    } else {
      // Only a pair that has a link ends: an end recorded for a stranger would hand that
      // stranger the caller's id at their next sync.
      const linked =
        (await store.getLink(me.id, memberId)) !== null || (await store.getLink(memberId, me.id)) !== null;
      others = linked ? [memberId] : [];
    }
    if (others.length === 0) {
      return c.json({ ok: true, ended: 0 });
    }
    await endLinksWith(me.id, others, now(), true);
    return c.json({ ok: true, ended: others.length });
  });

  /**
   * Leaving a challenge (ADR-0049), "Salir del reto": the caller stops being a
   * participant, so nobody sees them in it and nobody can nudge them in it. Their marks
   * stay as rows but stop showing, because a standing is drawn for participants only.
   * The maker may leave their own challenge too; it keeps running for the others.
   *
   * Like `/link/end`, a well-formed body always answers 200: a challenge already left,
   * or gone, is the state the caller asked for.
   */
  app.post('/challenge/leave', async (c) => {
    const me = c.get('account');
    if (!fits(`end:${me.id}`, LIMITS.endPerAccount)) {
      return over(c, LIMITS.endPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const challengeId = isObject(body) ? id(body.challengeId) : null;
    if (challengeId === null) {
      return c.json({ error: 'challengeId must be a UUID v7' }, 400);
    }
    const challenge = await store.getChallenge(challengeId);
    const at = now();
    if (challenge !== null && challenge.participantIds.includes(me.id)) {
      await store.putChallenge({
        ...challenge,
        participantIds: challenge.participantIds.filter((participant) => participant !== me.id),
        updatedAt: at,
      });
    }
    // Their photos in it go too, as tombstones the others' phones learn at their next
    // sync (ADR-0051). Outside the `if`, so a retry after a lost answer finishes the job.
    if (challenge !== null) {
      await tombstonePhotosOf(challenge.id, [me.id], at);
    }
    return c.json({ ok: true });
  });

  /**
   * One trip: the phone pushes the rows it owns and changed, and pulls everything the
   * people in its circle changed after `since`. `now` comes back as the next cursor.
   *
   * Every write is forced to the caller: a week is theirs, a mark is theirs, a cheer
   * and a nudge come from them. Nothing here trusts an id in the body.
   */
  app.post('/sync', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isObject(body)) {
      return c.json({ error: 'bad request' }, 400);
    }
    const me = c.get('account');
    if (!fits(`sync:${me.id}`, LIMITS.syncPerAccount)) {
      return over(c, LIMITS.syncPerAccount);
    }
    const at = now();
    const since = num(body.since) ?? 0;
    const rejected: string[] = [];

    // One sync is one phone's batch, not a bulk load. A body that claims otherwise is
    // refused whole rather than half written.
    for (const field of ['weeks', 'challenges', 'marks', 'kudos', 'nudges'] as const) {
      const rows = body[field];
      if (Array.isArray(rows) && rows.length > MAX_ROWS) {
        return c.json({ error: `too many ${field}: at most ${MAX_ROWS} per sync` }, 400);
      }
    }

    // A bare identity has nothing social to write (ADR-0048). Nobody's circle would see
    // its weeks, and the server keeps no totals of someone who does not use the circle
    // (§3); a challenge, a mark, a cheer and a nudge all show it to someone by a handle
    // it does not have. The sync still answers, as empty as its circle.
    const rowsOf = (field: 'weeks' | 'challenges' | 'marks' | 'kudos' | 'nudges'): unknown[] => {
      const rows = body[field];
      return me.handle !== null && Array.isArray(rows) ? rows : [];
    };

    for (const row of rowsOf('weeks')) {
      if (!isObject(row)) {
        continue;
      }
      const weekKey = dateKey(row.weekKey);
      if (weekKey === null) {
        continue;
      }
      // A metric the phone did not send is one its owner does not share: it stays
      // null. Defaulting it to zero here would publish "did nothing this week" about
      // someone who only said "not this one" (ADR-0021 §4).
      const week: Week = {
        accountId: me.id,
        weekKey,
        focusMs: num(row.focusMs),
        socialMs: num(row.socialMs),
        habitsDone: num(row.habitsDone),
        habitsTarget: num(row.habitsTarget),
        updatedAt: at,
      };
      await store.putWeek(week);
    }

    for (const row of rowsOf('challenges')) {
      if (!isObject(row)) {
        continue;
      }
      const challengeId = id(row.id);
      const name = str(row.name, MAX_CHALLENGE_NAME);
      const startWeekKey = dateKey(row.startWeekKey);
      if (challengeId === null || name === null || startWeekKey === null) {
        continue;
      }
      const existing = await store.getChallenge(challengeId);
      // Only the person who made a challenge can change it; the rest join and mark.
      if (existing !== null && existing.createdBy !== me.id) {
        rejected.push(challengeId);
        continue;
      }
      // Ids, not names: a participant that is not shaped like one could not have been
      // written by a phone, and it is the key rows elsewhere are matched on.
      const participantIds = Array.isArray(row.participantIds)
        ? row.participantIds.filter((value): value is string => isUuidV7(value))
        : [me.id];
      const challenge: Challenge = {
        id: challengeId,
        createdBy: me.id,
        name,
        weeklyTarget: num(row.weeklyTarget) ?? 4,
        startWeekKey,
        endDayKey: dateKey(row.endDayKey),
        participantIds,
        // "Fotos del día" (ADR-0051 §6). A phone that does not send it (an older app)
        // leaves it as it was; a challenge nobody said anything about is on.
        photos: typeof row.photos === 'boolean' ? row.photos : (existing?.photos ?? true),
        archivedAt: num(row.archivedAt),
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      await store.putChallenge(challenge);
    }

    for (const row of rowsOf('marks')) {
      if (!isObject(row)) {
        continue;
      }
      const challengeId = id(row.challengeId);
      const dayKey = dateKey(row.dayKey);
      if (challengeId === null || dayKey === null) {
        continue;
      }
      const challenge = await store.getChallenge(challengeId);
      if (challenge === null || !challenge.participantIds.includes(me.id)) {
        rejected.push(`${challengeId}/${dayKey}`);
        continue;
      }
      const mark: ChallengeMark = { challengeId, accountId: me.id, dayKey, source: markSourceOf(row.source), updatedAt: at };
      if (row.marked === false) {
        await store.deleteMark(mark);
      } else {
        await store.putMark(mark);
      }
    }

    for (const row of rowsOf('kudos')) {
      if (!isObject(row)) {
        continue;
      }
      const kudosId = id(row.id);
      const toId = id(row.toId);
      const dayKey = dateKey(row.dayKey);
      if (kudosId === null || toId === null || dayKey === null || toId === me.id) {
        continue;
      }
      const link = await store.getLink(me.id, toId);
      if (link?.status !== 'member') {
        rejected.push(kudosId);
        continue;
      }
      const kudos: Kudos = {
        id: kudosId,
        fromId: me.id,
        toId,
        dayKey,
        createdAt: at,
        updatedAt: at,
      };
      await store.putKudos(kudos);
    }

    // A block works both ways (ADR-0051 §18): two people in a third person's challenge
    // stay in it, and neither can nudge the other.
    const blocked = await store.blockedWith(me.id);

    for (const row of rowsOf('nudges')) {
      if (!isObject(row)) {
        continue;
      }
      const nudgeId = id(row.id);
      const toId = id(row.toId);
      const challengeId = id(row.challengeId);
      const dayKey = dateKey(row.dayKey);
      if (
        nudgeId === null ||
        toId === null ||
        challengeId === null ||
        dayKey === null ||
        toId === me.id
      ) {
        continue;
      }
      const challenge = await store.getChallenge(challengeId);
      // A nudge is between two people who share a challenge. Nothing else may send one.
      if (
        challenge === null ||
        !challenge.participantIds.includes(me.id) ||
        !challenge.participantIds.includes(toId) ||
        blocked.has(toId)
      ) {
        rejected.push(nudgeId);
        continue;
      }
      const nudge: Nudge = {
        id: nudgeId,
        fromId: me.id,
        toId,
        challengeId,
        dayKey,
        createdAt: at,
        updatedAt: at,
      };
      await store.putNudge(nudge);
      const target = await store.getAccount(toId);
      // The row is always written; the push is the part with a budget. Re-syncing the
      // same nudge is how a person inside a challenge could turn one allowed nudge into
      // a stream of wake-ups. The message is silent and carries no wording of theirs:
      // the phone writes the line, in its own language, when rule 11 lets it (ADR-0037).
      // The challenge name is not sent because the receiver is in that challenge and
      // already has it; `challengeId` is what the tap opens.
      if (
        target !== null &&
        target.pushToken !== null &&
        me.handle !== null &&
        fits(`push:${me.id}:${toId}`, LIMITS.pushPerPair)
      ) {
        await push.send(target, {
          data: {
            kind: 'nudge',
            from: me.id,
            fromHandle: me.handle,
            at: String(at),
            challengeId,
          },
          /** The receiver's switch, and only for nudges (ADR-0027 §5). */
          requiresNudges: true,
        });
      }
    }

    // --- What comes back ------------------------------------------------------------
    // A mutual circle is two rows, one per direction, and one person. Fold them: mine
    // wins, because 'pending' on my row is someone waiting for my answer, while the
    // same status on theirs is a request I sent and nobody answered yet ('invited').
    const byPerson = new Map<string, { status: 'member' | 'pending' | 'invited'; updatedAt: number }>();
    for (const link of await store.linksOf(me.id)) {
      const otherId = link.ownerId === me.id ? link.memberId : link.ownerId;
      const status =
        link.status === 'member' ? 'member' : link.ownerId === me.id ? 'pending' : 'invited';
      const seen = byPerson.get(otherId);
      const updatedAt = Math.max(seen?.updatedAt ?? 0, link.updatedAt);
      if (seen === undefined || seen.status !== 'member') {
        byPerson.set(otherId, { status, updatedAt });
      } else {
        byPerson.set(otherId, { status: seen.status, updatedAt });
      }
    }

    /** One read per account in this answer, shared by `members` and `keys`. */
    const accountCache = new Map<string, Account | null>([[me.id, me]]);
    const accountOf = async (accountId: string): Promise<Account | null> => {
      if (!accountCache.has(accountId)) {
        accountCache.set(accountId, await store.getAccount(accountId));
      }
      return accountCache.get(accountId) ?? null;
    };

    const members = [];
    const circleIds: string[] = [];
    for (const [otherId, folded] of byPerson) {
      const other = await accountOf(otherId);
      // A bare identity is nobody's member (ADR-0048): no link reaches one through the
      // API, and should a row ever say otherwise, a person without a handle is not shown.
      if (other === null || other.handle === null) {
        continue;
      }
      members.push({
        id: other.id,
        name: other.name,
        handle: other.handle,
        status: folded.status,
        joinedAt: folded.status === 'member' ? folded.updatedAt : null,
        updatedAt: folded.updatedAt,
      });
      if (folded.status === 'member') {
        circleIds.push(other.id);
      }
    }

    const challenges = await store.challengesOf(me.id, since);
    const everyChallenge = await store.challengesOf(me.id, 0);
    const marks = await store.marksOf(
      everyChallenge.map((challenge) => challenge.id),
      since,
    );

    // A phone restoring with the backup key has none of its own marks: they lived in its
    // habit_marks, on the phone that is gone (ADR-0048). The server has them, because
    // each one was synced to its witnesses, so a restore asks for them back — all of
    // them, whatever the cursor says. An ordinary sync never does: the phone that wrote
    // a mark already has it.
    //
    // The same for photos (ADR-0051): the caller's own live ones, with their own wrap, so a
    // restoring phone can open their keys with the old secret before it rotates.
    const own =
      body.restore === true
        ? {
            marks: (await store.marksOf(everyChallenge.map((challenge) => challenge.id), 0)).filter(
              (mark) => mark.accountId === me.id,
            ),
            media: (await store.liveMedia({ ownerId: me.id }))
              .filter((row) => row.state === 'ready')
              .map((row) => remoteMediaFor(row, me.id)),
          }
        : undefined;

    // Photos changed after the cursor (ADR-0051): the caller's own, and the ones wrapped
    // for them while they are still in that challenge and no block stands between them and
    // the owner. Tombstones go to everyone who held a wrap, in or out: they only say
    // "gone", and they are how a phone learns to delete its copy.
    const joined = new Set(
      everyChallenge
        .filter((challenge) => challenge.participantIds.includes(me.id))
        .map((challenge) => challenge.id),
    );
    const media = (await store.mediaChangedFor(me.id, since))
      .filter(
        (row) =>
          row.ownerId === me.id ||
          row.deletedAt !== null ||
          (joined.has(row.challengeId) && !blocked.has(row.ownerId)),
      )
      .map((row) => remoteMediaFor(row, me.id));

    // Every box key the caller may need to wrap for, always whole: their own, their
    // circle's, and everyone's in the challenges they are in — a challenge can join two
    // people who are each in the maker's circle and not in each other's.
    const keyHolders = new Set<string>([me.id, ...circleIds]);
    for (const challenge of everyChallenge) {
      if (challenge.archivedAt === null && challenge.participantIds.includes(me.id)) {
        for (const participant of challenge.participantIds) {
          keyHolders.add(participant);
        }
      }
    }
    const keys = [];
    for (const holderId of keyHolders) {
      const holder = await accountOf(holderId);
      if (
        holder !== null &&
        holder.boxKey !== null &&
        holder.boxKeyId !== null &&
        (holder.id === me.id || holder.handle !== null)
      ) {
        keys.push({ id: holder.id, boxKey: holder.boxKey, keyId: holder.boxKeyId });
      }
    }

    return c.json({
      now: at,
      members: members.filter((member) => member.updatedAt > since),
      weeks: await store.weeksOf(circleIds, since),
      challenges,
      marks: marks.filter((mark) => mark.accountId !== me.id),
      kudos: await store.kudosFor(me.id, since),
      nudges: await store.nudgesFor(me.id, since),
      rejected,
      // The people whose link with the caller ended after the cursor (ADR-0049). A row
      // that is gone never comes back on its own, so this is how the other phone learns.
      ended: (await store.endedLinksOf(me.id, since)).map((row) => row.otherId),
      media,
      keys,
      ...(own === undefined ? {} : { own }),
    });
  });

  // --- Photos (ADR-0051) ---------------------------------------------------------------
  //
  // End to end encrypted: the phone seals each photo with a key of its own and wraps that
  // key for every participant with a box key. What arrives here is a row of metadata, the
  // wraps, and two objects of ciphertext; nothing the server holds opens either.

  /** Where this server answers, for the memory store's URLs. Railway's edge says https. */
  const originOf = (c: Context<{ Variables: Authed; Bindings: Bindings }>): string => {
    const url = new URL(c.req.url);
    const proto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
    return `${proto === 'https' || proto === 'http' ? proto : url.protocol.replace(':', '')}://${url.host}`;
  };

  /** A box key as `/sync` and a 409 hand it: the account, the key, the key's id. */
  const keyOf = (account: Account) =>
    account.boxKey === null || account.boxKeyId === null
      ? null
      : { id: account.id, boxKey: account.boxKey, keyId: account.boxKeyId };

  /**
   * One photo for one marked day (ADR-0051 §3): the metadata and the wraps, before the
   * bytes. The row is born `pending` and enters nobody's sync until both objects arrive.
   *
   * The wraps must cover every participant who has a box key, each with the key they have
   * now, the owner included; otherwise `409 stale keys` hands back the keys to wrap for,
   * and the phone wraps again. A participant blocked either way with the owner is not
   * required, and a wrap for them — or for anyone outside the challenge — is dropped.
   *
   * The same id again (an answer the phone lost) rewrites a pending row and leaves a ready
   * one as it is. Another photo of the same day replaces the one before, whose objects go.
   */
  app.post('/media', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (me.bannedAt !== null) {
      return c.json({ error: 'banned' }, 403);
    }
    if (!fits(`media:${me.id}`, LIMITS.mediaPerAccount)) {
      return over(c, LIMITS.mediaPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const upload = parseMediaUpload(body);
    if ('error' in upload) {
      return c.json({ error: upload.error }, 400);
    }
    const at = now();
    const challenge = await store.getChallenge(upload.challengeId);
    if (challenge === null) {
      return c.json({ error: 'unknown challenge' }, 404);
    }
    if (!challenge.participantIds.includes(me.id)) {
      return c.json({ error: 'not in that challenge' }, 403);
    }
    if (!challenge.photos) {
      return c.json({ error: 'photos off' }, 409);
    }
    if (challenge.archivedAt !== null || !isChallengeDay(challenge, upload.dayKey)) {
      return c.json({ error: 'not a day of that challenge' }, 409);
    }
    if (!isRecentDay(upload.dayKey, at)) {
      return c.json({ error: 'dayKey is not today or yesterday' }, 400);
    }

    const existing = await store.getMedia(upload.id);
    if (existing !== null) {
      if (
        existing.ownerId !== me.id ||
        existing.challengeId !== upload.challengeId ||
        existing.dayKey !== upload.dayKey
      ) {
        return c.json({ error: 'id taken' }, 409);
      }
      if (existing.deletedAt !== null) {
        return c.json({ error: 'media deleted' }, 410);
      }
      if (existing.state === 'ready') {
        return c.json({ id: existing.id, expiresAt: existing.expiresAt });
      }
    }

    if (me.boxKey === null || me.boxKeyId === null) {
      return c.json({ error: 'box key required' }, 409);
    }
    const blocked = await store.blockedWith(me.id);
    const audience: Account[] = [me];
    for (const participantId of challenge.participantIds) {
      if (participantId === me.id || blocked.has(participantId)) {
        continue;
      }
      const participant = await store.getAccount(participantId);
      if (participant !== null && participant.handle !== null && participant.boxKeyId !== null) {
        audience.push(participant);
      }
    }
    const byRecipient = new Map(upload.wraps.map((wrap) => [wrap.recipientId, wrap]));
    const stale = audience.some((person) => byRecipient.get(person.id)?.keyId !== person.boxKeyId);
    if (stale) {
      return c.json(
        { error: 'stale keys', keys: audience.map(keyOf).filter((key) => key !== null) },
        409,
      );
    }
    const covered = new Set(audience.map((person) => person.id));

    const expiresAt = mediaExpiresAt(challenge, at, me.timeZone);
    const replaced = await store.putMediaReplacing({
      id: upload.id,
      challengeId: upload.challengeId,
      ownerId: me.id,
      dayKey: upload.dayKey,
      width: upload.width,
      height: upload.height,
      origin: upload.origin,
      epk: upload.epk,
      captionBox: upload.captionBox,
      wraps: upload.wraps.filter((wrap) => covered.has(wrap.recipientId)),
      thumbSize: upload.thumbSize,
      fullSize: upload.fullSize,
      state: 'pending',
      thumbAt: null,
      fullAt: null,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      expiresAt,
      deletedAt: null,
    });
    await dropObjects(replaced);
    return c.json({ id: upload.id, expiresAt }, existing === null ? 201 : 200);
  });

  /**
   * The bytes of one object, sealed on the phone: raw `application/octet-stream`, exactly
   * the size `POST /media` announced, capped like the backup is — by the header first and
   * then by counting. Only the owner. When both are in, the row turns ready.
   */
  const putObject = (variant: MediaVariant) =>
    async (c: Context<{ Variables: Authed; Bindings: Bindings }>) => {
      const me = c.get('account');
      if (me.handle === null) {
        return handleRequired(c);
      }
      if (me.bannedAt !== null) {
        return c.json({ error: 'banned' }, 403);
      }
      if (!fits(`media:put:${me.id}`, LIMITS.mediaPutPerAccount)) {
        return over(c, LIMITS.mediaPutPerAccount);
      }
      const mediaId = id(c.req.param('id'));
      if (mediaId === null) {
        return c.json({ error: 'id must be a UUID v7' }, 400);
      }
      const media = await store.getMedia(mediaId);
      if (media === null) {
        return c.json({ error: 'unknown media' }, 404);
      }
      if (media.ownerId !== me.id) {
        return c.json({ error: 'not yours' }, 403);
      }
      if (media.deletedAt !== null) {
        return c.json({ error: 'media deleted' }, 410);
      }
      const cap = variant === 'thumb' ? MAX_THUMB_BYTES : MAX_FULL_BYTES;
      const declared = c.req.header('Content-Length');
      if (declared !== undefined && Number(declared) > cap) {
        return c.json({ error: `${variant} too large` }, 413);
      }
      const bytes = await readCapped(c.req.raw, cap);
      if (bytes === 'too large') {
        return c.json({ error: `${variant} too large` }, 413);
      }
      if (bytes.byteLength === 0) {
        return c.json({ error: `empty ${variant}` }, 400);
      }
      const expected = variant === 'thumb' ? media.thumbSize : media.fullSize;
      if (bytes.byteLength !== expected) {
        return c.json({ error: 'size mismatch', expected }, 400);
      }
      const key = mediaObjectKey(media, variant);
      await objects.put(key, bytes);
      const marked = await store.markMediaObject(mediaId, variant, now());
      if (marked === null) {
        // Replaced or deleted while the bytes were on their way.
        await objects.delete([key]).catch(() => undefined);
        return c.json({ error: 'media deleted' }, 410);
      }
      return c.json({ id: mediaId, state: marked.state });
    };

  app.put('/media/:id/thumb', putObject('thumb'));
  app.put('/media/:id/full', putObject('full'));

  /**
   * A URL to download one object, for five minutes (ADR-0051 §17): straight from the
   * bucket, in JSON and never as a redirect — `fetch` may carry `Authorization` across a
   * 302, and S3 refuses a request signed twice. Only the owner, or someone the photo was
   * wrapped for who is still in the challenge and not blocked either way with the owner.
   */
  app.get('/media/:id/url', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (!fits(`media:url:${me.id}`, LIMITS.mediaUrlPerAccount)) {
      return over(c, LIMITS.mediaUrlPerAccount);
    }
    const variant = c.req.query('variant');
    const mediaId = id(c.req.param('id'));
    if (mediaId === null || !isMediaVariant(variant)) {
      return c.json({ error: "id must be a UUID v7 and variant 'thumb' or 'full'" }, 400);
    }
    const media = await store.getMedia(mediaId);
    if (media === null) {
      return c.json({ error: 'unknown media' }, 404);
    }
    const at = now();
    if (media.deletedAt !== null || media.expiresAt <= at) {
      return c.json({ error: 'media deleted' }, 410);
    }
    if (media.ownerId !== me.id) {
      const wrapped = media.wraps.some((wrap) => wrap.recipientId === me.id);
      const challenge = wrapped ? await store.getChallenge(media.challengeId) : null;
      const inside = challenge !== null && challenge.participantIds.includes(me.id);
      if (!inside || (await store.blockedWith(me.id)).has(media.ownerId)) {
        return c.json({ error: 'not allowed' }, 403);
      }
    }
    if (media.state !== 'ready') {
      return c.json({ error: 'not ready' }, 409);
    }
    const signed = await objects.presign(mediaObjectKey(media, variant), URL_TTL_MS, originOf(c));
    return c.json({ url: signed.url, expiresAt: signed.expiresAt });
  });

  /**
   * Deleting one's own photo: a tombstone the others learn at their next sync, and the
   * objects go now. 200 whether or not there was one, so a retry is the same request.
   */
  app.delete('/media/:id', async (c) => {
    const me = c.get('account');
    if (!fits(`media:delete:${me.id}`, LIMITS.mediaDeletePerAccount)) {
      return over(c, LIMITS.mediaDeletePerAccount);
    }
    const mediaId = id(c.req.param('id'));
    if (mediaId === null) {
      return c.json({ error: 'id must be a UUID v7' }, 400);
    }
    const media = await store.getMedia(mediaId);
    if (media === null || media.deletedAt !== null) {
      return c.json({ ok: true });
    }
    if (media.ownerId !== me.id) {
      return c.json({ error: 'not yours' }, 403);
    }
    await tombstone([mediaId], now());
    return c.json({ ok: true });
  });

  /** The memory store's "signed" URLs: the token is the credential, like a presigned one. */
  app.get(`${LOCAL_MEDIA_PATH}:token`, (c) => {
    const bytes = objects.readLocal?.(c.req.param('token')) ?? null;
    if (bytes === null) {
      return c.json({ error: 'expired or unknown' }, 404);
    }
    return c.body(new Uint8Array(bytes), 200, {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
  });

  /**
   * Reporting a photo (ADR-0051 §18). The reporter sends that photo's key — only that
   * one — and the server checks it opens the thumbnail the owner uploaded: the GCM tag
   * proves both the key and who the bytes came from. The objects are copied to `r/<id>/`
   * right away, so the owner deleting the photo, or its expiry, does not take the
   * evidence before a moderator looks. Nobody is told who reported, and the answer is the
   * same for a second report of the same photo.
   */
  app.post('/report', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (!fits(`report:${me.id}`, LIMITS.reportPerAccount)) {
      return over(c, LIMITS.reportPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const mediaId = isObject(body) ? id(body.mediaId) : null;
    const reason = isObject(body) ? body.reason : undefined;
    const contentKey = isObject(body) ? base64Bytes(body.contentKey, 32) : null;
    const rawNote = isObject(body) ? body.note : undefined;
    const note = typeof rawNote === 'string' ? rawNote.trim() : null;
    if (
      mediaId === null ||
      !isReportReason(reason) ||
      contentKey === null ||
      (rawNote !== undefined && rawNote !== null && typeof rawNote !== 'string') ||
      (note !== null && note.length > MAX_REPORT_NOTE)
    ) {
      return c.json(
        {
          error:
            "mediaId is a UUID v7, reason 'unwanted', 'consent', 'minor' or 'other', note at most 200 characters, contentKey 32 bytes of base64",
        },
        400,
      );
    }
    const media = await store.getMedia(mediaId);
    if (media === null || media.ownerId === me.id || !media.wraps.some((wrap) => wrap.recipientId === me.id)) {
      return c.json({ error: 'unknown media' }, 404);
    }
    if (await store.findReport(me.id, mediaId)) {
      return c.json({ ok: true });
    }
    if (media.deletedAt !== null || media.state !== 'ready') {
      return c.json({ error: 'media deleted' }, 410);
    }
    const thumb = await objects.get(mediaObjectKey(media, 'thumb'));
    if (thumb === null) {
      return c.json({ error: 'media deleted' }, 410);
    }
    if (openPhoto(contentKey, mediaId, 'thumb', thumb) === null) {
      return c.json({ error: 'wrong key' }, 400);
    }
    const reportId = randomUUID();
    const written = await store.putReport({
      id: reportId,
      mediaId,
      reporterId: me.id,
      ownerId: media.ownerId,
      challengeId: media.challengeId,
      dayKey: media.dayKey,
      reason,
      note: note === '' ? null : note,
      contentKey: contentKey.toString('base64'),
      createdAt: now(),
      resolvedAt: null,
      action: null,
      preservedUntil: null,
    });
    if (written) {
      // The row first, then the copies: the reconciliation keeps what an open report holds.
      for (const variant of ['thumb', 'full'] as const) {
        await objects.copy(mediaObjectKey(media, variant), `${reportPrefix(reportId)}${variant}`);
      }
      // A line a moderator can watch for; nothing in it says who reported or what is in it.
      console.log(`report ${reportId} on a photo (${reason}): /admin/reports`);
    }
    return c.json({ ok: true });
  });

  /**
   * "Bloquear a Ana" (ADR-0051 §18): the link ends like `/link/end` — both directions,
   * and each leaves the other's challenges with their photos — and from then on a code
   * between the two answers like one nobody has. The other person is not told. 200 for
   * any well-formed body, a stranger's id included, and the same again.
   */
  app.post('/block', async (c) => {
    const me = c.get('account');
    if (me.handle === null) {
      return handleRequired(c);
    }
    if (!fits(`end:${me.id}`, LIMITS.endPerAccount)) {
      return over(c, LIMITS.endPerAccount);
    }
    const body: unknown = await c.req.json().catch(() => null);
    const memberId = isObject(body) ? id(body.memberId) : null;
    if (memberId === null || memberId === me.id) {
      return c.json({ error: 'memberId must be a UUID v7 other than yours' }, 400);
    }
    const other = await store.getAccount(memberId);
    if (other === null) {
      return c.json({ ok: true });
    }
    const linked =
      (await store.getLink(me.id, memberId)) !== null || (await store.getLink(memberId, me.id)) !== null;
    const at = now();
    await endLinksWith(me.id, [memberId], at, linked);
    await store.putBlock(me.id, memberId, at);
    return c.json({ ok: true });
  });

  // --- Moderation (ADR-0051 §19) --------------------------------------------------------
  //
  // Behind `ADMIN_TOKEN`, as `Authorization: Bearer <token>`. Without one configured,
  // and with a wrong one, every route answers 404 like a route that does not exist. The
  // process a person follows is in server/README.md, "Moderar un reporte".

  const adminDigest = adminToken === null ? null : createHash('sha256').update(adminToken).digest();

  /** True for the right token. Compared as digests, in constant time. */
  const isAdmin = (c: Context<{ Variables: Authed; Bindings: Bindings }>): boolean => {
    if (adminDigest === null) {
      return false;
    }
    const header = c.req.header('Authorization') ?? '';
    const given = createHash('sha256')
      .update(header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '')
      .digest();
    return timingSafeEqual(given, adminDigest);
  };

  app.use('/admin/*', async (c, next) => {
    if (adminDigest === null) {
      return c.notFound();
    }
    const ip = clientIp(c);
    if (!isAdmin(c)) {
      if (!fits(`admin:fail:${ip}`, LIMITS.adminFailPerIp)) {
        return over(c, LIMITS.adminFailPerIp);
      }
      return c.notFound();
    }
    return next();
  });

  /** Reports, open ones first. Never who reported. */
  app.get('/admin/reports', async (c) => {
    const reports = await store.listReports(ADMIN_LIST_LIMIT);
    const rows = [];
    for (const report of reports) {
      const owner = await store.getAccount(report.ownerId);
      const media = await store.getMedia(report.mediaId);
      rows.push({
        id: report.id,
        reason: report.reason,
        note: report.note,
        createdAt: report.createdAt,
        mediaId: report.mediaId,
        challengeId: report.challengeId,
        dayKey: report.dayKey,
        ownerId: report.ownerId,
        ownerHandle: owner?.handle ?? null,
        ownerBanned: owner !== null && owner.bannedAt !== null,
        // 'live' still shows in the challenge; 'deleted' is a tombstone; 'gone' has no row.
        photo: media === null ? 'gone' : media.deletedAt === null ? 'live' : 'deleted',
        evidence: report.contentKey !== null,
        resolvedAt: report.resolvedAt,
        action: report.action,
        preservedUntil: report.preservedUntil,
      });
    }
    return c.json({ reports: rows });
  });

  /**
   * The reported photo, decrypted with the key the reporter handed over, as `image/jpeg`:
   * the full photo, or `?variant=thumb`. From the evidence copied when the report landed.
   */
  app.get('/admin/reports/:id/photo', async (c) => {
    const variant = c.req.query('variant') ?? 'full';
    if (!isMediaVariant(variant)) {
      return c.json({ error: "variant is 'thumb' or 'full'" }, 400);
    }
    const report = await store.getReport(c.req.param('id'));
    if (report === null) {
      return c.json({ error: 'unknown report' }, 404);
    }
    const key = report.contentKey === null ? null : base64Bytes(report.contentKey, 32);
    if (key === null) {
      return c.json({ error: 'evidence released' }, 410);
    }
    const sealed = await objects.get(`${reportPrefix(report.id)}${variant}`);
    if (sealed === null) {
      return c.json({ error: 'evidence missing' }, 410);
    }
    const jpeg = openPhoto(key, report.mediaId, variant, sealed);
    if (jpeg === null) {
      return c.json({ error: 'evidence does not open' }, 500);
    }
    return c.body(new Uint8Array(jpeg), 200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
  });

  /**
   * Acting on a report, within 24 hours (ADR-0051 §19):
   *
   * - `dismiss`: nothing happens to the photo.
   * - `remove`: the photo becomes a tombstone and its objects go; every phone deletes it.
   * - `ban`: that, and the owner is banned — no more photos — and every live photo of theirs
   *   goes the same way.
   *
   * With `preserve: true` the evidence stays under `r/<id>/` for 365 days, the key and a
   * note of what it is beside it, for what the law asks to keep of a report to NCMEC.
   * Without it, the evidence and the key go now. A report is resolved once.
   */
  app.post('/admin/reports/:id/resolve', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const action = isObject(body) ? body.action : undefined;
    const preserve = isObject(body) && body.preserve === true;
    if (!isReportAction(action) || (isObject(body) && body.preserve !== undefined && typeof body.preserve !== 'boolean')) {
      return c.json({ error: "action is 'dismiss', 'remove' or 'ban'; preserve is a boolean" }, 400);
    }
    const report = await store.getReport(c.req.param('id'));
    if (report === null) {
      return c.json({ error: 'unknown report' }, 404);
    }
    if (report.resolvedAt !== null) {
      return c.json({ error: 'already resolved', action: report.action }, 409);
    }
    const at = now();
    let removed = 0;
    if (action === 'remove' || action === 'ban') {
      removed += await tombstone([report.mediaId], at);
    }
    if (action === 'ban') {
      await store.banAccount(report.ownerId, at);
      const theirs = await store.liveMedia({ ownerId: report.ownerId });
      removed += await tombstone(theirs.map((row) => row.id), at);
      // The terms say whoever breaks the rule leaves: a ban ends every link of the
      // account, as "Salir del círculo" would, and every phone learns it at its next sync
      // (ADR-0049). The banned account cannot redeem or accept its way back in.
      const links = await store.linksOf(report.ownerId);
      const others = [...new Set(links.map((link) => (link.ownerId === report.ownerId ? link.memberId : link.ownerId)))];
      if (others.length > 0) {
        await endLinksWith(report.ownerId, others, at, true);
      }
    }
    const prefix = reportPrefix(report.id);
    let preservedUntil: number | null = null;
    let contentKey = report.contentKey;
    if (preserve && contentKey !== null) {
      preservedUntil = at + PRESERVE_MS;
      const owner = await store.getAccount(report.ownerId);
      const encoder = new TextEncoder();
      await objects.put(`${prefix}key`, encoder.encode(contentKey));
      await objects.put(
        `${prefix}meta.json`,
        encoder.encode(
          JSON.stringify(
            {
              reportId: report.id,
              mediaId: report.mediaId,
              ownerId: report.ownerId,
              ownerHandle: owner?.handle ?? null,
              challengeId: report.challengeId,
              dayKey: report.dayKey,
              reason: report.reason,
              note: report.note,
              reportedAt: new Date(report.createdAt).toISOString(),
              resolvedAt: new Date(at).toISOString(),
              action,
              preservedUntil: new Date(preservedUntil).toISOString(),
              sealed:
                'thumb and full: AES-256-GCM, nonce(12) | ciphertext | tag(16), key = base64 in "key", aad = utf8("vesper-photo-v1|<mediaId>|<thumb|full>")',
            },
            null,
            2,
          ),
        ),
      );
    } else {
      await objects.deletePrefix(prefix);
      contentKey = null;
    }
    await store.putReport({ ...report, resolvedAt: at, action, preservedUntil, contentKey });
    return c.json({ id: report.id, action, resolvedAt: at, preservedUntil, removed });
  });

  return app;
}
