import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { inviteCodeFor } from '../domain/circle';
import { ME, type Challenge, type HabitMark, type Member, type Profile } from '../domain/types';
import {
  backupKeyGroups,
  backupKeyOf,
  BACKUP_GROUP_SIZE,
  buildUpload,
  CIRCLE_API_URL,
  claimAccount,
  cleanHandle,
  createIdentity,
  credentialsFrom,
  credentialsFromPastedKey,
  deleteAccount,
  deviceBody,
  foldDownload,
  getAccount,
  isValidHandle,
  markIdOf,
  putAccount,
  putDevice,
  readAccount,
  readDownload,
  redeemInvite,
  retryAfterMs,
  rotateSecret,
  sync,
  type Credentials,
  type SyncDownload,
} from './circleApi';

/**
 * The client's half of the contract in server/README.md, driven with a fake `fetch`
 * like server/src/push.test.ts drives the real sender. Nothing here reaches the
 * deployed server: its database is empty on purpose and stays that way.
 *
 * What is guarded: the shape of every request, the two answers that mean something
 * other than "it failed" (409 invite code taken, 429), the fold of `/sync`, and the
 * promise that no call throws when there is no network.
 */

const ID = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const CHALLENGE = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const KUDOS = '0199a1b2-c3d4-7e5f-8a9b-0000000000k1'.replace('k', 'a');

const CREDENTIALS: Credentials = { id: ID, secret: 'a-secret' };

const PROFILE: Profile = { id: ID, name: 'Gus', handle: 'gus', codeGeneration: 0, createdAt: 1 };

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

/** Records every request and answers with the queued replies, in order. */
function fakeFetch(replies: Reply[]) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = init?.headers;
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (headers ?? {}) as Record<string, string>,
      body: init?.body === undefined || init.body === null ? undefined : JSON.parse(String(init.body)),
    });
    const reply = replies.shift() ?? { status: 200, body: {} };
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: reply.headers,
    });
  }) as unknown as typeof fetch;
  globalThis.fetch = impl;
  return calls;
}

/** The one call there should be, so a missing request fails as a missing request. */
function only(calls: readonly Call[]): Call {
  expect(calls.length).toBe(1);
  const call = calls[0];
  if (call === undefined) {
    throw new Error('nothing was sent');
  }
  return call;
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = realFetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('what a request looks like', () => {
  it('creates an account without an Authorization header', async () => {
    const calls = fakeFetch([{ status: 201, body: { id: ID, secret: 's3cret', handle: 'gus' } }]);

    const result = await putAccount({ id: ID, name: 'Gus', handle: 'gus' }, null);

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/account`);
    expect(call.method).toBe('POST');
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.body).toEqual({ id: ID, name: 'Gus', handle: 'gus' });
    expect(result).toEqual({ ok: true, value: { id: ID, handle: 'gus', secret: 's3cret' } });
  });

  it('signs every other call with `Bearer <id>.<secret>`', async () => {
    const calls = fakeFetch([{ status: 200, body: { ok: true, status: 'pending' } }]);

    await redeemInvite(CREDENTIALS, 'ABC234');

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/invite/redeem`);
    expect(call.headers.Authorization).toBe(`Bearer ${ID}.a-secret`);
    expect(call.body).toEqual({ code: 'ABC234' });
  });

  it('cuts a name to the forty characters the server accepts', async () => {
    const calls = fakeFetch([{ status: 201, body: { id: ID, secret: 's', handle: 'gus' } }]);

    await putAccount({ id: ID, name: 'x'.repeat(60), handle: 'gus' }, null);

    expect((only(calls).body as { name: string }).name).toHaveLength(40);
  });

  it('leaves the invite code alone when none is claimed', async () => {
    const calls = fakeFetch([{ status: 200, body: { id: ID, handle: 'gus' } }]);

    await putAccount({ id: ID, name: 'Gus', handle: 'gus' }, CREDENTIALS);

    expect(only(calls).body).not.toHaveProperty('inviteCode');
  });

  it('answers a 204 with no body as a success', async () => {
    fakeFetch([{ status: 204 }]);

    expect(await deleteAccount(CREDENTIALS)).toEqual({ ok: true, value: undefined });
  });

  it('has POST /device ready for the push round, with token, zone and switch', async () => {
    const calls = fakeFetch([{ status: 200, body: { ok: true } }]);

    await putDevice(CREDENTIALS, {
      pushToken: 'ExponentPushToken[gus]',
      timeZone: 'America/Bogota',
      nudgesOn: false,
    });

    expect(only(calls).body).toEqual({
      pushToken: 'ExponentPushToken[gus]',
      timeZone: 'America/Bogota',
      nudgesOn: false,
    });
  });
});

