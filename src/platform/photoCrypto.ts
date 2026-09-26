import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { type AesEngine, IV_LENGTH, TAG_LENGTH, utf8Decode, utf8Encode } from './backupCrypto';

/**
 * The end-to-end encryption of a challenge's photos (ADR-0051 §16). The server keeps
 * bytes it cannot open; only the people the owner wrapped a photo's key for can.
 *
 * **What is exported, and what SYNC calls** (every `engine` is an `AesEngine` from
 * `backupCrypto`: `expoEngine()` in the app, WebCrypto in the tests):
 *
 * ```ts
 * boxSecretKey(engine, secret: string): Promise<Uint8Array>          // 32 bytes
 * boxPublicKey(secretKey: Uint8Array): Uint8Array                    // 32 bytes, throws on a bad key
 * keyIdOf(engine, publicKey: Uint8Array | string): Promise<string>   // 16 hex chars, rejects on a bad key
 * readBoxKey(value: Uint8Array | string): Uint8Array | null          // a 32-byte key, or null
 * newContentKey(): Uint8Array                                        // 32 random bytes, throws without a secure source
 * sealPhoto(engine, key, mediaId, variant: 'full' | 'thumb', jpeg: Uint8Array): Promise<Uint8Array>
 * openPhoto(engine, key, mediaId, variant, sealed: Uint8Array): Promise<Uint8Array | null>
 * sealCaption(engine, key, mediaId, text: string): Promise<string>   // base64
 * openCaption(engine, key, mediaId, box: string): Promise<string | null>
 * wrapForRecipients(engine, key, mediaId, recipients: { id, publicKey }[]): Promise<WrappedKey>
 *   // WrappedKey = { epk: base64, wraps: { recipientId, keyId, box: base64 }[], skipped: string[] }
 * unwrapContentKey(engine, secretKey, epk: string, mediaId, recipientId, box: string): Promise<Uint8Array | null>
 * wrapKey, unwrapKey                                                 // the same two, by the guide's names
 * toBase64(bytes): string, fromBase64(text): Uint8Array | null       // RFC 4648, standard alphabet, padded
 * ```
 *
 * Every `open…`/`unwrap…` resolves to null on any failure (wrong key, another photo,
 * another part, a tampered byte, malformed base64) and never rejects. The `seal…`
 * functions and `wrapForRecipients` reject only on a programming error: a key that is
 * not 32 bytes, or an id with a `|` in it.
 *
 * **The formats, byte for byte** (the server repeats two of them: `box_key_id`, and the
 * thumbnail's additional data to check a report's key):
 *
 * - **Box key of an identity.** `sk = SHA-256(utf8("vesper-box-v1:" + secret))`, the
 *   same pattern as the backup's key with its own label, so the server, which keeps
 *   SHA-256 of the bare secret, cannot derive it. X25519 clamps `sk` itself (RFC 7748
 *   §5). `pk = X25519(sk, 9)` travels as `boxKey` (base64 of 32 bytes). `sk` is never
 *   stored: it comes back from the secret, wherever the secret goes.
 * - **Key id.** The first 8 bytes of SHA-256 of the 32 raw bytes of `pk`, as 16
 *   lowercase hex characters.
 * - **Content key.** 32 random bytes per photo. One key seals the full image, the
 *   thumbnail and the caption; the additional data tells the three apart.
 * - **Sealed photo.** AES-256-GCM with the content key and
 *   `aad = utf8("vesper-photo-v1|" + mediaId + "|" + variant)`, variant `full` or
 *   `thumb`, laid out as nonce (12) | ciphertext | tag (16): the backup's layout.
 * - **Sealed caption.** The same with variant `caption`, the text as UTF-8, in base64.
 * - **Wrap (ECIES).** One ephemeral X25519 pair `(esk, epk)` per photo. For each
 *   recipient `r` with box key `pk_r`: `shared = X25519(esk, pk_r)`;
 *   `kek = HKDF-SHA256(ikm = shared, salt = epk ‖ pk_r,
 *   info = utf8("vesper-photo-wrap-v1|" + mediaId + "|" + r), L = 32)`;
 *   `box = AES-256-GCM(kek, contentKey, aad = utf8(mediaId + "|" + r))`, 60 bytes in
 *   the same layout. The recipient computes `shared = X25519(sk_r, epk)` and its own
 *   `pk_r` from `sk_r`, so a wrap for an old key (the secret rotated on a restore) does
 *   not open with the new one. The owner wraps for itself too.
 *
 * Ids are joined with `|`, so an id that contains one could make two different pairs
 * read the same. Media and account ids are UUIDs; an empty id or one with a `|` is
 * refused.
 *
 * **What it costs on Hermes** (the pod's 250829098.0.17, measured on a Mac): one X25519
 * ladder is ~10 ms and everything else is noise, so wrapping for 12 is ~130 ms and
 * unwrapping ~10 ms a photo. Each recipient and each photo ends in an `await` on the
 * engine, so the JS thread is never held for more than one or two ladders at a time.
 *
 * X25519 and HKDF are `@noble/curves` and `@noble/hashes`, pure JavaScript (ADR-0051
 * §16: expo-crypto 57 has nothing asymmetric). AES-GCM stays native, behind the engine.
 * Randomness is expo-crypto's `getRandomBytes`, required lazily like the backup's
 * engine because vitest has no native module; the tests fall back to WebCrypto's
 * `getRandomValues`. Nothing ever falls back to `Math.random`.
 */

