import { useCircleStore } from '../data/stores/circle';
import {
  transferKey,
  usePhotoStore,
  usePhotoTransferStore,
  type MemberBoxKey,
  type PendingReport,
  type PhotoFetchFailure,
  type PhotoReportReason,
} from '../data/stores/photos';
import { thumbsToFetch, uploadCandidates, type RemotePhoto } from '../domain/photoSharing';
import { ME, type Challenge, type StoredPhoto } from '../domain/types';
import { stripJpegMetadata } from '../lib/jpegMetadata';
import { expoEngine, type AesEngine } from './backupCrypto';
import { photoFileNames, readPhotoFile, writePhotoFile } from './camera';
import { loadCredentials } from './circle';
import {
  isUuidV7,
  putDevice,
  sync,
  type ApiFailure,
  type Credentials,
  type RemoteKey,
  type RemoteMedia,
  type SyncDownload,
} from './circleApi';
import {
  deleteMedia,
  downloadMedia,
  FINAL_CONFLICTS,
  getMediaUrl,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  MAX_WRAPS,
  postMedia,
  putMediaFile,
  reportMedia,
  type MediaFailure,
  type MediaInput,
  type MediaVariant,
} from './photoApi';
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

/**
 * The photos of a challenge, shared (ADR-0051, tanda 2): what the phone does with the
 * server after every circle sync, and what a screen asks for when it opens.
 *
 * - **After each sync** (`ingestPhotoDownload`, `runPhotoQueue`, called by the circle's
 *   sync): the circle's keys are kept, the `media` rows are landed with their keys
 *   opened, this phone's key is published when the server does not have it, and then the
 *   queue: the deletes, the reports, and the user's photos waiting to go up — sealed,
 *   wrapped for the participants with a published key, `POST /media`, then its two files.
 * - **When a screen opens** (`ensureChallengeThumbs`, `ensureFullPhoto`): the thumbnails
 *   of a challenge, and one photo whole. Nothing is downloaded before somebody looks, and
 *   nothing runs in the background or by push (ADR-0051 §8).
 *
 * Local first (ADR-0044 §5): everything is written to SQLite before any request, and a
 * request that fails reverts nothing — the photo stays queued, and the next sync tries
 * again. Nothing here throws into a screen; nothing is logged (a bearer token is in every
 * request, and a photo's key in some of them).
 *
 * The keys: every identity has an X25519 key made from its secret (photoCrypto), so it
 * travels wherever the secret does. A photo's own key is wrapped for each recipient; the
 * one this phone opens is kept on the row (`content_key`), which is also what the
 * encrypted backup carries — the secret changes on a restore, and old wraps do not open
 * with the new key (`restorePhotoKeys`).
 */

/** At most this many downloads at a time: a challenge of 12 opens in a few round trips. */
const DOWNLOADS_AT_ONCE = 3;

/** How long a published key is not published again when the server still does not list it. */
const REPUBLISH_AFTER_MS = 60 * 60 * 1000;

// --- This phone's key -------------------------------------------------------------------------

type MyKeys = { secretKey: Uint8Array; boxKey: string; keyId: string };

/** The key of the last secret seen. It only lives in memory, like the secret itself. */
let myKeysCache: { id: string; secret: string; keys: MyKeys } | null = null;

async function myKeys(engine: AesEngine, credentials: Credentials): Promise<MyKeys | null> {
  if (myKeysCache !== null && myKeysCache.id === credentials.id && myKeysCache.secret === credentials.secret) {
    return myKeysCache.keys;
  }
  try {
    const secretKey = await boxSecretKey(engine, credentials.secret);
    const publicKey = boxPublicKey(secretKey);
    const keys: MyKeys = { secretKey, boxKey: toBase64(publicKey), keyId: await keyIdOf(engine, publicKey) };
    myKeysCache = { id: credentials.id, secret: credentials.secret, keys };
    return keys;
  } catch {
    return null;
  }
}

/** The public half of this phone's key, for tests and for a screen that wants to compare. */
export async function myBoxKey(credentials: Credentials): Promise<{ boxKey: string; keyId: string } | null> {
  const engine = expoEngine();
  if (engine === null) {
    return null;
  }
  const keys = await myKeys(engine, credentials);
  return keys === null ? null : { boxKey: keys.boxKey, keyId: keys.keyId };
}

/** The last key published, and when: a server that does not list it is not asked again for an hour. */
let lastPublished: { keyId: string; at: number } | null = null;

