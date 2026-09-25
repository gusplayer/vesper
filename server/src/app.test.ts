import { describe, expect, it } from 'vitest';

import { createApp } from './app.ts';
import { createMemoryStore } from './memoryStore.ts';
import { createRecordingPush } from './push.ts';

/**
 * What the server is for: a row has an owner, and only its owner writes it. These
 * tests run against the memory store, because that is where the rules live — the SQL
 * is checked by running the real thing against Postgres.
 */

const T0 = new Date(2026, 8, 21, 12, 0).getTime();

/**
 * Ids as the phone writes them: UUID v7, which is the only shape the server takes now.
 * The codes are what `inviteCodeFor` derives from those ids at generation 0 — a code
 * that does not come out of its own account id is refused, so they cannot be invented.
 */
const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const SOF = '0199a1b2-c3d4-7e5f-8a9b-000000000003';
const GUS_CODE = 'LD6FYR';
const ANA_CODE = '5UTAH8';

const CH1 = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const K1 = '0199a1b2-c3d4-7e5f-8a9b-00000000a001';
const K2 = '0199a1b2-c3d4-7e5f-8a9b-00000000a002';
const N1 = '0199a1b2-c3d4-7e5f-8a9b-00000000b001';
const N2 = '0199a1b2-c3d4-7e5f-8a9b-00000000b002';
const N9 = '0199a1b2-c3d4-7e5f-8a9b-00000000b009';

function setup() {
  const store = createMemoryStore();
  const push = createRecordingPush();
  let clock = T0;
  const app = createApp({ store, push, now: () => (clock += 1) });

  /**
   * JSON in and out, like the phone's client. `raw` sends bytes instead, the way the
   * backup travels; `headers` adds to or overrides the defaults; and a response that is
   * not JSON comes back as `bytes`, with its `headers` to read.
   */
  const call = async (
    method: string,
    path: string,
    options: {
      token?: string;
      body?: unknown;
      raw?: Uint8Array<ArrayBuffer>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<{ status: number; body: any; bytes: Uint8Array; headers: Headers }> => {
    const headers: Record<string, string> = {
      'content-type': options.raw === undefined ? 'application/json' : 'application/octet-stream',
    };
    if (options.token !== undefined) {
      headers.Authorization = `Bearer ${options.token}`;
    }
    Object.assign(headers, options.headers);
    const response = await app.request(path, {
      method,
      headers,
      body:
        options.raw !== undefined
          ? options.raw
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const json = (response.headers.get('content-type') ?? '').includes('application/json');
    const text = json ? new TextDecoder().decode(bytes) : '';
    return {
      status: response.status,
      body: text === '' ? null : JSON.parse(text),
      bytes,
      headers: response.headers,
    };
  };

  /** A phone that just installed the app: it picks its id, the server hands the secret. */
  const join = async (id: string, name: string, handle: string, code?: string) => {
    const created = await call('POST', '/account', { body: { id, name, handle, inviteCode: code } });
    return { id, token: `${id}.${created.body.secret}` };
  };

  /**
   * A phone on its first launch since ADR-0048: the id alone, no name, no handle. What
   * comes back is a bare identity, nobody in any circle yet.
   */
  const identity = async (id: string) => {
    const created = await call('POST', '/account', { body: { id } });
    return { id, token: `${id}.${created.body.secret}`, created };
  };

  /** Moves the clock forward, for the rules that are about an hour passing. */
  const wait = (ms: number) => {
    clock += ms;
  };

  return { store, push, call, join, identity, wait };
}

/**
 * Two people who accepted each other and share a challenge, with the receiver's phone
 * registered last: accepting notifies, and a push to a phone with no token is not a
 * push, so the budget starts whole.
 */
async function circleWithChallenge() {
  const kit = setup();
  const gus = await kit.join(GUS, 'Gus', 'gus', GUS_CODE);
  const ana = await kit.join(ANA, 'Ana', 'ana');
  await kit.call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });
  await kit.call('POST', '/invite/accept', { token: gus.token, body: { memberId: ANA } });
  await kit.call('POST', '/device', {
    token: ana.token,
    body: { pushToken: 'ExponentPushToken[ana]' },
  });
  await kit.call('POST', '/sync', {
    token: gus.token,
    body: {
      since: 0,
      challenges: [
        {
          id: CH1,
          name: 'Leer',
          weeklyTarget: 4,
          startWeekKey: '2026-09-21',
          participantIds: [GUS, ANA],
        },
      ],
    },
  });
  return { ...kit, gus, ana };
}

describe('accounts', () => {
  it('hands a secret on the first call and takes it back on the next', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus');

    expect(gus.token.startsWith(`${GUS}.`)).toBe(true);
    const renamed = await call('POST', '/account', {
      token: gus.token,
      body: { id: GUS, name: 'Gustavo', handle: 'gus' },
    });
    expect(renamed.status).toBe(200);

    const stolen = await call('POST', '/account', {
      token: `${GUS}.wrong`,
      body: { id: GUS, name: 'Nope', handle: 'gus' },
    });
    expect(stolen.status).toBe(401);
  });

  it('keeps handles unique and shaped', async () => {
    const { call, join } = setup();
    await join(GUS, 'Gus', 'gus');

    const taken = await call('POST', '/account', { body: { id: ANA, name: 'Ana', handle: 'GUS' } });
    const bad = await call('POST', '/account', { body: { id: ANA, name: 'Ana', handle: 'a b' } });

    expect(taken.status).toBe(409);
    expect(bad.status).toBe(400);
  });

  it('refuses everything else without credentials', async () => {
    const { call } = setup();

    expect((await call('POST', '/sync', { body: { since: 0 } })).status).toBe(401);
    expect((await call('POST', '/device', { body: {} })).status).toBe(401);
    expect((await call('GET', '/health')).status).toBe(200);
  });

  it('deletes the account and its rows', async () => {
    const { call, join, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus');
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', focusMs: 100, habitsDone: 1, habitsTarget: 4 }] },
    });

    const gone = await call('DELETE', '/account', { token: gus.token });

    expect(gone.status).toBe(204);
    expect(await store.getAccount(GUS)).toBeNull();
    expect(await store.weeksOf([GUS], 0)).toEqual([]);
  });
});

