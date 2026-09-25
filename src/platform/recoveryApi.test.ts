import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CIRCLE_API_URL, type Credentials } from './circleApi';
import {
  cleanCode,
  cleanEmail,
  finishRecovery,
  isValidCode,
  isValidEmail,
  readRecoveredKey,
  recoveryFailureFor,
  removeRecoveryEmail,
  sendRecoveryCode,
  startRecovery,
  verifyRecoveryCode,
} from './recoveryApi';

/**
 * The recovery email's contract (ADR-0050), driven with a fake `fetch` like
 * circleApi.test.ts: the shape of every request, the refusals that each mean a
 * different sentence, and the promise that nothing throws without a network.
 */

const ID = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const SECRET = 'Zm9vYmFyYmF6cXV4cXV1eGZvb2JhcmJhenF1eHF1dXg';
const CREDENTIALS: Credentials = { id: ID, secret: SECRET };

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body?: unknown; raw?: string; headers?: Record<string, string> };

function fakeFetch(replies: Reply[]) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined || init.body === null ? undefined : JSON.parse(String(init.body)),
    });
    const reply = replies.shift() ?? { status: 200, body: {} };
    const text = reply.raw ?? (reply.body === undefined ? null : JSON.stringify(reply.body));
    return new Response(reply.status === 204 ? null : text, { status: reply.status, headers: reply.headers });
  }) as unknown as typeof fetch;
  return calls;
}

function only(calls: readonly Call[]): Call {
  expect(calls.length).toBe(1);
  const call = calls[0];
  if (call === undefined) {
    throw new Error('no call');
  }
  return call;
}

let realFetch: typeof fetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('the shapes checked on the phone', () => {
  it('cleans an email the way the server does, and checks its shape', () => {
    expect(cleanEmail('  Gus@Example.COM ')).toBe('gus@example.com');
    expect(isValidEmail(' Gus@Example.com ')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
    for (const bad of ['', 'gus', 'gus@', '@example.com', 'gus@example', 'gus@.com', 'gus@example.', 'a@b@c.com', 'g us@example.com']) {
      expect(isValidEmail(bad)).toBe(false);
    }
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false);
  });

  it('reads a code with or without spaces, and only six digits are one', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('123-456')).toBe('123456');
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
  });
});

describe('recoveryFailureFor', () => {
  it('tells the two 400s apart by their message', () => {
    expect(recoveryFailureFor(400, { error: 'wrong code' }, null)).toEqual({ kind: 'wrongCode' });
    expect(recoveryFailureFor(400, { error: 'bad email' }, null)).toEqual({ kind: 'badEmail' });
    expect(recoveryFailureFor(400, { error: 'bad body' }, null)).toEqual({ kind: 'rejected', message: 'bad body' });
  });

  it('reads an expired code, a spent code, a budget and a lost key', () => {
    expect(recoveryFailureFor(410, { error: 'code expired' }, null)).toEqual({ kind: 'codeExpired' });
    // Five wrong codes: waiting does not help, a new code does.
    expect(recoveryFailureFor(429, { error: 'too many attempts' }, null)).toEqual({ kind: 'tooManyAttempts' });
    expect(recoveryFailureFor(429, { error: 'rate limited' }, '30')).toEqual({ kind: 'rateLimited', retryAfterMs: 30_000 });
    expect(recoveryFailureFor(401, { error: 'unauthorized' }, null)).toEqual({ kind: 'unauthorized' });
  });

  it('reads a refused email and a copy of the key the server can no longer open', () => {
    expect(recoveryFailureFor(502, { error: 'email not sent' }, null)).toEqual({ kind: 'notSent' });
    expect(recoveryFailureFor(502, null, null)).toEqual({ kind: 'serverError', status: 502 });
    expect(recoveryFailureFor(500, { error: 'escrow unreadable' }, null)).toEqual({ kind: 'escrowUnreadable' });
    expect(recoveryFailureFor(500, { error: 'internal' }, null)).toEqual({ kind: 'serverError', status: 500 });
  });

  it('says "not available yet" only when the server itself says so', () => {
    expect(recoveryFailureFor(503, { error: 'email not configured' }, null)).toEqual({ kind: 'notConfigured' });
    // A proxy's 503 is the server being down, not the feature being off.
    expect(recoveryFailureFor(503, null, null)).toEqual({ kind: 'serverError', status: 503 });
    expect(recoveryFailureFor(500, { error: 'email not configured' }, null)).toEqual({ kind: 'serverError', status: 500 });
  });
});

