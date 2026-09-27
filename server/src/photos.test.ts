import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createApp } from './app.ts';
import { mediaExpiresAt } from './media.ts';
import { createMemoryStore } from './memoryStore.ts';
import { createMemoryObjectStore } from './objectStore.ts';
import { createRecordingPush } from './push.ts';
import { createSweeper } from './sweeper.ts';

/**
 * Photos in challenges (ADR-0051), end to end encrypted, against the memory store and the
 * memory bucket. What is checked is what the server decides: who may post, whether the
 * wraps cover the right keys, one photo a day, tombstones through the cursor, who gets a
 * URL, reports, blocks, leaving, deleting the account, expiry and moderation.
 *
 * The phone's cryptography is stood in for by what the server can check: the photo and
 * its thumbnail are sealed here exactly as `sealPhoto` does (AES-256-GCM, nonce | ct |
 * tag, `vesper-photo-v1|<id>|<variant>`), and the wraps are opaque bytes, as they are to
 * the server.
 */

/** Wednesday 23 September 2026, 15:00 UTC: the challenge started on Monday the 21st. */
const T0 = Date.UTC(2026, 8, 23, 15, 0);
const TODAY = '2026-09-23';
const DAY = 24 * 60 * 60 * 1000;

const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const SOF = '0199a1b2-c3d4-7e5f-8a9b-000000000003';
const TOM = '0199a1b2-c3d4-7e5f-8a9b-000000000004';
const GUS_CODE = 'LD6FYR';
const ANA_CODE = '5UTAH8';

const CH1 = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const CH2 = '0199a1b2-c3d4-7e5f-8a9b-0000000000c2';
const M1 = '0199a1b2-c3d4-7e5f-8a9b-0000000000e1';
const M2 = '0199a1b2-c3d4-7e5f-8a9b-0000000000e2';
const M3 = '0199a1b2-c3d4-7e5f-8a9b-0000000000e3';
const N1 = '0199a1b2-c3d4-7e5f-8a9b-00000000b001';
const NOBODY = '0199a1b2-c3d4-7e5f-8a9b-00000000ffff';

const ADMIN = 'a-moderation-token-that-is-long-enough-000';

const keyIdOf = (boxKey: string) =>
  createHash('sha256').update(Buffer.from(boxKey, 'base64')).digest('hex').slice(0, 16);

/** `sealPhoto` on the phone. */
function seal(key: Uint8Array, mediaId: string, variant: 'thumb' | 'full', text: string): Uint8Array<ArrayBuffer> {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`vesper-photo-v1|${mediaId}|${variant}`, 'utf8'));
  const body = Buffer.concat([cipher.update(Buffer.from(text)), cipher.final()]);
  return new Uint8Array(Buffer.concat([nonce, body, cipher.getAuthTag()]));
}

type Person = { id: string; token: string; boxKey: string | null };

function setup(options: { adminToken?: string | null; photosEnabled?: boolean } = {}) {
  const store = createMemoryStore();
  const objects = createMemoryObjectStore(() => clock);
  let clock = T0;
  const app = createApp({
    store,
    push: createRecordingPush(),
    now: () => (clock += 1),
    mailer: null,
    recoveryKey: null,
    objects,
    adminToken: options.adminToken === undefined ? ADMIN : options.adminToken,
    photosEnabled: options.photosEnabled,
  });

  const call = async (
    method: string,
    path: string,
    options: { token?: string; body?: unknown; raw?: Uint8Array<ArrayBuffer>; headers?: Record<string, string> } = {},
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
      body: options.raw !== undefined ? options.raw : options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const json = (response.headers.get('content-type') ?? '').includes('application/json');
    const text = json ? new TextDecoder().decode(bytes) : '';
    return { status: response.status, body: text === '' ? null : JSON.parse(text), bytes, headers: response.headers };
  };

  /** An account with a handle and, unless told otherwise, a box key published. */
  const join = async (id: string, name: string, handle: string, code?: string, withKey = true): Promise<Person> => {
    const created = await call('POST', '/account', { body: { id, name, handle, inviteCode: code } });
    const token = `${id}.${created.body.secret}`;
    const boxKey = withKey ? randomBytes(32).toString('base64') : null;
    if (boxKey !== null) {
      await call('POST', '/device', { token, body: { boxKey } });
    }
    return { id, token, boxKey };
  };

  const befriend = async (owner: Person, code: string, other: Person) => {
    await call('POST', '/invite/redeem', { token: other.token, body: { code } });
    await call('POST', '/invite/accept', { token: owner.token, body: { memberId: other.id } });
  };

  const sync = async (person: Person, body: Record<string, unknown> = {}) =>
    call('POST', '/sync', { token: person.token, body: { since: 0, ...body } });

  const wait = (ms: number) => {
    clock += ms;
  };

  const at = () => clock;

  return { store, objects, app, call, join, befriend, sync, wait, at };
}

type Kit = ReturnType<typeof setup>;

/** A wrap for one person as the phone makes it: their key id, and a box only they open. */
const wrapFor = (person: Person, keyId = keyIdOf(person.boxKey ?? '')) => ({
  recipientId: person.id,
  keyId,
  box: randomBytes(60).toString('base64'),
});

/**
 * Gus made "Leer" with Ana and Sof, photos on, three weeks from Monday the 21st. Ana and
 * Sof are each in Gus's circle and not in each other's. Tom is in Gus's circle and not in
 * the challenge.
 */
