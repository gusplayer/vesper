import type { Credentials } from './circleApi';

/**
 * The backup's encryption (ADR-0048 §7): AES-256-GCM with a key only the person holds.
 *
 * - **The key** is SHA-256 of `vesper-backup-v1:` + the secret. The label keeps it apart
 *   from the secret's other use: the server checks the secret (it keeps a hash of it)
 *   and must never be able to derive this key from what it stores. Rotating the secret
 *   (ADR-0048 §5) changes the key, so a restore re-encrypts.
 * - **The additional data** is the account id: a blob copied under another account does
 *   not open, even with the right secret.
 * - **The blob** is the nonce (12 bytes), the ciphertext and the tag (16 bytes), one after
 *   the other: expo-crypto's "combined" form, and exactly what WebCrypto's AES-GCM
 *   produces with the nonce in front, so any standard implementation can open it.
 *
 * The byte helpers are pure and tested. The cipher itself is an `AesEngine`: the app's
 * is expo-crypto 57's, loaded lazily because it is a native module that vitest (and a
 * build without it) does not have; the tests run the same code on WebCrypto.
 */

export const KEY_LABEL = 'vesper-backup-v1:';
export const IV_LENGTH = 12;
export const TAG_LENGTH = 16;

// --- UTF-8, by hand: Hermes' TextDecoder is not something to count on ------------------

/** The UTF-8 bytes of `text`. A lone surrogate becomes U+FFFD, as TextEncoder does. */
export function utf8Encode(text: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(text.length * 3);
  let at = 0;
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) {
      out[at++] = code;
    } else if (code < 0x800) {
      out[at++] = 0xc0 | (code >> 6);
      out[at++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      out[at++] = 0xe0 | (code >> 12);
      out[at++] = 0x80 | ((code >> 6) & 0x3f);
      out[at++] = 0x80 | (code & 0x3f);
    } else {
      out[at++] = 0xf0 | (code >> 18);
      out[at++] = 0x80 | ((code >> 12) & 0x3f);
      out[at++] = 0x80 | ((code >> 6) & 0x3f);
      out[at++] = 0x80 | (code & 0x3f);
    }
  }
  return out.slice(0, at);
}

/** Text from UTF-8, or null for bytes that are not valid UTF-8. Never throws. */
export function utf8Decode(bytes: Uint8Array): string | null {
  const units: number[] = [];
  const chunks: string[] = [];
  const flush = () => {
    chunks.push(String.fromCharCode(...units));
    units.length = 0;
  };
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i] ?? 0;
    let code: number;
    let extra: number;
    let min: number;
    if (first < 0x80) {
      code = first;
      extra = 0;
      min = 0;
    } else if (first >= 0xc2 && first <= 0xdf) {
      code = first & 0x1f;
      extra = 1;
      min = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      code = first & 0x0f;
      extra = 2;
      min = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      code = first & 0x07;
      extra = 3;
      min = 0x10000;
    } else {
      return null;
    }
    for (let k = 1; k <= extra; k += 1) {
      const next = bytes[i + k];
      // Missing (the bytes ended mid-sequence) or not a continuation byte.
      if (next === undefined || (next & 0xc0) !== 0x80) {
        return null;
      }
      code = (code << 6) | (next & 0x3f);
    }
    if (code < min || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      return null;
    }
    if (code >= 0x10000) {
      const offset = code - 0x10000;
      units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      units.push(code);
    }
    if (units.length >= 8192) {
      flush();
    }
    i += extra + 1;
  }
  flush();
  return chunks.join('');
}

/** What the key is derived from: the label, then the secret, as UTF-8. */
export function keyMaterial(secret: string): Uint8Array<ArrayBuffer> {
  return utf8Encode(`${KEY_LABEL}${secret}`);
}

/** The additional authenticated data: the account id, as UTF-8. */
export function additionalData(accountId: string): Uint8Array<ArrayBuffer> {
  return utf8Encode(accountId);
}

