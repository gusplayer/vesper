import {
  CIRCLE_API_URL,
  REQUEST_TIMEOUT_MS,
  readRemoteKeys,
  readRemoteMedia,
  retryAfterMs,
  type ApiFailure,
  type ApiResult,
  type Credentials,
  type RemoteKey,
  type RemoteMedia,
} from './circleApi';

/**
 * The photos' half of the server contract (ADR-0051, tanda 2): a photo's row, its two
 * sealed files, the URL that downloads one, deleting it, reporting it, and blocking a
 * person. Pure like circleApi.ts, whose rules it keeps: it never throws, `offline` is an
 * ordinary answer, nothing is logged (the bearer token is in every request), and every
 * answer is read field by field.
 *
 * What it adds are the refusals only these routes have:
 *
 * - `staleKeys`: the `409` of `POST /media` when the wraps do not cover every participant
 *   with a published key, at the key they have now. It carries the keys the server holds,
 *   so the phone wraps again and asks once more.
 * - `tooLarge`: a `413`, a file over the server's cap. The same bytes never fit.
 * - `gone`: a `410`, a photo the server deleted (its owner, a moderator, its expiry, or a
 *   newer photo of the same day). Nothing about it will ever be taken again.
 *
 * The server never sees a photo, a thumbnail or a caption: what goes up here is sealed on
 * the phone (src/platform/photoCrypto.ts), and what comes down is opened there.
 */

export type { RemoteKey, RemoteMedia };
export { readRemoteKeys, readRemoteMedia };

/** The server's caps on the two files, sealed (server/README.md). */
export const MAX_THUMB_BYTES = 100 * 1024;
export const MAX_FULL_BYTES = 1.5 * 1024 * 1024;

/** At most a participant for each of the other 12 seats, and the owner. */
export const MAX_WRAPS = 13;

/** A file's round trip gets three times a JSON call's budget, like the backup's. */
export const MEDIA_TIMEOUT_MS = 3 * REQUEST_TIMEOUT_MS;

export type MediaVariant = 'full' | 'thumb';

export type MediaFailure =
  | ApiFailure
  | { kind: 'staleKeys'; keys: RemoteKey[] }
  | { kind: 'tooLarge' }
  | { kind: 'gone' };

/**
 * The `409`s of `POST /media` that no retry changes (server/src/app.ts): the challenge
 * has no photos, the day is not one of its days, or the id is somebody else's.
 */
export const FINAL_CONFLICTS: readonly string[] = ['photos off', 'not a day of that challenge', 'id taken'];

export type MediaResult<T> = { ok: true; value: T } | { ok: false; failure: MediaFailure };

/** One wrap of the photo's key: for whom, at which of their keys, and the sealed key. */
export type MediaWrap = { recipientId: string; keyId: string; box: string };

/** `POST /media`: the photo's row, before its files. */
export type MediaInput = {
  id: string;
  challengeId: string;
  dayKey: string;
  width: number;
  height: number;
  origin: 'camera' | 'library';
  /** The ephemeral public key of the wraps, base64. */
  epk: string;
  /** The caption sealed with the photo's key, base64, or null without one. */
  captionBox: string | null;
  /** One per recipient, the owner included. */
  wraps: MediaWrap[];
  /** The sealed sizes, in bytes, of what the two `PUT`s will carry. */
  thumbSize: number;
  fullSize: number;
};

export type MediaCreated = { id: string; expiresAt: number | null };

export type MediaUrl = { url: string; expiresAt: number | null };

export type ReportInput = {
  mediaId: string;
  reason: 'unwanted' | 'consent' | 'minor' | 'other';
  /** At most 200 characters; left out when there is none. */
  note: string | null;
  /** The photo's own key, base64: the server checks it opens the thumbnail it keeps. */
  contentKey: string;
};

// --- Reading ------------------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

/**
 * A non-2xx, as the one failure it means: circleApi's reading, plus the two refusals of
 * these routes. The 409s are told apart by their message, as there.
 */