async function photoCircle(options: { adminToken?: string | null } = {}) {
  const kit = setup(options);
  const gus = await kit.join(GUS, 'Gus', 'gus', GUS_CODE);
  const ana = await kit.join(ANA, 'Ana', 'ana', ANA_CODE);
  const sof = await kit.join(SOF, 'Sof', 'sof');
  const tom = await kit.join(TOM, 'Tom', 'tom');
  await kit.befriend(gus, GUS_CODE, ana);
  await kit.befriend(gus, GUS_CODE, sof);
  await kit.befriend(gus, GUS_CODE, tom);
  await kit.sync(gus, {
    challenges: [
      {
        id: CH1,
        name: 'Leer',
        weeklyTarget: 4,
        startWeekKey: '2026-09-21',
        endDayKey: '2026-10-11',
        participantIds: [GUS, ANA, SOF],
        photos: true,
      },
    ],
  });

  /** Posts a photo's row; the bytes come with `upload`. */
  const post = async (
    owner: Person,
    mediaId: string,
    options: { dayKey?: string; challengeId?: string; wraps?: unknown[]; to?: Person[] } = {},
  ) => {
    const key = randomBytes(32);
    const thumb = seal(key, mediaId, 'thumb', `thumb of ${mediaId}`);
    const full = seal(key, mediaId, 'full', `full photo ${mediaId}`);
    const wraps = options.wraps ?? [owner, ...(options.to ?? [])].map((person) => wrapFor(person));
    const response = await kit.call('POST', '/media', {
      token: owner.token,
      body: {
        id: mediaId,
        challengeId: options.challengeId ?? CH1,
        dayKey: options.dayKey ?? TODAY,
        width: 1280,
        height: 960,
        origin: 'camera',
        epk: randomBytes(32).toString('base64'),
        captionBox: randomBytes(40).toString('base64'),
        wraps,
        thumbSize: thumb.byteLength,
        fullSize: full.byteLength,
      },
    });
    const upload = async () => {
      const t = await kit.call('PUT', `/media/${mediaId}/thumb`, { token: owner.token, raw: thumb });
      const f = await kit.call('PUT', `/media/${mediaId}/full`, { token: owner.token, raw: full });
      return { thumb: t, full: f };
    };
    return { response, key, thumb, full, upload };
  };

  /** Posted and uploaded, wrapped for everyone in "Leer". */
  const share = async (owner: Person, mediaId: string, options: { dayKey?: string; to?: Person[] } = {}) => {
    const others = options.to ?? [gus, ana, sof].filter((person) => person.id !== owner.id);
    const posted = await post(owner, mediaId, { dayKey: options.dayKey, to: others });
    expect(posted.response.status).toBe(201);
    const uploaded = await posted.upload();
    expect(uploaded.full.body.state).toBe('ready');
    return posted;
  };

  return { ...kit, gus, ana, sof, tom, post, share };
}

describe('the box key', () => {
  it('is published by /device, named by its hash, and withdrawn with null', async () => {
    const { call, store, gus } = await photoCircle();
    const fresh = randomBytes(32).toString('base64');

    expect((await call('POST', '/device', { token: gus.token, body: { boxKey: fresh } })).status).toBe(200);
    expect(await store.getAccount(GUS)).toEqual(
      expect.objectContaining({ boxKey: fresh, boxKeyId: keyIdOf(fresh) }),
    );
    expect((await call('POST', '/device', { token: gus.token, body: { boxKey: 'c2hvcnQ=' } })).status).toBe(400);
    expect((await call('POST', '/device', { token: gus.token, body: { pushToken: null } })).status).toBe(200);
    expect((await store.getAccount(GUS))?.boxKey).toBe(fresh);
    await call('POST', '/device', { token: gus.token, body: { boxKey: null } });
    expect(await store.getAccount(GUS)).toEqual(expect.objectContaining({ boxKey: null, boxKeyId: null }));
  });

  it('goes with the old secret when it rotates, until the new phone publishes its own', async () => {
    const { call, store, gus } = await photoCircle();

    await call('POST', '/account/secret', { token: gus.token });

    expect(await store.getAccount(GUS)).toEqual(expect.objectContaining({ boxKey: null, boxKeyId: null }));
  });
});

describe('without a bucket', () => {
  it('says the photos are not configured instead of keeping them in memory, and the rest works', async () => {
    const { call, join } = setup({ photosEnabled: false });
    const gus = await join(GUS, 'Gus', 'gus');

    const posted = await call('POST', '/media', { token: gus.token, body: {} });
    const put = await call('PUT', `/media/${M1}/thumb`, { token: gus.token, raw: new Uint8Array(4) });
    const url = await call('GET', `/media/${M1}/url?variant=thumb`, { token: gus.token });

    expect([posted.status, put.status, url.status]).toEqual([503, 503, 503]);
    expect(posted.body).toEqual({ error: 'photos not configured' });
    expect((await call('POST', '/sync', { token: gus.token, body: { since: 0 } })).status).toBe(200);
  });
});