/** Long enough to hold a nonce and a tag. Anything shorter cannot be a backup. */
export function hasSealedShape(blob: Uint8Array): boolean {
  return blob.length >= IV_LENGTH + TAG_LENGTH;
}

// --- The cipher ----------------------------------------------------------------------------

/** AES-256-GCM and SHA-256, whoever provides them. `open` throws on a wrong key or a tampered blob. */
export type AesEngine = {
  sha256: (bytes: Uint8Array<ArrayBuffer>) => Promise<Uint8Array<ArrayBuffer>>;
  /** Returns nonce | ciphertext | tag, with a fresh random nonce. */
  seal: (
    key: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array<ArrayBuffer>,
    aad: Uint8Array<ArrayBuffer>,
  ) => Promise<Uint8Array<ArrayBuffer>>;
  open: (
    key: Uint8Array<ArrayBuffer>,
    sealed: Uint8Array<ArrayBuffer>,
    aad: Uint8Array<ArrayBuffer>,
  ) => Promise<Uint8Array<ArrayBuffer>>;
};

/** The 32 bytes of the backup key for `secret`. */
export async function deriveKey(engine: AesEngine, secret: string): Promise<Uint8Array<ArrayBuffer>> {
  return engine.sha256(keyMaterial(secret));
}

/** The JSON of a payload, sealed with the key of `credentials`. */
export async function sealBackup(engine: AesEngine, credentials: Credentials, json: string): Promise<Uint8Array> {
  const key = await deriveKey(engine, credentials.secret);
  return engine.seal(key, utf8Encode(json), additionalData(credentials.id));
}

export type OpenOutcome = { ok: true; json: string } | { ok: false; reason: 'undecryptable' };

/**
 * The JSON inside a blob, opened with the key of `credentials`. A wrong key, another
 * account's blob, a tampered byte and bytes that are not text all read the same:
 * `undecryptable`. None of them is retried: the same key gives the same answer.
 */
export async function openBackup(engine: AesEngine, credentials: Credentials, blob: Uint8Array): Promise<OpenOutcome> {
  if (!hasSealedShape(blob)) {
    return { ok: false, reason: 'undecryptable' };
  }
  try {
    const key = await deriveKey(engine, credentials.secret);
    const plain = await engine.open(key, new Uint8Array(blob), additionalData(credentials.id));
    const json = utf8Decode(plain);
    return json === null ? { ok: false, reason: 'undecryptable' } : { ok: true, json };
  } catch {
    return { ok: false, reason: 'undecryptable' };
  }
}

// --- expo-crypto ---------------------------------------------------------------------------

type CryptoModule = typeof import('expo-crypto');

/** Undefined until the first load; null when the module cannot be used here. */
let cached: CryptoModule | null | undefined;

function cryptoModule(): CryptoModule | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest
    const loaded = require('expo-crypto') as CryptoModule;
    cached = typeof loaded.aesEncryptAsync === 'function' ? loaded : null;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * expo-crypto 57's AES-GCM (ADR-0048 §7: no new dependency). Null when this build has
 * no such module; the backup then says so instead of sending anything in the clear.
 */
export function expoEngine(): AesEngine | null {
  const crypto = cryptoModule();
  if (crypto === null) {
    return null;
  }
  return {
    sha256: async (bytes) => new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, bytes)),
    seal: async (keyBytes, plaintext, aad) => {
      const key = await crypto.AESEncryptionKey.import(keyBytes);
      const sealed = await crypto.aesEncryptAsync(plaintext, key, {
        nonce: { length: IV_LENGTH },
        tagLength: TAG_LENGTH,
        additionalData: aad,
      });
      return new Uint8Array(await sealed.combined('bytes'));
    },
    open: async (keyBytes, blob, aad) => {
      const key = await crypto.AESEncryptionKey.import(keyBytes);
      const sealed = crypto.AESSealedData.fromCombined(blob, { ivLength: IV_LENGTH, tagLength: TAG_LENGTH });
      return new Uint8Array(await crypto.aesDecryptAsync(sealed, key, { output: 'bytes', additionalData: aad }));
    },
  };
}
