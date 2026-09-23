import { Hono } from 'hono';

import { credentialsFrom, hashSecret, newSecret, normalizeHandle, secretMatches } from './auth.ts';
import type { Push } from './push.ts';
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function createApp(deps: Deps) {
  const { store, push, now } = deps;
  const app = new Hono<{ Variables: Authed }>();

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
    const body: unknown = await c.req.json().catch(() => null);
    if (!isObject(body)) {
      return c.json({ error: 'bad request' }, 400);
    }
    const id = str(body.id);
    const name = str(body.name);
    const handle = normalizeHandle(typeof body.handle === 'string' ? body.handle : '');
    if (id === null || id.includes('.') || name === null || handle === null) {
      return c.json({ error: 'id, name and handle are required; handle is [a-z0-9_]{3,20}' }, 400);
    }
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.toUpperCase() : null;
    const existing = await store.getAccount(id);
    const taken = await store.getAccountByHandle(handle);
    if (taken !== null && taken.id !== id) {
      return c.json({ error: 'handle taken' }, 409);
    }

    if (existing === null) {
      const secret = newSecret();
      const account: Account = {
        id,
        secretHash: hashSecret(secret),
        name,
        handle,
        inviteCode,
        pushToken: null,
        timeZone: null,
        nudgesOn: true,
        createdAt: now(),
        updatedAt: now(),
      };
      await store.putAccount(account);
      return c.json({ id, secret, handle }, 201);
    }

    const account = await authenticate(c.req.header('Authorization'));
    if (account === null || account.id !== id) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await store.putAccount({ ...account, name, handle, inviteCode, updatedAt: now() });
    return c.json({ id, handle });
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
    await store.putAccount({
      ...account,
      pushToken: typeof body.pushToken === 'string' ? body.pushToken : null,
      timeZone: typeof body.timeZone === 'string' ? body.timeZone : account.timeZone,
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
    const body: unknown = await c.req.json().catch(() => null);
    const code = isObject(body) && typeof body.code === 'string' ? body.code.trim().toUpperCase() : null;
    if (code === null) {
      return c.json({ error: 'code is required' }, 400);
    }
    const me = c.get('account');
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
    await push.send(owner, {
      title: me.name,
      body: 'quiere entrar a tu círculo',
      data: { kind: 'invite', from: me.id },
    });
    return c.json({ ok: true, status: 'pending' });
  });

  /** Accepting is what makes it mutual: both directions become 'member' at once. */
  app.post('/invite/accept', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const memberId = isObject(body) ? str(body.memberId) : null;
    if (memberId === null) {
      return c.json({ error: 'memberId is required' }, 400);
    }
    const me = c.get('account');
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
    await push.send(other, {
      title: me.name,
      body: 'te aceptó en su círculo',
      data: { kind: 'accepted', from: me.id },
    });
    return c.json({ ok: true });
  });

  /**
   * Joining a challenge someone else made. The server only checks that the caller is in
   * the circle of whoever created it: a challenge is not public (that is ADR-0032).
   */
  app.post('/challenge/join', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const challengeId = isObject(body) ? str(body.challengeId) : null;
    if (challengeId === null) {
      return c.json({ error: 'challengeId is required' }, 400);
    }
    const me = c.get('account');
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
    const at = now();
    const since = num(body.since) ?? 0;
    const rejected: string[] = [];

    for (const row of Array.isArray(body.weeks) ? body.weeks : []) {
      if (!isObject(row)) {
        continue;
      }
      const weekKey = str(row.weekKey);
      if (weekKey === null) {
        continue;
      }
      const week: Week = {
        accountId: me.id,
        weekKey,
        focusMs: num(row.focusMs) ?? 0,
        socialMs: num(row.socialMs),
        habitsDone: num(row.habitsDone) ?? 0,
        habitsTarget: num(row.habitsTarget) ?? 0,
        updatedAt: at,
      };
      await store.putWeek(week);
    }

    for (const row of Array.isArray(body.challenges) ? body.challenges : []) {
      if (!isObject(row)) {
        continue;
      }
      const id = str(row.id);
      const name = str(row.name);
      const startWeekKey = str(row.startWeekKey);
      if (id === null || name === null || startWeekKey === null) {
        continue;
      }
      const existing = await store.getChallenge(id);
      // Only the person who made a challenge can change it; the rest join and mark.
      if (existing !== null && existing.createdBy !== me.id) {
        rejected.push(id);
        continue;
      }
      const participantIds = Array.isArray(row.participantIds)
        ? row.participantIds.filter((value): value is string => typeof value === 'string')
        : [me.id];
      const challenge: Challenge = {
        id,
        createdBy: me.id,
        name,
        weeklyTarget: num(row.weeklyTarget) ?? 4,
        startWeekKey,
        endDayKey: str(row.endDayKey),
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
      const challengeId = str(row.challengeId);
      const dayKey = str(row.dayKey);
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
      const id = str(row.id);
      const toId = str(row.toId);
      const dayKey = str(row.dayKey);
      if (id === null || toId === null || dayKey === null || toId === me.id) {
        continue;
      }
      const link = await store.getLink(me.id, toId);
      if (link?.status !== 'member') {
        rejected.push(id);
        continue;
      }
      const kudos: Kudos = { id, fromId: me.id, toId, dayKey, createdAt: at, updatedAt: at };
      await store.putKudos(kudos);
    }

    for (const row of Array.isArray(body.nudges) ? body.nudges : []) {
      if (!isObject(row)) {
        continue;
      }
      const id = str(row.id);
      const toId = str(row.toId);
      const challengeId = str(row.challengeId);
      const dayKey = str(row.dayKey);
      if (id === null || toId === null || challengeId === null || dayKey === null || toId === me.id) {
        continue;
      }
      const challenge = await store.getChallenge(challengeId);
      // A nudge is between two people who share a challenge. Nothing else may send one.
      if (
        challenge === null ||
        !challenge.participantIds.includes(me.id) ||
        !challenge.participantIds.includes(toId)
      ) {
        rejected.push(id);
        continue;
      }
      const nudge: Nudge = { id, fromId: me.id, toId, challengeId, dayKey, createdAt: at, updatedAt: at };
      await store.putNudge(nudge);
      const target = await store.getAccount(toId);
      if (target !== null) {
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