let queueFlight: Promise<void> | null = null;

const downloads = new Map<string, Promise<PhotoFetchFailure | null>>();

/** Tests and "Borrar todo y reiniciar": forget the keys, the flights and the last publish. */
export function forgetPhotoSync(): void {
  myKeysCache = null;
  lastPublished = null;
  queueFlight = null;
  downloads.clear();
  usePhotoTransferStore.setState({ running: {}, failures: {} });
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** The credentials of the circle's account, when there is one this phone can sign for. */
async function currentCredentials(): Promise<Credentials | null> {
  const { profile, account } = useCircleStore.getState();
  if (profile === null || account === null || account.id !== profile.id) {
    return null;
  }
  return loadCredentials(account.id);
}

// --- What comes down --------------------------------------------------------------------------

/** One row per id, the latest change of it: `media` and `own.media` can both carry one. */
function latestById(rows: readonly RemoteMedia[]): RemoteMedia[] {
  const byId = new Map<string, RemoteMedia>();
  for (const row of rows) {
    const current = byId.get(row.id);
    if (current === undefined || row.updatedAt >= current.updatedAt) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

/**
 * A server row as this phone keeps it, with what could be opened: the photo's key, from
 * the wrap for this phone's key (or kept from before: a photo's key never changes), and
 * the caption, with that key.
 */
async function openRow(
  engine: AesEngine | null,
  keys: MyKeys | null,
  row: RemoteMedia,
  accountId: string,
  existing: StoredPhoto | undefined,
): Promise<RemotePhoto> {
  let contentKey = existing?.contentKey ?? null;
  let caption = existing?.caption ?? null;
  if (row.deletedAt === null && engine !== null) {
    if (contentKey === null && keys !== null && row.wrap !== null) {
      const opened = await unwrapContentKey(engine, keys.secretKey, row.epk, row.id, accountId, row.wrap.box);
      contentKey = opened === null ? null : toBase64(opened);
    }
    if (contentKey !== null && caption === null && row.captionBox !== null) {
      const key = fromBase64(contentKey);
      caption = key === null ? null : await openCaption(engine, key, row.id, row.captionBox);
    }
  }
  return {
    id: row.id,
    challengeId: row.challengeId,
    memberId: row.ownerId === accountId ? ME : row.ownerId,
    dayKey: row.dayKey,
    origin: row.origin,
    width: row.width,
    height: row.height,
    captionBox: row.captionBox,
    contentKey,
    caption,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    deletedAt: row.deletedAt,
  };
}

/**
 * What a `/sync` brought for the photos (ADR-0051): the circle's published keys, and the
 * `media` rows with their keys opened where this phone's key opens them. Runs after every
 * sync, and once in a restore with the old key, before the secret changes. Returns how
 * many photos this phone can now open that it could not before. Never throws.
 */
export async function ingestPhotoDownload(
  download: Pick<SyncDownload, 'media' | 'ownMedia' | 'keys'>,
  credentials: Credentials,
  now: number,
): Promise<number> {
  try {
    const store = usePhotoStore.getState();
    if (download.keys !== null) {
      // The user's own key is never taken from the server: it comes from the secret.
      store.setBoxKeys(
        download.keys.filter((key) => key.id !== credentials.id),
        now,
      );
    }
    const rows = latestById([...download.ownMedia, ...download.media]);
    if (rows.length === 0) {
      store.expire(now);
      return 0;
    }
    const engine = expoEngine();
    const keys = engine === null ? null : await myKeys(engine, credentials);
    const existing = new Map(usePhotoStore.getState().photos.map((photo) => [photo.id, photo]));
    const incoming: RemotePhoto[] = [];
    let opened = 0;
    for (const row of rows) {
      const before = existing.get(row.id);
      const remote = await openRow(engine, keys, row, credentials.id, before);
      if (remote.contentKey !== null && (before?.contentKey ?? null) === null) {
        opened += 1;
      }
      incoming.push(remote);
    }
    usePhotoStore.getState().applyRemote(incoming, now);
    return opened;
  } catch {
    // A row this phone could not land is not a reason to fail the sync around it.
    return 0;
  }
}

// --- What goes up -----------------------------------------------------------------------------

export type Recipient = { id: string; publicKey: string; keyId: string };

/**
 * Whom a photo's key is wrapped for: the user first (the owner always wraps for itself),
 * then every other participant of the challenge with a published key. Only people the
 * challenge names: a key the server hands out for someone who is not in it here is not
 * wrapped for (the next sync brings the participants up to date).
 */
export function recipientsFor(
  challenge: Pick<Challenge, 'participantIds'>,
  boxKeys: Readonly<Record<string, MemberBoxKey>>,
  accountId: string,
  mine: { boxKey: string; keyId: string },
): Recipient[] {
  const others: Recipient[] = [];
  for (const id of challenge.participantIds) {
    if (id === ME || id === accountId || others.some((recipient) => recipient.id === id)) {
      continue;
    }
    const key = boxKeys[id];
    if (key !== undefined) {
      others.push({ id, publicKey: key.boxKey, keyId: key.keyId });
    }
  }
  return [{ id: accountId, publicKey: mine.boxKey, keyId: mine.keyId }, ...others].slice(0, MAX_WRAPS);
}

/**
 * What a refused step means for the photo:
 * - `stop`: nobody answered, the server asked for quiet or failed, or the account is not
 *   ready (no handle, a key that does not sign). It stays as it is, and the rest of the
 *   queue waits for the next sync too.
 * - `retry`: this photo waits for the next sync, and the queue goes on with the next one:
 *   keys still stale, the user's key not on the server yet, a challenge the server does
 *   not know yet.
 * - `local`: the server will never take it — too old a day, the challenge without photos
 *   or not on that day, the user no longer in it, a banned account, too large, deleted
 *   there. It stays on this phone, as in tanda 1.
 */
export function stepAfter(failure: MediaFailure): 'stop' | 'retry' | 'local' {
  switch (failure.kind) {
    case 'rejected':
    case 'forbidden':
    case 'tooLarge':
    case 'gone':
      return 'local';
    case 'conflict':
      return FINAL_CONFLICTS.some((message) => failure.message.includes(message)) ? 'local' : 'retry';
    case 'staleKeys':
    case 'notFound':
      return 'retry';
    default:
      return 'stop';
  }
}

type SendStep = 'next' | 'stop';

/** The row as it is now: the user may have removed or replaced it while a request was out. */
function current(id: string): StoredPhoto | undefined {
  return usePhotoStore.getState().photos.find((photo) => photo.id === id);
}

async function sendPhoto(
  engine: AesEngine,
  credentials: Credentials,
  keys: MyKeys,
  queued: StoredPhoto,
  now: number,
): Promise<SendStep> {
  const store = usePhotoStore.getState();
  const challenge = useCircleStore.getState().challenges.find((c) => c.id === queued.challengeId);
  if (
    challenge === undefined ||
    challenge.archivedAt !== null ||
    !challenge.photos ||
    !challenge.participantIds.includes(ME) ||
    !isUuidV7(queued.id) ||
    !isUuidV7(challenge.id)
  ) {
    store.setShare(queued.id, { remoteState: 'local' }, now);
    return 'next';
  }
  const thumb = readPhotoFile(queued.thumbFile);
  const full = readPhotoFile(queued.fullFile);
  if (thumb === null || full === null) {
    store.setShare(queued.id, { remoteState: 'local' }, now);
    return 'next';
  }

  // The key and the sealed caption are written before anything leaves: a photo whose
  // row reached the server must be sealed with the key this phone keeps.
  let contentKey = queued.contentKey === null ? null : fromBase64(queued.contentKey);
  if (contentKey === null) {
    contentKey = newContentKey();
    store.setShare(queued.id, { contentKey: toBase64(contentKey) }, now);
  }
  let captionBox = queued.captionBox;
  if (queued.caption !== null && captionBox === null) {
    captionBox = await sealCaption(engine, contentKey, queued.id, queued.caption);
    usePhotoStore.getState().setShare(queued.id, { captionBox }, now);
  }
  const sealedThumb = await sealPhoto(engine, contentKey, queued.id, 'thumb', thumb);
  const sealedFull = await sealPhoto(engine, contentKey, queued.id, 'full', full);

  if (queued.remoteState === 'queued') {
    const post = async (): Promise<Awaited<ReturnType<typeof postMedia>> | 'nobody'> => {
      const recipients = recipientsFor(challenge, usePhotoStore.getState().boxKeys, credentials.id, keys);
      if (recipients.length < 2) {
        return 'nobody';
      }
      const wrapped = await wrapForRecipients(engine, contentKey, queued.id, recipients);
      const input: MediaInput = {
        id: queued.id,
        challengeId: queued.challengeId,
        dayKey: queued.dayKey,
        width: queued.width,
        height: queued.height,
        origin: queued.origin,
        epk: wrapped.epk,
        captionBox,
        wraps: wrapped.wraps,
        thumbSize: sealedThumb.length,
        fullSize: sealedFull.length,
      };
      return postMedia(credentials, input);
    };
    let posted = await post();
    if (posted !== 'nobody' && !posted.ok && posted.failure.kind === 'staleKeys') {
      // The keys the server holds now, and once more (never the user's own: it comes
      // from the secret, and a wrap for another would be one this phone cannot open).
      usePhotoStore.getState().mergeBoxKeys(
        posted.failure.keys.filter((key) => key.id !== credentials.id),
        now,
      );
      posted = await post();
    }
    if (current(queued.id) === undefined) {
      return 'next';
    }
    if (posted === 'nobody') {
      // Nobody else can open it any more: it was for them, and it stays here.
      usePhotoStore.getState().setShare(queued.id, { remoteState: 'local' }, now);
      return 'next';
    }
    if (!posted.ok) {
      const step = stepAfter(posted.failure);
      if (step === 'local') {
        usePhotoStore.getState().setShare(queued.id, { remoteState: 'local' }, now);
      }
      return step === 'stop' ? 'stop' : 'next';
    }
    usePhotoStore.getState().setShare(queued.id, { remoteState: 'posted', expiresAt: posted.value.expiresAt }, now);
  }

  for (const [variant, bytes] of [
    ['thumb', sealedThumb],
    ['full', sealedFull],
  ] as const) {
    const put = await putMediaFile(credentials, queued.id, variant, bytes);
    if (current(queued.id) === undefined) {
      return 'next';
    }
    if (!put.ok) {
      if (put.failure.kind === 'notFound') {
        // The server no longer has the row (swept while it waited): a new one next time.
        usePhotoStore.getState().setShare(queued.id, { remoteState: 'queued' }, now);
        return 'next';
      }
      const step = stepAfter(put.failure);
      if (step === 'local') {
        usePhotoStore.getState().setShare(queued.id, { remoteState: 'local' }, now);
      }
      return step === 'stop' ? 'stop' : 'next';
    }
  }
  usePhotoStore.getState().setShare(queued.id, { remoteState: 'uploaded' }, now);
  return 'next';
}

/** Whether a failed call is one to try again later, as opposed to one that will never go. */
function worthRetrying(failure: ApiFailure): boolean {
  return (
    failure.kind === 'offline' ||
    failure.kind === 'rateLimited' ||
    failure.kind === 'serverError' ||
    failure.kind === 'unauthorized' ||
    failure.kind === 'handleRequired'
  );
}

async function sendDeletes(credentials: Credentials): Promise<SendStep> {
  for (const id of [...usePhotoStore.getState().pendingDeletes]) {
    if (!isUuidV7(id)) {
      usePhotoStore.getState().settleDelete(id, Date.now());
      continue;
    }
    const result = await deleteMedia(credentials, id);
    if (!result.ok && worthRetrying(result.failure)) {
      return 'stop';
    }
    usePhotoStore.getState().settleDelete(id, Date.now());
  }
  return 'next';
}

async function sendReport(credentials: Credentials, report: PendingReport): Promise<SendStep> {
  const result = await reportMedia(credentials, report);
  if (!result.ok && worthRetrying(result.failure)) {
    return 'stop';
  }
  // Sent, or refused for good (a key that does not open it): either way, not again.
  usePhotoStore.getState().settleReport(report.mediaId, Date.now());
  return 'next';
}

async function sendReports(credentials: Credentials): Promise<SendStep> {
  for (const report of [...usePhotoStore.getState().pendingReports]) {
    if ((await sendReport(credentials, report)) === 'stop') {
      return 'stop';
    }
  }
  return 'next';
}

/**
 * This phone's key, published when the server does not list it as the user's (the first
 * time, and after a restore changed the secret). True when the server has it, or was
 * just given it. A server from before photos (`keys` null) is not asked.
 */
async function publishKey(credentials: Credentials, keys: MyKeys, serverKeys: readonly RemoteKey[] | null): Promise<boolean> {
  if (serverKeys === null) {
    return false;
  }
  if (serverKeys.some((key) => key.id === credentials.id && key.keyId === keys.keyId)) {
    return true;
  }
  const now = Date.now();
  if (lastPublished !== null && lastPublished.keyId === keys.keyId && now - lastPublished.at < REPUBLISH_AFTER_MS) {
    return true;
  }
  const result = await putDevice(credentials, { timeZone: timeZone(), boxKey: keys.boxKey });
  if (result.ok) {
    lastPublished = { keyId: keys.keyId, at: now };
  }
  return result.ok;
}

/**
 * The queue, after a sync (ADR-0051): this phone's key, then the deletes, the reports and
 * the photos waiting to go up, oldest first. One run at a time; a second caller shares
 * the first. Whatever fails stays queued for the next sync. Never throws.
 *
 * `serverKeys` are the keys the sync just brought (null from a server before photos, and
 * then nothing is sent).
 */
export function runPhotoQueue(credentials: Credentials, serverKeys: readonly RemoteKey[] | null): Promise<void> {
  if (queueFlight !== null) {
    return queueFlight;
  }
  const flight = runQueue(credentials, serverKeys)
    .catch(() => undefined)
    .finally(() => {
      if (queueFlight === flight) {
        queueFlight = null;
      }
    });
  queueFlight = flight;
  return flight;
}

async function runQueue(credentials: Credentials, serverKeys: readonly RemoteKey[] | null): Promise<void> {
  const engine = expoEngine();
  if (engine === null || serverKeys === null) {
    return;
  }
  const keys = await myKeys(engine, credentials);
  if (keys === null) {
    return;
  }
  if (!(await publishKey(credentials, keys, serverKeys))) {
    return;
  }
  if ((await sendDeletes(credentials)) === 'stop') {
    return;
  }
  if ((await sendReports(credentials)) === 'stop') {
    return;
  }
  for (const photo of uploadCandidates(usePhotoStore.getState().photos)) {
    const queued = current(photo.id);
    if (queued === undefined) {
      continue;
    }
    const step = await sendPhoto(engine, credentials, keys, queued, Date.now());
    if (step === 'stop') {
      return;
    }
  }
}

// --- What a screen asks for -------------------------------------------------------------------

function fetchFailure(failure: ApiFailure): PhotoFetchFailure {
  switch (failure.kind) {
    case 'offline':
      return 'offline';
    case 'notFound':
    case 'forbidden':
      return 'gone';
    default:
      return 'failed';
  }
}

/** One file of one photo: its signed URL, the sealed bytes, opened, written. */
async function download(credentials: Credentials, id: string, variant: MediaVariant): Promise<PhotoFetchFailure | null> {
  const engine = expoEngine();
  const photo = current(id);
  if (engine === null || photo === undefined || photo.contentKey === null) {
    return 'unavailable';
  }
  const key = fromBase64(photo.contentKey);
  if (key === null) {
    return 'failed';
  }
  const url = await getMediaUrl(credentials, id, variant);
  if (!url.ok) {
    return fetchFailure(url.failure);
  }
  const sealed = await downloadMedia(url.value.url, variant === 'thumb' ? MAX_THUMB_BYTES : MAX_FULL_BYTES);
  if (!sealed.ok) {
    return fetchFailure(sealed.failure);
  }
  const opened = await openPhoto(engine, key, id, variant, sealed.value);
  if (opened === null) {
    return 'failed';
  }
  // Its owner's phone already stripped it; a phone that did not (another client, an old
  // build) must not put a place on this one. What cannot be walked as a JPEG is not kept.
  const jpeg = stripJpegMetadata(opened);
  if (jpeg === opened) {
    return 'failed';
  }
  const names = photoFileNames(id);
  const name = variant === 'full' ? names.fullFile : names.thumbFile;
  if (!writePhotoFile(name, jpeg)) {
    return 'failed';
  }
  // Deletes the file instead when the row went meanwhile.
  usePhotoStore.getState().setFile(id, variant, name);
  return null;
}

/** One download per file at a time; the transfer store says which are running and why one failed. */
function fetchFile(credentials: Credentials, id: string, variant: MediaVariant): Promise<PhotoFetchFailure | null> {
  const key = transferKey(id, variant);
  const running = downloads.get(key);
  if (running !== undefined) {
    return running;
  }
  usePhotoTransferStore.setState((state) => ({ running: { ...state.running, [key]: true } }));
  const flight = download(credentials, id, variant)
    .catch((): PhotoFetchFailure => 'failed')
    .then((failure) => {
      usePhotoTransferStore.setState((state) => {
        const { [key]: _done, ...stillRunning } = state.running;
        const { [key]: _last, ...failures } = state.failures;
        return { running: stillRunning, failures: failure === null ? failures : { ...failures, [key]: failure } };
      });
      return failure;
    })
    .finally(() => {
      downloads.delete(key);
    });
  downloads.set(key, flight);
  return flight;
}

function markUnavailable(ids: readonly string[], variant: MediaVariant): void {
  if (ids.length === 0) {
    return;
  }
  usePhotoTransferStore.setState((state) => {
    const failures = { ...state.failures };
    for (const id of ids) {
      failures[transferKey(id, variant)] = 'unavailable';
    }
    return { failures };
  });
}

/**
 * The thumbnails of a challenge's photos that are not on this phone yet, when its page
 * opens (ADR-0051): other people's, and the user's own after a restore. A few at a time,
 * each opened and written as `<id>.thumb.jpg`. Whatever fails is asked again the next
 * time the page opens. Never throws.
 */
export async function ensureChallengeThumbs(challengeId: string): Promise<void> {
  const store = usePhotoStore.getState();
  const missing = thumbsToFetch(store.photos, challengeId, {
    hidden: new Set(store.hiddenMembers),
    now: Date.now(),
  });
  if (missing.length === 0) {
    return;
  }
  const credentials = await currentCredentials();
  if (credentials === null) {
    markUnavailable(
      missing.map((photo) => photo.id),
      'thumb',
    );
    return;
  }
  const queue = [...missing];
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      await fetchFile(credentials, next.id, 'thumb');
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOADS_AT_ONCE, queue.length) }, worker));
}