export const BOX_KEY_LABEL = 'vesper-box-v1:';
export const PHOTO_AAD_LABEL = 'vesper-photo-v1';
export const WRAP_INFO_LABEL = 'vesper-photo-wrap-v1';

/** A box key (secret or public), a content key and a key-encryption key: all 32 bytes. */
export const KEY_LENGTH = 32;
/** How much of SHA-256(pk) names a box key. */
export const KEY_ID_BYTES = 8;
/** A wrapped content key: nonce, the 32-byte key, tag. */
export const WRAP_BOX_LENGTH = IV_LENGTH + KEY_LENGTH + TAG_LENGTH;

export type PhotoVariant = 'full' | 'thumb';
type SealedPart = PhotoVariant | 'caption';

/** A person to wrap a content key for. The box key as it arrives (base64) or as bytes. */
export type WrapRecipient = { id: string; publicKey: Uint8Array | string };
export type KeyWrap = { recipientId: string; keyId: string; box: string };
/**
 * What `POST /media` carries: the ephemeral public key and one wrap per recipient.
 * `skipped` lists the recipients whose box key was not a usable X25519 key (malformed,
 * or of low order); none of them got a wrap.
 */
export type WrappedKey = { epk: string; wraps: KeyWrap[]; skipped: string[] };

// --- Base64 (RFC 4648, standard alphabet, padded) ---------------------------------------
// By hand: no Buffer in React Native, and atob/btoa work on "binary strings", not bytes.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DECODE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export function toBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    chunk +=
      ALPHABET.charAt((triple >> 18) & 63) +
      ALPHABET.charAt((triple >> 12) & 63) +
      (b === undefined ? '=' : ALPHABET.charAt((triple >> 6) & 63)) +
      (c === undefined ? '=' : ALPHABET.charAt(triple & 63));
    if (chunk.length >= 8192) {
      chunks.push(chunk);
      chunk = '';
    }
  }
  chunks.push(chunk);
  return chunks.join('');
}

/**
 * The bytes of standard base64, padded or not. Null for anything else: a character
 * outside the alphabet (base64url's `-` and `_` included), padding in the middle, or a
 * length no encoding produces. Never throws.
 */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  let end = text.length;
  if (end % 4 === 0 && end > 0) {
    if (text.charCodeAt(end - 1) === 61) {
      end -= 1;
      if (text.charCodeAt(end - 1) === 61) {
        end -= 1;
      }
    }
  }
  if (end % 4 === 1) {
    return null;
  }
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let at = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < end; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? (DECODE[code] ?? -1) : -1;
    if (value < 0) {
      return null;
    }
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

