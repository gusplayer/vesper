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

describe('accounts', () => {
  it('hands a secret on the first call and takes it back on the next', async () => {
    const { call, join } = setup();
    const gus = await join('gus-1', 'Gus', 'gus');

    expect(gus.token.startsWith('gus-1.')).toBe(true);
    const renamed = await call('POST', '/account', {
      token: gus.token,
      body: { id: 'gus-1', name: 'Gustavo', handle: 'gus' },
    });
    expect(renamed.status).toBe(200);

    const stolen = await call('POST', '/account', {
      token: 'gus-1.wrong',
      body: { id: 'gus-1', name: 'Nope', handle: 'gus' },
    });
    expect(stolen.status).toBe(401);
  });

  it('keeps handles unique and shaped', async () => {
    const { call, join } = setup();
    await join('gus-1', 'Gus', 'gus');

    const taken = await call('POST', '/account', { body: { id: 'ana-1', name: 'Ana', handle: 'GUS' } });
    const bad = await call('POST', '/account', { body: { id: 'ana-1', name: 'Ana', handle: 'a b' } });

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
    const gus = await join('gus-1', 'Gus', 'gus');
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, weeks: [{ weekKey: '2026-09-21', focusMs: 100, habitsDone: 1, habitsTarget: 4 }] },
    });

    const gone = await call('DELETE', '/account', { token: gus.token });

    expect(gone.status).toBe(204);
    expect(await store.getAccount('gus-1')).toBeNull();
    expect(await store.weeksOf(['gus-1'], 0)).toEqual([]);
  });
});

describe('invitations', () => {
  it('leaves whoever redeems a code waiting for an answer', async () => {
    const { call, join, push } = setup();
    const gus = await join('gus-1', 'Gus', 'gus', 'ABC234');
    await call('POST', '/device', { token: gus.token, body: { pushToken: 'ExponentPushToken[gus]' } });
    const ana = await join('ana-1', 'Ana', 'ana', 'XYZ789');

    const redeemed = await call('POST', '/invite/redeem', { token: ana.token, body: { code: 'abc234' } });

    expect(redeemed.body).toEqual({ ok: true, status: 'pending' });
    expect(push.sent.map((one) => one.to)).toEqual(['gus-1']);
    // Nobody is in anybody's circle until the owner says yes.
    const anaSync = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(anaSync.body.members).toEqual([
      expect.objectContaining({ id: 'gus-1', status: 'invited' }),
    ]);
  });

  it('makes it mutual when the owner accepts', async () => {
    const { call, join } = setup();
    const gus = await join('gus-1', 'Gus', 'gus', 'ABC234');
    const ana = await join('ana-1', 'Ana', 'ana');
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: 'ABC234' } });

    const accepted = await call('POST', '/invite/accept', { token: gus.token, body: { memberId: 'ana-1' } });

    expect(accepted.status).toBe(200);
    const gusSync = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    const anaSync = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(gusSync.body.members).toEqual([expect.objectContaining({ id: 'ana-1', status: 'member' })]);
    expect(anaSync.body.members).toEqual([expect.objectContaining({ id: 'gus-1', status: 'member' })]);
  });

  it('refuses a code nobody has, and your own', async () => {
    const { call, join } = setup();
    const gus = await join('gus-1', 'Gus', 'gus', 'ABC234');

    expect((await call('POST', '/invite/redeem', { token: gus.token, body: { code: 'QQQQQQ' } })).status).toBe(404);
    expect((await call('POST', '/invite/redeem', { token: gus.token, body: { code: 'ABC234' } })).status).toBe(409);
  });
});