/**
 * The whole photo, when the viewer opens it (ADR-0051): true once `<id>.jpg` is on this
 * phone — at once for the user's own, after a download for anybody else's. False when
 * it could not come down; `usePhotoFetch` says why. Never throws.
 */
export async function ensureFullPhoto(id: string): Promise<boolean> {
  const photo = current(id);
  if (photo === undefined) {
    return false;
  }
  if (photo.fullFile !== null) {
    return true;
  }
  if (photo.contentKey === null) {
    markUnavailable([id], 'full');
    return false;
  }
  const credentials = await currentCredentials();
  if (credentials === null) {
    markUnavailable([id], 'full');
    return false;
  }
  return (await fetchFile(credentials, id, 'full')) === null;
}

// --- Reporting --------------------------------------------------------------------------------

/**
 * - `sent`: the server has the report.
 * - `queued`: it goes with the next sync (no connection now). The photo is gone here anyway.
 * - `gone`: there was no such photo here, or no key of it to show the server.
 */
export type ReportOutcome = 'sent' | 'queued' | 'gone';

/**
 * "Reportar la foto" (ADR-0051 §18): the photo leaves this phone at once and never comes
 * back, and the report — the reason, a note, and that one photo's key, which lets the
 * server open the thumbnail it keeps and nothing else — goes to the server now or with
 * the next sync. The server never says who reported. Never throws.
 */