// --- Bytes -------------------------------------------------------------------------------

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** A 32-byte key from bytes or base64, copied; null for anything else. */
export function readBoxKey(value: Uint8Array | string): Uint8Array<ArrayBuffer> | null {
  const bytes = typeof value === 'string' ? fromBase64(value) : new Uint8Array(value);
  return bytes !== null && bytes.length === KEY_LENGTH ? bytes : null;
}

function requireKey(key: Uint8Array, what: string): Uint8Array<ArrayBuffer> {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`photoCrypto: ${what} must be ${KEY_LENGTH} bytes`);
  }
  return new Uint8Array(key);
}

function isJoinable(id: string): boolean {
  return id.length > 0 && !id.includes('|');
}

function requireJoinable(id: string, what: string): void {
  if (!isJoinable(id)) {
    throw new Error(`photoCrypto: ${what} must be non-empty and have no "|"`);
  }
}

// --- Randomness ----------------------------------------------------------------------------

type ExpoCrypto = Pick<typeof import('expo-crypto'), 'getRandomBytes'>;

/** Undefined until the first load; null when the module cannot be used here. */
let expoCrypto: ExpoCrypto | null | undefined;

function loadExpoCrypto(): ExpoCrypto | null {
  if (expoCrypto !== undefined) {
    return expoCrypto;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest
    const loaded = require('expo-crypto') as ExpoCrypto;
    expoCrypto = typeof loaded.getRandomBytes === 'function' ? loaded : null;
  } catch {
    expoCrypto = null;
  }
  return expoCrypto;
}

/**
 * `length` bytes from the system's secure generator: expo-crypto in the app, WebCrypto
 * where there is no native module. Throws when neither exists, rather than make a key
 * anyone could guess.
 */
function secureRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const expo = loadExpoCrypto();
  if (expo !== null) {
    try {
      const bytes = expo.getRandomBytes(length);
      if (bytes.length === length) {
        return new Uint8Array(bytes);
      }
    } catch {
      // The JS is there and the native module is not (vitest): try WebCrypto.
    }
  }
  const web = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array<ArrayBuffer>) => unknown } }).crypto;
  if (web !== undefined && typeof web.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    web.getRandomValues(bytes);
    return bytes;
  }
  throw new Error('photoCrypto: no secure random source');
}

// --- Box keys ------------------------------------------------------------------------------

/** The identity's X25519 secret key: SHA-256 of the label and the secret. */
export async function boxSecretKey(engine: AesEngine, secret: string): Promise<Uint8Array<ArrayBuffer>> {
  return engine.sha256(utf8Encode(`${BOX_KEY_LABEL}${secret}`));
}

/** The u-coordinate 9, curve25519's base point (RFC 7748 §4.1). */
const BASE_POINT = (() => {
  const u = new Uint8Array(KEY_LENGTH);
  u[0] = 9;
  return u;
})();

/**
 * The public half of a box secret key, what `POST /device` sends as `boxKey`:
 * X25519(sk, 9), the RFC's own definition. Not `x25519.getPublicKey`, which is the same
 * number through Edwards tables: on Hermes their first build costs ~90 ms and a heap of
 * BigInts, and one ladder costs ~10 ms (measured on the pod's Hermes, 250829098.0.17).
 */
export function boxPublicKey(secretKey: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(x25519.scalarMult(requireKey(secretKey, 'a box secret key'), BASE_POINT));
}

/** The last secret key `unwrapContentKey` saw and its public half: one ladder less per photo. */
let ownKey: { secretKey: Uint8Array; publicKey: Uint8Array<ArrayBuffer> } | null = null;