describe('confirming an email', () => {
  it('asks for a code with the cleaned email, the language and the bearer token', async () => {
    const calls = fakeFetch([{ status: 202, body: { sent: true } }]);

    expect(await sendRecoveryCode(CREDENTIALS, ' Gus@Example.com ', 'es')).toEqual({ ok: true, value: undefined });

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/recovery/email`);
    expect(call.method).toBe('POST');
    expect(call.headers.Authorization).toBe(`Bearer ${ID}.${SECRET}`);
    expect(call.body).toEqual({ email: 'gus@example.com', locale: 'es' });
  });

  it('never sends an email the phone knows is malformed', async () => {
    const calls = fakeFetch([]);
    expect(await sendRecoveryCode(CREDENTIALS, 'gus@example', 'en')).toEqual({ ok: false, failure: { kind: 'badEmail' } });
    expect(calls).toEqual([]);
  });

  it('reads "not configured" and "not sent" as their own failures', async () => {
    fakeFetch([
      { status: 503, body: { error: 'email not configured' } },
      { status: 502, body: { error: 'email not sent' } },
    ]);
    expect(await sendRecoveryCode(CREDENTIALS, 'gus@example.com', 'en')).toEqual({
      ok: false,
      failure: { kind: 'notConfigured' },
    });
    expect(await sendRecoveryCode(CREDENTIALS, 'gus@example.com', 'en')).toEqual({
      ok: false,
      failure: { kind: 'notSent' },
    });
  });

  it('verifies the code and answers the email the server stored', async () => {
    const calls = fakeFetch([{ status: 200, body: { email: 'gus@example.com' } }]);

    expect(await verifyRecoveryCode(CREDENTIALS, '123 456')).toEqual({ ok: true, value: { email: 'gus@example.com' } });

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/recovery/email/verify`);
    expect(call.body).toEqual({ code: '123456' });
    expect(call.headers.Authorization).toBe(`Bearer ${ID}.${SECRET}`);
  });

  it('tells a wrong, an expired and a spent code apart', async () => {
    fakeFetch([
      { status: 400, body: { error: 'wrong code' } },
      { status: 410, body: { error: 'code expired' } },
      { status: 429, body: { error: 'too many attempts' } },
    ]);
    expect(await verifyRecoveryCode(CREDENTIALS, '111111')).toEqual({ ok: false, failure: { kind: 'wrongCode' } });
    expect(await verifyRecoveryCode(CREDENTIALS, '111111')).toEqual({ ok: false, failure: { kind: 'codeExpired' } });
    expect(await verifyRecoveryCode(CREDENTIALS, '111111')).toEqual({ ok: false, failure: { kind: 'tooManyAttempts' } });
  });

  it('removes the email with a DELETE and reads the 204 as done', async () => {
    const calls = fakeFetch([{ status: 204 }]);
    expect(await removeRecoveryEmail(CREDENTIALS)).toEqual({ ok: true, value: undefined });
    const call = only(calls);
    expect(call.method).toBe('DELETE');
    expect(call.url).toBe(`${CIRCLE_API_URL}/recovery/email`);
    expect(call.body).toBeUndefined();
  });
});

describe('recovering with an email', () => {
  it('starts without a key, and a 202 says nothing about whether the email exists', async () => {
    const calls = fakeFetch([{ status: 202, body: { sent: true } }]);

    expect(await startRecovery('Gus@Example.com', 'en')).toEqual({ ok: true, value: undefined });

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/recovery/start`);
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.body).toEqual({ email: 'gus@example.com', locale: 'en' });
  });

  it('trades the email and the code for the key', async () => {
    const calls = fakeFetch([{ status: 200, body: { id: ID.toUpperCase(), secret: SECRET } }]);

    expect(await finishRecovery('gus@example.com', '123456')).toEqual({ ok: true, value: { id: ID, secret: SECRET } });

    const call = only(calls);
    expect(call.url).toBe(`${CIRCLE_API_URL}/recovery/finish`);
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.body).toEqual({ email: 'gus@example.com', code: '123456' });
  });

  it('says when the email can no longer bring the key back', async () => {
    fakeFetch([{ status: 500, body: { error: 'escrow unreadable' } }]);
    expect(await finishRecovery('gus@example.com', '123456')).toEqual({ ok: false, failure: { kind: 'escrowUnreadable' } });
  });

  it('never hands back half a key', async () => {
    fakeFetch([{ status: 200, body: { id: ID } }]);
    expect(await finishRecovery('gus@example.com', '123456')).toEqual({
      ok: false,
      failure: { kind: 'serverError', status: 200 },
    });
    expect(readRecoveredKey({ id: 'not-a-uuid', secret: SECRET })).toBeNull();
    expect(readRecoveredKey({ id: ID, secret: 'has.dot' })).toBeNull();
    expect(readRecoveredKey(null)).toBeNull();
  });

  it('answers offline instead of throwing when nobody answers', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect(await startRecovery('gus@example.com', 'es')).toEqual({ ok: false, failure: { kind: 'offline' } });
    expect(await finishRecovery('gus@example.com', '123456')).toEqual({ ok: false, failure: { kind: 'offline' } });
    expect(await removeRecoveryEmail(CREDENTIALS)).toEqual({ ok: false, failure: { kind: 'offline' } });
  });

  it('reads a proxy page in HTML as the server failing, not as a crash', async () => {
    fakeFetch([{ status: 502, raw: '<html>Bad gateway</html>' }]);
    expect(await startRecovery('gus@example.com', 'es')).toEqual({ ok: false, failure: { kind: 'serverError', status: 502 } });
  });
});