describe('sharing a photo', () => {
  it('reaches the others once both objects are in, each with their own wrap', async () => {
    const { call, sync, store, gus, ana, sof, post } = await photoCircle();

    const posted = await post(gus, M1, { to: [ana, sof] });

    expect(posted.response.status).toBe(201);
    expect(posted.response.body).toEqual({
      id: M1,
      // Fourteen days after Sunday 11 October, at midnight: Gus never said a zone, so UTC.
      expiresAt: mediaExpiresAt({ endDayKey: '2026-10-11' }, 0, null),
    });
    expect(posted.response.body.expiresAt).toBe(Date.UTC(2026, 9, 26));
    expect((await sync(ana)).body.media).toEqual([]);

    const thumb = await call('PUT', `/media/${M1}/thumb`, { token: gus.token, raw: posted.thumb });
    expect(thumb.body).toEqual({ id: M1, state: 'pending' });
    expect((await sync(ana)).body.media).toEqual([]);
    const full = await call('PUT', `/media/${M1}/full`, { token: gus.token, raw: posted.full });
    expect(full.body).toEqual({ id: M1, state: 'ready' });

    const seen = (await sync(ana)).body.media;
    const stored = await store.getMedia(M1);
    const anaWrap = stored?.wraps.find((wrap) => wrap.recipientId === ANA);
    expect(seen).toEqual([
      expect.objectContaining({
        id: M1,
        challengeId: CH1,
        ownerId: GUS,
        dayKey: TODAY,
        width: 1280,
        height: 960,
        origin: 'camera',
        captionBox: stored?.captionBox,
        wrap: { keyId: anaWrap?.keyId, box: anaWrap?.box },
        deletedAt: null,
      }),
    ]);
    // Only her own wrap travels to her; Sof's never does.
    const sofBox = stored?.wraps.find((wrap) => wrap.recipientId === SOF)?.box ?? '';
    expect(JSON.stringify(seen)).not.toContain(sofBox);
    expect((await sync(gus)).body.media[0].wrap.keyId).toBe(keyIdOf(gus.boxKey ?? ''));
  });

  it('is asked of a person with a handle, in the challenge, with photos on, on one of its days', async () => {
    const { call, sync, store, gus, tom, post } = await photoCircle();
    const bare = await call('POST', '/account', { body: { id: NOBODY } });
    const bareToken = `${NOBODY}.${bare.body.secret}`;
    await sync(gus, {
      challenges: [
        { id: CH2, name: 'Sin teléfono en la mesa', weeklyTarget: 5, startWeekKey: '2026-09-21', participantIds: [GUS], photos: false },
      ],
    });

    expect((await call('POST', '/media', { token: bareToken, body: {} })).status).toBe(409);
    expect((await post(tom, M1)).response.status).toBe(403);
    expect((await post(gus, M1, { challengeId: M3 })).response.status).toBe(404);
    expect((await post(gus, M1, { challengeId: CH2 })).response.body).toEqual({ error: 'photos off' });
    expect((await post(gus, M1, { dayKey: '2026-09-20' })).response.body).toEqual({
      error: 'not a day of that challenge',
    });
    const malformed = await call('POST', '/media', { token: gus.token, body: { id: M1 } });
    expect(malformed.status).toBe(400);

    await store.banAccount(GUS, T0);
    expect((await post(gus, M1)).response).toEqual(expect.objectContaining({ status: 403, body: { error: 'banned' } }));
  });

  it('refuses a day that is neither today nor yesterday, give or take the zones', async () => {
    const { ana, sof, gus, post, wait } = await photoCircle();
    wait(4 * DAY);

    const late = await post(ana, M1, { dayKey: TODAY, to: [gus, sof] });

    expect(late.response).toEqual(expect.objectContaining({ status: 400, body: { error: 'dayKey is not today or yesterday' } }));
  });

  it('needs the owner’s own box key first', async () => {
    const { call, gus, ana, sof, post } = await photoCircle();
    await call('POST', '/device', { token: gus.token, body: { boxKey: null } });

    const posted = await post(gus, M1, { wraps: [wrapFor(ana), wrapFor(sof)] });

    expect(posted.response).toEqual(expect.objectContaining({ status: 409, body: { error: 'box key required' } }));
  });
});

describe('the wraps', () => {
  it('must cover every participant with a key, or the answer is the keys to wrap for', async () => {
    const { gus, ana, sof, post } = await photoCircle();

    const missing = await post(gus, M1, { to: [ana] });

    expect(missing.response.status).toBe(409);
    expect(missing.response.body.error).toBe('stale keys');
    expect(missing.response.body.keys).toEqual(
      expect.arrayContaining([
        { id: GUS, boxKey: gus.boxKey, keyId: keyIdOf(gus.boxKey ?? '') },
        { id: ANA, boxKey: ana.boxKey, keyId: keyIdOf(ana.boxKey ?? '') },
        { id: SOF, boxKey: sof.boxKey, keyId: keyIdOf(sof.boxKey ?? '') },
      ]),
    );
    expect(missing.response.body.keys).toHaveLength(3);
  });

  it('must use the key each one has now: a key that changed is stale', async () => {
    const { call, gus, ana, sof, post } = await photoCircle();
    const old = ana.boxKey ?? '';
    const fresh = randomBytes(32).toString('base64');
    await call('POST', '/device', { token: ana.token, body: { boxKey: fresh } });

    const stale = await post(gus, M1, { wraps: [wrapFor(gus), wrapFor(ana, keyIdOf(old)), wrapFor(sof)] });
    const current = await post(gus, M1, {
      wraps: [wrapFor(gus), wrapFor({ ...ana, boxKey: fresh }), wrapFor(sof)],
    });

    expect(stale.response.status).toBe(409);
    expect(stale.response.body.keys).toContainEqual({ id: ANA, boxKey: fresh, keyId: keyIdOf(fresh) });
    expect(current.response.status).toBe(201);
  });

  it('includes the owner, and nobody without a key is required', async () => {
    const { call, gus, ana, sof, post } = await photoCircle();
    await call('POST', '/device', { token: sof.token, body: { boxKey: null } });

    const withoutOwner = await post(gus, M1, { wraps: [wrapFor(ana)] });
    const withoutSof = await post(gus, M1, { to: [ana] });

    expect(withoutOwner.response.status).toBe(409);
    expect(withoutSof.response.status).toBe(201);
  });

  it('keeps no wrap for someone outside the challenge', async () => {
    const { store, gus, ana, sof, tom, post } = await photoCircle();

    const posted = await post(gus, M1, { to: [ana, sof, tom] });

    expect(posted.response.status).toBe(201);
    expect((await store.getMedia(M1))?.wraps.map((wrap) => wrap.recipientId).sort()).toEqual([GUS, ANA, SOF].sort());
  });
});

