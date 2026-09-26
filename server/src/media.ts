import { createDecipheriv, createHash } from 'node:crypto';

import { isUuidV7 } from './auth.ts';
import { isMediaOrigin } from './store.ts';
import type { Challenge, Media, MediaOrigin, MediaVariant, MediaWrap } from './store.ts';

/**
 * The rules a photo lives by on the server (ADR-0051), pure: the shapes of its keys, where
 * its objects live, when it expires and how a reported one is opened. The routes are in
 * app.ts; the phone's side of the same rules is `src/domain/photos.ts` and
 * `src/platform/photoCrypto.ts`.
 */

/** A thumbnail of 320 px is about 20 KB; this is the ceiling, sealed (ADR-0051 §17). */
export const MAX_THUMB_BYTES = 100 * 1024;
/** A photo of 1280 px at 0.7 is about 200 KB; this is the ceiling, sealed. */
export const MAX_FULL_BYTES = 1536 * 1024;
/** Twelve people in a circle and the owner: one wrap each, at most. */
export const MAX_WRAPS = 13;
/** How long a download URL works (ADR-0051 §17). */
export const URL_TTL_MS = 5 * 60 * 1000;
/** On the server, days after the last day of a challenge (ADR-0051 §12). */
export const RETENTION_DAYS_AFTER_END = 14;
/** On the server, days per photo in a challenge with no end. */
export const RETENTION_DAYS_ROLLING = 28;
/** A caption of 80 characters, sealed and in base64, is under 500; this is room. */
export const MAX_CAPTION_BOX = 1024;
/** A wrap is a 32-byte key sealed with AES-GCM: 60 bytes, 80 in base64. */
export const MAX_WRAP_BOX = 256;

/** AES-256-GCM as the phone seals: nonce(12) | ciphertext | tag(16). */
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Exactly `length` bytes of base64 (standard or url-safe, padded or not), or null. The
 * bytes are encoded again and must come back the same: `Buffer.from(…, 'base64')` skips
 * what it cannot read, and a key with a typo must be refused, not quietly shortened.
 */
export function base64Bytes(value: unknown, length?: number): Buffer | null {
  if (typeof value !== 'string') {
    return null;
  }
  const clean = value.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (clean === '' || !/^[A-Za-z0-9+/]+$/.test(clean)) {
    return null;
  }
  const bytes = Buffer.from(clean, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== clean) {
    return null;
  }
  return length === undefined || bytes.length === length ? bytes : null;
}

/**
 * A box key or an ephemeral key: 32 bytes of X25519 in base64. Kept as the phone wrote it
 * (trimmed): the phones read it back with their own decoder, and the key id is computed
 * from the bytes, so the spelling does not matter to the server.
 */
export function parsePublicKey(value: unknown): string | null {
  return base64Bytes(value, KEY_BYTES) === null ? null : (value as string).trim();
}

/** The first 8 bytes of SHA-256 of the key, in hex: `keyIdOf` on the phone. */
export function keyIdOf(boxKey: string): string {
  return createHash('sha256').update(Buffer.from(boxKey, 'base64')).digest('hex').slice(0, 16);
}

/** What `keyIdOf` gives: 16 hex characters. */
export function isKeyId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
}

/** Where a photo's objects live in the bucket. The prefix is what the account deletion empties. */
export function mediaPrefix(ownerId: string): string {
  return `m/${ownerId}/`;
}

export function mediaObjectKey(media: Pick<Media, 'ownerId' | 'id'>, variant: MediaVariant): string {
  return `${mediaPrefix(media.ownerId)}${media.id}/${variant}`;
}

/** Where a report keeps its evidence: the two objects, and once preserved the key and a note. */
export function reportPrefix(reportId: string): string {
  return `r/${reportId}/`;
}

/** `m/<owner>/<media>/<variant>` → the media id, or null for a key of any other shape. */
export function mediaIdOfKey(key: string): string | null {
  const parts = key.split('/');
  return parts.length === 4 && parts[0] === 'm' && parts[2] !== '' ? (parts[2] ?? null) : null;
}

/** `r/<report>/<file>` → the report id, or null. */
export function reportIdOfKey(key: string): string | null {
  const parts = key.split('/');
  return parts.length === 3 && parts[0] === 'r' && parts[1] !== '' ? (parts[1] ?? null) : null;
}

/**
 * Opens one object of a photo with its key, as the phone sealed it: AES-256-GCM, nonce |
 * ciphertext | tag, with `vesper-photo-v1|<mediaId>|<variant>` as associated data. Null
 * when the key is not the one, the bytes were changed, or they belong to another photo or
 * variant: the tag checks all three. This is how a report proves it came with the right
 * key, and what a moderator's view decrypts with.
 */