describe('a taken invite code', () => {
  it('bumps the generation and claims the next one', async () => {
    const calls = fakeFetch([
      { status: 409, body: { error: 'invite code taken' } },
      { status: 201, body: { id: ID, secret: 's3cret', handle: 'gus' } },
    ]);

    const result = await claimAccount(PROFILE, null);

    expect(calls.length).toBe(2);
    expect((calls[0]?.body as { inviteCode: string }).inviteCode).toBe(inviteCodeFor(PROFILE));
    expect((calls[0]?.body as { codeGeneration: number }).codeGeneration).toBe(0);
    expect((calls[1]?.body as { inviteCode: string }).inviteCode).toBe(
      inviteCodeFor({ ...PROFILE, codeGeneration: 1 }),
    );
    expect((calls[1]?.body as { codeGeneration: number }).codeGeneration).toBe(1);
    expect(result.ok && result.value.codeGeneration).toBe(1);
    expect(result.ok && result.value.account.secret).toBe('s3cret');
  });

  it('gives up after a few attempts instead of grinding a rate-limited endpoint', async () => {
    const calls = fakeFetch(
      Array.from({ length: 5 }, () => ({ status: 409, body: { error: 'invite code taken' } })),
    );

    const result = await claimAccount(PROFILE, null);

    expect(calls.length).toBe(3);
    expect(result).toEqual({ ok: false, failure: { kind: 'inviteCodeTaken' } });
  });

  it('is not confused with a taken handle, which is the user’s to fix', async () => {
    fakeFetch([{ status: 409, body: { error: 'handle taken' } }]);

    const result = await claimAccount(PROFILE, null);

    expect(result).toEqual({ ok: false, failure: { kind: 'handleTaken' } });
  });
});

describe('a 429', () => {
  it('carries the seconds the server asked for', async () => {
    fakeFetch([
      { status: 429, body: { error: 'too many requests' }, headers: { 'Retry-After': '120' } },
    ]);

    const result = await sync(CREDENTIALS, {
      since: 0,
      weeks: [],
      challenges: [],
      marks: [],
      kudos: [],
      nudges: [],
    });

    expect(result).toEqual({ ok: false, failure: { kind: 'rateLimited', retryAfterMs: 120_000 } });
  });

  it('falls back to a minute when the header is missing or nonsense', () => {
    expect(retryAfterMs('30')).toBe(30_000);
    expect(retryAfterMs(null)).toBe(60_000);
    expect(retryAfterMs('soon')).toBe(60_000);
    expect(retryAfterMs('-5')).toBe(60_000);
  });
});

describe('with no network', () => {
  it('answers offline instead of throwing', async () => {
    globalThis.fetch = (() => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch;

    const result = await sync(CREDENTIALS, {
      since: 7,
      weeks: [],
      challenges: [],
      marks: [],
      kudos: [],
      nudges: [],
    });

    expect(result).toEqual({ ok: false, failure: { kind: 'offline' } });
  });

  it('answers offline for the account call too, so nothing up the stack has to catch', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('boom'))) as unknown as typeof fetch;

    await expect(claimAccount(PROFILE, null)).resolves.toEqual({
      ok: false,
      failure: { kind: 'offline' },
    });
  });

  it('reads a 5xx that is not JSON as a server error, not as a parse failure', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response('<html>502</html>', { status: 502 }))) as unknown as typeof fetch;

    const result = await deleteAccount(CREDENTIALS);

    expect(result).toEqual({ ok: false, failure: { kind: 'serverError', status: 502 } });
  });
});