function ownPublicKey(secretKey: Uint8Array): Uint8Array<ArrayBuffer> {
  if (ownKey !== null && ownKey.secretKey.every((byte, i) => byte === secretKey[i])) {
    return ownKey.publicKey;
  }
  const publicKey = boxPublicKey(secretKey);
  ownKey = { secretKey: new Uint8Array(secretKey), publicKey };
  return publicKey;
}

/** 16 hex characters that name a box key: the first 8 bytes of SHA-256(pk). */
export async function keyIdOf(engine: AesEngine, publicKey: Uint8Array | string): Promise<string> {
  const key = readBoxKey(publicKey);
  if (key === null) {
    throw new Error(`photoCrypto: a box key must be ${KEY_LENGTH} bytes`);
  }
  const digest = await engine.sha256(key);
  return toHex(digest.slice(0, KEY_ID_BYTES));
}

// --- Content: photos and captions ----------------------------------------------------------

/** A fresh content key for one photo. */
export function newContentKey(): Uint8Array<ArrayBuffer> {
  return secureRandomBytes(KEY_LENGTH);
}

/** `vesper-photo-v1|<mediaId>|<part>` as UTF-8: binds a sealed part to its photo and its role. */
export function photoAad(mediaId: string, part: SealedPart): Uint8Array<ArrayBuffer> {
  return utf8Encode(`${PHOTO_AAD_LABEL}|${mediaId}|${part}`);
}

async function sealPart(
  engine: AesEngine,
  key: Uint8Array,
  mediaId: string,
  part: SealedPart,
  plain: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  requireJoinable(mediaId, 'a media id');
  return engine.seal(requireKey(key, 'a content key'), new Uint8Array(plain), photoAad(mediaId, part));
}

async function openPart(
  engine: AesEngine,
  key: Uint8Array,
  mediaId: string,
  part: SealedPart,
  sealed: Uint8Array,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (key.length !== KEY_LENGTH || sealed.length < IV_LENGTH + TAG_LENGTH || !isJoinable(mediaId)) {
    return null;
  }
  try {
    return await engine.open(new Uint8Array(key), new Uint8Array(sealed), photoAad(mediaId, part));
  } catch {
    return null;
  }
}

/** A JPEG sealed with the photo's content key: the bytes `PUT /media/:id/<variant>` uploads. */
export async function sealPhoto(
  engine: AesEngine,
  key: Uint8Array,
  mediaId: string,
  variant: PhotoVariant,
  jpeg: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return sealPart(engine, key, mediaId, variant, jpeg);
}

/** The JPEG inside a sealed photo, or null when it does not open as this photo's `variant`. */
export async function openPhoto(
  engine: AesEngine,
  key: Uint8Array,
  mediaId: string,
  variant: PhotoVariant,
  sealed: Uint8Array,
): Promise<Uint8Array<ArrayBuffer> | null> {
  return openPart(engine, key, mediaId, variant, sealed);
}

/** A caption sealed with the photo's content key, in base64: `captionBox`. */
export async function sealCaption(engine: AesEngine, key: Uint8Array, mediaId: string, text: string): Promise<string> {
  return toBase64(await sealPart(engine, key, mediaId, 'caption', utf8Encode(text)));
}

/** The caption inside `box`, or null when it does not open or is not text. */
export async function openCaption(
  engine: AesEngine,
  key: Uint8Array,
  mediaId: string,
  box: string,
): Promise<string | null> {
  const sealed = fromBase64(box);
  if (sealed === null) {
    return null;
  }
  const plain = await openPart(engine, key, mediaId, 'caption', sealed);
  return plain === null ? null : utf8Decode(plain);
}

// --- Wrapping the content key (ECIES over X25519) -------------------------------------------

function wrapInfo(mediaId: string, recipientId: string): Uint8Array<ArrayBuffer> {
  return utf8Encode(`${WRAP_INFO_LABEL}|${mediaId}|${recipientId}`);
}

