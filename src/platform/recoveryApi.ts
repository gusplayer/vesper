import {
  backupKeyOf,
  CIRCLE_API_URL,
  isUuidV7,
  REQUEST_TIMEOUT_MS,
  retryAfterMs,
  type ApiFailure,
  type Credentials,
} from './circleApi';

/**
 * The recovery email's half of the server contract (ADR-0050 §1–§7): confirm an email
 * with a six-digit code, take it away, and, from any phone, trade the email and a code
 * for the key.
 *
 * Pure like circleApi.ts and backupApi.ts, whose transport rules it follows: it never
 * throws, `offline` is an ordinary answer, and nothing is logged — the bearer token is
 * in the authenticated calls, and the key itself is in the answer of `finishRecovery`.
 *
 * What it adds to `ApiFailure` are the refusals only these routes have, each one a
 * sentence the screens can say (rule 8):
 *
 * - `notConfigured`: `503 { error: 'email not configured' }`. The server has no mail
 *   provider or no escrow key yet. Any other 503 (a proxy, a cold container) is a
 *   plain `serverError`: only the server's own words mean "not available yet".
 * - `badEmail`: `400 bad email`.
 * - `wrongCode`: `400 wrong code` — also what an email with no Vesper answers when
 *   recovering (§4), so the screen can never tell the two apart, and must not try.
 * - `codeExpired`: `410`. Ten minutes went by.
 * - `tooManyAttempts`: `429 too many attempts`, five wrong codes. That code is spent
 *   until a new one is asked for (or it expires); waiting alone does not help.
 * - `rateLimited` (any other 429) is the one of `ApiFailure`: the budget per address or
 *   per email. Waiting does.
 * - `notSent`: `502 email not sent`. The mail provider refused; later may work.
 * - `escrowUnreadable`: `500 escrow unreadable` from `/recovery/finish`. The server can
 *   no longer open its copy of the key (its escrow key changed), so the email cannot
 *   bring the key back any more: only the backup key can.
 */

export type RecoveryFailure =
  | ApiFailure
  | { kind: 'notConfigured' }
  | { kind: 'badEmail' }
  | { kind: 'wrongCode' }
  | { kind: 'codeExpired' }
  | { kind: 'tooManyAttempts' }
  | { kind: 'notSent' }
  | { kind: 'escrowUnreadable' };

export type RecoveryResult<T> = { ok: true; value: T } | { ok: false; failure: RecoveryFailure };

/** The language the code's email is written in: the app's (ADR-0020). */
export type RecoveryLocale = 'es' | 'en';

/** The server's rule (the contract in ADR-0050's plan): at most 254 characters. */
export const MAX_EMAIL = 254;

/** Six digits, nothing else. */
export const CODE_LENGTH = 6;

/** What a typed email becomes before it is checked or sent: trimmed and lowercased. */
export function cleanEmail(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * The server's shape, checked on the phone first so a typo is said before anything goes
 * out: at most 254 characters, no spaces, exactly one `@`, something before it, and a
 * dot after it with something on both sides.
 */
export function isValidEmail(text: string): boolean {
  const email = cleanEmail(text);
  if (email.length === 0 || email.length > MAX_EMAIL || /\s/.test(email)) {
    return false;
  }
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }
  const [local, domain] = parts as [string, string];
  const dot = domain.indexOf('.');
  return local.length > 0 && dot > 0 && dot < domain.length - 1;
}

/** The digits of a pasted or typed code: '123 456' and '123-456' are the same code. */
export function cleanCode(text: string): string {
  return text.replace(/\D/g, '');
}

export function isValidCode(text: string): boolean {
  return cleanCode(text).length === CODE_LENGTH;
}

// --- Reading an answer ---------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A non-2xx, as the one failure it means. The message decides between the two 400s. */
export function recoveryFailureFor(status: number, body: unknown, retryAfter: string | null): RecoveryFailure {
  const message = isObject(body) ? (str(body.error) ?? '') : '';
  switch (status) {
    case 400:
      if (message.includes('wrong code')) {
        return { kind: 'wrongCode' };
      }
      if (message.includes('bad email')) {
        return { kind: 'badEmail' };
      }
      return { kind: 'rejected', message };
    case 401:
      return { kind: 'unauthorized' };
    case 403:
      return { kind: 'forbidden' };
    case 404:
      return { kind: 'notFound' };
    case 409:
      return { kind: 'conflict', message };
    case 410:
      return { kind: 'codeExpired' };
    case 429:
      return message.includes('too many attempts')
        ? { kind: 'tooManyAttempts' }
        : { kind: 'rateLimited', retryAfterMs: retryAfterMs(retryAfter) };
    case 500:
      return message.includes('escrow unreadable') ? { kind: 'escrowUnreadable' } : { kind: 'serverError', status };
    case 502:
      return message.includes('email not sent') ? { kind: 'notSent' } : { kind: 'serverError', status };
    case 503:
      return message.includes('email not configured') ? { kind: 'notConfigured' } : { kind: 'serverError', status };
    default:
      return { kind: 'serverError', status };
  }
}