describe('restoring with the backup key', () => {
  it('hands a new phone its own profile, and nothing it should not read', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[old]' } });

    const me = await call('GET', '/account', { token: gus.token });

    expect(me.status).toBe(200);
    expect(me.body).toEqual(
      expect.objectContaining({ id: GUS, name: 'Gus', handle: 'gus', inviteCode: GUS_CODE, nudgesOn: true }),
    );
    expect(me.body).not.toHaveProperty('secretHash');
    expect(me.body).not.toHaveProperty('pushToken');
    expect((await call('GET', '/account')).status).toBe(401);
  });

  it('rotates the secret, shuts out the old phone and forgets where it pushed', async () => {
    const { call, join, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus');
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[old]' } });

    const rotated = await call('POST', '/account/secret', { token: gus.token });
    const fresh = `${GUS}.${rotated.body.secret}`;

    expect(rotated.status).toBe(200);
    expect(rotated.body.id).toBe(GUS);
    expect((await call('GET', '/account', { token: gus.token })).status).toBe(401);
    expect((await call('GET', '/account', { token: fresh })).status).toBe(200);
    expect((await store.getAccount(GUS))?.pushToken).toBeNull();
  });

  it('gives back your own marks only when asked to restore, whatever the cursor', async () => {
    const { call, gus, ana } = await circleWithChallenge();
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        marks: [
          { challengeId: CH1, dayKey: '2026-09-22', source: 'health' },
          { challengeId: CH1, dayKey: '2026-09-23', source: 'session' },
        ],
      },
    });
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: CH1, dayKey: '2026-09-22' }] },
    });

    const ordinary = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    const restored = await call('POST', '/sync', {
      token: gus.token,
      body: { since: ordinary.body.now, restore: true },
    });

    expect(ordinary.body).not.toHaveProperty('own');
    expect(ordinary.body.marks).toEqual([expect.objectContaining({ accountId: ANA })]);
    expect(restored.body.own.marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: GUS, dayKey: '2026-09-22', source: 'health' }),
        expect.objectContaining({ accountId: GUS, dayKey: '2026-09-23', source: 'session' }),
      ]),
    );
    expect(restored.body.own.marks).toHaveLength(2);
  });
});

const HOUR_MS = 60 * 60 * 1000;
const MB = 1024 * 1024;

/**
 * ADR-0048: the account is the person's identity, born on first launch with an id and a
 * secret and nothing else. Until it claims a handle it has nothing social, and that is
 * a rule the server keeps, not one it trusts the phone to keep.
 */
describe('an identity without a circle', () => {
  it('is born from an id alone, with no name and no handle', async () => {
    const { identity, call, store } = setup();

    const gus = await identity(GUS);
    const ana = await identity(ANA);

    expect(gus.created.status).toBe(201);
    expect(gus.created.body).toEqual({ id: GUS, secret: expect.any(String), handle: null });
    // Two accounts without a handle are not two claims on the same handle.
    expect(ana.created.status).toBe(201);
    expect(await store.getAccount(GUS)).toEqual(
      expect.objectContaining({ name: null, handle: null, inviteCode: null }),
    );
    const me = await call('GET', '/account', { token: gus.token });
    expect(me.body).toEqual(expect.objectContaining({ id: GUS, name: null, handle: null }));
  });

  it('takes a name and a handle together or not at all', async () => {
    const { call } = setup();

    const nameOnly = await call('POST', '/account', { body: { id: GUS, name: 'Gus' } });
    const handleOnly = await call('POST', '/account', { body: { id: GUS, handle: 'gus' } });
    const codeOnly = await call('POST', '/account', { body: { id: GUS, inviteCode: GUS_CODE } });

    expect([nameOnly.status, handleOnly.status, codeOnly.status]).toEqual([400, 400, 400]);
  });

  it('claims its circle profile later, with its secret and the usual rules', async () => {
    const { identity, join, call, store } = setup();
    await join(ANA, 'Ana', 'ana');
    const gus = await identity(GUS);

    const stranger = await call('POST', '/account', {
      body: { id: GUS, name: 'Gus', handle: 'gus' },
    });
    const taken = await call('POST', '/account', {
      token: gus.token,
      body: { id: GUS, name: 'Gus', handle: 'ana' },
    });
    const claimed = await call('POST', '/account', {
      token: gus.token,
      body: { id: GUS, name: 'Gus', handle: 'gus', inviteCode: GUS_CODE },
    });

    expect(stranger.status).toBe(401);
    expect(taken.status).toBe(409);
    expect(claimed.status).toBe(200);
    expect(claimed.body).toEqual({ id: GUS, handle: 'gus' });
    expect(await store.getAccount(GUS)).toEqual(
      expect.objectContaining({ name: 'Gus', handle: 'gus', inviteCode: GUS_CODE }),
    );
  });

  it('answers a second registration with the secret, and changes nothing', async () => {
    const { identity, join, call, store } = setup();
    const gus = await identity(GUS);
    const ana = await join(ANA, 'Ana', 'ana');

    const again = await call('POST', '/account', { token: gus.token, body: { id: GUS } });
    const hers = await call('POST', '/account', { token: ana.token, body: { id: ANA } });
    const unsure = await call('POST', '/account', { body: { id: GUS } });

    expect(again.status).toBe(200);
    expect(again.body).toEqual({ id: GUS, handle: null });
    // A bare body never takes a profile away.
    expect(hers.body).toEqual({ id: ANA, handle: 'ana' });
    expect((await store.getAccount(ANA))?.name).toBe('Ana');
    // Without the secret the id is someone else's, as it always was.
    expect(unsure.status).toBe(401);
  });

  it('spends the same budget as any new account', async () => {
    const { call } = setup();
    const idAt = (n: number) => `0199a1b2-c3d4-7e5f-8a9b-${n.toString(16).padStart(12, '0')}`;

    const made = [];
    for (let i = 1; i <= 10; i += 1) {
      const body = i % 2 === 0 ? { id: idAt(i) } : { id: idAt(i), name: 'Quien', handle: `who${i}` };
      made.push((await call('POST', '/account', { body })).status);
    }
    const eleventh = await call('POST', '/account', { body: { id: idAt(11) } });

    expect(made).toEqual(Array.from({ length: 10 }, () => 201));
    expect(eleventh.status).toBe(429);
  });

  it('cannot redeem, accept or join until it has a handle', async () => {
    const { identity, join, call, push, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[gus]' } });
    const sofia = await identity(SOF);
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, challenges: [{ id: CH1, name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21' }] },
    });

    const redeemed = await call('POST', '/invite/redeem', { token: sofia.token, body: { code: GUS_CODE } });
    const accepted = await call('POST', '/invite/accept', { token: sofia.token, body: { memberId: GUS } });
    const joined = await call('POST', '/challenge/join', { token: sofia.token, body: { challengeId: CH1 } });

    for (const refused of [redeemed, accepted, joined]) {
      expect(refused.status).toBe(409);
      expect(refused.body).toEqual({ error: 'handle required' });
    }
    // No link written, nobody woken, and nobody named by a handle that does not exist.
    expect(await store.linksOf(SOF)).toEqual([]);
    expect(push.sent).toEqual([]);
    expect((await store.getChallenge(CH1))?.participantIds).toEqual([GUS]);
  });

  it('is nobody’s member, whatever the rows say', async () => {
    const { identity, join, call, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    await identity(SOF);
    // Not reachable through the API; written by hand to show the read holds on its own.
    await store.putLink({ ownerId: GUS, memberId: SOF, status: 'member', createdAt: T0, updatedAt: T0 });
    await store.putLink({ ownerId: SOF, memberId: GUS, status: 'member', createdAt: T0, updatedAt: T0 });
    await store.putWeek({
      accountId: SOF,
      weekKey: '2026-09-21',
      focusMs: 1,
      socialMs: null,
      habitsDone: null,
      habitsTarget: null,
      updatedAt: T0,
    });

    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });

    expect(mine.body.members).toEqual([]);
    expect(mine.body.weeks).toEqual([]);
  });

  it('syncs, and writes nothing social', async () => {
    const { identity, call, store } = setup();
    const gus = await identity(GUS);

    const synced = await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        weeks: [{ weekKey: '2026-09-21', focusMs: 3600000, habitsDone: 3, habitsTarget: 4 }],
        challenges: [{ id: CH1, name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21' }],
      },
    });

    expect(synced.status).toBe(200);
    expect(synced.body).toEqual(
      expect.objectContaining({ now: expect.any(Number), members: [], weeks: [], challenges: [] }),
    );
    // The server keeps no totals of someone who does not use the circle (ADR-0048 §3).
    expect(await store.weeksOf([GUS], 0)).toEqual([]);
    expect(await store.getChallenge(CH1)).toBeNull();
  });
});