describe('one photo a day', () => {
  it('replaces the one before, whose objects go and whose tombstone reaches the others', async () => {
    const { sync, store, objects, gus, ana, share } = await photoCircle();
    await share(gus, M1);
    const cursor = (await sync(ana)).body.now;

    await share(gus, M2);
    const seen = (await sync(ana, { since: cursor })).body.media;

    expect((await store.getMedia(M1))?.deletedAt).not.toBeNull();
    expect(await objects.list(`m/${GUS}/${M1}/`)).toEqual([]);
    expect((await objects.list(`m/${GUS}/${M2}/`)).sort()).toEqual([`m/${GUS}/${M2}/full`, `m/${GUS}/${M2}/thumb`]);
    expect(seen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: M1, deletedAt: expect.any(Number) }),
        expect.objectContaining({ id: M2, deletedAt: null }),
      ]),
    );
    expect(seen).toHaveLength(2);
  });

  it('answers the same id again without a second photo, and refuses it to anyone else', async () => {
    const { store, gus, ana, sof, post } = await photoCircle();
    const first = await post(gus, M1, { to: [ana, sof] });
    const again = await post(gus, M1, { to: [ana, sof] });
    const squatter = await post(ana, M1, { to: [gus, sof] });

    expect(first.response.status).toBe(201);
    expect(again.response).toEqual(expect.objectContaining({ status: 200, body: first.response.body }));
    expect(squatter.response).toEqual(expect.objectContaining({ status: 409, body: { error: 'id taken' } }));
    expect((await store.liveMedia({ challengeId: CH1 })).map((row) => row.id)).toEqual([M1]);
  });

  it('answers a ready photo posted again with what it is, and a deleted one with 410', async () => {
    const { call, gus, ana, sof, share, post } = await photoCircle();
    const shared = await share(gus, M1);

    const again = await post(gus, M1, { to: [ana, sof] });
    await call('DELETE', `/media/${M1}`, { token: gus.token });
    const gone = await post(gus, M1, { to: [ana, sof] });

    expect(again.response).toEqual(expect.objectContaining({ status: 200, body: shared.response.body }));
    expect(gone.response.status).toBe(410);
  });
});

describe('the objects', () => {
  it('are the owner’s to upload, at exactly the size announced and under the caps', async () => {
    const { call, gus, ana, sof, post } = await photoCircle();
    const posted = await post(gus, M1, { to: [ana, sof] });

    const notYours = await call('PUT', `/media/${M1}/thumb`, { token: ana.token, raw: posted.thumb });
    const unknown = await call('PUT', `/media/${M2}/thumb`, { token: gus.token, raw: posted.thumb });
    const short = await call('PUT', `/media/${M1}/thumb`, { token: gus.token, raw: posted.thumb.slice(1) });
    const empty = await call('PUT', `/media/${M1}/full`, { token: gus.token, raw: new Uint8Array(0) });
    const huge = await call('PUT', `/media/${M1}/thumb`, { token: gus.token, raw: new Uint8Array(100 * 1024 + 1) });
    const announced = await call('PUT', `/media/${M1}/full`, {
      token: gus.token,
      raw: posted.full,
      headers: { 'Content-Length': String(2 * 1024 * 1024) },
    });

    expect(notYours.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(short.body).toEqual({ error: 'size mismatch', expected: posted.thumb.byteLength });
    expect(empty.status).toBe(400);
    expect(huge.status).toBe(413);
    expect(announced.status).toBe(413);
  });
});

describe('tombstones through the cursor', () => {
  it('tells everyone who could see a photo that it is gone, once', async () => {
    const { call, sync, objects, gus, ana, share } = await photoCircle();
    await share(gus, M1);
    const cursor = (await sync(ana)).body.now;

    const deleted = await call('DELETE', `/media/${M1}`, { token: gus.token });
    const after = await sync(ana, { since: cursor });
    const later = await sync(ana, { since: after.body.now });

    expect(deleted.body).toEqual({ ok: true });
    expect(await objects.list('m/')).toEqual([]);
    expect(after.body.media).toEqual([
      expect.objectContaining({ id: M1, wrap: null, captionBox: null, deletedAt: expect.any(Number) }),
    ]);
    expect(later.body.media).toEqual([]);
  });

  it('deletes only the owner’s photo, and answers 200 to one that is not there', async () => {
    const { call, gus, ana, share } = await photoCircle();
    await share(gus, M1);

    expect((await call('DELETE', `/media/${M1}`, { token: ana.token })).status).toBe(403);
    expect((await call('DELETE', `/media/${M2}`, { token: gus.token })).status).toBe(200);
    expect((await call('DELETE', `/media/${M1}`, { token: gus.token })).status).toBe(200);
    expect((await call('DELETE', `/media/${M1}`, { token: gus.token })).status).toBe(200);
  });
});

describe('the download URL', () => {
  it('goes to the owner and to whoever the photo was wrapped for, and works five minutes', async () => {
    const { app, call, gus, ana, share, wait } = await photoCircle();
    const shared = await share(gus, M1);

    const own = await call('GET', `/media/${M1}/url?variant=thumb`, { token: gus.token });
    const hers = await call('GET', `/media/${M1}/url?variant=full`, { token: ana.token });
    const fetched = await app.request(hers.body.url);

    expect(own.status).toBe(200);
    expect(own.body.url).toMatch(/^http:\/\/localhost\/media-local\//);
    expect(hers.body.expiresAt).toBeGreaterThan(T0);
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(shared.full);
    wait(5 * 60 * 1000);
    expect((await app.request(hers.body.url)).status).toBe(404);
  });

  it('goes to nobody else, and not to someone who left', async () => {
    const { call, gus, ana, tom, share } = await photoCircle();
    await share(gus, M1);

    const stranger = await call('GET', `/media/${M1}/url?variant=thumb`, { token: tom.token });
    const badVariant = await call('GET', `/media/${M1}/url?variant=raw`, { token: ana.token });
    await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: CH1 } });
    const left = await call('GET', `/media/${M1}/url?variant=thumb`, { token: ana.token });

    expect(stranger.status).toBe(403);
    expect(badVariant.status).toBe(400);
    expect(left.status).toBe(403);
  });

  it('waits for both objects, and is refused for a deleted or expired photo', async () => {
    const { call, gus, ana, sof, post, share, wait } = await photoCircle();
    await post(gus, M1, { to: [ana, sof] });

    const pending = await call('GET', `/media/${M1}/url?variant=thumb`, { token: gus.token });
    await share(ana, M2);
    wait(Date.UTC(2026, 9, 26) - T0);
    const expired = await call('GET', `/media/${M2}/url?variant=thumb`, { token: ana.token });

    expect(pending.body).toEqual({ error: 'not ready' });
    expect(expired.status).toBe(410);
  });
});

