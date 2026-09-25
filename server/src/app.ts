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
import type { Push } from './push.ts';
import { createRateLimiter } from './rateLimit.ts';
import { ConflictError, isPlatform } from './store.ts';
import { markSourceOf, type Account, type Challenge, type ChallengeMark, type Kudos, type Nudge, type Store, type Week } from './store.ts';

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
 */

export type Deps = {
  store: Store;
  push: Push;
  /** Injected so the tests can hold time still. */
  now: () => number;
};

type Authed = { account: Account };

/** node-server hands the raw request through `c.env`; nothing else uses it. */
type Bindings = { incoming?: { socket?: { remoteAddress?: string } } };

const HOUR = 60 * 60 * 1000;

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

export function createApp(deps: Deps) {
  const { store, push, now } = deps;
  const app = new Hono<{ Variables: Authed; Bindings: Bindings }>();
  const limiter = createRateLimiter(now);

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
    if (c.req.path === '/account' && c.req.method === 'POST') {
      return next();
    }
    if (c.req.path === '/health') {
      return next();
    }
    const account = await authenticate(c.req.header('Authorization'));
    if (account === null) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    // "When did we last see them" is the one question it answers (ADR-0048 §3), and an
    // hour is enough resolution for it: a sync every twenty seconds would otherwise be a
    // write every twenty seconds on the hottest row there is.
    const at = now();
    if (account.lastSeenAt === null || at - account.lastSeenAt >= SEEN_EVERY_MS) {
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
  app.get('/account', (c) => {
    const account = c.get('account');
    return c.json({
      id: account.id,
      name: account.name,
      handle: account.handle,
      inviteCode: account.inviteCode,
      timeZone: account.timeZone,
      nudgesOn: account.nudgesOn,
      createdAt: account.createdAt,
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
    await store.putAccount({
      ...account,
      secretHash: hashSecret(secret),
      pushToken: null,
      updatedAt: now(),
    });
    return c.json({ id: account.id, secret });
  });

  /** Leaving for good: the account and every row of it, its backup too. No soft delete. */
  app.delete('/account', async (c) => {
    await store.deleteAccount(c.get('account').id);
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
    await store.putAccount({
      ...account,
      pushToken: body.pushToken === undefined ? account.pushToken : token,
      timeZone: zone ?? account.timeZone,
      nudgesOn: typeof body.nudgesOn === 'boolean' ? body.nudgesOn : account.nudgesOn,
      platform: isPlatform(body.platform) ? body.platform : account.platform,
      appVersion: version ?? account.appVersion,
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
    if (owner === null) {
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
    const at = now();
    for (const otherId of others) {
      await store.endLink(me.id, otherId, at);
    }
    const gone = new Set(others);
    for (const challenge of await store.challengesOf(me.id, 0)) {
      const participantIds =
        challenge.createdBy === me.id
          ? challenge.participantIds.filter((participant) => !gone.has(participant))
          : gone.has(challenge.createdBy)
            ? challenge.participantIds.filter((participant) => participant !== me.id)
            : challenge.participantIds;
      if (participantIds.length !== challenge.participantIds.length) {
        await store.putChallenge({ ...challenge, participantIds, updatedAt: at });
      }
    }
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
    if (challenge !== null && challenge.participantIds.includes(me.id)) {
      await store.putChallenge({
        ...challenge,
        participantIds: challenge.participantIds.filter((participant) => participant !== me.id),
        updatedAt: now(),
      });
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
        !challenge.participantIds.includes(toId)
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

    const members = [];
    const circleIds: string[] = [];
    for (const [otherId, folded] of byPerson) {
      const other = await store.getAccount(otherId);
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
    const own =
      body.restore === true
        ? {
            marks: (await store.marksOf(everyChallenge.map((challenge) => challenge.id), 0)).filter(
              (mark) => mark.accountId === me.id,
            ),
          }
        : undefined;

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
      ...(own === undefined ? {} : { own }),
    });
  });

  return app;
}
