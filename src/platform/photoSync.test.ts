import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCircleStore } from '../data/stores/circle';
import { usePhotoStore, usePhotoTransferStore } from '../data/stores/photos';
import { createFakeDb, transactionOn, type FakeRows } from '../db/testing/fakeDb';
import { ME, type Challenge, type StoredPhoto } from '../domain/types';
import { CIRCLE_API_URL, type Credentials, type RemoteKey, type RemoteMedia } from './circleApi';
import {
  boxPublicKey,
  boxSecretKey,
  fromBase64,
  keyIdOf,
  newContentKey,
  openCaption,
  openPhoto,
  sealCaption,
  sealPhoto,
  toBase64,
  unwrapContentKey,
  wrapForRecipients,
} from './photoCrypto';
import {
  ensureChallengeThumbs,
  ensureFullPhoto,
  forgetPhotoSync,
  ingestPhotoDownload,
  recipientsFor,
  reportPhoto,
  restorePhotoKeys,
  runPhotoQueue,
  stepAfter,
} from './photoSync';

/**
 * The photos' sync (ADR-0051, tanda 2) against a fake server behind `fetch`, with the
 * real cipher on WebCrypto: what the queue sends and in which order, what it does with
 * each refusal, what a download writes, and a restore that opens the keys with the old
 * secret. The stores run on a fake database; the files live in a map.
 */

const hoisted = vi.hoisted(() => {
  const IV = 12;
  const subtle = globalThis.crypto.subtle;
  const engine = {
    sha256: async (bytes: Uint8Array<ArrayBuffer>) => new Uint8Array(await subtle.digest('SHA-256', bytes)),
    seal: async (keyBytes: Uint8Array<ArrayBuffer>, plaintext: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>) => {
      const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV));
      const sealed = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext));
      const out = new Uint8Array(IV + sealed.length);
      out.set(iv);
      out.set(sealed, IV);
      return out;
    },
    open: async (keyBytes: Uint8Array<ArrayBuffer>, blob: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>) => {
      const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
      return new Uint8Array(
        await subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(0, IV), additionalData: aad }, key, blob.slice(IV)),
      );
    },
  };
  return {
    engine,
    files: new Map<string, Uint8Array>(),
    deleted: [] as (string | null)[],
    credentials: null as { id: string; secret: string } | null,
  };
});

let fake = createFakeDb();

vi.mock('../db/client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

vi.mock('../lib/uuid', () => ({ uuidv7: (now: number) => `id-${now}` }));

vi.mock('./backupCrypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./backupCrypto')>()),
  expoEngine: () => hoisted.engine,
}));

vi.mock('./camera', () => ({
  photoFileNames: (id: string) => ({ fullFile: `${id}.jpg`, thumbFile: `${id}.thumb.jpg` }),
  readPhotoFile: (name: string | null) => (name === null ? null : (hoisted.files.get(name) ?? null)),
  writePhotoFile: (name: string, bytes: Uint8Array) => {
    hoisted.files.set(name, bytes);
    return true;
  },
  deletePhotoFiles: (names: readonly (string | null)[]) => {
    hoisted.deleted.push(...names);
  },
  deleteAllPhotoFiles: () => undefined,
}));

vi.mock('./circle', () => ({
  loadCredentials: async (id: string) => (hoisted.credentials?.id === id ? hoisted.credentials : null),
}));

const engine = hoisted.engine;

const MINE = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const LUIS = '0199a1b2-c3d4-7e5f-8a9b-000000000003';
const CHALLENGE = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const PHOTO = '0199a1b2-c3d4-7e5f-8a9b-0000000000d1';
const ANAS = '0199a1b2-c3d4-7e5f-8a9b-0000000000d2';
const EXPIRES = 1_900_000_000_000;
const T0 = 1_700_000_000_000;

const CREDENTIALS: Credentials = { id: MINE, secret: 'my-secret-that-is-long-enough-000000' };