describe('reporting a photo', () => {
  it('takes the photo’s key when it opens the thumbnail, keeps the evidence, and says nothing else', async () => {
    const { call, store, objects, gus, ana, share } = await photoCircle();
    const shared = await share(gus, M1);

    const report = await call('POST', '/report', {
      token: ana.token,
      body: { mediaId: M1, reason: 'unwanted', note: '  no quiero verla ', contentKey: shared.key.toString('base64') },
    });

    const [stored] = await store.listReports(10);
    expect(report).toEqual(expect.objectContaining({ status: 200, body: { ok: true } }));
    expect(stored).toEqual(
      expect.objectContaining({ mediaId: M1, ownerId: GUS, reporterId: ANA, reason: 'unwanted', note: 'no quiero verla' }),
    );
    expect((await objects.list(`r/${stored?.id}/`)).sort()).toEqual([`r/${stored?.id}/full`, `r/${stored?.id}/thumb`]);
  });

  it('refuses a key that does not open it, and a body out of shape', async () => {
    const { call, gus, ana, share } = await photoCircle();
    const shared = await share(gus, M1);
    const good = shared.key.toString('base64');

    const wrong = await call('POST', '/report', {
      token: ana.token,
      body: { mediaId: M1, reason: 'minor', contentKey: randomBytes(32).toString('base64') },
    });
    const reason = await call('POST', '/report', { token: ana.token, body: { mediaId: M1, reason: 'ugly', contentKey: good } });
    const note = await call('POST', '/report', {
      token: ana.token,
      body: { mediaId: M1, reason: 'other', note: 'x'.repeat(201), contentKey: good },
    });

    expect(wrong).toEqual(expect.objectContaining({ status: 400, body: { error: 'wrong key' } }));
    expect(reason.status).toBe(400);
    expect(note.status).toBe(400);
  });

  it('is for someone the photo was wrapped for, once per person', async () => {
    const { call, store, gus, ana, tom, share } = await photoCircle();
    const shared = await share(gus, M1);
    const body = { mediaId: M1, reason: 'consent', contentKey: shared.key.toString('base64') };

    const own = await call('POST', '/report', { token: gus.token, body });
    const stranger = await call('POST', '/report', { token: tom.token, body });
    const first = await call('POST', '/report', { token: ana.token, body });
    const second = await call('POST', '/report', { token: ana.token, body });

    expect(own.status).toBe(404);
    expect(stranger.status).toBe(404);
    expect(first.body).toEqual(second.body);
    expect(await store.listReports(10)).toHaveLength(1);
  });

  it('takes twenty an hour from one account', async () => {
    const { call, gus, ana, share } = await photoCircle();
    const shared = await share(gus, M1);
    const body = { mediaId: M1, reason: 'other', contentKey: shared.key.toString('base64') };

    for (let n = 0; n < 20; n += 1) {
      await call('POST', '/report', { token: ana.token, body });
    }

    expect((await call('POST', '/report', { token: ana.token, body })).status).toBe(429);
  });
});