// --- The transport ---------------------------------------------------------------------------

/**
 * One JSON request. `credentials` null for the two calls a person without their key
 * makes (`/recovery/start`, `/recovery/finish`). `fetch` is read from the global on
 * every call, so a test can swap it.
 */
async function request(
  path: string,
  method: 'POST' | 'DELETE',
  credentials: Credentials | null,
  body: unknown,
): Promise<RecoveryResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${CIRCLE_API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(credentials === null ? {} : { Authorization: `Bearer ${backupKeyOf(credentials)}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // 202 and 204 may carry no body, and a proxy may answer in HTML.
    const text = await response.text();
    let parsed: unknown = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        failure: recoveryFailureFor(response.status, parsed, response.headers.get('Retry-After')),
      };
    }
    return { ok: true, value: parsed };
  } catch {
    // An abort, a DNS failure, a dropped connection: nobody answered. Nothing is logged.
    return { ok: false, failure: { kind: 'offline' } };
  } finally {
    clearTimeout(timer);
  }
}

function done(result: RecoveryResult<unknown>): RecoveryResult<void> {
  return result.ok ? { ok: true, value: undefined } : result;
}

// --- The calls ---------------------------------------------------------------------------------

/**
 * `POST /recovery/email`: a code to confirm `email`, sent to it in `locale`. 202. The
 * email is cleaned first; one the phone already knows is malformed never goes out.
 */
export async function sendRecoveryCode(
  credentials: Credentials,
  email: string,
  locale: RecoveryLocale,
): Promise<RecoveryResult<void>> {
  if (!isValidEmail(email)) {
    return { ok: false, failure: { kind: 'badEmail' } };
  }
  return done(await request('/recovery/email', 'POST', credentials, { email: cleanEmail(email), locale }));
}

/**
 * `POST /recovery/email/verify`: the code, and the email is this account's from now on
 * — with a copy of the key the server can open (ADR-0050 §2). Answers the email the
 * server stored; an answer without one falls back to nothing rather than to a guess.
 */
export async function verifyRecoveryCode(
  credentials: Credentials,
  code: string,
): Promise<RecoveryResult<{ email: string | null }>> {
  if (!isValidCode(code)) {
    return { ok: false, failure: { kind: 'wrongCode' } };
  }
  const result = await request('/recovery/email/verify', 'POST', credentials, { code: cleanCode(code) });
  return result.ok ? { ok: true, value: { email: isObject(result.value) ? str(result.value.email) : null } } : result;
}

/**
 * `DELETE /recovery/email`: the email and the copy of the key, gone. 204, and 204 even
 * on a server that cannot send mail: removing always works.
 */
export async function removeRecoveryEmail(credentials: Credentials): Promise<RecoveryResult<void>> {
  return done(await request('/recovery/email', 'DELETE', credentials, undefined));
}

/**
 * `POST /recovery/start`, without a key: a code to `email` **if** it is some Vesper's
 * recovery email. The server answers 202 either way (§4), so a success here says only
 * that the request arrived — never that the email exists.
 */
export async function startRecovery(email: string, locale: RecoveryLocale): Promise<RecoveryResult<void>> {
  if (!isValidEmail(email)) {
    return { ok: false, failure: { kind: 'badEmail' } };
  }
  return done(await request('/recovery/start', 'POST', null, { email: cleanEmail(email), locale }));
}

/**
 * `POST /recovery/finish`: the email and the code, traded for the key `{ id, secret }`.
 * From here the restore is the one with the backup key (ADR-0048 §5–§7). An answer that
 * is not the shape of a key is the server's error: the caller must never restore with
 * half of one.
 */
export async function finishRecovery(email: string, code: string): Promise<RecoveryResult<Credentials>> {
  if (!isValidEmail(email) || !isValidCode(code)) {
    return { ok: false, failure: { kind: 'wrongCode' } };
  }
  const result = await request('/recovery/finish', 'POST', null, { email: cleanEmail(email), code: cleanCode(code) });
  if (!result.ok) {
    return result;
  }
  const credentials = readRecoveredKey(result.value);
  return credentials === null
    ? { ok: false, failure: { kind: 'serverError', status: 200 } }
    : { ok: true, value: credentials };
}

/** The key in `/recovery/finish`'s answer, or null when it is not one. The id is lowercased (hex). */
export function readRecoveredKey(value: unknown): Credentials | null {
  if (!isObject(value)) {
    return null;
  }
  const id = str(value.id)?.toLowerCase() ?? null;
  const secret = str(value.secret);
  if (id === null || secret === null || !isUuidV7(id) || /[\s.]/.test(secret)) {
    return null;
  }
  return { id, secret };
}