describe('reading the answer to /sync', () => {
  it('drops rows it cannot read rather than believing them', () => {
    const download = readDownload({
      now: 500,
      members: [{ id: ANA, name: 'Ana', handle: 'ana', status: 'member', joinedAt: 4, updatedAt: 9 }, { id: ANA }, 7],
      weeks: [{ accountId: ANA, weekKey: '2026-09-21', focusMs: null, updatedAt: 9 }, {}],
      challenges: [null],
      marks: [{ challengeId: CHALLENGE, accountId: ANA, dayKey: '2026-09-22', source: 'nonsense', updatedAt: 9 }],
      kudos: [],
      nudges: [],
      rejected: [KUDOS, 3],
    });

    expect(download.now).toBe(500);
    expect(download.members).toHaveLength(1);
    expect(download.weeks).toHaveLength(1);
    expect(download.weeks[0]?.focusMs).toBeNull();
    expect(download.challenges).toHaveLength(0);
    expect(download.marks[0]?.source).toBe('manual');
    expect(download.rejected).toEqual([KUDOS]);
  });

  it('reads an empty answer as an empty sync, not as a failure', () => {
    expect(readDownload(null)).toEqual({
      now: 0,
      members: [],
      weeks: [],
      challenges: [],
      marks: [],
      kudos: [],
      nudges: [],
      rejected: [],
      ended: [],
      ownMarks: [],
    });
  });

  it('reads who ended a link, and nothing from a server that predates the call', () => {
    expect(readDownload({ ended: [ANA, 5] }).ended).toEqual([ANA]);
    expect(readDownload({ now: 1 }).ended).toEqual([]);
  });

  it("reads the caller's own marks only from a restore's answer (ADR-0048 §6)", () => {
    const download = readDownload({
      now: 1,
      own: {
        marks: [
          { challengeId: CHALLENGE, accountId: ID, dayKey: '2026-09-22', source: 'health', updatedAt: 9 },
          { challengeId: CHALLENGE, dayKey: '2026-09-23' },
        ],
      },
    });
    expect(download.ownMarks).toEqual([
      { challengeId: CHALLENGE, accountId: ID, dayKey: '2026-09-22', source: 'health', updatedAt: 9 },
    ]);
    // The own marks never leak into `marks`, which are other people's.
    expect(download.marks).toEqual([]);
    expect(readDownload({ own: null }).ownMarks).toEqual([]);
    expect(readDownload({ own: { marks: 'no' } }).ownMarks).toEqual([]);
  });
});

// --- The fold -------------------------------------------------------------------------

const EMPTY: SyncDownload = {
  now: 100,
  members: [],
  weeks: [],
  challenges: [],
  marks: [],
  kudos: [],
  nudges: [],
  rejected: [],
  ended: [],
  ownMarks: [],
};

const NO_LOCAL = { members: [], challenges: [], nudgeIds: new Set<string>() };