describe('blocking', () => {
  it('ends the link, takes each out of the other’s challenges with their photos, and tells nobody', async () => {
    const { call, sync, store, gus, ana, share } = await photoCircle();
    await share(ana, M1);
    const cursor = (await sync(gus)).body.now;

    const blocked = await call('POST', '/block', { token: ana.token, body: { memberId: GUS } });
    const gusSees = await sync(gus, { since: cursor });

    expect(blocked.body).toEqual({ ok: true });
    expect(gusSees.body.ended).toEqual([ANA]);
    expect((await store.getChallenge(CH1))?.participantIds).toEqual([GUS, SOF]);
    expect(gusSees.body.media).toEqual([expect.objectContaining({ id: M1, deletedAt: expect.any(Number) })]);
  });

  it('answers a code between the two like one nobody has, both ways', async () => {
    const { call, gus, ana } = await photoCircle();
    await call('POST', '/block', { token: ana.token, body: { memberId: GUS } });

    const hers = await call('POST', '/invite/redeem', { token: ana.token, body: { code: GUS_CODE } });
    const his = await call('POST', '/invite/redeem', { token: gus.token, body: { code: ANA_CODE } });

    expect(hers).toEqual(expect.objectContaining({ status: 404, body: { error: 'unknown code' } }));
    expect(his).toEqual(expect.objectContaining({ status: 404, body: { error: 'unknown code' } }));
  });

  it('answers 200 again, and for a stranger; 400 for yourself; 409 without a handle', async () => {
    const { call, gus } = await photoCircle();
    const bare = await call('POST', '/account', { body: { id: NOBODY } });

    expect((await call('POST', '/block', { token: gus.token, body: { memberId: ANA } })).status).toBe(200);
    expect((await call('POST', '/block', { token: gus.token, body: { memberId: ANA } })).status).toBe(200);
    expect((await call('POST', '/block', { token: gus.token, body: { memberId: M3 } })).status).toBe(200);
    expect((await call('POST', '/block', { token: gus.token, body: { memberId: GUS } })).status).toBe(400);
    expect(
      (await call('POST', '/block', { token: `${NOBODY}.${bare.body.secret}`, body: { memberId: GUS } })).status,
    ).toBe(409);
  });

  it('keeps two people apart inside a third person’s challenge', async () => {
    const { call, sync, store, gus, ana, sof, share, post } = await photoCircle();
    await share(ana, M1, { dayKey: '2026-09-21' });
    // Ana and Sof are not linked: blocking ends nothing, and both stay in Gus's challenge.
    await call('POST', '/block', { token: sof.token, body: { memberId: ANA } });

    const withoutSof = await post(ana, M2, { dayKey: '2026-09-22', to: [gus] });
    await withoutSof.upload();
    const withSof = await post(ana, M3, { dayKey: TODAY, to: [gus, sof] });
    await withSof.upload();
    const sofSees = await sync(sof);
    const sofUrl = await call('GET', `/media/${M1}/url?variant=thumb`, { token: sof.token });
    const nudge = await sync(ana, { nudges: [{ id: N1, toId: SOF, challengeId: CH1, dayKey: TODAY }] });

    expect((await store.getChallenge(CH1))?.participantIds).toEqual([GUS, ANA, SOF]);
    expect(withoutSof.response.status).toBe(201);
    // The wrap Ana made for Sof anyway is dropped: her phone need not know of the block.
    expect((await store.getMedia(M3))?.wraps.map((wrap) => wrap.recipientId)).toEqual([ANA, GUS]);
    // Nothing of Ana's reaches Sof, not even the photo wrapped for her before the block.
    expect(sofSees.body.media).toEqual([]);
    expect(sofUrl.status).toBe(403);
    expect(nudge.body.rejected).toEqual([N1]);
  });
});

describe('leaving', () => {
  it('a challenge takes your photos out of it, and the others learn it', async () => {
    const { call, sync, gus, ana, share } = await photoCircle();
    await share(ana, M1);
    await share(gus, M2);
    const cursor = (await sync(gus)).body.now;

    await call('POST', '/challenge/leave', { token: ana.token, body: { challengeId: CH1 } });
    const gusSees = await sync(gus, { since: cursor });
    const anaSees = await sync(ana);

    expect(gusSees.body.media).toEqual([expect.objectContaining({ id: M1, deletedAt: expect.any(Number) })]);
    // Her own tombstone, and nothing of a challenge she is no longer in.
    expect(anaSees.body.media.map((row: { id: string }) => row.id)).toEqual([M1]);
  });

  it('a link that ends takes the other out of your challenges with their photos', async () => {
    const { call, store, gus, sof, share } = await photoCircle();
    await share(sof, M1);

    await call('POST', '/link/end', { token: gus.token, body: { memberId: SOF } });

    expect((await store.getChallenge(CH1))?.participantIds).toEqual([GUS, ANA]);
    expect((await store.getMedia(M1))?.deletedAt).not.toBeNull();
  });
});

describe('deleting the account', () => {
  it('empties its prefix, and the photos of the challenges it made', async () => {
    const { call, store, objects, gus, ana, share } = await photoCircle();
    await share(gus, M1);
    await share(ana, M2);

    const gone = await call('DELETE', '/account', { token: gus.token });

    expect(gone.status).toBe(204);
    expect(await objects.list('m/')).toEqual([]);
    expect(await store.getMedia(M1)).toBeNull();
    expect(await store.getMedia(M2)).toBeNull();
  });

  it('leaves a report on its photo for a moderator to read', async () => {
    const { call, gus, ana, share } = await photoCircle();
    const shared = await share(gus, M1);
    await call('POST', '/report', {
      token: ana.token,
      body: { mediaId: M1, reason: 'minor', contentKey: shared.key.toString('base64') },
    });

    await call('DELETE', '/account', { token: gus.token });
    const list = await call('GET', '/admin/reports', { headers: { Authorization: `Bearer ${ADMIN}` } });
    const photo = await call('GET', `/admin/reports/${list.body.reports[0].id}/photo`, {
      headers: { Authorization: `Bearer ${ADMIN}` },
    });

    expect(list.body.reports[0]).toEqual(expect.objectContaining({ ownerId: GUS, ownerHandle: null, photo: 'gone' }));
    expect(new TextDecoder().decode(photo.bytes)).toBe(`full photo ${M1}`);
  });
});