function wrapAad(mediaId: string, recipientId: string): Uint8Array<ArrayBuffer> {
  return utf8Encode(`${mediaId}|${recipientId}`);
}

/** X25519, or null for a low-order point (its shared secret would be all zeros). */
function sharedSecret(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array | null {
  try {
    return x25519.getSharedSecret(secretKey, publicKey);
  } catch {
    return null;
  }
}

/** HKDF-SHA256(shared, salt = epk ‖ pk_r, info) → 32 bytes. */
function keyEncryptionKey(
  shared: Uint8Array,
  epk: Uint8Array,
  recipientKey: Uint8Array,
  mediaId: string,
  recipientId: string,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(hkdf(sha256, shared, concat(epk, recipientKey), wrapInfo(mediaId, recipientId), KEY_LENGTH));
}

/**
 * The content key wrapped for each recipient, the owner included, under one fresh
 * ephemeral key. A recipient listed twice is wrapped once (the first entry wins). A
 * recipient whose box key cannot be used is left out and named in `skipped`.
 */
export async function wrapForRecipients(
  engine: AesEngine,
  key: Uint8Array,
  mediaId: string,
  recipients: readonly WrapRecipient[],
): Promise<WrappedKey> {
  const contentKey = requireKey(key, 'a content key');
  requireJoinable(mediaId, 'a media id');
  for (const recipient of recipients) {
    requireJoinable(recipient.id, 'a recipient id');
  }

  const esk = secureRandomBytes(KEY_LENGTH);
  const epk = boxPublicKey(esk);
  const wraps: KeyWrap[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  try {
    for (const recipient of recipients) {
      if (seen.has(recipient.id)) {
        continue;
      }
      seen.add(recipient.id);
      const recipientKey = readBoxKey(recipient.publicKey);
      const shared = recipientKey === null ? null : sharedSecret(esk, recipientKey);
      if (recipientKey === null || shared === null) {
        skipped.push(recipient.id);
        continue;
      }
      const kek = keyEncryptionKey(shared, epk, recipientKey, mediaId, recipient.id);
      shared.fill(0);
      const box = await engine.seal(kek, contentKey, wrapAad(mediaId, recipient.id));
      kek.fill(0);
      wraps.push({ recipientId: recipient.id, keyId: await keyIdOf(engine, recipientKey), box: toBase64(box) });
    }
  } finally {
    esk.fill(0);
  }
  return { epk: toBase64(epk), wraps, skipped };
}

/**
 * The content key a wrap holds for `recipientId`, opened with that person's box secret
 * key; null when anything does not fit: another person's key, an old key, another
 * photo, a tampered box, malformed base64. Never rejects.
 */
export async function unwrapContentKey(
  engine: AesEngine,
  secretKey: Uint8Array,
  epk: string,
  mediaId: string,
  recipientId: string,
  box: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const ephemeral = readBoxKey(epk);
  const sealed = fromBase64(box);
  if (
    secretKey.length !== KEY_LENGTH ||
    ephemeral === null ||
    sealed === null ||
    sealed.length !== WRAP_BOX_LENGTH ||
    !isJoinable(mediaId) ||
    !isJoinable(recipientId)
  ) {
    return null;
  }
  try {
    const own = ownPublicKey(secretKey);
    const shared = sharedSecret(secretKey, ephemeral);
    if (shared === null) {
      return null;
    }
    const kek = keyEncryptionKey(shared, ephemeral, own, mediaId, recipientId);
    shared.fill(0);
    const contentKey = await engine.open(kek, sealed, wrapAad(mediaId, recipientId));
    kek.fill(0);
    return contentKey.length === KEY_LENGTH ? contentKey : null;
  } catch {
    return null;
  }
}

/** The guide's names for the same two functions. */
export const wrapKey = wrapForRecipients;
export const unwrapKey = unwrapContentKey;