describe('folding a download into local rows', () => {
  it('turns the account id back into ME wherever it appears', () => {
    const folded = foldDownload(
      {
        ...EMPTY,
        kudos: [{ id: KUDOS, fromId: ANA, toId: ID, dayKey: '2026-09-22', createdAt: 5, updatedAt: 5 }],
        nudges: [
          {
            id: CHALLENGE,
            fromId: ANA,
            toId: ID,
            challengeId: CHALLENGE,
            dayKey: '2026-09-22',
            createdAt: 5,
            updatedAt: 5,
          },
        ],
      },
      ID,
      NO_LOCAL,
      999,
    );

    expect(folded.kudos[0]?.toId).toBe(ME);
    expect(folded.kudos[0]?.fromId).toBe(ANA);
    expect(folded.nudges[0]?.toId).toBe(ME);
  });

  it('keeps the local habit a challenge counts against', () => {
    const local: Challenge = {
      id: CHALLENGE,
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: ANA,
      participantIds: [ME, ANA],
      habitId: 'habit-read',
      createdAt: 1,
      archivedAt: null,
    };
    const folded = foldDownload(
      {
        ...EMPTY,
        challenges: [
          {
            id: CHALLENGE,
            createdBy: ANA,
            name: 'Leer',
            weeklyTarget: 4,
            startWeekKey: '2026-09-21',
            endDayKey: null,
            participantIds: [ANA, ID],
            archivedAt: null,
            createdAt: 1,
            updatedAt: 9,
          },
        ],
      },
      ID,
      { ...NO_LOCAL, challenges: [local] },
      999,
    );

    expect(folded.challenges[0]?.habitId).toBe('habit-read');
    expect(folded.challenges[0]?.participantIds).toEqual([ANA, ME]);
    expect(folded.joins).toEqual([]);
  });

  it('keeps a join made while offline, and asks for it to be sent', () => {
    const local: Challenge = {
      id: CHALLENGE,
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: ANA,
      participantIds: [ME, ANA],
      habitId: 'habit-read',
      createdAt: 1,
      archivedAt: null,
    };
    const folded = foldDownload(
      {
        ...EMPTY,
        challenges: [
          {
            id: CHALLENGE,
            createdBy: ANA,
            name: 'Leer',
            weeklyTarget: 4,
            startWeekKey: '2026-09-21',
            endDayKey: null,
            // The server has not heard about the join yet.
            participantIds: [ANA],
            archivedAt: null,
            createdAt: 1,
            updatedAt: 9,
          },
        ],
      },
      ID,
      { ...NO_LOCAL, challenges: [local] },
      999,
    );

    expect(folded.challenges[0]?.participantIds).toEqual([ME, ANA]);
    expect(folded.joins).toEqual([CHALLENGE]);
  });

  it('asks to accept again when this phone already said yes and the server has not heard', () => {
    const local: Member = {
      id: ANA,
      name: 'Ana',
      handle: 'ana',
      status: 'member',
      joinedAt: 5,
      createdAt: 1,
    };
    const folded = foldDownload(
      {
        ...EMPTY,
        members: [{ id: ANA, name: 'Ana', handle: 'ana', status: 'pending', joinedAt: null, updatedAt: 9 }],
      },
      ID,
      { ...NO_LOCAL, members: [local] },
      999,
    );

    expect(folded.accepts).toEqual([ANA]);
    // The member's own created_at is not rewritten by a sync.
    expect(folded.members[0]?.createdAt).toBe(1);
  });

  it('gives a mark the key the table is unique on', () => {
    const folded = foldDownload(
      {
        ...EMPTY,
        marks: [
          { challengeId: CHALLENGE, accountId: ANA, dayKey: '2026-09-22', source: 'health', updatedAt: 9 },
          // The caller's own marks are habit marks; the server leaves them out and so
          // does the fold, whatever arrives.
          { challengeId: CHALLENGE, accountId: ID, dayKey: '2026-09-22', source: 'manual', updatedAt: 9 },
        ],
      },
      ID,
      NO_LOCAL,
      999,
    );

    expect(folded.marks).toHaveLength(1);
    expect(folded.marks[0]?.id).toBe(markIdOf(CHALLENGE, ANA, '2026-09-22'));
    expect(folded.marks[0]?.source).toBe('health');
  });

  it('never writes the same nudge twice: the table has no rule for a repeat', () => {
    const folded = foldDownload(
      {
        ...EMPTY,
        nudges: [
          {
            id: CHALLENGE,
            fromId: ANA,
            toId: ID,
            challengeId: CHALLENGE,
            dayKey: '2026-09-22',
            createdAt: 5,
            updatedAt: 5,
          },
        ],
      },
      ID,
      { ...NO_LOCAL, nudgeIds: new Set([CHALLENGE]) },
      999,
    );

    expect(folded.nudges).toEqual([]);
  });

  it('keeps a social floor null and does not invent one', () => {
    const folded = foldDownload(
      {
        ...EMPTY,
        weeks: [
          {
            accountId: ANA,
            weekKey: '2026-09-21',
            focusMs: 3600,
            socialMs: null,
            habitsDone: 2,
            habitsTarget: 4,
            updatedAt: 9,
          },
        ],
      },
      ID,
      NO_LOCAL,
      999,
    );

    expect(folded.weeks[0]?.socialMs).toBeNull();
    expect(folded.weeks[0]?.memberId).toBe(ANA);
  });
});

// --- The upload ------------------------------------------------------------------------

const WEEK_DAYS = [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
];

function mark(habitId: string, dayKey: string, source: HabitMark['source'] = 'manual'): HabitMark {
  return { id: `${habitId}-${dayKey}`, habitId, dayKey, source, sourceRef: '', durationMs: null, markedAt: 1 };
}