describe('the sync', () => {
  it('carries the photos switch both ways, and keeps it when an older phone says nothing', async () => {
    const { sync, store, gus, ana } = await photoCircle();
    await sync(gus, {
      challenges: [
        { id: CH2, name: 'Sin teléfono en la mesa', weeklyTarget: 5, startWeekKey: '2026-09-21', participantIds: [GUS, ANA], photos: false },
      ],
    });
    await sync(gus, {
      challenges: [{ id: CH2, name: 'Sin teléfono', weeklyTarget: 5, startWeekKey: '2026-09-21', participantIds: [GUS, ANA] }],
    });

    const seen = (await sync(ana)).body.challenges;

    expect(seen.find((row: { id: string }) => row.id === CH1).photos).toBe(true);
    expect(seen.find((row: { id: string }) => row.id === CH2)).toEqual(expect.objectContaining({ name: 'Sin teléfono', photos: false }));
    expect((await store.getChallenge(CH2))?.photos).toBe(false);
  });

  it('hands every key the caller may wrap for: their own, their circle’s and their challenges’', async () => {
    const { sync, gus, ana, sof, tom } = await photoCircle();

    const hers = (await sync(ana)).body.keys;
    const his = (await sync(gus)).body.keys;

    // Sof is not in Ana's circle, but they share "Leer"; Tom is in neither.
    expect(hers).toHaveLength(3);
    expect(hers).toEqual(
      expect.arrayContaining([
        { id: ANA, boxKey: ana.boxKey, keyId: keyIdOf(ana.boxKey ?? '') },
        { id: GUS, boxKey: gus.boxKey, keyId: keyIdOf(gus.boxKey ?? '') },
        { id: SOF, boxKey: sof.boxKey, keyId: keyIdOf(sof.boxKey ?? '') },
      ]),
    );
    expect(his.map((key: { id: string }) => key.id).sort()).toEqual([GUS, ANA, SOF, TOM].sort());
    expect(hers.map((key: { id: string }) => key.id)).not.toContain(tom.id);
  });

  it('gives back your own live photos when asked to restore, whatever the cursor', async () => {
    const { call, sync, gus, share } = await photoCircle();
    await share(gus, M1, { dayKey: '2026-09-22' });
    await share(gus, M2);
    await call('DELETE', `/media/${M1}`, { token: gus.token });
    const cursor = (await sync(gus)).body.now;

    const ordinary = await sync(gus, { since: cursor });
    const restored = await sync(gus, { since: cursor, restore: true });

    expect(ordinary.body.own).toBeUndefined();
    expect(restored.body.own.media).toEqual([
      expect.objectContaining({ id: M2, wrap: expect.objectContaining({ keyId: keyIdOf(gus.boxKey ?? '') }) }),
    ]);
  });
});

describe('the sweep', () => {
  it('tombstones what expired, deletes its objects, and forgets the tombstone after 60 days', async () => {
    const { sync, store, objects, gus, ana, share, wait, at } = await photoCircle();
    await share(gus, M1);
    const cursor = (await sync(ana)).body.now;
    const sweeper = createSweeper({ store, objects, now: at, log: () => undefined });

    expect((await sweeper.sweep()).expired).toBe(0);
    wait(Date.UTC(2026, 9, 26) - at());
    const swept = await sweeper.sweep();
    const told = await sync(ana, { since: cursor });

    expect(swept.expired).toBe(1);
    expect(await objects.list('m/')).toEqual([]);
    expect(told.body.media).toEqual([expect.objectContaining({ id: M1, deletedAt: expect.any(Number) })]);
    wait(60 * DAY + 1);
    expect((await sweeper.sweep()).tombstonesPurged).toBe(1);
    expect(await store.getMedia(M1)).toBeNull();
  });

  it('drops an upload whose bytes never came, after a day', async () => {
    const { call, store, objects, gus, ana, sof, post, wait, at } = await photoCircle();
    const posted = await post(gus, M1, { to: [ana, sof] });
    await call('PUT', `/media/${M1}/thumb`, { token: gus.token, raw: posted.thumb });
    const sweeper = createSweeper({ store, objects, now: at, log: () => undefined });

    expect((await sweeper.sweep()).abandoned).toBe(0);
    wait(DAY + 1);
    expect((await sweeper.sweep()).abandoned).toBe(1);
    expect(await store.getMedia(M1)).toBeNull();
    expect(await objects.list('m/')).toEqual([]);
    expect((await call('PUT', `/media/${M1}/full`, { token: gus.token, raw: posted.full })).status).toBe(404);
  });

  it('deletes, once a week, every object no row wants', async () => {
    const { store, objects, gus, share, at } = await photoCircle();
    await share(gus, M1);
    await objects.put(`m/${GUS}/${M3}/thumb`, new Uint8Array([1]));
    await objects.put('m/stray', new Uint8Array([1]));
    await objects.put('r/no-such-report/full', new Uint8Array([1]));
    const lines: string[] = [];
    const sweeper = createSweeper({ store, objects, now: at, log: (line) => lines.push(line) });

    await sweeper.tick();

    expect((await objects.list('')).sort()).toEqual([`m/${GUS}/${M1}/full`, `m/${GUS}/${M1}/thumb`]);
    expect(lines).toContain('photo reconciliation: 3 objects without a row deleted');
  });

  it('releases a preserved report after a year', async () => {
    const { call, store, objects, gus, ana, share, wait, at } = await photoCircle();
    const shared = await share(gus, M1);
    await call('POST', '/report', {
      token: ana.token,
      body: { mediaId: M1, reason: 'minor', contentKey: shared.key.toString('base64') },
    });
    const [report] = await store.listReports(1);
    await call('POST', `/admin/reports/${report?.id}/resolve`, {
      headers: { Authorization: `Bearer ${ADMIN}` },
      body: { action: 'ban', preserve: true },
    });
    const sweeper = createSweeper({ store, objects, now: at, log: () => undefined });

    wait(364 * DAY);
    expect((await sweeper.sweep()).preservedReleased).toBe(0);
    expect(await objects.list(`r/${report?.id}/`)).toHaveLength(4);
    wait(2 * DAY);
    expect((await sweeper.sweep()).preservedReleased).toBe(1);
    expect(await objects.list('r/')).toEqual([]);
    expect(await store.getReport(report?.id ?? '')).toBeNull();
  });
});

