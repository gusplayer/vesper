import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteBackup,
  getBackup,
  getBackupMeta,
  MAX_BACKUP_BYTES,
  putBackup,
  readMeta,
  type BackupHeaders,
} from './backupApi';
import { CIRCLE_API_URL, type Credentials } from './circleApi';

/**
 * The backup routes of server/README.md, driven with a fake `fetch`. Nothing here
 * reaches the deployed server. Guarded: the shape of each request (raw bytes, the three
 * headers, the bearer token), a 404 read as "none", a 413 as `tooLarge`, and no call
 * that throws without a network.
 */

const ME: Credentials = { id: '0199a1b2-c3d4-7e5f-8a9b-000000000001', secret: 'a-secret' };
const HEADERS: BackupHeaders = { format: 1, schema: 10, platform: 'ios' };

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

type Reply = { status: number; body?: BodyInit | null; headers?: Record<string, string> };

const realFetch = globalThis.fetch;

function fakeFetch(replies: Reply[]): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    });
    const reply = replies.shift() ?? { status: 200, body: '{}' };
    return new Response(reply.body ?? null, { status: reply.status, headers: reply.headers });
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('putBackup', () => {
  it('sends the raw bytes with the three headers and the bearer token', async () => {
    const calls = fakeFetch([{ status: 200, body: JSON.stringify({ updatedAt: 1234, size: 3 }) }]);
    const bytes = new Uint8Array([1, 2, 3]);

    const result = await putBackup(ME, bytes, HEADERS);

    expect(result).toEqual({ ok: true, value: { updatedAt: 1234, size: 3 } });
    const [call] = calls;
    expect(call?.url).toBe(`${CIRCLE_API_URL}/backup`);
    expect(call?.method).toBe('PUT');
    expect(call?.headers).toMatchObject({
      Authorization: `Bearer ${ME.id}.${ME.secret}`,
      'Content-Type': 'application/octet-stream',
      'X-Backup-Format': '1',
      'X-Backup-Schema': '10',
      'X-Backup-Platform': 'ios',
    });
    expect(call?.body).toBe(bytes);
  });

  it('reads a 413 as too large, and never sends what is over the cap', async () => {
    fakeFetch([{ status: 413, body: JSON.stringify({ error: 'backup too large' }) }]);
    expect(await putBackup(ME, new Uint8Array([1]), HEADERS)).toEqual({ ok: false, failure: { kind: 'tooLarge' } });

    const calls = fakeFetch([]);
    expect(await putBackup(ME, new Uint8Array(MAX_BACKUP_BYTES + 1), HEADERS)).toEqual({
      ok: false,
      failure: { kind: 'tooLarge' },
    });
    expect(calls).toHaveLength(0);
  });

  it('tells a lost key, a wait and a server error apart', async () => {
    fakeFetch([
      { status: 401, body: JSON.stringify({ error: 'unauthorized' }) },
      { status: 429, body: JSON.stringify({ error: 'slow down' }), headers: { 'Retry-After': '30' } },
      { status: 502, body: '<html>bad gateway</html>' },
    ]);
    const bytes = new Uint8Array([1]);

    expect(await putBackup(ME, bytes, HEADERS)).toEqual({ ok: false, failure: { kind: 'unauthorized' } });
    expect(await putBackup(ME, bytes, HEADERS)).toEqual({
      ok: false,
      failure: { kind: 'rateLimited', retryAfterMs: 30_000 },
    });
    expect(await putBackup(ME, bytes, HEADERS)).toEqual({ ok: false, failure: { kind: 'serverError', status: 502 } });
  });

  it('answers offline instead of throwing when nobody answers', async () => {
    globalThis.fetch = (() => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch;

    expect(await putBackup(ME, new Uint8Array([1]), HEADERS)).toEqual({ ok: false, failure: { kind: 'offline' } });
  });
});

describe('getBackup', () => {
  it('returns the bytes and what the headers say', async () => {
    const calls = fakeFetch([
      {
        status: 200,
        body: new Uint8Array([9, 8, 7]),
        headers: {
          'X-Backup-Format': '1',
          'X-Backup-Schema': '9',
          'X-Backup-Platform': 'android',
          'X-Backup-Updated-At': '5555',
        },
      },
    ]);

    const result = await getBackup(ME);

    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${ME.id}.${ME.secret}`);
    expect(result.ok).toBe(true);
    if (result.ok && result.value !== null) {
      expect(result.value).toMatchObject({ format: 1, schema: 9, platform: 'android', updatedAt: 5555 });
      expect(Array.from(result.value.bytes)).toEqual([9, 8, 7]);
    } else {
      throw new Error('expected a backup');
    }
  });

  it('reads a 404 as no backup, and a 200 without its headers as the server failing', async () => {
    fakeFetch([
      { status: 404, body: JSON.stringify({ error: 'no backup' }) },
      { status: 200, body: new Uint8Array([1]) },
    ]);

    expect(await getBackup(ME)).toEqual({ ok: true, value: null });
    expect(await getBackup(ME)).toEqual({ ok: false, failure: { kind: 'serverError', status: 200 } });
  });
});

describe('getBackupMeta', () => {
  it('reads the meta, and a 404 as none', async () => {
    const calls = fakeFetch([
      { status: 200, body: JSON.stringify({ updatedAt: 10, size: 20, schema: 9, platform: 'ios', format: 1 }) },
      { status: 404, body: JSON.stringify({ error: 'no backup' }) },
    ]);

    expect(await getBackupMeta(ME)).toEqual({
      ok: true,
      value: { updatedAt: 10, size: 20, schema: 9, platform: 'ios', format: 1 },
    });
    expect(await getBackupMeta(ME)).toEqual({ ok: true, value: null });
    expect(calls[0]?.url).toBe(`${CIRCLE_API_URL}/backup/meta`);
  });
});

describe('deleteBackup', () => {
  it('sends a DELETE with the bearer token and reads the 204 as done', async () => {
    const calls = fakeFetch([{ status: 204 }]);

    const result = await deleteBackup(ME);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${CIRCLE_API_URL}/backup`);
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.headers).toMatchObject({ Authorization: `Bearer ${ME.id}.${ME.secret}` });
  });

  it('answers offline instead of throwing, and a lost key as unauthorized', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect(await deleteBackup(ME)).toEqual({ ok: false, failure: { kind: 'offline' } });

    fakeFetch([{ status: 401, body: JSON.stringify({ error: 'unauthorized' }) }]);
    expect(await deleteBackup(ME)).toEqual({ ok: false, failure: { kind: 'unauthorized' } });
  });
});

describe('readMeta', () => {
  it('is null when a field is missing or of the wrong kind', () => {
    expect(readMeta(null)).toBeNull();
    expect(readMeta({ updatedAt: 1, size: 2, schema: 3, format: 1 })).toBeNull();
    expect(readMeta({ updatedAt: 1, size: 2, schema: 3, format: 1, platform: 'web' })).toBeNull();
    expect(readMeta({ updatedAt: '1', size: 2, schema: 3, format: 1, platform: 'ios' })).toBeNull();
  });
});