describe('what a phone says about itself', () => {
  it('takes its system and its app version, and nothing shaped otherwise', async () => {
    const { identity, call, store } = setup();
    const gus = await identity(GUS);

    const told = await call('POST', '/device', {
      token: gus.token,
      body: { platform: 'ios', appVersion: '1.4.0 (212)' },
    });
    const refused = await Promise.all(
      [
        { platform: 'windows' },
        { platform: null },
        { appVersion: '' },
        { appVersion: 'x'.repeat(33) },
        { appVersion: '1.0\n<script>' },
        { appVersion: 140 },
      ].map(async (body) => (await call('POST', '/device', { token: gus.token, body })).status),
    );

    expect(told.status).toBe(200);
    expect(await store.getAccount(GUS)).toEqual(
      expect.objectContaining({ platform: 'ios', appVersion: '1.4.0 (212)' }),
    );
    expect(refused).toEqual([400, 400, 400, 400, 400, 400]);
  });

  it('keeps the push token when a report does not mention it, and drops it on null', async () => {
    const { join, call, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus');
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[gus]' } });

    await call('POST', '/device', { token: gus.token, body: { platform: 'android', appVersion: '1.0.0' } });
    const kept = await store.getAccount(GUS);
    await call('POST', '/device', { token: gus.token, body: { pushToken: null } });
    const dropped = await store.getAccount(GUS);

    expect(kept).toEqual(
      expect.objectContaining({ pushToken: 'ExponentPushToken[gus]', platform: 'android' }),
    );
    expect(dropped).toEqual(expect.objectContaining({ pushToken: null, appVersion: '1.0.0' }));
  });

  it('is seen at most once an hour, however often it calls', async () => {
    const { identity, call, store, wait } = setup();
    const gus = await identity(GUS);
    const touches: number[] = [];
    const touch = store.touchAccount;
    store.touchAccount = async (id, at) => {
      touches.push(at);
      await touch(id, at);
    };
    const born = (await store.getAccount(GUS))?.lastSeenAt;

    for (let i = 0; i < 5; i += 1) {
      await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    }
    const stale = await store.getAccount(GUS);
    const early = stale?.lastSeenAt;
    wait(HOUR_MS);
    await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    // A write that began from the account as it was read before the touch — another
    // request in flight — cannot move it back.
    if (stale !== null) {
      await store.putAccount({ ...stale, appVersion: '1.0.1' });
    }
    await call('POST', '/device', { token: gus.token, body: { appVersion: '1.0.2' } });
    const later = (await store.getAccount(GUS))?.lastSeenAt;

    expect(born).toEqual(expect.any(Number));
    expect(early).toBe(born);
    expect(touches).toHaveLength(1);
    expect(later).toBe(touches[0]);
    expect(later).toBeGreaterThanOrEqual((born ?? 0) + HOUR_MS);
  });
});

/**
 * ADR-0048 §7: one encrypted copy of the phone's database per account. The server
 * keeps bytes it cannot read; what these tests check is that it keeps them whole, keeps
 * them apart, keeps them small, and lets them go with the account.
 */
describe('the encrypted backup', () => {
  const BACKUP_HEADERS = {
    'X-Backup-Format': '1',
    'X-Backup-Schema': '9',
    'X-Backup-Platform': 'android',
  };
  /** Stands in for ciphertext: every byte value, zero and 0xff included. */
  const blob = (size: number, seed = 0) =>
    Uint8Array.from({ length: size }, (_, i) => (i + seed) % 256);

  it('gives the bytes back as they came, with what was said about them', async () => {
    const { identity, call } = setup();
    const gus = await identity(GUS);
    const sent = blob(1000);

    const put = await call('PUT', '/backup', { token: gus.token, raw: sent, headers: BACKUP_HEADERS });
    const got = await call('GET', '/backup', { token: gus.token });
    const meta = await call('GET', '/backup/meta', { token: gus.token });

    expect(put.status).toBe(200);
    expect(put.body).toEqual({ updatedAt: expect.any(Number), size: 1000 });
    expect(got.status).toBe(200);
    expect(got.bytes).toEqual(sent);
    expect(got.headers.get('content-type')).toBe('application/octet-stream');
    expect(got.headers.get('x-backup-format')).toBe('1');
    expect(got.headers.get('x-backup-schema')).toBe('9');
    expect(got.headers.get('x-backup-platform')).toBe('android');
    expect(got.headers.get('x-backup-updated-at')).toBe(String(put.body.updatedAt));
    expect(meta.body).toEqual({
      updatedAt: put.body.updatedAt,
      size: 1000,
      schema: 9,
      platform: 'android',
      format: 1,
    });
  });

  it('deletes the copy when the backup is turned off, and keeps the account', async () => {
    const { identity, call } = setup();
    const gus = await identity(GUS);
    await call('PUT', '/backup', { token: gus.token, raw: blob(100), headers: BACKUP_HEADERS });

    const gone = await call('DELETE', '/backup', { token: gus.token });
    const again = await call('DELETE', '/backup', { token: gus.token });

    expect([gone.status, again.status]).toEqual([204, 204]);
    expect((await call('GET', '/backup/meta', { token: gus.token })).status).toBe(404);
    expect((await call('GET', '/account', { token: gus.token })).status).toBe(200);
    expect((await call('DELETE', '/backup')).status).toBe(401);
  });

  it('answers 404 when there is none', async () => {
    const { identity, call } = setup();
    const gus = await identity(GUS);

    const got = await call('GET', '/backup', { token: gus.token });
    const meta = await call('GET', '/backup/meta', { token: gus.token });

    expect([got.status, meta.status]).toEqual([404, 404]);
    expect(got.body).toEqual({ error: 'no backup' });
    expect(meta.body).toEqual({ error: 'no backup' });
  });

  it('keeps one per account, the last one', async () => {
    const { identity, call } = setup();
    const gus = await identity(GUS);

    await call('PUT', '/backup', { token: gus.token, raw: blob(500), headers: BACKUP_HEADERS });
    await call('PUT', '/backup', {
      token: gus.token,
      raw: blob(300, 7),
      headers: { ...BACKUP_HEADERS, 'X-Backup-Schema': '10', 'X-Backup-Platform': 'ios' },
    });
    const got = await call('GET', '/backup', { token: gus.token });

    expect(got.bytes).toEqual(blob(300, 7));
    expect(got.headers.get('x-backup-schema')).toBe('10');
    expect(got.headers.get('x-backup-platform')).toBe('ios');
  });

  it('is only its owner’s to read', async () => {
    const { identity, call } = setup();
    const gus = await identity(GUS);
    const ana = await identity(ANA);
    await call('PUT', '/backup', { token: gus.token, raw: blob(100), headers: BACKUP_HEADERS });

    expect((await call('GET', '/backup', { token: ana.token })).status).toBe(404);
    expect((await call('GET', '/backup')).status).toBe(401);
    expect((await call('PUT', '/backup', { raw: blob(100), headers: BACKUP_HEADERS })).status).toBe(401);
  });

  it('refuses a body it could not file, and an empty one', async () => {
    const { identity, call, store } = setup();
    const gus = await identity(GUS);
    const without = (name: string) =>
      Object.fromEntries(Object.entries(BACKUP_HEADERS).filter(([key]) => key !== name));

    const statuses = await Promise.all(
      [
        without('X-Backup-Format'),
        without('X-Backup-Schema'),
        without('X-Backup-Platform'),
        { ...BACKUP_HEADERS, 'X-Backup-Format': '0' },
        { ...BACKUP_HEADERS, 'X-Backup-Format': 'one' },
        { ...BACKUP_HEADERS, 'X-Backup-Schema': '-3' },
        { ...BACKUP_HEADERS, 'X-Backup-Schema': '2.5' },
        { ...BACKUP_HEADERS, 'X-Backup-Platform': 'web' },
      ].map(async (headers) => (await call('PUT', '/backup', { token: gus.token, raw: blob(10), headers })).status),
    );
    const empty = await call('PUT', '/backup', {
      token: gus.token,
      raw: new Uint8Array(0),
      headers: BACKUP_HEADERS,
    });

    expect(statuses).toEqual(Array.from({ length: 8 }, () => 400));
    expect(empty.status).toBe(400);
    expect(await store.getBackup(GUS)).toBeNull();
  });

  it('takes five megabytes and not a byte more, by the header and by the bytes', async () => {
    const { identity, call, store } = setup();
    const gus = await identity(GUS);

    const announced = await call('PUT', '/backup', {
      token: gus.token,
      raw: blob(10),
      headers: { ...BACKUP_HEADERS, 'Content-Length': String(6 * MB) },
    });
    const over = await call('PUT', '/backup', {
      token: gus.token,
      raw: blob(5 * MB + 1),
      headers: BACKUP_HEADERS,
    });
    const exact = await call('PUT', '/backup', {
      token: gus.token,
      raw: blob(5 * MB),
      headers: BACKUP_HEADERS,
    });

    expect(announced.status).toBe(413);
    expect(announced.body).toEqual({ error: 'backup too large' });
    expect(over.status).toBe(413);
    expect(over.body).toEqual({ error: 'backup too large' });
    expect(exact.status).toBe(200);
    expect((await store.getBackupMeta(GUS))?.size).toBe(5 * MB);
  });

  it('takes thirty uploads an hour', async () => {
    const { identity, call } = setup();
    const gus = await identity(GUS);

    const statuses = [];
    for (let i = 0; i < 31; i += 1) {
      statuses.push(
        (await call('PUT', '/backup', { token: gus.token, raw: blob(10, i), headers: BACKUP_HEADERS })).status,
      );
    }

    expect(statuses.slice(0, 30)).toEqual(Array.from({ length: 30 }, () => 200));
    expect(statuses[30]).toBe(429);
  });

  it('goes with the account', async () => {
    const { identity, call, store } = setup();
    const gus = await identity(GUS);
    await call('PUT', '/backup', { token: gus.token, raw: blob(100), headers: BACKUP_HEADERS });

    await call('DELETE', '/account', { token: gus.token });

    expect(await store.getBackup(GUS)).toBeNull();
    expect(await store.getBackupMeta(GUS)).toBeNull();
  });
});

describe('invitations', () => {
  it('leaves whoever redeems a code waiting for an answer', async () => {
    const { call, join, push } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[gus]' } });
    const ana = await join(ANA, 'Ana', 'ana', ANA_CODE);

    const redeemed = await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE.toLowerCase() } });

    expect(redeemed.body).toEqual({ ok: true, status: 'pending' });
    expect(push.sent.map((one) => one.to)).toEqual([GUS]);
    // A stranger who guessed a code does not get to write a line in someone's shade:
    // the push is silent, and identifies them by handle, never by the name they typed.
    expect(push.sent[0]?.message).toEqual({
      data: { kind: 'invite', from: ANA, fromHandle: 'ana', at: expect.any(String) },
    });
    // Nobody is in anybody's circle until the owner says yes.
    const anaSync = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(anaSync.body.members).toEqual([
      expect.objectContaining({ id: GUS, status: 'invited' }),
    ]);
  });

  it('tells the person who was accepted, and tells them nothing to read', async () => {
    const { call, join, push } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    const ana = await join(ANA, 'Ana', 'ana');
    await call('POST', '/device', { token: ana.token, body: { pushToken: 'ExponentPushToken[ana]' } });
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });

    await call('POST', '/invite/accept', { token: gus.token, body: { memberId: ANA } });

    expect(push.sent).toEqual([
      {
        to: ANA,
        message: { data: { kind: 'accepted', from: GUS, fromHandle: 'gus', at: expect.any(String) } },
      },
    ]);
  });

  it('makes it mutual when the owner accepts', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    const ana = await join(ANA, 'Ana', 'ana');
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });

    const accepted = await call('POST', '/invite/accept', { token: gus.token, body: { memberId: ANA } });

    expect(accepted.status).toBe(200);
    const gusSync = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    const anaSync = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(gusSync.body.members).toEqual([expect.objectContaining({ id: ANA, status: 'member' })]);
    expect(anaSync.body.members).toEqual([expect.objectContaining({ id: GUS, status: 'member' })]);
  });

  it('refuses a code nobody has, and your own', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);

    expect((await call('POST', '/invite/redeem', { token: gus.token, body: { code: 'QQQQQQ' } })).status).toBe(404);
    expect((await call('POST', '/invite/redeem', { token: gus.token, body: { code: GUS_CODE } })).status).toBe(409);
  });
});