describe('moderation', () => {
  const admin = { Authorization: `Bearer ${ADMIN}` };

  async function reported() {
    const kit = await photoCircle();
    const shared = await kit.share(kit.gus, M1);
    await kit.share(kit.gus, M2, { dayKey: '2026-09-22' });
    await kit.call('POST', '/report', {
      token: kit.ana.token,
      body: { mediaId: M1, reason: 'minor', note: 'es un niño', contentKey: shared.key.toString('base64') },
    });
    const [report] = await kit.store.listReports(1);
    return { ...kit, report: report!, shared };
  }

  it('does not exist without ADMIN_TOKEN, nor with a wrong one', async () => {
    const off = await photoCircle({ adminToken: null });
    const short = await photoCircle({ adminToken: 'short' });
    const on = await photoCircle();

    expect((await off.call('GET', '/admin/reports', { headers: admin })).status).toBe(404);
    expect((await short.call('GET', '/admin/reports', { headers: { Authorization: 'Bearer short' } })).status).toBe(404);
    expect((await on.call('GET', '/admin/reports', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(404);
    expect((await on.call('GET', '/admin/reports', { token: on.gus.token })).status).toBe(404);
    expect((await on.call('GET', '/admin/reports', { headers: admin })).status).toBe(200);
  });

  it('lists open reports first, and never who reported', async () => {
    const { call, report } = await reported();

    const list = await call('GET', '/admin/reports', { headers: admin });

    expect(list.body.reports).toEqual([
      expect.objectContaining({
        id: report.id,
        reason: 'minor',
        note: 'es un niño',
        mediaId: M1,
        ownerId: GUS,
        ownerHandle: 'gus',
        ownerBanned: false,
        photo: 'live',
        evidence: true,
        resolvedAt: null,
      }),
    ]);
    expect(JSON.stringify(list.body)).not.toContain(ANA);
  });

  it('shows the reported photo, decrypted with the key the reporter gave', async () => {
    const { call, report } = await reported();

    const full = await call('GET', `/admin/reports/${report.id}/photo`, { headers: admin });
    const thumb = await call('GET', `/admin/reports/${report.id}/photo?variant=thumb`, { headers: admin });

    expect(full.headers.get('content-type')).toBe('image/jpeg');
    expect(new TextDecoder().decode(full.bytes)).toBe(`full photo ${M1}`);
    expect(new TextDecoder().decode(thumb.bytes)).toBe(`thumb of ${M1}`);
  });

  it('dismisses: the photo stays, the evidence and the key go, and it is resolved once', async () => {
    const { call, store, objects, report } = await reported();

    const resolved = await call('POST', `/admin/reports/${report.id}/resolve`, { headers: admin, body: { action: 'dismiss' } });
    const again = await call('POST', `/admin/reports/${report.id}/resolve`, { headers: admin, body: { action: 'ban' } });
    const photo = await call('GET', `/admin/reports/${report.id}/photo`, { headers: admin });

    expect(resolved.body).toEqual(
      expect.objectContaining({ id: report.id, action: 'dismiss', preservedUntil: null, removed: 0 }),
    );
    expect(again.status).toBe(409);
    expect(photo.status).toBe(410);
    expect(await objects.list(`r/${report.id}/`)).toEqual([]);
    expect((await store.getReport(report.id))?.contentKey).toBeNull();
    expect((await store.getMedia(M1))?.deletedAt).toBeNull();
  });

  it('removes: the photo becomes a tombstone every phone learns', async () => {
    const { call, sync, store, ana, report } = await reported();
    const cursor = (await sync(ana)).body.now;

    const resolved = await call('POST', `/admin/reports/${report.id}/resolve`, { headers: admin, body: { action: 'remove' } });

    expect(resolved.body.removed).toBe(1);
    expect((await sync(ana, { since: cursor })).body.media).toEqual([
      expect.objectContaining({ id: M1, deletedAt: expect.any(Number) }),
    ]);
    expect((await store.getMedia(M2))?.deletedAt).toBeNull();
  });

  it('bans: every photo of the owner goes, no new one is taken, and preserved evidence stays a year', async () => {
    const { call, store, objects, gus, ana, sof, post, report } = await reported();

    const resolved = await call('POST', `/admin/reports/${report.id}/resolve`, {
      headers: admin,
      body: { action: 'ban', preserve: true },
    });
    const meta = JSON.parse(new TextDecoder().decode((await objects.get(`r/${report.id}/meta.json`)) ?? new Uint8Array()));

    expect(resolved.body).toEqual(expect.objectContaining({ action: 'ban', removed: 2 }));
    expect(resolved.body.preservedUntil).toBe(resolved.body.resolvedAt + 365 * DAY);
    expect((await store.getAccount(GUS))?.bannedAt).not.toBeNull();
    expect(await store.liveMedia({ ownerId: GUS })).toEqual([]);
    expect((await post(gus, M3, { to: [ana, sof] })).response.status).toBe(403);
    // The ban also takes the account out of every circle, and it cannot come back in.
    expect(await store.linksOf(GUS)).toEqual([]);
    expect((await call('POST', '/invite/redeem', { token: gus.token, body: { code: 'ABC234' } })).status).toBe(403);
    expect((await objects.list(`r/${report.id}/`)).sort()).toEqual(
      ['full', 'key', 'meta.json', 'thumb'].map((file) => `r/${report.id}/${file}`),
    );
    expect(meta).toEqual(expect.objectContaining({ reportId: report.id, mediaId: M1, ownerHandle: 'gus', reason: 'minor' }));
    expect(meta).not.toHaveProperty('reporterId');
    // The evidence still opens after the photo is gone from the challenge.
    expect((await call('GET', `/admin/reports/${report.id}/photo`, { headers: admin })).status).toBe(200);
  });

  it('refuses an action it does not know, and a report that does not exist', async () => {
    const { call, report } = await reported();

    expect((await call('POST', `/admin/reports/${report.id}/resolve`, { headers: admin, body: { action: 'delete' } })).status).toBe(400);
    expect(
      (await call('POST', `/admin/reports/${report.id}/resolve`, { headers: admin, body: { action: 'remove', preserve: 'yes' } })).status,
    ).toBe(400);
    expect((await call('POST', '/admin/reports/nope/resolve', { headers: admin, body: { action: 'remove' } })).status).toBe(404);
    expect((await call('GET', '/admin/reports/nope/photo', { headers: admin })).status).toBe(404);
  });
});