const BASE = {
  since: 42,
  weekKey: '2026-09-21',
  myWeek: { focusMs: 7_200_000, socialMs: 3_600_000, habitsDone: 5, habitsTarget: 8 },
  share: { focus: true, habits: true, social: true },
  challenges: [] as Challenge[],
  myMarks: [] as HabitMark[],
  weekDays: WEEK_DAYS,
  kudos: [],
  nudges: [],
  accountId: ID,
};

describe('building what goes up', () => {
  it('sends a metric that is not shared as null, never as zero', () => {
    const upload = buildUpload({
      ...BASE,
      share: { focus: false, habits: false, social: false },
    });

    expect(upload.weeks[0]).toEqual({
      weekKey: '2026-09-21',
      focusMs: null,
      socialMs: null,
      habitsDone: null,
      habitsTarget: null,
    });
  });

  it('sends the numbers when the switches are on', () => {
    const upload = buildUpload(BASE);

    expect(upload.weeks[0]).toEqual({
      weekKey: '2026-09-21',
      focusMs: 7_200_000,
      socialMs: 3_600_000,
      habitsDone: 5,
      habitsTarget: 8,
    });
    expect(upload.since).toBe(42);
  });

  it('sends no social figure when the phone never gave one, even with the switch on', () => {
    // `sharedWeekUsageMs` is null while the floor is still the demo one (ADR-0035): the
    // seed's estimate must not leave the phone as this person's week.
    const upload = buildUpload({ ...BASE, myWeek: { ...BASE.myWeek, socialMs: null } });

    expect(upload.weeks[0]?.socialMs).toBeNull();
    expect(upload.weeks[0]?.focusMs).toBe(7_200_000);
  });

  it('leaves the demo seed behind: its ids are not ones the server stores', () => {
    const demo: Challenge = {
      id: 'challenge-read',
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: ME,
      participantIds: [ME, 'ana'],
      habitId: 'habit-read',
      createdAt: 1,
      archivedAt: null,
    };
    const upload = buildUpload({
      ...BASE,
      challenges: [demo],
      myMarks: [mark('habit-read', '2026-09-22')],
      kudos: [{ id: 'kudos-ana-2026-09-22', fromId: ME, toId: 'ana', dayKey: '2026-09-22', createdAt: 1 }],
    });

    expect(upload.challenges).toEqual([]);
    expect(upload.marks).toEqual([]);
    expect(upload.kudos).toEqual([]);
  });

  it('maps ME to the account id and drops a participant the server would ignore', () => {
    const mine: Challenge = {
      id: CHALLENGE,
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: '2026-10-11',
      createdBy: ME,
      participantIds: [ME, ANA, 'ana'],
      habitId: 'habit-read',
      createdAt: 1,
      archivedAt: null,
    };
    const upload = buildUpload({ ...BASE, challenges: [mine] });

    expect(upload.challenges[0]?.participantIds).toEqual([ID, ANA]);
  });

  it('sends the whole week of a challenge, so unmarking a day travels too', () => {
    const mine: Challenge = {
      id: CHALLENGE,
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: ANA,
      participantIds: [ME, ANA],
      habitId: 'habit-read',
      createdAt: 1,
      archivedAt: null,
    };
    const upload = buildUpload({
      ...BASE,
      challenges: [mine],
      myMarks: [mark('habit-read', '2026-09-22', 'session')],
    });

    expect(upload.marks).toHaveLength(7);
    expect(upload.marks.filter((row) => row.marked)).toEqual([
      { challengeId: CHALLENGE, dayKey: '2026-09-22', source: 'session', marked: true },
    ]);
  });

  it('says nothing about a challenge the user has not joined', () => {
    const theirs: Challenge = {
      id: CHALLENGE,
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: ANA,
      participantIds: [ANA],
      habitId: null,
      createdAt: 1,
      archivedAt: null,
    };
    const upload = buildUpload({ ...BASE, challenges: [theirs] });

    expect(upload.marks).toEqual([]);
    expect(upload.challenges).toEqual([]);
  });

  it('cuts a challenge name to the sixty characters the server accepts', () => {
    const mine: Challenge = {
      id: CHALLENGE,
      name: 'x'.repeat(90),
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: ME,
      participantIds: [ME],
      habitId: null,
      createdAt: 1,
      archivedAt: null,
    };

    expect(buildUpload({ ...BASE, challenges: [mine] }).challenges[0]?.name).toHaveLength(60);
  });

  it('sends only what the user themselves gave', () => {
    const upload = buildUpload({
      ...BASE,
      kudos: [
        { id: KUDOS, fromId: ME, toId: ANA, dayKey: '2026-09-22', createdAt: 1 },
        { id: CHALLENGE, fromId: ANA, toId: ME, dayKey: '2026-09-22', createdAt: 1 },
      ],
    });

    expect(upload.kudos).toEqual([{ id: KUDOS, toId: ANA, dayKey: '2026-09-22' }]);
  });
});