describe('sync', () => {
  /** Two people who accepted each other, which is the state everything else needs. */
  async function circle() {
    const kit = setup();
    const gus = await kit.join(GUS, 'Gus', 'gus', GUS_CODE);
    const ana = await kit.join(ANA, 'Ana', 'ana');
    await kit.call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });
    await kit.call('POST', '/invite/accept', { token: gus.token, body: { memberId: ANA } });
    return { ...kit, gus, ana };
  }

  it('hands back the weeks of the people in the circle, and not of strangers', async () => {
    const { call, join, gus, ana } = await circle();
    const stranger = await join(SOF, 'Sofía', 'sofia');
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', focusMs: 3600000, habitsDone: 3, habitsTarget: 4 }] },
    });
    await call('POST', '/sync', {
      token: stranger.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', focusMs: 999, habitsDone: 1, habitsTarget: 4 }] },
    });

    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });

    expect(mine.body.weeks).toEqual([
      expect.objectContaining({ accountId: ANA, focusMs: 3600000, socialMs: null }),
    ]);
  });

  it('keeps a metric the phone does not share as null, never as zero', async () => {
    const { call, gus, ana } = await circle();

    // Ana shares her habits but not her focus hours nor her social floor.
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', habitsDone: 3, habitsTarget: 4 }] },
    });

    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });

    expect(mine.body.weeks).toEqual([
      expect.objectContaining({
        accountId: ANA,
        focusMs: null,
        socialMs: null,
        habitsDone: 3,
        habitsTarget: 4,
      }),
    ]);
  });

  it('writes a week as the caller, whatever the body claims', async () => {
    const { call, gus, store } = await circle();

    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        weeks: [{ accountId: ANA, weekKey: '2026-09-21', focusMs: 1, habitsDone: 0, habitsTarget: 4 }],
      },
    });

    expect((await store.weeksOf([ANA], 0)).length).toBe(0);
    expect((await store.weeksOf([GUS], 0))[0]?.focusMs).toBe(1);
  });

  it('moves the cursor: what was already sent does not come back', async () => {
    const { call, gus, ana } = await circle();
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', focusMs: 10, habitsDone: 1, habitsTarget: 4 }] },
    });

    const first = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    const second = await call('POST', '/sync', { token: gus.token, body: { since: first.body.now } });

    expect(first.body.weeks.length).toBe(1);
    expect(second.body.weeks).toEqual([]);
    expect(second.body.members).toEqual([]);
  });

  it('lets only the maker change a challenge, and only participants mark it', async () => {
    const { call, gus, ana, store } = await circle();
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          {
            id: CH1,
            name: 'Leer',
            weeklyTarget: 4,
            startWeekKey: '2026-09-21',
            endDayKey: '2026-10-11',
            participantIds: [GUS, ANA],
          },
        ],
      },
    });

    const hijack = await call('POST', '/sync', {
      token: ana.token,
      body: {
        since: 0,
        challenges: [{ id: CH1, name: 'Otra cosa', weeklyTarget: 2, startWeekKey: '2026-09-21' }],
      },
    });
    const marked = await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: CH1, dayKey: '2026-09-22' }] },
    });

    expect(hijack.body.rejected).toEqual([CH1]);
    expect((await store.getChallenge(CH1))?.name).toBe('Leer');
    expect(marked.body.rejected).toEqual([]);
    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.marks).toEqual([
      expect.objectContaining({ challengeId: CH1, accountId: ANA, dayKey: '2026-09-22' }),
    ]);
  });

  it('carries where a mark came from, and reads anything unknown as manual', async () => {
    const { call, gus, ana } = await circle();
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, challenges: [{ id: CH1, name: 'Caminar 10.000 pasos', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: [GUS, ANA] }] },
    });
    await call('POST', '/sync', {
      token: ana.token,
      body: {
        since: 0,
        marks: [
          { challengeId: CH1, dayKey: '2026-09-22', source: 'health' },
          { challengeId: CH1, dayKey: '2026-09-23', source: 'watch' },
        ],
      },
    });

    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dayKey: '2026-09-22', source: 'health' }),
        expect.objectContaining({ dayKey: '2026-09-23', source: 'manual' }),
      ]),
    );
  });

  it('refuses a mark on a challenge you are not in, and unmarks with marked false', async () => {
    const { call, join, gus, ana } = await circle();
    const stranger = await join(SOF, 'Sofía', 'sofia');
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: CH1, name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: [GUS, ANA] },
        ],
      },
    });

    const refused = await call('POST', '/sync', {
      token: stranger.token,
      body: { since: 0, marks: [{ challengeId: CH1, dayKey: '2026-09-22' }] },
    });
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: CH1, dayKey: '2026-09-22' }] },
    });
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: CH1, dayKey: '2026-09-22', marked: false }] },
    });

    expect(refused.body.rejected).toEqual([`${CH1}/2026-09-22`]);
    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.marks).toEqual([]);
  });

  it('takes a cheer only for someone in the circle', async () => {
    const { call, join, gus, ana } = await circle();
    const stranger = await join(SOF, 'Sofía', 'sofia');

    const ok = await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, kudos: [{ id: K1, toId: ANA, dayKey: '2026-09-21' }] },
    });
    const no = await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, kudos: [{ id: K2, toId: SOF, dayKey: '2026-09-21' }] },
    });

    expect(ok.body.rejected).toEqual([]);
    expect(no.body.rejected).toEqual([K2]);
    const hers = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(hers.body.kudos).toEqual([expect.objectContaining({ fromId: GUS, toId: ANA })]);
    const theirs = await call('POST', '/sync', { token: stranger.token, body: { since: 0 } });
    expect(theirs.body.kudos).toEqual([]);
  });

  it('delivers a nudge between two people in the same challenge, and respects the switch', async () => {
    const { call, gus, ana, push } = await circle();
    await call('POST', '/device', { token: ana.token, body: { pushToken: 'ExponentPushToken[ana]' } });
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: CH1, name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: [GUS, ANA] },
        ],
      },
    });

    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, nudges: [{ id: N1, toId: ANA, challengeId: CH1, dayKey: '2026-09-22' }] },
    });

    // Silent and data only (ADR-0037 §1): the server sends the fact, the phone writes
    // the sentence when rule 11 lets it. No title, no body, no challenge name.
    expect(push.sent).toEqual([
      {
        to: ANA,
        message: {
          data: { kind: 'nudge', from: GUS, fromHandle: 'gus', at: expect.any(String), challengeId: CH1 },
          requiresNudges: true,
        },
      },
    ]);
    expect(Number(push.sent[0]?.message.data.at)).toBeGreaterThan(T0);

    // With nudges off, the row still travels; the phone just does not ring.
    await call('POST', '/device', { token: ana.token, body: { pushToken: 'ExponentPushToken[ana]', nudgesOn: false } });
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, nudges: [{ id: N2, toId: ANA, challengeId: CH1, dayKey: '2026-09-23' }] },
    });

    expect(push.sent.length).toBe(1);
    const hers = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(hers.body.nudges.length).toBe(2);
  });

  it('refuses a nudge from outside the challenge', async () => {
    const { call, join, gus } = await circle();
    const stranger = await join(SOF, 'Sofía', 'sofia');
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: CH1, name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: [GUS, ANA] },
        ],
      },
    });

    const refused = await call('POST', '/sync', {
      token: stranger.token,
      body: { since: 0, nudges: [{ id: N9, toId: ANA, challengeId: CH1, dayKey: '2026-09-22' }] },
    });

    expect(refused.body.rejected).toEqual([N9]);
  });
});