export async function reportPhoto(id: string, reason: PhotoReportReason, note: string | null): Promise<ReportOutcome> {
  const report = usePhotoStore.getState().reportPhoto(id, reason, note, Date.now());
  if (report === null) {
    return 'gone';
  }
  const credentials = await currentCredentials();
  if (credentials === null) {
    return 'queued';
  }
  return (await sendReport(credentials, report)) === 'stop' ? 'queued' : 'sent';
}

// --- Restoring --------------------------------------------------------------------------------

/**
 * A restore's photos, with the **old** credentials, before the secret changes (ADR-0048
 * §5, ADR-0051 §16): every photo the account can still see — its own and the ones
 * wrapped for it — comes down with `restore: true`, and each wrap is opened with the key
 * the old secret makes. The keys land on the rows, so after the rotation (a new secret,
 * a new key, and wraps that no longer open) the photos can still be downloaded and
 * opened. The backup already brought the keys of the photos it knew; this adds the ones
 * that came after it. False when the server could not be reached: then only the photos
 * since the last backup are lost.
 */
export async function restorePhotoKeys(credentials: Credentials, now: number): Promise<boolean> {
  const result = await sync(
    credentials,
    { since: 0, weeks: [], challenges: [], marks: [], kudos: [], nudges: [] },
    { restore: true },
  );
  if (!result.ok) {
    return false;
  }
  await ingestPhotoDownload(result.value, credentials, now);
  return true;
}