export function openPhoto(
  contentKey: Uint8Array,
  mediaId: string,
  variant: MediaVariant,
  sealed: Uint8Array,
): Buffer | null {
  if (contentKey.byteLength !== KEY_BYTES || sealed.byteLength < NONCE_BYTES + TAG_BYTES) {
    return null;
  }
  try {
    const nonce = sealed.subarray(0, NONCE_BYTES);
    const tag = sealed.subarray(sealed.byteLength - TAG_BYTES);
    const body = sealed.subarray(NONCE_BYTES, sealed.byteLength - TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', contentKey, nonce);
    decipher.setAAD(Buffer.from(`vesper-photo-v1|${mediaId}|${variant}`, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    return null;
  }
}

// --- Days -------------------------------------------------------------------------------

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → [year, month (1–12), day], or null. */
function partsOf(dayKey: string): [number, number, number] | null {
  const match = DAY_KEY.exec(dayKey);
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function keyOf(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar days, never `n * DAY`: the same rule as the phone's `domain/day.ts`. */
export function shiftDayKey(dayKey: string, days: number): string {
  const parts = partsOf(dayKey);
  if (parts === null) {
    return dayKey;
  }
  return keyOf(parts[0], parts[1], parts[2] + days);
}

/** Whole calendar days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  const pa = partsOf(a);
  const pb = partsOf(b);
  if (pa === null || pb === null) {
    return Number.NaN;
  }
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

/** The zone as Intl knows it, or null for a name it does not: then UTC stands in. */
function formatterFor(timeZone: string | null): Intl.DateTimeFormat | null {
  if (timeZone === null) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

/** Wall-clock fields of `at` in the zone, as a UTC instant: the zone's offset is the difference. */
function wallClock(format: Intl.DateTimeFormat, at: number): number {
  const parts = format.formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/** The day `at` falls on in the zone (UTC when the zone is unknown). */
export function dayKeyIn(at: number, timeZone: string | null): string {
  const format = formatterFor(timeZone);
  const wall = format === null ? at : wallClock(format, at);
  const date = new Date(wall);
  return keyOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * The instant a day starts in the zone (UTC when the zone is unknown). The offset is read
 * at a first guess and again at the answer, which settles a day that starts across a
 * change of clocks.
 */
export function dayStartIn(dayKey: string, timeZone: string | null): number {
  const parts = partsOf(dayKey);
  if (parts === null) {
    return Number.NaN;
  }
  const midnightUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const format = formatterFor(timeZone);
  if (format === null) {
    return midnightUtc;
  }
  const offsetAt = (at: number) => wallClock(format, at) - Math.floor(at / 1000) * 1000;
  let guess = midnightUtc - offsetAt(midnightUtc);
  const settled = offsetAt(guess);
  guess = midnightUtc - settled;
  return guess;
}

/**
 * When the server forgets a photo (ADR-0051 §12), the same instant the owner's phone
 * computes (`photoExpiresAt` in `src/domain/photos.ts`): the local midnight that ends the
 * last day it is kept — 14 days after the challenge's last day, or 28 days after the day
 * it was shared in a challenge with no end — in the owner's time zone, UTC when the phone
 * never said one. A fixed date the screen can name, never a countdown.
 */
export function mediaExpiresAt(
  challenge: Pick<Challenge, 'endDayKey'>,
  sharedAt: number,
  timeZone: string | null,
): number {
  if (challenge.endDayKey !== null) {
    return dayStartIn(shiftDayKey(challenge.endDayKey, RETENTION_DAYS_AFTER_END + 1), timeZone);
  }
  return dayStartIn(shiftDayKey(dayKeyIn(sharedAt, timeZone), RETENTION_DAYS_ROLLING + 1), timeZone);
}

/**
 * "Today or yesterday" as the phone says it, checked loosely: the server does not know
 * the phone's zone for sure, and between UTC−12 and UTC+14 a phone's yesterday can be two
 * days from the server's UTC today. Two days either way; the phone holds the strict rule.
 */
export function isRecentDay(dayKey: string, at: number): boolean {
  const distance = daysBetween(dayKeyIn(at, null), dayKey);
  return Number.isFinite(distance) && Math.abs(distance) <= 2;
}

/** Inside the challenge: from its first Monday to its last day, both included. */
export function isChallengeDay(challenge: Pick<Challenge, 'startWeekKey' | 'endDayKey'>, dayKey: string): boolean {
  if (dayKey < challenge.startWeekKey) {
    return false;
  }
  return challenge.endDayKey === null || dayKey <= challenge.endDayKey;
}

// --- The upload's body --------------------------------------------------------------------

/** The largest side a phone sends is 1280 px; this is only a sanity bound. */
const MAX_SIDE = 10_000;
/** AES-GCM around 32 bytes is 60; a little room for another layout, and no more. */
const WRAP_BYTES = { min: 28, max: 200 };

export type MediaUpload = {
  id: string;
  challengeId: string;
  dayKey: string;
  width: number;
  height: number;
  origin: MediaOrigin;
  epk: string;
  captionBox: string | null;
  wraps: MediaWrap[];
  thumbSize: number;
  fullSize: number;
};

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && DAY_KEY.test(value) && shiftDayKey(value, 0) === value;
}

/**
 * `POST /media`'s body, checked for shape only: who may post it, and whether the wraps
 * cover the right keys, is the route's. Each field says what it must be when it is not.
 */
export function parseMediaUpload(body: unknown): MediaUpload | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'bad request' };
  }
  const row = body as Record<string, unknown>;
  if (!isUuidV7(row.id) || !isUuidV7(row.challengeId)) {
    return { error: 'id and challengeId must be UUID v7' };
  }
  if (!isDayKey(row.dayKey)) {
    return { error: 'dayKey is YYYY-MM-DD' };
  }
  const width = intIn(row.width, 1, MAX_SIDE);
  const height = intIn(row.height, 1, MAX_SIDE);
  if (width === null || height === null) {
    return { error: `width and height are whole pixels, 1 to ${MAX_SIDE}` };
  }
  if (!isMediaOrigin(row.origin)) {
    return { error: "origin is 'camera' or 'library'" };
  }
  const epk = parsePublicKey(row.epk);
  if (epk === null) {
    return { error: 'epk is 32 bytes of base64' };
  }
  let captionBox: string | null = null;
  if (row.captionBox !== undefined && row.captionBox !== null) {
    const sealed = typeof row.captionBox === 'string' ? base64Bytes(row.captionBox) : null;
    if (
      sealed === null ||
      sealed.length < NONCE_BYTES + TAG_BYTES ||
      (row.captionBox as string).trim().length > MAX_CAPTION_BOX
    ) {
      return { error: `captionBox is null or sealed base64 of at most ${MAX_CAPTION_BOX} characters` };
    }
    captionBox = (row.captionBox as string).trim();
  }
  if (!Array.isArray(row.wraps) || row.wraps.length === 0 || row.wraps.length > MAX_WRAPS) {
    return { error: `wraps is 1 to ${MAX_WRAPS} of { recipientId, keyId, box }` };
  }
  const wraps: MediaWrap[] = [];
  for (const item of row.wraps as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      return { error: 'a wrap is { recipientId, keyId, box }' };
    }
    const wrap = item as Record<string, unknown>;
    const box = typeof wrap.box === 'string' ? wrap.box.trim() : null;
    const sealed = box === null || box.length > MAX_WRAP_BOX ? null : base64Bytes(box);
    if (
      !isUuidV7(wrap.recipientId) ||
      !isKeyId(wrap.keyId) ||
      box === null ||
      sealed === null ||
      sealed.length < WRAP_BYTES.min ||
      sealed.length > WRAP_BYTES.max
    ) {
      return { error: 'a wrap is { recipientId: UUID v7, keyId: 16 hex, box: base64 }' };
    }
    if (wraps.some((seen) => seen.recipientId === wrap.recipientId)) {
      return { error: 'one wrap per recipient' };
    }
    wraps.push({ recipientId: wrap.recipientId, keyId: wrap.keyId, box });
  }
  const thumbSize = intIn(row.thumbSize, NONCE_BYTES + TAG_BYTES + 1, MAX_THUMB_BYTES);
  const fullSize = intIn(row.fullSize, NONCE_BYTES + TAG_BYTES + 1, MAX_FULL_BYTES);
  if (thumbSize === null || fullSize === null) {
    return { error: `thumbSize is at most ${MAX_THUMB_BYTES} bytes and fullSize at most ${MAX_FULL_BYTES}` };
  }
  return {
    id: row.id,
    challengeId: row.challengeId,
    dayKey: row.dayKey,
    width,
    height,
    origin: row.origin,
    epk,
    captionBox,
    wraps,
    thumbSize,
    fullSize,
  };
}

/**
 * A photo as a sync hands it to one person (the `RemoteMedia` of the phone): their own
 * wrap and no one else's. A tombstone carries no wrap and no caption — it only says the
 * photo is gone.
 */
export function remoteMediaFor(media: Media, viewerId: string) {
  const alive = media.deletedAt === null;
  const wrap = alive ? media.wraps.find((item) => item.recipientId === viewerId) : undefined;
  return {
    id: media.id,
    challengeId: media.challengeId,
    ownerId: media.ownerId,
    dayKey: media.dayKey,
    width: media.width,
    height: media.height,
    origin: media.origin,
    epk: media.epk,
    captionBox: alive ? media.captionBox : null,
    wrap: wrap === undefined ? null : { keyId: wrap.keyId, box: wrap.box },
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
    expiresAt: media.expiresAt,
    deletedAt: media.deletedAt,
  };
}