describe('joining a challenge', () => {
  it('only works inside the maker circle', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    const ana = await join(ANA, 'Ana', 'ana');
    const stranger = await join(SOF, 'Sofía', 'sofia');
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });
    await call('POST', '/invite/accept', { token: gus.token, body: { memberId: ANA } });
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: CH1, name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: [GUS] },
        ],
      },
    });

    const joined = await call('POST', '/challenge/join', { token: ana.token, body: { challengeId: CH1 } });
    const refused = await call('POST', '/challenge/join', { token: stranger.token, body: { challengeId: CH1 } });

    expect(joined.status).toBe(200);
    expect(refused.status).toBe(403);
    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.challenges[0].participantIds).toEqual([GUS, ANA]);
  });
});

describe('the invite code belongs to one account', () => {
  /**
   * The hijack this closes: the code is six symbols on a screen, in a QR and in a
   * `/join?code=` link, so everyone who sees it can type it. Before, whoever typed it
   * into `POST /account` first got a second row with the same code, and redeeming it
   * resolved to whichever row the database reached first.
   */
  it('refuses a code that does not come out of the account id', async () => {
    const { call } = setup();

    const stolen = await call('POST', '/account', {
      body: { id: ANA, name: 'Ana', handle: 'ana', inviteCode: GUS_CODE },
    });

    expect(stolen.status).toBe(400);
    expect(stolen.body.error).toContain('does not derive');
  });

  it('keeps the code for whoever claimed it first', async () => {
    // Two ids that derive the same code. They exist — the derivation is FNV-1a, not a
    // signature, so a patient attacker can grind one out. That is precisely why the
    // unique constraint, and not the derivation, is what decides who holds a code.
    const TWIN_A = '0199a1b2-c3d4-7e5f-8a9b-00000000001a';
    const TWIN_B = '0199a1b2-c3d4-7e5f-8a9b-0000000000a1';
    const TWIN_CODE = 'RQTAML';
    const { call, store } = setup();

    const first = await call('POST', '/account', {
      body: { id: TWIN_A, name: 'Gus', handle: 'gus', inviteCode: TWIN_CODE },
    });
    const second = await call('POST', '/account', {
      body: { id: TWIN_B, name: 'Otro', handle: 'otro', inviteCode: TWIN_CODE },
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: 'invite code taken' });
    expect((await store.getAccountByInviteCode(TWIN_CODE))?.id).toBe(TWIN_A);
  });

  it('lets the owner keep its own code across a rename', async () => {
    const { call, join, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);

    const renamed = await call('POST', '/account', {
      token: gus.token,
      body: { id: GUS, name: 'Gustavo', handle: 'gus', inviteCode: GUS_CODE },
    });

    expect(renamed.status).toBe(200);
    expect((await store.getAccount(GUS))?.inviteCode).toBe(GUS_CODE);
  });

  it('takes the next generation of the code, and a body without one keeps it', async () => {
    const { call, join, store } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);

    // 'Generar código nuevo' bumps the generation; the code it shows next is derived.
    const rolled = await call('POST', '/account', {
      token: gus.token,
      body: { id: GUS, name: 'Gus', handle: 'gus', inviteCode: '7SRUK6', codeGeneration: 1 },
    });
    expect(rolled.status).toBe(200);
    expect((await store.getAccount(GUS))?.inviteCode).toBe('7SRUK6');

    await call('POST', '/account', { token: gus.token, body: { id: GUS, name: 'Gus', handle: 'gus' } });
    expect((await store.getAccount(GUS))?.inviteCode).toBe('7SRUK6');

    await call('POST', '/account', {
      token: gus.token,
      body: { id: GUS, name: 'Gus', handle: 'gus', inviteCode: null },
    });
    expect((await store.getAccount(GUS))?.inviteCode).toBeNull();
  });

  it('refuses a code from a generation nobody could have reached', async () => {
    const { call } = setup();

    const far = await call('POST', '/account', {
      body: { id: GUS, name: 'Gus', handle: 'gus', inviteCode: GUS_CODE, codeGeneration: 99999 },
    });
    const shapeless = await call('POST', '/account', {
      body: { id: GUS, name: 'Gus', handle: 'gus', inviteCode: 'ABC' },
    });

    expect(far.status).toBe(400);
    expect(shapeless.status).toBe(400);
  });

  it('refuses two accounts with one handle at the store, not only at the check', async () => {
    // The check before the write loses a race; the constraint does not. This is what
    // Postgres raises as 23505 and what the API turns into a 409.
    const { store } = setup();
    const row = {
      secretHash: 'x',
      name: 'Gus',
      handle: 'gus',
      inviteCode: null,
      pushToken: null,
      timeZone: null,
      nudgesOn: true,
      platform: null,
      appVersion: null,
      lastSeenAt: null,
      createdAt: T0,
      updatedAt: T0,
    };
    await store.putAccount({ ...row, id: GUS });

    await expect(store.putAccount({ ...row, id: ANA })).rejects.toThrow('handle taken');
    await expect(
      store.putAccount({ ...row, id: ANA, handle: 'ana', inviteCode: GUS_CODE }),
    ).resolves.toBeUndefined();
    await expect(
      store.putAccount({ ...row, id: SOF, handle: 'sof', inviteCode: GUS_CODE }),
    ).rejects.toThrow('inviteCode taken');
  });
});