describe('sync', () => {
  /** Two people who accepted each other, which is the state everything else needs. */
  async function circle() {
    const kit = setup();
    const gus = await kit.join('gus-1', 'Gus', 'gus', 'ABC234');
    const ana = await kit.join('ana-1', 'Ana', 'ana');
    await kit.call('POST', '/invite/redeem', { token: ana.token, body: { code: 'ABC234' } });
    await kit.call('POST', '/invite/accept', { token: gus.token, body: { memberId: 'ana-1' } });
    return { ...kit, gus, ana };
  }

  it('hands back the weeks of the people in the circle, and not of strangers', async () => {
    const { call, join, gus, ana } = await circle();
    const stranger = await join('sof-1', 'Sofía', 'sofia');
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
      expect.objectContaining({ accountId: 'ana-1', focusMs: 3600000, socialMs: null }),
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
        accountId: 'ana-1',
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
        weeks: [{ accountId: 'ana-1', weekKey: '2026-09-21', focusMs: 1, habitsDone: 0, habitsTarget: 4 }],
      },
    });

    expect((await store.weeksOf(['ana-1'], 0)).length).toBe(0);
    expect((await store.weeksOf(['gus-1'], 0))[0]?.focusMs).toBe(1);
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
            id: 'ch-1',
            name: 'Leer',
            weeklyTarget: 4,
            startWeekKey: '2026-09-21',
            endDayKey: '2026-10-11',
            participantIds: ['gus-1', 'ana-1'],
          },
        ],
      },
    });

    const hijack = await call('POST', '/sync', {
      token: ana.token,
      body: {
        since: 0,
        challenges: [{ id: 'ch-1', name: 'Otra cosa', weeklyTarget: 2, startWeekKey: '2026-09-21' }],
      },
    });
    const marked = await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: 'ch-1', dayKey: '2026-09-22' }] },
    });

    expect(hijack.body.rejected).toEqual(['ch-1']);
    expect((await store.getChallenge('ch-1'))?.name).toBe('Leer');
    expect(marked.body.rejected).toEqual([]);
    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.marks).toEqual([
      expect.objectContaining({ challengeId: 'ch-1', accountId: 'ana-1', dayKey: '2026-09-22' }),
    ]);
  });

  it('refuses a mark on a challenge you are not in, and unmarks with marked false', async () => {
    const { call, join, gus, ana } = await circle();
    const stranger = await join('sof-1', 'Sofía', 'sofia');
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: 'ch-1', name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: ['gus-1', 'ana-1'] },
        ],
      },
    });

    const refused = await call('POST', '/sync', {
      token: stranger.token,
      body: { since: 0, marks: [{ challengeId: 'ch-1', dayKey: '2026-09-22' }] },
    });
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: 'ch-1', dayKey: '2026-09-22' }] },
    });
    await call('POST', '/sync', {
      token: ana.token,
      body: { since: 0, marks: [{ challengeId: 'ch-1', dayKey: '2026-09-22', marked: false }] },
    });

    expect(refused.body.rejected).toEqual(['ch-1/2026-09-22']);
    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.marks).toEqual([]);
  });

  it('takes a cheer only for someone in the circle', async () => {
    const { call, join, gus, ana } = await circle();
    const stranger = await join('sof-1', 'Sofía', 'sofia');

    const ok = await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, kudos: [{ id: 'k-1', toId: 'ana-1', dayKey: '2026-09-21' }] },
    });
    const no = await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, kudos: [{ id: 'k-2', toId: 'sof-1', dayKey: '2026-09-21' }] },
    });

    expect(ok.body.rejected).toEqual([]);
    expect(no.body.rejected).toEqual(['k-2']);
    const hers = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(hers.body.kudos).toEqual([expect.objectContaining({ fromId: 'gus-1', toId: 'ana-1' })]);
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
          { id: 'ch-1', name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: ['gus-1', 'ana-1'] },
        ],
      },
    });

    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, nudges: [{ id: 'n-1', toId: 'ana-1', challengeId: 'ch-1', dayKey: '2026-09-22' }] },
    });

    expect(push.sent).toEqual([
      {
        to: 'ana-1',
        message: expect.objectContaining({ title: 'Gus te empuja', body: 'hoy no has marcado Leer.' }),
      },
    ]);

    // With nudges off, the row still travels; the phone just does not ring.
    await call('POST', '/device', { token: ana.token, body: { pushToken: 'ExponentPushToken[ana]', nudgesOn: false } });
    await call('POST', '/sync', {
      token: gus.token,
      body: { since: 0, nudges: [{ id: 'n-2', toId: 'ana-1', challengeId: 'ch-1', dayKey: '2026-09-23' }] },
    });

    expect(push.sent.length).toBe(1);
    const hers = await call('POST', '/sync', { token: ana.token, body: { since: 0 } });
    expect(hers.body.nudges.length).toBe(2);
  });

  it('refuses a nudge from outside the challenge', async () => {
    const { call, join, gus } = await circle();
    const stranger = await join('sof-1', 'Sofía', 'sofia');
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: 'ch-1', name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: ['gus-1', 'ana-1'] },
        ],
      },
    });

    const refused = await call('POST', '/sync', {
      token: stranger.token,
      body: { since: 0, nudges: [{ id: 'n-9', toId: 'ana-1', challengeId: 'ch-1', dayKey: '2026-09-22' }] },
    });

    expect(refused.body.rejected).toEqual(['n-9']);
  });
});

describe('joining a challenge', () => {
  it('only works inside the maker circle', async () => {
    const { call, join } = setup();
    const gus = await join('gus-1', 'Gus', 'gus', 'ABC234');
    const ana = await join('ana-1', 'Ana', 'ana');
    const stranger = await join('sof-1', 'Sofía', 'sofia');
    await call('POST', '/invite/redeem', { token: ana.token, body: { code: 'ABC234' } });
    await call('POST', '/invite/accept', { token: gus.token, body: { memberId: 'ana-1' } });
    await call('POST', '/sync', {
      token: gus.token,
      body: {
        since: 0,
        challenges: [
          { id: 'ch-1', name: 'Leer', weeklyTarget: 4, startWeekKey: '2026-09-21', participantIds: ['gus-1'] },
        ],
      },
    });

    const joined = await call('POST', '/challenge/join', { token: ana.token, body: { challengeId: 'ch-1' } });
    const refused = await call('POST', '/challenge/join', { token: stranger.token, body: { challengeId: 'ch-1' } });

    expect(joined.status).toBe(200);
    expect(refused.status).toBe(403);
    const mine = await call('POST', '/sync', { token: gus.token, body: { since: 0 } });
    expect(mine.body.challenges[0].participantIds).toEqual(['gus-1', 'ana-1']);
  });
});