async function identity(secret: string) {
  const secretKey = await boxSecretKey(engine, secret);
  const publicKey = boxPublicKey(secretKey);
  return { secretKey, boxKey: toBase64(publicKey), keyId: await keyIdOf(engine, publicKey) };
}

/** The smallest shapes the metadata stripper walks: SOI, a scan with its data, EOI. */
const THUMB = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9]);
const FULL = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 4, 5, 6, 7, 8, 0xff, 0xd9]);
/** The same thumbnail with an Exif segment in front, as a careless client could send it. */
const THUMB_WITH_EXIF = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66, ...THUMB.slice(2)]);

const CHALLENGE_ROW: Challenge = {
  id: CHALLENGE,
  name: 'Leer',
  weeklyTarget: 4,
  startWeekKey: '2026-09-21',
  endDayKey: '2026-10-11',
  createdBy: ME,
  participantIds: [ME, ANA],
  habitId: 'habit-read',
  photos: true,
  createdAt: 1,
  archivedAt: null,
};

function queued(overrides: Partial<StoredPhoto> = {}): StoredPhoto {
  const id = overrides.id ?? PHOTO;
  return {
    id,
    challengeId: CHALLENGE,
    memberId: ME,
    dayKey: '2026-09-22',
    origin: 'camera',
    caption: 'Pierna, por fin.',
    width: 1280,
    height: 960,
    fullFile: `${id}.jpg`,
    thumbFile: `${id}.thumb.jpg`,
    takenAt: T0,
    createdAt: T0,
    updatedAt: T0,
    contentKey: null,
    remoteState: 'queued',
    expiresAt: null,
    captionBox: null,
    ...overrides,
  };
}

// --- A server behind fetch -------------------------------------------------------------------

type Request = { method: string; path: string; body: unknown; bytes: Uint8Array | null; headers: Record<string, string> };
type Reply = { status: number; body?: unknown; raw?: Uint8Array };

const server = {
  requests: [] as Request[],
  objects: new Map<string, Uint8Array>(),
  /** Answers first; undefined falls through to the ordinary routes. */
  override: null as ((request: Request) => Reply | undefined) | null,
};

function route(request: Request): Reply {
  const custom = server.override?.(request);
  if (custom !== undefined) {
    return custom;
  }
  const { method, path } = request;
  if (method === 'POST' && path === '/media') {
    return { status: 201, body: { id: (request.body as { id: string }).id, expiresAt: EXPIRES } };
  }
  const put = /^\/media\/([^/]+)\/(thumb|full)$/.exec(path);
  if (method === 'PUT' && put !== null && request.bytes !== null) {
    server.objects.set(`${put[1]}/${put[2]}`, request.bytes);
    return { status: 200, body: { ok: true } };
  }
  const url = /^\/media\/([^/]+)\/url\?variant=(thumb|full)$/.exec(path);
  if (method === 'GET' && url !== null) {
    const key = `${url[1]}/${url[2]}`;
    return server.objects.has(key) ? { status: 200, body: { url: `/objects/${key}`, expiresAt: 1 } } : { status: 404 };
  }
  const object = /^\/objects\/(.+)$/.exec(path);
  if (method === 'GET' && object !== null) {
    const bytes = server.objects.get(object[1] ?? '');
    return bytes === undefined ? { status: 404 } : { status: 200, raw: bytes };
  }
  return { status: 200, body: {} };
}

function installServer(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body;
    const request: Request = {
      method: init?.method ?? 'GET',
      path: url.startsWith(CIRCLE_API_URL) ? url.slice(CIRCLE_API_URL.length) : url,
      body: typeof body === 'string' ? (JSON.parse(body) as unknown) : null,
      bytes: body instanceof Uint8Array ? body : null,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    server.requests.push(request);
    const reply = route(request);
    const payload = reply.raw ?? (reply.body === undefined ? null : JSON.stringify(reply.body));
    return new Response(payload as BodyInit | null, { status: reply.status });
  }) as unknown as typeof fetch;
}

function offline(): void {
  globalThis.fetch = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
}

function paths(): string[] {
  return server.requests.map((request) => `${request.method} ${request.path}`);
}