describe('what a caller may write', () => {
  it('insists on the id the phone generates', async () => {
    const { call } = setup();

    const short = await call('POST', '/account', { body: { id: 'gus-1', name: 'Gus', handle: 'gus' } });
    const v4 = await call('POST', '/account', {
      body: { id: '0199a1b2-c3d4-4e5f-8a9b-000000000001', name: 'Gus', handle: 'gus' },
    });
    const huge = await call('POST', '/account', {
      body: { id: `${GUS}${'0'.repeat(4000)}`, name: 'Gus', handle: 'gus' },
    });

    expect([short.status, v4.status, huge.status]).toEqual([400, 400, 400]);
  });

  it('caps a name, a push token and a time zone', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus');

    const long = await call('POST', '/account', {
      body: { id: ANA, name: 'a'.repeat(200), handle: 'ana' },
    });
    const zone = await call('POST', '/device', {
      token: gus.token,
      body: { timeZone: 'Bogotá; drop table accounts' },
    });
    const token = await call('POST', '/device', {
      token: gus.token,
      body: { pushToken: 'x'.repeat(500) },
    });

    expect([long.status, zone.status, token.status]).toEqual([400, 400, 400]);
    expect((await call('POST', '/device', { token: gus.token, body: { timeZone: 'America/Bogota' } })).status).toBe(200);
  });

  it('drops rows whose ids no phone could have written', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus');

    const synced = await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [{ id: 'ch-1', name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21' }],
        weeks: [{ weekKey: 'esta semana', focusMs: 1 }],
      },
    });

    expect(synced.body.challenges).toEqual([]);
    expect(synced.body.weeks).toEqual([]);
  });

  it('refuses a sync that carries more rows than a phone has', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus');

    const flood = await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, weeks: Array.from({ length: 501 }, () => ({ weekKey: '2026-09-21' })) },
    });

    expect(flood.status).toBe(400);
    expect(flood.body.error).toContain('too many weeks');
  });
});