export function mediaFailureFor(status: number, body: unknown, retryAfter: string | null): MediaFailure {
  const message = isObject(body) ? (str(body.error) ?? '') : '';
  switch (status) {
    case 400:
      return { kind: 'rejected', message };
    case 401:
      return { kind: 'unauthorized' };
    case 403:
      return { kind: 'forbidden' };
    case 404:
      return { kind: 'notFound' };
    case 409:
      if (message.includes('stale keys')) {
        return { kind: 'staleKeys', keys: (isObject(body) ? readRemoteKeys(body.keys) : null) ?? [] };
      }
      if (message.includes('handle required')) {
        return { kind: 'handleRequired' };
      }
      return { kind: 'conflict', message };
    case 410:
      return { kind: 'gone' };
    case 413:
      return { kind: 'tooLarge' };
    case 429:
      return { kind: 'rateLimited', retryAfterMs: retryAfterMs(retryAfter) };
    default:
      return { kind: 'serverError', status };
  }
}

// --- The transport ----------------------------------------------------------------------------

type Body = { json: unknown } | { bytes: Uint8Array } | undefined;

/**
 * One request to the circle's server. `fetch` is read from the global on every call, so
 * a test can swap it. A JSON answer is read whatever the status: a refusal says why in it.
 */
async function request(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  credentials: Credentials,
  body: Body,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<MediaResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { Authorization: `Bearer ${credentials.id}.${credentials.secret}` };
  let payload: BodyInit | undefined;
  if (body !== undefined && 'json' in body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body.json);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/octet-stream';
    payload = body.bytes as BodyInit;
  }
  try {
    const response = await fetch(`${CIRCLE_API_URL}${path}`, { method, signal: controller.signal, headers, body: payload });
    const parsed = await jsonOf(response);
    if (!response.ok) {
      return { ok: false, failure: mediaFailureFor(response.status, parsed, response.headers.get('Retry-After')) };
    }
    return { ok: true, value: parsed };
  } catch {
    // An abort, a DNS failure, a dropped connection: nobody answered.
    return { ok: false, failure: { kind: 'offline' } };
  } finally {
    clearTimeout(timer);
  }
}

/** A failure of these routes, in the vocabulary of the ones that cannot have their own. */
function asApiFailure(failure: MediaFailure): ApiFailure {
  switch (failure.kind) {
    case 'staleKeys':
      return { kind: 'conflict', message: 'stale keys' };
    case 'tooLarge':
      return { kind: 'rejected', message: 'too large' };
    case 'gone':
      return { kind: 'notFound' };
    default:
      return failure;
  }
}

function plain<T>(result: MediaResult<T>): ApiResult<T> {
  return result.ok ? result : { ok: false, failure: asApiFailure(result.failure) };
}

function segment(id: string): string {
  return encodeURIComponent(id);
}

// --- The calls ----------------------------------------------------------------------------------

/** The body of `POST /media`, exactly: nothing but the fields the server reads. */
export function mediaBody(input: MediaInput): Record<string, unknown> {
  return {
    id: input.id,
    challengeId: input.challengeId,
    dayKey: input.dayKey,
    width: Math.round(input.width),
    height: Math.round(input.height),
    origin: input.origin,
    epk: input.epk,
    captionBox: input.captionBox,
    wraps: input.wraps.slice(0, MAX_WRAPS).map((wrap) => ({
      recipientId: wrap.recipientId,
      keyId: wrap.keyId,
      box: wrap.box,
    })),
    thumbSize: input.thumbSize,
    fullSize: input.fullSize,
  };
}

/**
 * `POST /media`: the photo's row, born pending until both files arrive. A `409 stale
 * keys` comes back as `staleKeys` with the keys to wrap for; the caller wraps again.
 */
export async function postMedia(credentials: Credentials, input: MediaInput): Promise<MediaResult<MediaCreated>> {
  const result = await request('/media', 'POST', credentials, { json: mediaBody(input) });
  if (!result.ok) {
    return result;
  }
  const body = isObject(result.value) ? result.value : {};
  return { ok: true, value: { id: str(body.id) ?? input.id, expiresAt: num(body.expiresAt) } };
}

