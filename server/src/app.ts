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
import { ConflictError } from './store.ts';
import type { Account, Challenge, ChallengeMark, Kudos, Nudge, Store, Week } from './store.ts';

/**
 * The circle's API (ADR-0033). Five verbs and one sync, over rows that each have an
 * owner: the server's whole job is to check that a caller writes only what is theirs
 * and to hand back what the people in their circle wrote.
 *
 * What it never receives: sessions, intentions, modes, apps, anything from Screen Time
 * or Health. The phone aggregates; this takes totals (ADR-0004, ADR-0005, ADR-0021).
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

/** 'YYYY-MM-DD', which is what both a day key and a week key are (domain/day.ts). */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** Printable ASCII, no spaces: what an Expo token, an APNs one and an FCM one all are. */
const PUSH_TOKEN = /^[\x21-\x7e]+$/;
/** IANA zone names: 'America/Bogota', 'UTC', 'Etc/GMT+5'. */
const TIME_ZONE = /^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)*$/;

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
    c.set('account', account);
    return next();
  });

  app.get('/health', (c) => c.json({ ok: true }));

  /**
   * First sync of a phone: it picks its own id (UUID v7, like everything else) and the
   * server hands back the secret it will keep in the keychain. Calling it again with
   * the same id and the right secret updates the profile, so a renamed handle is one
   * call and not a second concept.
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
      const conflict = await write({
        id: accountId,
        secretHash: hashSecret(secret),
        name,
        handle,
        inviteCode,
        pushToken: null,
        timeZone: null,
        nudgesOn: true,
        createdAt: now(),
        updatedAt: now(),
      });
      return conflict ?? c.json({ id: accountId, secret, handle }, 201);
    }

    const account = await authenticate(c.req.header('Authorization'));
    if (account === null || account.id !== accountId) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const conflict = await write({ ...account, name, handle, inviteCode, updatedAt: now() });
    return conflict ?? c.json({ id: accountId, handle });
  });

  /** Leaving for good: the account and every row of it, gone. No soft delete. */
  app.delete('/account', async (c) => {
    await store.deleteAccount(c.get('account').id);
    return c.body(null, 204);
  });

  /**
   * Where a push goes and when it is allowed. `nudgesOn` is the receiver's switch from
   * Ajustes › Círculo: the server asks nobody else before sending.
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
    await store.putAccount({
      ...account,
      pushToken: token,
      timeZone: zone ?? account.timeZone,
      nudgesOn: typeof body.nudgesOn === 'boolean' ? body.nudgesOn : account.nudgesOn,
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
    // Redeeming again is how one caller could notify the same person over and over,
    // with their own name as the title. The link is already written either way.
    if (owner.pushToken !== null && fits(`push:${me.id}:${owner.id}`, LIMITS.pushPerPair)) {
      await push.send(owner, {
        title: me.name,
        body: 'quiere entrar a tu círculo',
        data: { kind: 'invite', from: me.id },
      });
    }
    return c.json({ ok: true, status: 'pending' });
  });

  /** Accepting is what makes it mutual: both directions become 'member' at once. */
  app.post('/invite/accept', async (c) => {
    const me = c.get('account');
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
        title: me.name,
        body: 'te aceptó en su círculo',
        data: { kind: 'accepted', from: me.id },
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

    for (const row of Array.isArray(body.weeks) ? body.weeks : []) {
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

    for (const row of Array.isArray(body.challenges) ? body.challenges : []) {
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

    for (const row of Array.isArray(body.marks) ? body.marks : []) {
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
      const mark: ChallengeMark = { challengeId, accountId: me.id, dayKey, updatedAt: at };
      if (row.marked === false) {
        await store.deleteMark(mark);
      } else {
        await store.putMark(mark);
      }
    }

    for (const row of Array.isArray(body.kudos) ? body.kudos : []) {
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

    for (const row of Array.isArray(body.nudges) ? body.nudges : []) {
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
      // The row is always written; the notification is the part with a budget. Re-syncing
      // the same nudge is how a person inside a challenge could turn one allowed nudge
      // into a stream of notifications, and the text carries their own name.
      if (
        target !== null &&
        target.pushToken !== null &&
        fits(`push:${me.id}:${toId}`, LIMITS.pushPerPair)
      ) {
        await push.send(target, {
          title: `${me.name} te empuja`,
          body: `hoy no has marcado ${challenge.name}.`,
          data: { kind: 'nudge', challengeId },
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
      if (other === null) {
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

    return c.json({
      now: at,
      members: members.filter((member) => member.updatedAt > since),
      weeks: await store.weeksOf(circleIds, since),
      challenges,
      marks: marks.filter((mark) => mark.accountId !== me.id),
      kudos: await store.kudosFor(me.id, since),
      nudges: await store.nudgesFor(me.id, since),
      rejected,
    });
  });

  return app;
}