const realFetch = globalThis.fetch;

let me: Awaited<ReturnType<typeof identity>>;
let ana: Awaited<ReturnType<typeof identity>>;

function serverKeys(): RemoteKey[] {
  return [
    { id: MINE, boxKey: me.boxKey, keyId: me.keyId },
    { id: ANA, boxKey: ana.boxKey, keyId: ana.keyId },
  ];
}

beforeEach(async () => {
  fake = createFakeDb();
  forgetPhotoSync();
  hoisted.files.clear();
  hoisted.deleted.length = 0;
  hoisted.credentials = CREDENTIALS;
  server.requests.length = 0;
  server.objects.clear();
  server.override = null;
  installServer();
  me = await identity(CREDENTIALS.secret);
  ana = await identity('ana-secret-that-is-long-enough-00000');
  hoisted.files.set(`${PHOTO}.jpg`, FULL);
  hoisted.files.set(`${PHOTO}.thumb.jpg`, THUMB);
  useCircleStore.setState({
    profile: { id: MINE, name: 'Gus', handle: 'gus', codeGeneration: 0, createdAt: 1 },
    account: { id: MINE, createdAt: 1 },
    challenges: [CHALLENGE_ROW],
    members: [{ id: ANA, name: 'Ana', handle: 'ana', status: 'member', joinedAt: 1, createdAt: 1 }],
  });
  usePhotoStore.setState({
    photos: [queued()],
    hiddenMembers: [],
    boxKeys: { [ANA]: { boxKey: ana.boxKey, keyId: ana.keyId } },
    pendingDeletes: [],
    pendingReports: [],
    reported: [],
    termsAcceptedAt: null,
  });
  usePhotoTransferStore.setState({ running: {}, failures: {} });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function photo(id = PHOTO): StoredPhoto | undefined {
  return usePhotoStore.getState().photos.find((candidate) => candidate.id === id);
}

// --- Pure --------------------------------------------------------------------------------------

describe('recipientsFor', () => {
  it('wraps for the user first, then each participant with a key, once, never for ME', () => {
    const recipients = recipientsFor(
      { participantIds: [ME, ANA, LUIS, ANA, MINE] },
      { [ANA]: { boxKey: 'a', keyId: 'ka' }, [ME]: { boxKey: 'x', keyId: 'kx' } },
      MINE,
      { boxKey: 'm', keyId: 'km' },
    );

    expect(recipients).toEqual([
      { id: MINE, publicKey: 'm', keyId: 'km' },
      { id: ANA, publicKey: 'a', keyId: 'ka' },
    ]);
  });
});

describe('stepAfter', () => {
  it('stops on silence, waits on a conflict, and keeps local what the server will never take', () => {
    expect(stepAfter({ kind: 'offline' })).toBe('stop');
    expect(stepAfter({ kind: 'rateLimited', retryAfterMs: 1 })).toBe('stop');
    expect(stepAfter({ kind: 'serverError', status: 500 })).toBe('stop');
    expect(stepAfter({ kind: 'handleRequired' })).toBe('stop');
    expect(stepAfter({ kind: 'notFound' })).toBe('retry');
    expect(stepAfter({ kind: 'staleKeys', keys: [] })).toBe('retry');
    expect(stepAfter({ kind: 'conflict', message: 'box key required' })).toBe('retry');
    expect(stepAfter({ kind: 'conflict', message: 'photos off' })).toBe('local');
    expect(stepAfter({ kind: 'conflict', message: 'not a day of that challenge' })).toBe('local');
    expect(stepAfter({ kind: 'rejected', message: 'too old' })).toBe('local');
    expect(stepAfter({ kind: 'forbidden' })).toBe('local');
    expect(stepAfter({ kind: 'tooLarge' })).toBe('local');
    expect(stepAfter({ kind: 'gone' })).toBe('local');
  });
});

// --- The queue --------------------------------------------------------------------------------

describe('uploading', () => {
  it('seals the photo, wraps its key for the user and Ana, posts the row, then both files', async () => {
    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(paths()).toEqual(['POST /media', `PUT /media/${PHOTO}/thumb`, `PUT /media/${PHOTO}/full`]);
    const sent = photo();
    expect(sent).toMatchObject({ remoteState: 'uploaded', expiresAt: EXPIRES });
    const key = fromBase64(sent?.contentKey ?? '');
    expect(key).not.toBeNull();

    const body = server.requests[0]?.body as {
      wraps: { recipientId: string; keyId: string; box: string }[];
      epk: string;
      captionBox: string;
      thumbSize: number;
      fullSize: number;
      dayKey: string;
      origin: string;
    };
    expect(body.wraps.map((wrap) => [wrap.recipientId, wrap.keyId])).toEqual([
      [MINE, me.keyId],
      [ANA, ana.keyId],
    ]);
    expect(body).toMatchObject({ dayKey: '2026-09-22', origin: 'camera' });
    // Ana opens her wrap, then the caption and the files with the key inside.
    const anaWrap = body.wraps[1];
    const opened = await unwrapContentKey(engine, ana.secretKey, body.epk, PHOTO, ANA, anaWrap?.box ?? '');
    expect(opened).not.toBeNull();
    expect(toBase64(opened ?? new Uint8Array())).toBe(sent?.contentKey);
    expect(await openCaption(engine, opened ?? new Uint8Array(), PHOTO, body.captionBox)).toBe('Pierna, por fin.');
    const sealedThumb = server.objects.get(`${PHOTO}/thumb`) ?? new Uint8Array();
    expect(body.thumbSize).toBe(sealedThumb.length);
    expect(await openPhoto(engine, opened ?? new Uint8Array(), PHOTO, 'thumb', sealedThumb)).toEqual(THUMB);
    expect(await openPhoto(engine, opened ?? new Uint8Array(), PHOTO, 'full', server.objects.get(`${PHOTO}/full`) ?? new Uint8Array())).toEqual(FULL);
  });

  it("publishes the user's key first when the server does not list it", async () => {
    await runPhotoQueue(CREDENTIALS, [{ id: ANA, boxKey: ana.boxKey, keyId: ana.keyId }]);

    expect(paths()[0]).toBe('POST /device');
    expect(server.requests[0]?.body).toMatchObject({ boxKey: me.boxKey });
    expect(photo()?.remoteState).toBe('uploaded');
  });

  it('sends nothing to a server from before photos', async () => {
    await runPhotoQueue(CREDENTIALS, null);

    expect(server.requests).toEqual([]);
    expect(photo()?.remoteState).toBe('queued');
  });

  it('wraps again with the keys a 409 names, once', async () => {
    const fresh = await identity('ana-after-her-restore-000000000000000');
    let posts = 0;
    server.override = (request) => {
      if (request.method === 'POST' && request.path === '/media') {
        posts += 1;
        if (posts === 1) {
          return {
            status: 409,
            body: { error: 'stale keys', keys: [{ id: ANA, boxKey: fresh.boxKey, keyId: fresh.keyId }] },
          };
        }
      }
      return undefined;
    };

    await runPhotoQueue(CREDENTIALS, serverKeys());

    const second = server.requests.filter((request) => request.path === '/media')[1]?.body as {
      wraps: { recipientId: string; keyId: string }[];
    };
    expect(second.wraps.map((wrap) => wrap.keyId)).toEqual([me.keyId, fresh.keyId]);
    expect(usePhotoStore.getState().boxKeys[ANA]?.keyId).toBe(fresh.keyId);
    expect(photo()?.remoteState).toBe('uploaded');
  });

  it('leaves the photo queued when the keys are still stale after the second try', async () => {
    server.override = (request) =>
      request.path === '/media' ? { status: 409, body: { error: 'stale keys', keys: [] } } : undefined;

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(paths()).toEqual(['POST /media', 'POST /media']);
    expect(photo()?.remoteState).toBe('queued');
    // The key it was sealed with is kept, so the next try seals with the same one.
    expect(photo()?.contentKey).not.toBeNull();
  });

  it('keeps everything queued without a connection, and the same key for the next try', async () => {
    offline();

    await runPhotoQueue(CREDENTIALS, serverKeys());

    const kept = photo();
    expect(kept?.remoteState).toBe('queued');
    expect(kept?.contentKey).not.toBeNull();
    expect(kept?.captionBox).not.toBeNull();

    installServer();
    await runPhotoQueue(CREDENTIALS, serverKeys());
    expect(photo()?.contentKey).toBe(kept?.contentKey);
    expect(photo()?.remoteState).toBe('uploaded');
  });

  it('sends only the files of a photo whose row already reached the server', async () => {
    usePhotoStore.setState({ photos: [queued({ remoteState: 'posted', contentKey: toBase64(newContentKey()) })] });

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(paths()).toEqual([`PUT /media/${PHOTO}/thumb`, `PUT /media/${PHOTO}/full`]);
    expect(photo()?.remoteState).toBe('uploaded');
  });

  it('asks for a new row when the server lost the one the files were for', async () => {
    usePhotoStore.setState({ photos: [queued({ remoteState: 'posted', contentKey: toBase64(newContentKey()) })] });
    server.override = (request) => (request.method === 'PUT' ? { status: 404 } : undefined);

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(photo()?.remoteState).toBe('queued');
  });

  it('keeps here a photo the server deleted while its files were on their way', async () => {
    usePhotoStore.setState({ photos: [queued({ remoteState: 'posted', contentKey: toBase64(newContentKey()) })] });
    server.override = (request) => (request.method === 'PUT' ? { status: 410, body: { error: 'media deleted' } } : undefined);

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(photo()?.remoteState).toBe('local');
  });

  it('keeps on the phone a photo the server will never take, and goes on with the next', async () => {
    const second = '0199a1b2-c3d4-7e5f-8a9b-0000000000d3';
    hoisted.files.set(`${second}.jpg`, FULL);
    hoisted.files.set(`${second}.thumb.jpg`, THUMB);
    usePhotoStore.setState({
      photos: [queued(), queued({ id: second, dayKey: '2026-09-23', createdAt: T0 + 1 })],
    });
    server.override = (request) =>
      request.path === '/media' && (request.body as { id: string }).id === PHOTO
        ? { status: 400, body: { error: 'day out of range' } }
        : undefined;

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(photo()?.remoteState).toBe('local');
    expect(photo(second)?.remoteState).toBe('uploaded');
  });

  it('keeps it on the phone when nobody else has a key any more, without asking the server', async () => {
    usePhotoStore.setState({ boxKeys: {} });

    await runPhotoQueue(CREDENTIALS, [{ id: MINE, boxKey: me.boxKey, keyId: me.keyId }]);

    expect(server.requests).toEqual([]);
    expect(photo()?.remoteState).toBe('local');
  });

  it('keeps on the phone a photo whose challenge lost its photos or its files', async () => {
    useCircleStore.setState({ challenges: [{ ...CHALLENGE_ROW, photos: false }] });

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(server.requests).toEqual([]);
    expect(photo()?.remoteState).toBe('local');
  });

  it('runs once at a time: a second caller shares the first run', async () => {
    await Promise.all([runPhotoQueue(CREDENTIALS, serverKeys()), runPhotoQueue(CREDENTIALS, serverKeys())]);

    expect(paths().filter((path) => path === 'POST /media')).toHaveLength(1);
  });
});

describe('deletes and reports', () => {
  it('sends the deletes before any upload, and forgets them once the server answers', async () => {
    usePhotoStore.setState({ pendingDeletes: ['0199a1b2-c3d4-7e5f-8a9b-0000000000d9', 'not-a-uuid'] });

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(paths()[0]).toBe('DELETE /media/0199a1b2-c3d4-7e5f-8a9b-0000000000d9');
    expect(usePhotoStore.getState().pendingDeletes).toEqual([]);
  });

  it('keeps the deletes, and everything after them, without a connection', async () => {
    usePhotoStore.setState({ pendingDeletes: ['0199a1b2-c3d4-7e5f-8a9b-0000000000d9'] });
    server.override = (request) => (request.method === 'DELETE' ? { status: 503 } : undefined);

    await runPhotoQueue(CREDENTIALS, serverKeys());

    expect(usePhotoStore.getState().pendingDeletes).toHaveLength(1);
    expect(paths()).toEqual(['DELETE /media/0199a1b2-c3d4-7e5f-8a9b-0000000000d9']);
  });

  it('reports a photo at once: gone from here, and its key to the server', async () => {
    usePhotoStore.setState({
      photos: [queued({ id: ANAS, memberId: ANA, remoteState: 'remote', contentKey: 'a2V5' })],
    });

    expect(await reportPhoto(ANAS, 'unwanted', null)).toBe('sent');
    expect(server.requests[0]?.body).toEqual({ mediaId: ANAS, reason: 'unwanted', contentKey: 'a2V5' });
    expect(usePhotoStore.getState().photos).toEqual([]);
    expect(usePhotoStore.getState().pendingReports).toEqual([]);
  });

  it('keeps a report for the next sync without a connection, and sends it then', async () => {
    usePhotoStore.setState({
      photos: [queued({ id: ANAS, memberId: ANA, remoteState: 'remote', contentKey: 'a2V5' })],
    });
    offline();

    expect(await reportPhoto(ANAS, 'minor', 'es una niña')).toBe('queued');
    expect(usePhotoStore.getState().pendingReports).toHaveLength(1);

    installServer();
    await runPhotoQueue(CREDENTIALS, serverKeys());
    expect(paths()).toContain('POST /report');
    expect(usePhotoStore.getState().pendingReports).toEqual([]);
  });

  it('says gone for a photo it cannot report', async () => {
    expect(await reportPhoto(PHOTO, 'other', null)).toBe('gone');
  });
});

// --- What comes down ---------------------------------------------------------------------------

/** Ana's photo, sealed on her phone and wrapped for whoever she chose. */
async function anasPhoto(recipients: { id: string; boxKey: string }[], overrides: Partial<RemoteMedia> = {}) {
  const key = newContentKey();
  const wrapped = await wrapForRecipients(
    engine,
    key,
    ANAS,
    recipients.map((r) => ({ id: r.id, publicKey: r.boxKey })),
  );
  server.objects.set(`${ANAS}/thumb`, await sealPhoto(engine, key, ANAS, 'thumb', THUMB));
  server.objects.set(`${ANAS}/full`, await sealPhoto(engine, key, ANAS, 'full', FULL));
  const mine = wrapped.wraps.find((wrap) => wrap.recipientId === MINE) ?? null;
  const row: RemoteMedia = {
    id: ANAS,
    challengeId: CHALLENGE,
    ownerId: ANA,
    dayKey: '2026-09-22',
    width: 1280,
    height: 960,
    origin: 'library',
    epk: wrapped.epk,
    captionBox: await sealCaption(engine, key, ANAS, 'Con Luis'),
    wrap: mine === null ? null : { keyId: mine.keyId, box: mine.box },
    createdAt: T0,
    updatedAt: T0,
    expiresAt: EXPIRES,
    deletedAt: null,
    ...overrides,
  };
  return { key, row };
}

describe('ingestPhotoDownload', () => {
  it("opens Ana's key and caption with the user's key, and keeps the circle's keys but the user's own", async () => {
    usePhotoStore.setState({ photos: [] });
    const { key, row } = await anasPhoto([{ id: ANA, boxKey: ana.boxKey }, { id: MINE, boxKey: me.boxKey }]);

    const opened = await ingestPhotoDownload({ media: [row], ownMedia: [], keys: serverKeys() }, CREDENTIALS, T0);

    expect(opened).toBe(1);
    expect(photo(ANAS)).toMatchObject({
      memberId: ANA,
      remoteState: 'remote',
      contentKey: toBase64(key),
      caption: 'Con Luis',
      thumbFile: null,
      expiresAt: EXPIRES,
    });
    expect(Object.keys(usePhotoStore.getState().boxKeys)).toEqual([ANA]);
  });

  it('keeps a photo with no wrap for this key, which is never drawn', async () => {
    usePhotoStore.setState({ photos: [] });
    const stranger = await identity('someone-else-000000000000000000000000');
    const { row } = await anasPhoto([{ id: MINE, boxKey: stranger.boxKey }]);

    expect(await ingestPhotoDownload({ media: [row], ownMedia: [], keys: null }, CREDENTIALS, T0)).toBe(0);
    expect(photo(ANAS)?.contentKey).toBeNull();
  });

  it('leaves the stored keys alone when the server sends none', async () => {
    await ingestPhotoDownload({ media: [], ownMedia: [], keys: null }, CREDENTIALS, T0);

    expect(Object.keys(usePhotoStore.getState().boxKeys)).toEqual([ANA]);
  });
});

describe('downloads when a screen asks', () => {
  it("brings the thumbnails of a challenge's photos, opened, under the names of tanda 1", async () => {
    usePhotoStore.setState({ photos: [] });
    const { row } = await anasPhoto([{ id: MINE, boxKey: me.boxKey }]);
    await ingestPhotoDownload({ media: [row], ownMedia: [], keys: null }, CREDENTIALS, T0);

    await ensureChallengeThumbs(CHALLENGE);

    expect(hoisted.files.get(`${ANAS}.thumb.jpg`)).toEqual(THUMB);
    expect(photo(ANAS)?.thumbFile).toBe(`${ANAS}.thumb.jpg`);
    // The signed URL goes without the bearer token.
    const download = server.requests.find((request) => request.path.startsWith('/objects/'));
    expect(download?.headers.Authorization).toBeUndefined();
  });

  it('strips what a careless client left in a photo, and keeps nothing that is not a JPEG', async () => {
    usePhotoStore.setState({ photos: [] });
    const { key, row } = await anasPhoto([{ id: MINE, boxKey: me.boxKey }]);
    await ingestPhotoDownload({ media: [row], ownMedia: [], keys: null }, CREDENTIALS, T0);
    server.objects.set(`${ANAS}/thumb`, await sealPhoto(engine, key, ANAS, 'thumb', THUMB_WITH_EXIF));
    server.objects.set(`${ANAS}/full`, await sealPhoto(engine, key, ANAS, 'full', new Uint8Array([1, 2, 3])));

    await ensureChallengeThumbs(CHALLENGE);
    expect(hoisted.files.get(`${ANAS}.thumb.jpg`)).toEqual(THUMB);

    expect(await ensureFullPhoto(ANAS)).toBe(false);
    expect(hoisted.files.has(`${ANAS}.jpg`)).toBe(false);
    expect(usePhotoTransferStore.getState().failures[`${ANAS}:full`]).toBe('failed');
  });

  it('says why a thumbnail did not come, and asks nothing for a hidden person', async () => {
    usePhotoStore.setState({ photos: [] });
    const { row } = await anasPhoto([{ id: MINE, boxKey: me.boxKey }]);
    await ingestPhotoDownload({ media: [row], ownMedia: [], keys: null }, CREDENTIALS, T0);

    usePhotoStore.getState().hideMember(ANA, T0);
    server.requests.length = 0;
    await ensureChallengeThumbs(CHALLENGE);
    expect(server.requests).toEqual([]);

    usePhotoStore.getState().showMember(ANA, T0);
    offline();
    await ensureChallengeThumbs(CHALLENGE);
    expect(usePhotoTransferStore.getState().failures[`${ANAS}:thumb`]).toBe('offline');
    expect(usePhotoTransferStore.getState().running).toEqual({});
  });

  it("brings the whole photo for the viewer, and says at once that the user's own is here", async () => {
    usePhotoStore.setState({ photos: [queued({ remoteState: 'uploaded' })] });
    const { row } = await anasPhoto([{ id: MINE, boxKey: me.boxKey }]);
    await ingestPhotoDownload({ media: [row], ownMedia: [], keys: null }, CREDENTIALS, T0);
    server.requests.length = 0;

    expect(await ensureFullPhoto(PHOTO)).toBe(true);
    expect(server.requests).toEqual([]);

    expect(await ensureFullPhoto(ANAS)).toBe(true);
    expect(hoisted.files.get(`${ANAS}.jpg`)).toEqual(FULL);
    expect(photo(ANAS)?.fullFile).toBe(`${ANAS}.jpg`);
  });

  it('answers false, with the reason, for a photo the server no longer gives', async () => {
    usePhotoStore.setState({ photos: [] });
    const { row } = await anasPhoto([{ id: MINE, boxKey: me.boxKey }]);
    await ingestPhotoDownload({ media: [row], ownMedia: [], keys: null }, CREDENTIALS, T0);
    server.objects.clear();

    expect(await ensureFullPhoto(ANAS)).toBe(false);
    expect(usePhotoTransferStore.getState().failures[`${ANAS}:full`]).toBe('gone');
    expect(await ensureFullPhoto('nothing')).toBe(false);
  });
});

// --- Restoring -----------------------------------------------------------------------------------

describe('restorePhotoKeys', () => {
  it('opens every wrap with the old key before the secret changes, so the photos survive it', async () => {
    usePhotoStore.setState({ photos: [], boxKeys: {} });
    const { key, row } = await anasPhoto([{ id: MINE, boxKey: me.boxKey }]);
    const ownKey = newContentKey();
    const ownWrap = await wrapForRecipients(engine, ownKey, PHOTO, [{ id: MINE, publicKey: me.boxKey }]);
    const own: RemoteMedia = {
      ...row,
      id: PHOTO,
      ownerId: MINE,
      dayKey: '2026-09-21',
      epk: ownWrap.epk,
      captionBox: null,
      wrap: { keyId: me.keyId, box: ownWrap.wraps[0]?.box ?? '' },
    };
    server.override = (request) =>
      request.path === '/sync'
        ? { status: 200, body: { now: 5, media: [row], own: { media: [own] }, keys: serverKeys() } }
        : undefined;

    expect(await restorePhotoKeys(CREDENTIALS, T0)).toBe(true);

    const sync = server.requests.find((request) => request.path === '/sync');
    expect(sync?.body).toMatchObject({ since: 0, restore: true, weeks: [], marks: [] });
    expect(sync?.headers.Authorization).toBe(`Bearer ${MINE}.${CREDENTIALS.secret}`);
    expect(photo(ANAS)?.contentKey).toBe(toBase64(key));
    expect(photo(PHOTO)).toMatchObject({ memberId: ME, remoteState: 'uploaded', contentKey: toBase64(ownKey), fullFile: null });

    // The secret rotates: the same rows come again, and no wrap opens with the new key.
    const rotated: Credentials = { id: MINE, secret: 'the-new-secret-after-rotation-0000000' };
    hoisted.credentials = rotated;
    await ingestPhotoDownload({ media: [row], ownMedia: [own], keys: serverKeys() }, rotated, T0 + 1);

    expect(photo(ANAS)?.contentKey).toBe(toBase64(key));
    expect(photo(PHOTO)?.contentKey).toBe(toBase64(ownKey));
    // And the files still come down and open.
    expect(await ensureFullPhoto(ANAS)).toBe(true);
  });

  it('says false when the server could not be reached, and changes nothing', async () => {
    offline();

    expect(await restorePhotoKeys(CREDENTIALS, T0)).toBe(false);
    expect(usePhotoStore.getState().photos).toHaveLength(1);
  });

  it('publishes the new key on the first queue after the rotation', async () => {
    const rotated: Credentials = { id: MINE, secret: 'the-new-secret-after-rotation-0000000' };
    const next = await identity(rotated.secret);
    usePhotoStore.setState({ photos: [] });

    await runPhotoQueue(rotated, serverKeys());

    expect(paths()).toEqual(['POST /device']);
    expect(server.requests[0]?.body).toMatchObject({ boxKey: next.boxKey });
  });
});