describe('budgets', () => {
  /** Ids in a row, so a test can make more accounts than one address is allowed. */
  const idAt = (n: number) => `0199a1b2-c3d4-7e5f-8a9b-${n.toString(16).padStart(12, '0')}`;

  it('stops a caller guessing codes', async () => {
    const { call, join } = setup();
    const ana = await join(ANA, 'Ana', 'ana');

    const tried = [];
    for (let i = 0; i < 11; i += 1) {
      tried.push(
        (await call('POST', '/invite/redeem', { token: ana.token, body: { code: 'QQQQQQ' } })).status,
      );
    }

    // Ten misses answer 'unknown code'; the eleventh does not get to ask.
    expect(tried.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 404));
    expect(tried[10]).toBe(429);
  });

  it('stops one address minting accounts', async () => {
    const { call } = setup();

    const made = [];
    for (let i = 1; i <= 11; i += 1) {
      made.push(
        (await call('POST', '/account', { body: { id: idAt(i), name: 'Quien', handle: `who${i}` } }))
          .status,
      );
    }

    expect(made.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 201));
    expect(made[10]).toBe(429);
  });

  it('writes every nudge and notifies only the first few', async () => {
    const { call, push, gus, ana } = await circleWithChallenge();

    for (let day = 1; day <= 7; day += 1) {
      await call('POST', '/sync', {
        token: gus.token,
        body: {
          since: 0,
          nudges: [
            {
              id: idAt(0xd0 + day),
              toId: ana.id,
              challengeId: CH1,
              dayKey: `2026-09-2${day}`,
            },
          ],
        },
      });
    }

    // The rows are all there — the sync never drops what it is allowed to write.
    const hers = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(hers.body.nudges.length).toBe(7);
    // The wake-ups stop at the budget: a person in your challenge cannot poke your
    // phone all afternoon. ADR-0037 leaves this limit exactly where it was.
    expect(push.sent.length).toBe(5);
  });
});

/**
 * The rule this file stands guard over, across every endpoint that can cause a push:
 * nothing the server sends is a visible alert (ADR-0037 §1). The reason is rule 11 —
 * the circle never notifies during a session — and a visible alert is drawn by the
 * operating system before the app can decide anything about it.
 */
describe('no push carries anything to show', () => {
  it('sends facts, never sentences, whatever the endpoint', async () => {
    const { call, join, push, gus, ana } = await circleWithChallenge();
    // Sofía redeems Gus's code and he accepts: the two other push paths.
    const sofia = await join(SOF, 'Sofía', 'sofia');
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[gus]' } });
    await call('POST', '/device', { token: sofia.token, body: { pushToken: 'ExponentPushToken[sofia]' } });
    await call('POST', '/invite/redeem', { token: sofia.token, body: { code: GUS_CODE } });
    await call('POST', '/invite/accept', { token: gus.token, body: { memberId: SOF } });
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, nudges: [{ id: N1, toId: ana.id, challengeId: CH1, dayKey: '2026-09-22' }] },
    });

    expect(push.sent.map((one) => one.message.data.kind).sort()).toEqual([
      'accepted',
      'invite',
      'nudge',
    ]);
    for (const { message } of push.sent) {
      // Not a sentence anywhere, and not the sender's free-text name: a handle, ids, a
      // kind and an instant. Nothing a person would read.
      expect(message).not.toHaveProperty('title');
      expect(message).not.toHaveProperty('body');
      for (const value of Object.values(message.data)) {
        expect(value).not.toMatch(/\s/);
      }
      expect(Object.values(message.data)).not.toContain('Gus');
      expect(Object.values(message.data)).not.toContain('Leer');
    }
  });
});

