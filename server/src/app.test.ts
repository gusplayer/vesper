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

  const call = async (
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.token !== undefined) {
      headers.Authorization = `Bearer ${options.token}`;
    }
    const response = await app.request(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : JSON.parse(text) };
  };

  /** A phone that just installed the app: it picks its id, the server hands the secret. */
  const join = async (id: string, name: string, handle: string, code?: string) => {
    const created = await call('POST', '/account', { body: { id, name, handle, inviteCode: code } });
    return { id, token: `${id}.${created.body.secret}` };
  };

  return { store, push, call, join };
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