/** `PUT /media/:id/thumb` and `/full`: one sealed file, raw. Checked against the cap first. */
export async function putMediaFile(
  credentials: Credentials,
  id: string,
  variant: MediaVariant,
  bytes: Uint8Array,
): Promise<MediaResult<void>> {
  const cap = variant === 'thumb' ? MAX_THUMB_BYTES : MAX_FULL_BYTES;
  if (bytes.length > cap) {
    return { ok: false, failure: { kind: 'tooLarge' } };
  }
  const result = await request(`/media/${segment(id)}/${variant}`, 'PUT', credentials, { bytes }, MEDIA_TIMEOUT_MS);
  return result.ok ? { ok: true, value: undefined } : result;
}

/**
 * `GET /media/:id/url?variant=`: where one sealed file can be downloaded for five
 * minutes. Only for its owner, or someone it was wrapped for who is still in the
 * challenge; anyone else gets `forbidden` or `notFound`.
 */
export async function getMediaUrl(
  credentials: Credentials,
  id: string,
  variant: MediaVariant,
): Promise<ApiResult<MediaUrl>> {
  const result = plain(await request(`/media/${segment(id)}/url?variant=${variant}`, 'GET', credentials, undefined));
  if (!result.ok) {
    return result;
  }
  const body = isObject(result.value) ? result.value : {};
  const url = str(body.url);
  if (url === null) {
    return { ok: false, failure: { kind: 'serverError', status: 200 } };
  }
  return { ok: true, value: { url: absoluteUrl(url), expiresAt: num(body.expiresAt) } };
}

/**
 * A signed URL as `fetch` takes it. The server in memory (tests, a local run) answers
 * with a path of its own; a bucket answers with a whole URL.
 */
export function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${CIRCLE_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * The sealed bytes at a signed URL. No bearer token goes with it: the URL is the
 * permission, and it may point at a bucket that must never see the key. Anything over
 * the full photo's cap is refused rather than read into memory.
 */
export async function downloadMedia(url: string, cap: number = MAX_FULL_BYTES): Promise<ApiResult<Uint8Array>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      const failure = mediaFailureFor(response.status, null, response.headers.get('Retry-After'));
      return { ok: false, failure: asApiFailure(failure) };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > cap) {
      return { ok: false, failure: { kind: 'rejected', message: 'too large' } };
    }
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, failure: { kind: 'offline' } };
  } finally {
    clearTimeout(timer);
  }
}

/** `DELETE /media/:id`: the owner takes a photo back. 200 even when it is already gone. */
export async function deleteMedia(credentials: Credentials, id: string): Promise<ApiResult<void>> {
  const result = plain(await request(`/media/${segment(id)}`, 'DELETE', credentials, undefined));
  return result.ok ? { ok: true, value: undefined } : result;
}

/**
 * `POST /report` (ADR-0051 §18): the reason, a note if there is one, and the key of that
 * one photo. The server checks the key opens the thumbnail it keeps and never tells
 * anybody who reported. A `rejected` is a key that does not open it: sending it again
 * would not change that.
 */
export async function reportMedia(credentials: Credentials, input: ReportInput): Promise<ApiResult<void>> {
  const body: Record<string, unknown> = { mediaId: input.mediaId, reason: input.reason, contentKey: input.contentKey };
  if (input.note !== null && input.note !== '') {
    body.note = Array.from(input.note).slice(0, 200).join('');
  }
  const result = plain(await request('/report', 'POST', credentials, { json: body }));
  return result.ok ? { ok: true, value: undefined } : result;
}

/**
 * `POST /block` (ADR-0051 §18): the link with that person ends, like `/link/end`, and
 * their code stops working for the caller and the caller's for them. Idempotent.
 */
export async function blockMember(credentials: Credentials, memberId: string): Promise<ApiResult<void>> {
  const result = plain(await request('/block', 'POST', credentials, { json: { memberId } }));
  return result.ok ? { ok: true, value: undefined } : result;
}