describe('ending a link (ADR-0049)', () => {
  const CH2 = '0199a1b2-c3d4-7e5f-8a9b-0000000000c2';
  const K3 = '0199a1b2-c3d4-7e5f-8a9b-00000000a003';

  it('declines a request: the one who asked learns it, and may ask again', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    const ana = await join(ANA, 'Ana', 'ana');
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });
    const before = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });

    const declined = await call('POST', '/link/end', { token: gus.token, body: { memberId: ANA } });

    expect(declined.body).toEqual({ ok: true, ended: 1 });
    const after = await call('POST', '/sync', { token: ana.token, body: { since: before.body.now } });
    expect(after.body.ended).toEqual([GUS]);
    expect(after.body.members).toEqual([]);
    const gusSync = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(gusSync.body.members).toEqual([]);

    // A new request supersedes the end: a phone starting from zero sees the request, not the end.
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });
    const again = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(again.body.ended).toEqual([]);
    expect(again.body.members).toEqual([expect.objectContaining({ id: ANA, status: 'pending' })]);
  });

  it('removes a member: they stop seeing your week, stop cheering you, and leave your challenges', async () => {
    const { call, gus, ana } = await circleWithChallenge();
    const cursor = (await call('POST', '/sync', { token: ana.token, body: { since: 0 } })).body.now;

    const removed = await call('POST', '/link/end', { token: gus.token, body: { memberId: ANA } });

    expect(removed.status).toBe(200);
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', focusMs: 3600000, habitsDone: 1, habitsTarget: 2 }] },
    });
    const anaSync = await call('POST', '/sync', {
      token: ana.token,
      body: { since: cursor, kudos: [{ id: K3, toId: GUS, dayKey: '2026-09-22' }] },
    });
    expect(anaSync.body.ended).toEqual([GUS]);
    expect(anaSync.body.weeks).toEqual([]);
    expect(anaSync.body.rejected).toContain(K3);
    // The challenge Gus made no longer reaches Ana at all: her phone archives it when it
    // learns the end, because its maker is not in her circle any more.
    expect(anaSync.body.challenges).toEqual([]);
    const gusSync = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(gusSync.body.challenges[0].participantIds).toEqual([GUS]);
    expect(gusSync.body.ended).toEqual([ANA]);
  });

  it('takes the one who ends it out of the challenges the other one made', async () => {
    const { call, gus, ana } = await circleWithChallenge();
    await call('POST', '/sync', {
      token: ana.token,
      body: {
        since: 0,
        challenges: [{ id: CH2, name: 'Correr', weeklyTarget: 3, startWeekKey: '2026-09-21', participantIds: [ANA, GUS] }],
      },
    });

    await call('POST', '/link/end', { token: gus.token, body: { memberId: ANA } });

    const anaSync = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    const correr = anaSync.body.challenges.find((challenge: { id: string }) => challenge.id === CH2);
    expect(correr.participantIds).toEqual([ANA]);
  });

  it('leaves the whole circle with everyone: true', async () => {
    const { call, join, gus, ana } = await circleWithChallenge();
    const sof = await join(SOF, 'Sofía', 'sofia');
    await call('POST', '/invite/redeem', { token: sof.token, body: { code: GUS_CODE } });

    const left = await call('POST', '/link/end', { token: gus.token, body: { everyone: true } });

    expect(left.body).toEqual({ ok: true, ended: 2 });
    expect((await call('POST', '/sync', { token: ana.token, body: { since: 0 } })).body.ended).toEqual([GUS]);
    expect((await call('POST', '/sync', { token: sof.token, body: { since: 0 } })).body.ended).toEqual([GUS]);
    expect((await call('POST', '/sync', { token: gus.token, body: { since: 0 } })).body.members).toEqual([]);
  });

  it('answers 200 to a link that is already gone, and tells a stranger nothing', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);
    const stranger = await join(SOF, 'Sofía', 'sofia');

    const nothing = await call('POST', '/link/end', { token: gus.token, body: { memberId: SOF } });

    expect(nothing.body).toEqual({ ok: true, ended: 0 });
    expect((await call('POST', '/sync', { token: stranger.token, body: { since: 0 } })).body.ended).toEqual([]);
  });

  it('refuses a body with no one to end, or with yourself', async () => {
    const { call, join } = setup();
    const gus = await join(GUS, 'Gus', 'gus', GUS_CODE);

    expect((await call('POST', '/link/end', { token: gus.token, body: {} })).status).toBe(400);
    expect((await call('POST', '/link/end', { token: gus.token, body: { memberId: 'ana' } })).status).toBe(400);
    expect((await call('POST', '/link/end', { token: gus.token, body: { memberId: GUS } })).status).toBe(400);
    expect((await call('POST', '/link/end', { body: { memberId: ANA } })).status).toBe(401);
  });
});

describe('leaving a challenge (ADR-0049)', () => {
  it('takes the caller out, so nobody sees them in it or can nudge them in it', async () => {
    const { call, gus, ana } = await circleWithChallenge();

    const left = await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: CH1 } });

    expect(left.status).toBe(200);
    const gusSync = await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, nudges: [{ id: N9, toId: ANA, challengeId: CH1, dayKey: '2026-09-22' }] },
    });
    expect(gusSync.body.challenges[0].participantIds).toEqual([GUS]);
    expect(gusSync.body.rejected).toContain(N9);
    // Still in each other's circle: leaving a challenge ends no link.
    expect(gusSync.body.members).toEqual([expect.objectContaining({ id: ANA, status: 'member' })]);
  });

  it('answers 200 to a challenge already left or unknown, and 400 to a malformed id', async () => {
    const { call, ana } = await circleWithChallenge();
    await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: CH1 } });

    expect((await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: CH1 } })).status).toBe(200);
    expect(
      (await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: '0199a1b2-c3d4-7e5f-8a9b-0000000000ff' } }))
        .status,
    ).toBe(200);
    expect((await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: 'nope' } })).status).toBe(400);
  });
});