describe('the backup key', () => {
  it('is the bearer token, and reads back as the credentials it came from', () => {
    const key = backupKeyOf(CREDENTIALS);

    expect(key).toBe(`${ID}.a-secret`);
    expect(credentialsFrom(key)).toEqual(CREDENTIALS);
    expect(credentialsFrom(`  ${key}  `)).toEqual(CREDENTIALS);
  });

  it('is nothing at all when it is not a token', () => {
    expect(credentialsFrom('')).toBeNull();
    expect(credentialsFrom('no-dot')).toBeNull();
    expect(credentialsFrom('.secret')).toBeNull();
    expect(credentialsFrom(`${ID}.`)).toBeNull();
  });

  it('shows in groups but copies whole: a group boundary is not part of the secret', () => {
    const key = backupKeyOf(CREDENTIALS);
    const groups = backupKeyGroups(key);

    expect(groups.every((group) => group.length <= BACKUP_GROUP_SIZE)).toBe(true);
    expect(groups.join('')).toBe(key);
  });
});

describe('the handle rule', () => {
  it('is the server one: 3 to 20 of a-z, 0-9 and _', () => {
    expect(isValidHandle('gus')).toBe(true);
    expect(isValidHandle('ana_luz_2')).toBe(true);
    expect(isValidHandle('yo')).toBe(false);
    expect(isValidHandle('josé')).toBe(false);
    expect(isValidHandle('ana-maría')).toBe(false);
    expect(isValidHandle('a'.repeat(21))).toBe(false);
  });

  it('reads a typed handle the way it is saved: trimmed, lowercased, without spaces', () => {
    expect(cleanHandle('  Gus Moreno ')).toBe('gusmoreno');
    expect(isValidHandle(' Gus ')).toBe(true);
  });
});

describe('an ended link in the fold (ADR-0049)', () => {
  const SOF = '0199a1b2-c3d4-7e5f-8a9b-000000000003';
  const everything: SyncDownload = {
    ...EMPTY,
    members: [
      { id: ANA, name: 'Ana', handle: 'ana', status: 'member', joinedAt: 4, updatedAt: 9 },
      { id: SOF, name: 'Sofía', handle: 'sofia', status: 'member', joinedAt: 4, updatedAt: 9 },
    ],
    weeks: [
      { accountId: ANA, weekKey: '2026-09-21', focusMs: 1, socialMs: null, habitsDone: 1, habitsTarget: 2, updatedAt: 9 },
      { accountId: SOF, weekKey: '2026-09-21', focusMs: 2, socialMs: null, habitsDone: 1, habitsTarget: 2, updatedAt: 9 },
    ],
    challenges: [
      {
        id: CHALLENGE,
        createdBy: SOF,
        name: 'Leer',
        weeklyTarget: 4,
        startWeekKey: '2026-09-21',
        endDayKey: null,
        participantIds: [SOF, ANA, ID],
        archivedAt: null,
        createdAt: 1,
        updatedAt: 9,
      },
    ],
    marks: [{ challengeId: CHALLENGE, accountId: ANA, dayKey: '2026-09-22', source: 'manual', updatedAt: 9 }],
    kudos: [{ id: KUDOS, fromId: ANA, toId: ID, dayKey: '2026-09-22', createdAt: 5, updatedAt: 5 }],
  };

  it('lets nothing of a person the server says is gone back in', () => {
    const folded = foldDownload({ ...everything, ended: [ANA] }, ID, NO_LOCAL, 999);

    expect(folded.ended).toEqual([ANA]);
    expect(folded.members.map((member) => member.id)).toEqual([SOF]);
    expect(folded.weeks.map((week) => week.memberId)).toEqual([SOF]);
    expect(folded.marks).toEqual([]);
    expect(folded.kudos).toEqual([]);
    expect(folded.challenges[0]?.participantIds).toEqual([SOF, ME]);
  });

  it('holds off what the server still sends about a person removed here, offline', () => {
    const folded = foldDownload(everything, ID, {
      ...NO_LOCAL,
      endedHere: { people: new Set([ANA]), everyone: false, challenges: new Set() },
    }, 999);

    expect(folded.members.map((member) => member.id)).toEqual([SOF]);
    expect(folded.kudos).toEqual([]);
  });

  it('holds off everyone after "Salir del círculo", and ME from a challenge left here', () => {
    const folded = foldDownload(everything, ID, {
      ...NO_LOCAL,
      endedHere: { people: new Set(), everyone: true, challenges: new Set([CHALLENGE]) },
    }, 999);

    expect(folded.members).toEqual([]);
    expect(folded.weeks).toEqual([]);
    expect(folded.challenges[0]?.participantIds).toEqual([]);
  });

  it('does not join again a challenge whose maker is gone', () => {
    const local: Challenge = {
      id: CHALLENGE,
      name: 'Leer',
      weeklyTarget: 4,
      startWeekKey: '2026-09-21',
      endDayKey: null,
      createdBy: SOF,
      participantIds: [ME, SOF],
      habitId: 'habit-read',
      createdAt: 1,
      archivedAt: null,
    };
    const removed: SyncDownload = {
      ...everything,
      ended: [SOF],
      challenges: everything.challenges.map((row) => ({ ...row, participantIds: [SOF] })),
    };

    const folded = foldDownload(removed, ID, { ...NO_LOCAL, challenges: [local] }, 999);

    expect(folded.joins).toEqual([]);
    expect(folded.challenges[0]?.participantIds).toEqual([]);
  });
});

