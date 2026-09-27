import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CIRCLE_API_URL, type Credentials } from './circleApi';
import {
  absoluteUrl,
  blockMember,
  deleteMedia,
  downloadMedia,
  getMediaUrl,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  mediaBody,
  mediaFailureFor,
  postMedia,
  putMediaFile,
  readRemoteMedia,
  reportMedia,
  type MediaInput,
} from './photoApi';

/**
 * The photos' half of the contract (ADR-0051, tanda 2), driven with a fake `fetch` like
 * circleApi.test.ts: the shape of each request, the two refusals only these routes have
 * (`409 stale keys` and `413`), and the promise that nothing throws without a network.
 * Nothing here reaches a real server.
 */

const ID = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const MEDIA = '0199a1b2-c3d4-7e5f-8a9b-0000000000d1';
const CHALLENGE = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const CREDENTIALS: Credentials = { id: ID, secret: 'a-secret' };

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body?: unknown; raw?: Uint8Array; headers?: Record<string, string> };

function fakeFetch(replies: Reply[]) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body instanceof Uint8Array ? init.body : typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const reply = replies.shift() ?? { status: 200, body: {} };
    const payload = reply.raw ?? (reply.body === undefined ? null : JSON.stringify(reply.body));
    return new Response(payload as BodyInit | null, { status: reply.status, headers: reply.headers });
  }) as unknown as typeof fetch;
  return calls;
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  fakeFetch([]);
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const INPUT: MediaInput = {
  id: MEDIA,
  challengeId: CHALLENGE,
  dayKey: '2026-09-22',
  width: 1280.4,
  height: 960,
  origin: 'camera',
  epk: 'ZXBr',
  captionBox: null,
  wraps: [
    { recipientId: ID, keyId: '0123456789abcdef', box: 'Ym94' },
    { recipientId: ANA, keyId: 'fedcba9876543210', box: 'Ym94Mg==' },
  ],
  thumbSize: 30_028,
  fullSize: 200_028,
};

describe('POST /media', () => {
  it('sends the row with the bearer token, and reads the expiry back', async () => {
    const calls = fakeFetch([{ status: 201, body: { id: MEDIA, expiresAt: 99 } }]);

    const result = await postMedia(CREDENTIALS, INPUT);

    expect(result).toEqual({ ok: true, value: { id: MEDIA, expiresAt: 99 } });
    expect(calls[0]?.url).toBe(`${CIRCLE_API_URL}/media`);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${ID}.a-secret`);
    expect(calls[0]?.body).toEqual({ ...INPUT, width: 1280 });
  });

  it('reads a 409 stale keys with the keys to wrap for', async () => {
    fakeFetch([
      {
        status: 409,
        body: { error: 'stale keys', keys: [{ id: ANA, boxKey: 'bmV3', keyId: '1111111111111111' }, { id: 'x' }] },
      },
    ]);

    const result = await postMedia(CREDENTIALS, INPUT);

    expect(result).toEqual({
      ok: false,
      failure: { kind: 'staleKeys', keys: [{ id: ANA, boxKey: 'bmV3', keyId: '1111111111111111' }] },
    });
  });

  it('tells the other refusals apart', () => {
    expect(mediaFailureFor(409, { error: 'handle required' }, null)).toEqual({ kind: 'handleRequired' });
    expect(mediaFailureFor(409, { error: 'something' }, null)).toEqual({ kind: 'conflict', message: 'something' });
    expect(mediaFailureFor(413, null, null)).toEqual({ kind: 'tooLarge' });
    expect(mediaFailureFor(410, { error: 'media deleted' }, null)).toEqual({ kind: 'gone' });
    expect(mediaFailureFor(403, null, null)).toEqual({ kind: 'forbidden' });
    expect(mediaFailureFor(400, { error: 'day' }, null)).toEqual({ kind: 'rejected', message: 'day' });
    expect(mediaFailureFor(429, null, '30')).toEqual({ kind: 'rateLimited', retryAfterMs: 30_000 });
    expect(mediaFailureFor(502, null, null)).toEqual({ kind: 'serverError', status: 502 });
  });

  it('never sends more than thirteen wraps', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ recipientId: `r${i}`, keyId: 'k', box: 'b' }));

    expect((mediaBody({ ...INPUT, wraps: many }).wraps as unknown[]).length).toBe(13);
  });
});

describe('the two files', () => {
  it('PUTs the sealed bytes raw, to the variant, and refuses what is over the cap before sending', async () => {
    const calls = fakeFetch([{ status: 200, body: { ok: true } }]);
    const bytes = new Uint8Array([1, 2, 3]);

    expect(await putMediaFile(CREDENTIALS, MEDIA, 'thumb', bytes)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${CIRCLE_API_URL}/media/${MEDIA}/thumb`);
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.headers['Content-Type']).toBe('application/octet-stream');
    expect(calls[0]?.body).toEqual(bytes);

    expect(await putMediaFile(CREDENTIALS, MEDIA, 'thumb', new Uint8Array(MAX_THUMB_BYTES + 1))).toEqual({
      ok: false,
      failure: { kind: 'tooLarge' },
    });
    expect(await putMediaFile(CREDENTIALS, MEDIA, 'full', new Uint8Array(MAX_FULL_BYTES + 1))).toEqual({
      ok: false,
      failure: { kind: 'tooLarge' },
    });
    expect(calls).toHaveLength(1);
  });

  it('asks for a signed URL, and makes a path of the server in memory a whole URL', async () => {
    const calls = fakeFetch([
      { status: 200, body: { url: '/media/object?token=t', expiresAt: 5 } },
      { status: 200, body: { url: 'https://bucket.example/m/x?sig=1', expiresAt: 6 } },
      { status: 200, body: {} },
      { status: 404, body: { error: 'not found' } },
    ]);

    expect(await getMediaUrl(CREDENTIALS, MEDIA, 'full')).toEqual({
      ok: true,
      value: { url: `${CIRCLE_API_URL}/media/object?token=t`, expiresAt: 5 },
    });
    expect(calls[0]?.url).toBe(`${CIRCLE_API_URL}/media/${MEDIA}/url?variant=full`);
    expect((await getMediaUrl(CREDENTIALS, MEDIA, 'thumb')).ok).toBe(true);
    expect(await getMediaUrl(CREDENTIALS, MEDIA, 'thumb')).toEqual({
      ok: false,
      failure: { kind: 'serverError', status: 200 },
    });
    expect(await getMediaUrl(CREDENTIALS, MEDIA, 'thumb')).toEqual({ ok: false, failure: { kind: 'notFound' } });
    expect(absoluteUrl('media/x')).toBe(`${CIRCLE_API_URL}/media/x`);
  });

  it('downloads the sealed bytes without the bearer token, and refuses more than the cap', async () => {
    const calls = fakeFetch([
      { status: 200, raw: new Uint8Array([9, 8, 7]) },
      { status: 200, raw: new Uint8Array(11) },
      { status: 403 },
    ]);

    expect(await downloadMedia('https://bucket.example/x')).toEqual({ ok: true, value: new Uint8Array([9, 8, 7]) });
    expect(calls[0]?.headers).toEqual({});
    expect((await downloadMedia('https://bucket.example/x', 10)).ok).toBe(false);
    expect(await downloadMedia('https://bucket.example/x')).toEqual({ ok: false, failure: { kind: 'forbidden' } });
  });
});

