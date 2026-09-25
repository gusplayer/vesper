import type { BackupPlatform } from '../db/backup';
import {
  backupKeyOf,
  CIRCLE_API_URL,
  REQUEST_TIMEOUT_MS,
  retryAfterMs,
  type ApiFailure,
  type ApiResult,
  type Credentials,
} from './circleApi';

/**
 * The backup's half of the server contract (ADR-0048 §7, server/README.md): one opaque
 * blob per account, replaced on every upload and deleted with the account. The server
 * never sees inside it; the headers are the only things it can read, and they say
 * nothing about the person: the payload's format, its schema and the platform.
 *
 * Pure like circleApi.ts, whose transport rules it follows: it never throws, `offline`
 * is an ordinary answer, and nothing is logged, because the bearer token is in every
 * request. What it adds is the one refusal only this route has, `tooLarge` (413).
 */

/** The server's cap on one blob (server/README.md). Checked here too, before the upload. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/**
 * The blob's round trip gets three times a JSON call's budget: it carries up to five
 * megabytes, and a cold container on a slow network should not read as "offline".
 */
export const BACKUP_TIMEOUT_MS = 3 * REQUEST_TIMEOUT_MS;

export type { BackupPlatform };

/** What the headers say about a blob. */
export type BackupHeaders = { format: number; schema: number; platform: BackupPlatform };

/** `GET /backup/meta`: what is stored, without the bytes. */
export type BackupMeta = BackupHeaders & { updatedAt: number; size: number };

export type BackupDownload = BackupHeaders & { bytes: Uint8Array; updatedAt: number | null };

/** `tooLarge`: 413, the blob is over the server's cap. Retrying the same bytes is pointless. */
export type BackupFailure = ApiFailure | { kind: 'tooLarge' };

export type BackupResult<T> = { ok: true; value: T } | { ok: false; failure: BackupFailure };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function platformOf(value: unknown): BackupPlatform | null {
  return value === 'ios' || value === 'android' ? value : null;
}

function intHeader(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : null;
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

/** A non-2xx, as the one failure it means (the same reading as circleApi's, plus 413). */
function failureFor(status: number, body: unknown, retryAfter: string | null): BackupFailure {
  const message = isObject(body) && typeof body.error === 'string' ? body.error : '';
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
      return { kind: 'conflict', message };
    case 413:
      return { kind: 'tooLarge' };
    case 429:
      return { kind: 'rateLimited', retryAfterMs: retryAfterMs(retryAfter) };
    default:
      return { kind: 'serverError', status };
  }
}

/**
 * One request, answered by `read` when it is a 2xx and by a failure otherwise. `fetch`
 * is read from the global on every call, so a test can swap it.
 */
async function request<T>(
  path: string,
  init: { method: 'GET' | 'PUT' | 'DELETE'; credentials: Credentials; headers?: Record<string, string>; body?: Uint8Array },
  timeoutMs: number,
  read: (response: Response) => Promise<T>,
): Promise<BackupResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${CIRCLE_API_URL}${path}`, {
      method: init.method,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${backupKeyOf(init.credentials)}`, ...init.headers },
      body: init.body as BodyInit | undefined,
    });
    if (!response.ok) {
      const body = await jsonOf(response);
      return { ok: false, failure: failureFor(response.status, body, response.headers.get('Retry-After')) };
    }
    return { ok: true, value: await read(response) };
  } catch {
    // An abort, a DNS failure, a dropped connection: nobody answered.
    return { ok: false, failure: { kind: 'offline' } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A read's answer as the contract promises it: a 404 is "there is none" (an answer, not
 * a failure), a 200 that could not be read is the server's error, and `tooLarge` cannot
 * happen on a read — if a proxy says it anyway, that is the server's error too.
 */
function readAnswer<T>(result: BackupResult<T | null>): ApiResult<T | null> {
  if (result.ok) {
    return result.value === null ? { ok: false, failure: { kind: 'serverError', status: 200 } } : result;
  }
  if (result.failure.kind === 'notFound') {
    return { ok: true, value: null };
  }
  if (result.failure.kind === 'tooLarge') {
    return { ok: false, failure: { kind: 'serverError', status: 413 } };
  }
  return { ok: false, failure: result.failure };
}

// --- The calls ---------------------------------------------------------------------------

/** `PUT /backup`: the blob, replacing whatever the account had. */
export async function putBackup(
  credentials: Credentials,
  bytes: Uint8Array,
  headers: BackupHeaders,
): Promise<BackupResult<{ updatedAt: number; size: number }>> {
  if (bytes.length > MAX_BACKUP_BYTES) {
    return { ok: false, failure: { kind: 'tooLarge' } };
  }
  return request(
    '/backup',
    {
      method: 'PUT',
      credentials,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Backup-Format': String(headers.format),
        'X-Backup-Schema': String(headers.schema),
        'X-Backup-Platform': headers.platform,
      },
      body: bytes,
    },
    BACKUP_TIMEOUT_MS,
    async (response) => {
      const body = await jsonOf(response);
      const updatedAt = isObject(body) ? num(body.updatedAt) : null;
      const size = isObject(body) ? num(body.size) : null;
      return { updatedAt: updatedAt ?? Date.now(), size: size ?? bytes.length };
    },
  );
}

/**
 * `GET /backup`: the blob and what its headers say, or null when the account has none.
 * A blob whose headers are missing or unreadable is the server's error, not a backup.
 */
export async function getBackup(credentials: Credentials): Promise<ApiResult<BackupDownload | null>> {
  const result = await request('/backup', { method: 'GET', credentials }, BACKUP_TIMEOUT_MS, async (response) => {
    const format = intHeader(response.headers.get('X-Backup-Format'));
    const schema = intHeader(response.headers.get('X-Backup-Schema'));
    const platform = platformOf(response.headers.get('X-Backup-Platform'));
    const updatedAt = intHeader(response.headers.get('X-Backup-Updated-At'));
    const bytes = new Uint8Array(await response.arrayBuffer());
    return format === null || schema === null || platform === null
      ? null
      : { format, schema, platform, updatedAt, bytes };
  });
  return readAnswer(result);
}

/**
 * `DELETE /backup`: the switch in Ajustes turned off (ADR-0048 §7). The server answers
 * 204 whether or not there was a copy, so a retry after a lost answer is harmless.
 */
export async function deleteBackup(credentials: Credentials): Promise<ApiResult<void>> {
  const result = await request('/backup', { method: 'DELETE', credentials }, REQUEST_TIMEOUT_MS, async () => undefined);
  if (result.ok) {
    return result;
  }
  return result.failure.kind === 'tooLarge'
    ? { ok: false, failure: { kind: 'serverError', status: 413 } }
    : { ok: false, failure: result.failure };
}

/** Reads the meta body. Null when a field is missing: the caller treats it as the server's error. */
export function readMeta(body: unknown): BackupMeta | null {
  if (!isObject(body)) {
    return null;
  }
  const updatedAt = num(body.updatedAt);
  const size = num(body.size);
  const schema = num(body.schema);
  const format = num(body.format);
  const platform = platformOf(body.platform);
  if (updatedAt === null || size === null || schema === null || format === null || platform === null) {
    return null;
  }
  return { updatedAt, size, schema, format, platform };
}

/** `GET /backup/meta`: when the stored blob was written, how big and from where; null when none. */
export async function getBackupMeta(credentials: Credentials): Promise<ApiResult<BackupMeta | null>> {
  const result = await request('/backup/meta', { method: 'GET', credentials }, REQUEST_TIMEOUT_MS, async (response) =>
    readMeta(await jsonOf(response)),
  );
  return readAnswer(result);
}