// --- The identity (ADR-0048) -----------------------------------------------------------

describe('the identity calls (ADR-0048)', () => {
  it('registers an identity with the id alone, unsigned, and keeps the secret it gets once', async () => {
    const calls = fakeFetch([{ status: 201, body: { id: ID, secret: 's3cret', handle: null } }]);

    const result = await createIdentity(ID);

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/account`);
    expect(call.method).toBe('POST');
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.body).toEqual({ id: ID });
    expect(result).toEqual({ ok: true, value: { id: ID, secret: 's3cret' } });
  });

  it('reads an id that is already taken as no secret to be had, whatever the status', async () => {
    fakeFetch([{ status: 401, body: { error: 'unauthorized' } }]);
    expect(await createIdentity(ID)).toEqual({ ok: false, failure: { kind: 'unauthorized' } });

    fakeFetch([{ status: 200, body: { id: ID, handle: null } }]);
    expect(await createIdentity(ID)).toEqual({ ok: false, failure: { kind: 'unauthorized' } });
  });

  it('reads the own profile with GET /account, nulls where nothing was ever set', async () => {
    const calls = fakeFetch([
      { status: 200, body: { id: ID, name: null, handle: null, inviteCode: null, createdAt: 7, nudgesOn: true } },
    ]);

    const result = await getAccount(CREDENTIALS);

    const call = only(calls);
    expect(call.method).toBe('GET');
    expect(call.body).toBeUndefined();
    expect(call.headers.Authorization).toBe(`Bearer ${ID}.a-secret`);
    expect(result).toEqual({
      ok: true,
      value: {
        id: ID,
        name: null,
        handle: null,
        inviteCode: null,
        createdAt: 7,
        lastSeenAt: null,
        platform: null,
        recoveryEmail: null,
      },
    });
    expect(readAccount({ name: 'Gus', handle: 'gus', inviteCode: 'ABC234' }, ID)).toEqual({
      id: ID,
      name: 'Gus',
      handle: 'gus',
      inviteCode: 'ABC234',
      createdAt: null,
      lastSeenAt: null,
      platform: null,
      recoveryEmail: null,
    });
  });

  it('reads when the account was last seen, from where, and its recovery email (ADR-0050)', () => {
    expect(
      readAccount({ id: ID, lastSeenAt: 1_700, platform: 'ios', recoveryEmail: 'gus@example.com' }, ID),
    ).toMatchObject({ lastSeenAt: 1_700, platform: 'ios', recoveryEmail: 'gus@example.com' });
    // Anything unshaped reads as never set, field by field.
    expect(readAccount({ id: ID, lastSeenAt: '1700', platform: 'web', recoveryEmail: '' }, ID)).toMatchObject({
      lastSeenAt: null,
      platform: null,
      recoveryEmail: null,
    });
  });

  it('rotates the secret and hands back the new credentials, never an empty one', async () => {
    const calls = fakeFetch([{ status: 200, body: { id: ID, secret: 'n3w' } }]);
    expect(await rotateSecret(CREDENTIALS)).toEqual({ ok: true, value: { id: ID, secret: 'n3w' } });
    expect(only(calls).url).toBe(`${CIRCLE_API_URL}/account/secret`);

    fakeFetch([{ status: 200, body: {} }]);
    expect(await rotateSecret(CREDENTIALS)).toEqual({ ok: false, failure: { kind: 'serverError', status: 200 } });
  });

  it('pings /device with platform and version, and leaves out the push token it does not own', async () => {
    const calls = fakeFetch([{ status: 200, body: { ok: true } }]);

    await putDevice(CREDENTIALS, { timeZone: 'America/Bogota', platform: 'ios', appVersion: '1.0.0' });

    expect(only(calls).body).toEqual({ timeZone: 'America/Bogota', platform: 'ios', appVersion: '1.0.0' });
    expect(deviceBody({ timeZone: 'UTC', appVersion: 'x'.repeat(40) }).appVersion).toHaveLength(32);
    expect(deviceBody({ timeZone: 'UTC', pushToken: null })).toEqual({ timeZone: 'UTC', pushToken: null });
  });

  it('asks for the own marks only when restoring', async () => {
    const calls = fakeFetch([
      { status: 200, body: { now: 5 } },
      { status: 200, body: { now: 6 } },
    ]);
    const upload = { since: 0, weeks: [], challenges: [], marks: [], kudos: [], nudges: [] };

    await sync(CREDENTIALS, upload, { restore: true });
    await sync(CREDENTIALS, upload);

    expect(calls[0]?.body).toMatchObject({ since: 0, restore: true });
    expect(calls[1]?.body).not.toHaveProperty('restore');
  });

  it("tells 'handle required' apart from 'handle taken'", async () => {
    fakeFetch([{ status: 409, body: { error: 'handle required' } }]);
    expect(await redeemInvite(CREDENTIALS, 'ABC234')).toEqual({ ok: false, failure: { kind: 'handleRequired' } });

    fakeFetch([{ status: 409, body: { error: 'handle taken' } }]);
    expect(await putAccount({ id: ID, name: 'Gus', handle: 'gus' }, CREDENTIALS)).toEqual({
      ok: false,
      failure: { kind: 'handleTaken' },
    });
  });
});

describe('a pasted backup key', () => {
  const SECRET = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE';
  const KEY = `${ID}.${SECRET}`;

  it('reads the one string a password manager keeps', () => {
    expect(credentialsFromPastedKey(KEY)).toEqual({ id: ID, secret: SECRET });
  });

  it('reads it back from the groups the screen shows, spaces and line breaks and all', () => {
    const grouped = backupKeyGroups(KEY).join(' ');
    expect(credentialsFromPastedKey(grouped)).toEqual({ id: ID, secret: SECRET });
    expect(credentialsFromPastedKey(`\n  ${backupKeyGroups(KEY).join('\n')}  `)).toEqual({ id: ID, secret: SECRET });
  });

  it('lowercases the id, which is hex, and never the secret, which is not', () => {
    expect(credentialsFromPastedKey(`${ID.toUpperCase()}.${SECRET}`)).toEqual({ id: ID, secret: SECRET });
  });

  it('refuses anything that is not the shape of a key, before any request', () => {
    expect(credentialsFromPastedKey('')).toBeNull();
    expect(credentialsFromPastedKey(SECRET)).toBeNull();
    expect(credentialsFromPastedKey(`${ID}.short`)).toBeNull();
    expect(credentialsFromPastedKey(`not-a-uuid.${SECRET}`)).toBeNull();
    expect(credentialsFromPastedKey(`${ID}.${SECRET}!`)).toBeNull();
    // A UUID that is not v7 is not an id this app ever made.
    expect(credentialsFromPastedKey(`0199a1b2-c3d4-4e5f-8a9b-000000000001.${SECRET}`)).toBeNull();
  });
});