describe('deleting, reporting and blocking', () => {
  it('sends each one where the contract says', async () => {
    const calls = fakeFetch([{ status: 200 }, { status: 200 }, { status: 200 }]);

    await deleteMedia(CREDENTIALS, MEDIA);
    await reportMedia(CREDENTIALS, { mediaId: MEDIA, reason: 'consent', note: 'x'.repeat(250), contentKey: 'a2V5' });
    await blockMember(CREDENTIALS, ANA);

    expect(calls.map((call) => [call.method, call.url.replace(CIRCLE_API_URL, '')])).toEqual([
      ['DELETE', `/media/${MEDIA}`],
      ['POST', '/report'],
      ['POST', '/block'],
    ]);
    expect(calls[1]?.body).toEqual({ mediaId: MEDIA, reason: 'consent', contentKey: 'a2V5', note: 'x'.repeat(200) });
    expect(calls[2]?.body).toEqual({ memberId: ANA });
  });

  it('leaves the note out when there is none', async () => {
    const calls = fakeFetch([{ status: 200 }]);

    await reportMedia(CREDENTIALS, { mediaId: MEDIA, reason: 'minor', note: null, contentKey: 'a2V5' });

    expect(calls[0]?.body).toEqual({ mediaId: MEDIA, reason: 'minor', contentKey: 'a2V5' });
  });
});

describe('with no network', () => {
  it('answers offline and never throws', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    for (const result of [
      await postMedia(CREDENTIALS, INPUT),
      await putMediaFile(CREDENTIALS, MEDIA, 'full', new Uint8Array(1)),
      await getMediaUrl(CREDENTIALS, MEDIA, 'full'),
      await downloadMedia('https://bucket.example/x'),
      await deleteMedia(CREDENTIALS, MEDIA),
      await reportMedia(CREDENTIALS, { mediaId: MEDIA, reason: 'other', note: null, contentKey: 'k' }),
      await blockMember(CREDENTIALS, ANA),
    ]) {
      expect(result).toEqual({ ok: false, failure: { kind: 'offline' } });
    }
  });
});

describe('readRemoteMedia', () => {
  it('reads nothing from anything that is not a list', () => {
    expect(readRemoteMedia(undefined)).toEqual([]);
    expect(readRemoteMedia({ id: MEDIA })).toEqual([]);
  });
});
