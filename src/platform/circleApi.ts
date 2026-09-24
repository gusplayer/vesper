import { inviteCodeFor } from '../domain/circle';
import { SECOND } from '../domain/time';
import {
  ME,
  type Challenge,
  type ChallengeMark,
  type HabitMark,
  type Kudos,
  type MarkSource,
  type Member,
  type MemberWeek,
  type Nudge,
  type Profile,
  type SharePrefs,
} from '../domain/types';

/**
 * The contract with the circle's server (ADR-0033, ADR-0044), both directions: how a
 * request is shaped and what an answer means. Pure — it imports no native module and
 * no store, so every rule here is covered by circleApi.test.ts against a fake `fetch`.
 *
 * Two things it never does:
 *
 * - **Throw.** A screen that asks for the circle must never see an exception: every
 *   call answers with a tagged result and `offline` is an ordinary answer, not an
 *   error (ADR-0044 §5).
 * - **Decide.** It reports `inviteCodeTaken` and `rateLimited`; what to do about them
 *   (bump the generation, wait) is `claimAccount`'s and the sync hook's business.
 *
 * The server's rules this file has to honour, from server/README.md:
 * every id the phone picks is a UUID v7, `name` is at most 40 characters, a challenge
 * name at most 60, a sync carries at most 500 rows of each kind, and in `weeks` **null
 * is "not shared", never zero** — zero would say the person did nothing that week.
 */

/** Railway, service `circle-api`, environment `production` (server/README.md). */
export const CIRCLE_API_URL = 'https://circle-api-production.up.railway.app';

/**
 * A request that hangs is a sync that never releases its slot. Ten seconds is the same
 * budget the usage read gets: long enough for a cold Railway container, short enough
 * that the next foreground can try again.
 */
export const REQUEST_TIMEOUT_MS = 10 * SECOND;

/** At most 500 rows of one kind per sync; the server refuses the whole body over it. */
export const MAX_ROWS = 500;

export const MAX_NAME = 40;
export const MAX_CHALLENGE_NAME = 60;

/** `Authorization: Bearer <id>.<secret>`. The id is the circle profile's id. */
export type Credentials = { id: string; secret: string };

// --- The backup key (ADR-0044 §3) ------------------------------------------------------

/** `<id>.<secret>`: what is stored, what is shown, and what is pasted back. */
export function backupKeyOf(credentials: Credentials): string {
  return `${credentials.id}.${credentials.secret}`;
}

/** The two halves of a bearer token. Null for anything else. The id holds no dot. */
export function credentialsFrom(key: string): Credentials | null {
  const token = key.trim();
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) {
    return null;
  }
  return { id: token.slice(0, dot), secret: token.slice(dot + 1) };
}

/** How many characters one readable group of the backup key holds. */
export const BACKUP_GROUP_SIZE = 8;

/**
 * The key cut into groups a person can read across a line without losing their place
 * (ADR-0044 §3). It is not a word list: the secret is text that gets copied, and the
 * real path is the password manager. What is copied is the ungrouped string.
 */
export function backupKeyGroups(key: string): string[] {
  const groups: string[] = [];
  for (let i = 0; i < key.length; i += BACKUP_GROUP_SIZE) {
    groups.push(key.slice(i, i + BACKUP_GROUP_SIZE));
  }
  return groups;
}

// --- Results ------------------------------------------------------------------------

/**
 * Why a call did not produce an answer. Every one of these is a fact a screen may
 * show; none of them is a crash.
 *
 * - `offline`: the request never got an answer (no network, timeout, DNS). The local
 *   write stays; nothing is reverted (ADR-0044 §5).
 * - `unauthorized`: the secret is not this account's. A reinstall without the backup
 *   key looks like this.
 * - `handleTaken` / `inviteCodeTaken`: the two 409s of `POST /account`.
 * - `rateLimited`: a 429, with the seconds the server asked us to wait.
 * - `rejected`: a 400 — a body the server will never accept, so retrying is pointless.
 * - `notFound` / `forbidden`: an unknown code or challenge, someone else's circle.
 * - `serverError`: a 5xx or anything unshaped. Try again later.
 */
export type ApiFailure =
  | { kind: 'offline' }
  | { kind: 'unauthorized' }
  | { kind: 'handleTaken' }
  | { kind: 'inviteCodeTaken' }
  | { kind: 'rateLimited'; retryAfterMs: number }
  | { kind: 'rejected'; message: string }
  | { kind: 'notFound' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; message: string }
  | { kind: 'serverError'; status: number };

export type ApiResult<T> = { ok: true; value: T } | { ok: false; failure: ApiFailure };

export function isOk<T>(result: ApiResult<T>): result is { ok: true; value: T } {
  return result.ok;
}

// --- What travels ---------------------------------------------------------------------

export type AccountInput = {
  /** The circle profile's id: the server derives the invite code from it. */
  id: string;
  name: string;
  handle: string;
  /**
   * Absent leaves the stored code alone, null gives it up, a string claims it. The
   * server checks the claim derives from `id` at `codeGeneration`.
   */
  inviteCode?: string | null;
  codeGeneration?: number;
};

/** What `POST /account` gives back. `secret` only ever on the first call (201). */
export type AccountCreated = { id: string; handle: string; secret: string | null };

export type DeviceInput = {
  /** The Expo push token, or null to say this phone has none. */
  pushToken: string | null;
  /** An IANA name: 'America/Bogota'. */
  timeZone: string;
  /** Ajustes › Notificaciones › empujones (ADR-0027 §5). */
  nudgesOn: boolean;
};

/**
 * One week of the caller's, as the circle may see it. **Null is "not shared".** The
 * three switches of Ajustes › Círculo arrive here as nulls, and a metric that is off
 * must not be sent as zero: zero says the person did nothing that week (ADR-0021 §4).
 */
export type WeekUpload = {
  weekKey: string;
  focusMs: number | null;
  /** The estimated floor, never summed with focus (ADR-0005). */
  socialMs: number | null;
  habitsDone: number | null;
  habitsTarget: number | null;
};

export type ChallengeUpload = {
  id: string;
  name: string;
  weeklyTarget: number;
  startWeekKey: string;
  endDayKey: string | null;
  /** Account ids, never 'me': the local ME is mapped out before it leaves. */
  participantIds: string[];
  archivedAt: number | null;
};

/** One day of one challenge. `marked: false` takes the mark away. */
export type MarkUpload = {
  challengeId: string;
  dayKey: string;
  source: MarkSource;
  marked: boolean;
};

export type KudosUpload = { id: string; toId: string; dayKey: string };

export type NudgeUpload = { id: string; toId: string; challengeId: string; dayKey: string };

export type SyncUpload = {
  /** The cursor: rows changed after this come back. 0 asks for everything. */
  since: number;
  weeks: WeekUpload[];
  challenges: ChallengeUpload[];
  marks: MarkUpload[];
  kudos: KudosUpload[];
  nudges: NudgeUpload[];
};

export type RemoteMember = {
  id: string;
  name: string;
  handle: string;
  /** 'pending' is someone waiting for my answer; 'invited' is someone waiting to give me one. */
  status: 'member' | 'pending' | 'invited';
  joinedAt: number | null;
  updatedAt: number;
};

export type RemoteWeek = {
  accountId: string;
  weekKey: string;
  focusMs: number | null;
  socialMs: number | null;
  habitsDone: number | null;
  habitsTarget: number | null;
  updatedAt: number;
};

export type RemoteChallenge = {
  id: string;
  createdBy: string;
  name: string;
  weeklyTarget: number;
  startWeekKey: string;
  endDayKey: string | null;
  participantIds: string[];
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type RemoteMark = {
  challengeId: string;
  accountId: string;
  dayKey: string;
  source: MarkSource;
  updatedAt: number;
};

export type RemoteKudos = {
  id: string;
  fromId: string;
  toId: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
};

export type RemoteNudge = {
  id: string;
  fromId: string;
  toId: string;
  challengeId: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
};

export type SyncDownload = {
  /** The next cursor. Stored only when the whole call succeeded. */
  now: number;
  members: RemoteMember[];
  weeks: RemoteWeek[];
  challenges: RemoteChallenge[];
  marks: RemoteMark[];
  kudos: RemoteKudos[];
  nudges: RemoteNudge[];
  /** Ids (and `challengeId/dayKey` keys) the server refused to write. */
  rejected: string[];
};

// --- Reading an answer ----------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function markSource(value: unknown): MarkSource {
  return value === 'health' || value === 'session' ? value : 'manual';
}

function memberStatus(value: unknown): RemoteMember['status'] {
  return value === 'member' || value === 'invited' ? value : 'pending';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: unknown): string[] {
  return list(value).filter((entry): entry is string => typeof entry === 'string');
}

/**
 * `Retry-After` in seconds, which is what the server sends. A missing or unreadable
 * header falls back to a minute: the point is not to hammer, and the sync's own
 * five-minute floor covers the rest.
 */
export function retryAfterMs(header: string | null): number {
  const seconds = header === null ? NaN : Number(header.trim());
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60 * 1000;
}

/** The server always answers `{ error: '…' }` on a refusal; anything else reads empty. */
function errorMessage(body: unknown): string {
  return isObject(body) ? (str(body.error) ?? '') : '';
}

/**
 * A response that is not a 2xx, turned into the one failure it means. The two 409s are
 * told apart by their message, because that is the only thing that separates them and
 * the phone acts differently on each: a taken handle is a question for the user, a
 * taken invite code is a generation to bump and a call to repeat (server/README.md).
 */
function failureFor(status: number, body: unknown, header: string | null): ApiFailure {
  const message = errorMessage(body);
  if (status === 401) {
    return { kind: 'unauthorized' };
  }
  if (status === 403) {
    return { kind: 'forbidden' };
  }
  if (status === 404) {
    return { kind: 'notFound' };
  }
  if (status === 409) {
    if (message.includes('handle')) {
      return { kind: 'handleTaken' };
    }
    if (message.includes('invite code')) {
      return { kind: 'inviteCodeTaken' };
    }
    return { kind: 'conflict', message };
  }
  if (status === 429) {
    return { kind: 'rateLimited', retryAfterMs: retryAfterMs(header) };
  }
  if (status === 400) {
    return { kind: 'rejected', message };
  }
  return { kind: 'serverError', status };
}

// --- The transport ---------------------------------------------------------------------

type Method = 'POST' | 'DELETE';

/**
 * One request. `credentials` null means the call goes out unauthenticated, which only
 * `POST /account` creating a new account may do.
 *
 * `fetch` is taken from the global on every call rather than captured at import, so a
 * test can swap it and so a polyfill installed after this module loads is still used.
 */
async function request(
  path: string,
  method: Method,
  credentials: Credentials | null,
  body: unknown,
): Promise<ApiResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${CIRCLE_API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(credentials === null
          ? {}
          : { Authorization: `Bearer ${credentials.id}.${credentials.secret}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // 204 has no body, and a proxy may answer a 5xx in HTML: neither is a failure to
    // parse, so the text is read first and only then attempted as JSON.
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
      return { ok: false, failure: failureFor(response.status, parsed, response.headers.get('Retry-After')) };
    }
    return { ok: true, value: parsed };
  } catch {
    // An abort, a DNS failure and a dropped connection are the same fact to the app:
    // nobody answered. Nothing is logged — the bearer token is in the request.
    return { ok: false, failure: { kind: 'offline' } };
  } finally {
    clearTimeout(timer);
  }
}

function map<T, U>(result: ApiResult<T>, fold: (value: T) => U): ApiResult<U> {
  return result.ok ? { ok: true, value: fold(result.value) } : result;
}

// --- The calls --------------------------------------------------------------------------

/**
 * `POST /account`. With no credentials it creates the account and the answer carries
 * the secret **once**; with credentials it renames the profile or claims a code, and
 * there is no secret in the answer.
 */
export async function putAccount(
  input: AccountInput,
  credentials: Credentials | null,
): Promise<ApiResult<AccountCreated>> {
  const body: Record<string, unknown> = {
    id: input.id,
    name: input.name.slice(0, MAX_NAME),
    handle: input.handle,
  };
  if (input.inviteCode !== undefined) {
    body.inviteCode = input.inviteCode;
    if (input.codeGeneration !== undefined) {
      body.codeGeneration = input.codeGeneration;
    }
  }
  const result = await request('/account', 'POST', credentials, body);
  return map(result, (value) => ({
    id: isObject(value) ? (str(value.id) ?? input.id) : input.id,
    handle: isObject(value) ? (str(value.handle) ?? input.handle) : input.handle,
    secret: isObject(value) ? str(value.secret) : null,
  }));
}

/** `DELETE /account`: the account and every row of it, gone. 204, no body. */
export async function deleteAccount(credentials: Credentials): Promise<ApiResult<void>> {
  return map(await request('/account', 'DELETE', credentials, undefined), () => undefined);
}

/**
 * `POST /device`: where a push goes, in which zone, and whether nudges may wake this
 * phone (ADR-0037 §1). **Nothing calls this yet**: registering the Expo token and
 * receiving in the background is the other half of ADR-0037 and belongs to the push
 * round. The endpoint is here so that round only has to supply the token.
 */
export async function putDevice(
  credentials: Credentials,
  input: DeviceInput,
): Promise<ApiResult<void>> {
  return map(
    await request('/device', 'POST', credentials, {
      pushToken: input.pushToken,
      timeZone: input.timeZone,
      nudgesOn: input.nudgesOn,
    }),
    () => undefined,
  );
}

/**
 * `POST /invite/redeem`: using someone's code. It is a request, not a key — the answer
 * is 'pending' until they accept (ADR-0021 addendum).
 */
export async function redeemInvite(
  credentials: Credentials,
  code: string,
): Promise<ApiResult<{ status: 'pending' | 'member' }>> {
  return map(await request('/invite/redeem', 'POST', credentials, { code }), (value) => ({
    status: isObject(value) && value.status === 'member' ? 'member' : 'pending',
  }));
}

/** `POST /invite/accept`: answering someone who used my code. Both directions at once. */
export async function acceptInvite(
  credentials: Credentials,
  memberId: string,
): Promise<ApiResult<void>> {
  return map(await request('/invite/accept', 'POST', credentials, { memberId }), () => undefined);
}

/** `POST /challenge/join`: entering a challenge made by someone in my circle. */
export async function joinChallenge(
  credentials: Credentials,
  challengeId: string,
): Promise<ApiResult<void>> {
  return map(
    await request('/challenge/join', 'POST', credentials, { challengeId }),
    () => undefined,
  );
}

/** `POST /sync`: one trip. Mine up, theirs down, `now` back as the next cursor. */
export async function sync(
  credentials: Credentials,
  upload: SyncUpload,
): Promise<ApiResult<SyncDownload>> {
  return map(await request('/sync', 'POST', credentials, trimUpload(upload)), readDownload);
}

/**
 * The account, claimed. A `409 invite code taken` means someone else holds the six
 * symbols this profile derives, so the phone bumps its generation and derives the
 * next one — exactly what "Generar código nuevo" does — and tries again
 * (server/README.md). The caller gets the generation that worked and stores it.
 *
 * `attempts` is small on purpose: with 32^6 codes, two collisions in a row means
 * something other than bad luck, and a loop against a rate-limited endpoint is worse
 * than no code at all — an account with no invite code still works for everything
 * except being invited from, and the next attempt can claim one.
 */
export async function claimAccount(
  profile: Profile,
  credentials: Credentials | null,
  attempts = 3,
): Promise<ApiResult<{ account: AccountCreated; codeGeneration: number }>> {
  let generation = profile.codeGeneration;
  let credentialsNow = credentials;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await putAccount(
      {
        id: profile.id,
        name: profile.name,
        handle: profile.handle,
        inviteCode: inviteCodeFor({ ...profile, codeGeneration: generation }),
        codeGeneration: generation,
      },
      credentialsNow,
    );
    if (result.ok) {
      return { ok: true, value: { account: result.value, codeGeneration: generation } };
    }
    if (result.failure.kind !== 'inviteCodeTaken') {
      return result;
    }
    // The account itself may have been created by the very first call before the code
    // was refused — it is not: the server checks both 409s before it writes anything.
    // So the next attempt is still a creation, with the same credentials as this one.
    credentialsNow = credentials;
    generation += 1;
  }
  return { ok: false, failure: { kind: 'inviteCodeTaken' } };
}

// --- Shaping what goes up ----------------------------------------------------------------

/**
 * The caps, applied here so a body is never refused whole for one row too many. A
 * phone's real batch is a handful; this only matters for a first sync after a long
 * time offline, and dropping the tail is better than dropping everything.
 */
export function trimUpload(upload: SyncUpload): SyncUpload {
  return {
    since: upload.since,
    weeks: upload.weeks.slice(0, MAX_ROWS),
    challenges: upload.challenges
      .slice(0, MAX_ROWS)
      .map((challenge) => ({ ...challenge, name: challenge.name.slice(0, MAX_CHALLENGE_NAME) })),
    marks: upload.marks.slice(0, MAX_ROWS),
    kudos: upload.kudos.slice(0, MAX_ROWS),
    nudges: upload.nudges.slice(0, MAX_ROWS),
  };
}

// --- Reading what comes down -------------------------------------------------------------

/**
 * The `/sync` answer, field by field. Anything unshaped is dropped rather than
 * believed: these rows are written by other people's phones, and one malformed week
 * must not take a whole sync down.
 */
export function readDownload(value: unknown): SyncDownload {
  const body = isObject(value) ? value : {};
  return {
    now: num(body.now) ?? 0,
    members: list(body.members).flatMap(readMember),
    weeks: list(body.weeks).flatMap(readWeek),
    challenges: list(body.challenges).flatMap(readChallenge),
    marks: list(body.marks).flatMap(readMark),
    kudos: list(body.kudos).flatMap(readKudos),
    nudges: list(body.nudges).flatMap(readNudge),
    rejected: stringList(body.rejected),
  };
}

function readMember(row: unknown): RemoteMember[] {
  if (!isObject(row)) {
    return [];
  }
  const id = str(row.id);
  const name = str(row.name);
  const handle = str(row.handle);
  if (id === null || name === null || handle === null) {
    return [];
  }
  return [
    {
      id,
      name,
      handle,
      status: memberStatus(row.status),
      joinedAt: num(row.joinedAt),
      updatedAt: num(row.updatedAt) ?? 0,
    },
  ];
}

function readWeek(row: unknown): RemoteWeek[] {
  if (!isObject(row)) {
    return [];
  }
  const accountId = str(row.accountId);
  const weekKey = str(row.weekKey);
  if (accountId === null || weekKey === null) {
    return [];
  }
  return [
    {
      accountId,
      weekKey,
      focusMs: num(row.focusMs),
      socialMs: num(row.socialMs),
      habitsDone: num(row.habitsDone),
      habitsTarget: num(row.habitsTarget),
      updatedAt: num(row.updatedAt) ?? 0,
    },
  ];
}

function readChallenge(row: unknown): RemoteChallenge[] {
  if (!isObject(row)) {
    return [];
  }
  const id = str(row.id);
  const name = str(row.name);
  const createdBy = str(row.createdBy);
  const startWeekKey = str(row.startWeekKey);
  if (id === null || name === null || createdBy === null || startWeekKey === null) {
    return [];
  }
  return [
    {
      id,
      createdBy,
      name,
      weeklyTarget: num(row.weeklyTarget) ?? 4,
      startWeekKey,
      endDayKey: str(row.endDayKey),
      participantIds: stringList(row.participantIds),
      archivedAt: num(row.archivedAt),
      createdAt: num(row.createdAt) ?? 0,
      updatedAt: num(row.updatedAt) ?? 0,
    },
  ];
}

function readMark(row: unknown): RemoteMark[] {
  if (!isObject(row)) {
    return [];
  }
  const challengeId = str(row.challengeId);
  const accountId = str(row.accountId);
  const dayKey = str(row.dayKey);
  if (challengeId === null || accountId === null || dayKey === null) {
    return [];
  }
  return [
    {
      challengeId,
      accountId,
      dayKey,
      source: markSource(row.source),
      updatedAt: num(row.updatedAt) ?? 0,
    },
  ];
}

function readKudos(row: unknown): RemoteKudos[] {
  if (!isObject(row)) {
    return [];
  }
  const id = str(row.id);
  const fromId = str(row.fromId);
  const toId = str(row.toId);
  const dayKey = str(row.dayKey);
  if (id === null || fromId === null || toId === null || dayKey === null) {
    return [];
  }
  const updatedAt = num(row.updatedAt) ?? 0;
  return [{ id, fromId, toId, dayKey, createdAt: num(row.createdAt) ?? updatedAt, updatedAt }];
}

function readNudge(row: unknown): RemoteNudge[] {
  if (!isObject(row)) {
    return [];
  }
  const id = str(row.id);
  const fromId = str(row.fromId);
  const toId = str(row.toId);
  const challengeId = str(row.challengeId);
  const dayKey = str(row.dayKey);
  if (id === null || fromId === null || toId === null || challengeId === null || dayKey === null) {
    return [];
  }
  const updatedAt = num(row.updatedAt) ?? 0;
  return [{ id, fromId, toId, challengeId, dayKey, createdAt: num(row.createdAt) ?? updatedAt, updatedAt }];
}

// --- Folding an answer into local rows -------------------------------------------------

/**
 * What the sync hands the circle store: the same domain rows the demo seed writes, so
 * no screen changes when they start arriving from a server instead (ADR-0021).
 *
 * `accepts` and `joins` are the two things `/sync` cannot express. Both are the phone
 * catching up with a local write that was made while offline: a person the user
 * accepted, and a challenge the user joined. They go out as their own calls, after.
 */
export type FoldedRows = {
  members: Member[];
  weeks: MemberWeek[];
  challenges: Challenge[];
  marks: ChallengeMark[];
  kudos: Kudos[];
  nudges: Nudge[];
  /** Member ids to accept: they asked, and this phone already said yes locally. */
  accepts: string[];
  /** Challenge ids to join: the user is in them here and not yet on the server. */
  joins: string[];
};

/** What the fold needs to know about the rows already on this phone. */
export type LocalRows = {
  members: readonly Member[];
  challenges: readonly Challenge[];
  /** Nudge ids already stored: the nudges table has no "or ignore" on a repeat. */
  nudgeIds: ReadonlySet<string>;
};

/** The user is ME in every local row; on the wire they are their account id. */
function localId(id: string, accountId: string): string {
  return id === accountId ? ME : id;
}

/** One mark of one person on one day: the key the table is unique on, spelled out. */
export function markIdOf(challengeId: string, memberId: string, dayKey: string): string {
  return `${challengeId}/${memberId}/${dayKey}`;
}

/**
 * The server's answer, as rows this phone can store (ADR-0044 §5).
 *
 * Three things it is careful about:
 *
 * - **`habitId` is local.** It is the user's own habit a challenge counts against, and
 *   it never travels. A challenge coming back must not wipe it.
 * - **A local join survives a server that has not heard of it yet.** If the user joined
 *   while offline, ME stays among the participants and the challenge goes into `joins`.
 * - **Nulls.** A week metric that is null is one its owner does not share, and it is
 *   kept as null all the way down: migration 010 made those columns nullable, because
 *   zero would say "did nothing that week" about someone who only kept the number to
 *   themselves. `metricState` in domain/circle.ts is what decides which is which.
 */
export function foldDownload(
  download: SyncDownload,
  accountId: string,
  local: LocalRows,
  now: number,
): FoldedRows {
  const members: Member[] = download.members.map((row) => {
    const existing = local.members.find((member) => member.id === row.id);
    return {
      id: row.id,
      name: row.name,
      handle: row.handle,
      status: row.status,
      joinedAt: row.joinedAt,
      createdAt: existing?.createdAt ?? row.joinedAt ?? row.updatedAt ?? now,
    };
  });

  // Someone who asked to come in and was already accepted on this phone: the answer
  // never reached the server, so it goes out again after the sync.
  const accepts = download.members
    .filter(
      (row) =>
        row.status === 'pending' &&
        local.members.some((member) => member.id === row.id && member.status === 'member'),
    )
    .map((row) => row.id);

  const weeks: MemberWeek[] = download.weeks.map((row) => ({
    memberId: localId(row.accountId, accountId),
    weekKey: row.weekKey,
    // Null is "not shared", never zero: zero would say that person did nothing that
    // week, which is a different sentence. Migration 010 made the columns nullable so
    // the phone could stop telling the lie the server already refuses (ADR-0033).
    focusMs: row.focusMs,
    socialMs: row.socialMs,
    habitsDone: row.habitsDone,
    habitsTarget: row.habitsTarget,
    updatedAt: row.updatedAt,
  }));

  const joins: string[] = [];
  const challenges: Challenge[] = download.challenges.map((row) => {
    const existing = local.challenges.find((challenge) => challenge.id === row.id);
    const participantIds = row.participantIds.map((id) => localId(id, accountId));
    // `habitId` is what says the user joined: it is set the moment they do, locally.
    const joinedHere = existing?.habitId != null;
    if (joinedHere && !participantIds.includes(ME)) {
      participantIds.unshift(ME);
      joins.push(row.id);
    }
    return {
      id: row.id,
      name: row.name,
      weeklyTarget: row.weeklyTarget,
      startWeekKey: row.startWeekKey,
      endDayKey: row.endDayKey,
      createdBy: localId(row.createdBy, accountId),
      participantIds,
      habitId: existing?.habitId ?? null,
      createdAt: existing?.createdAt ?? row.createdAt ?? now,
      archivedAt: row.archivedAt,
    };
  });

  // The server already leaves the caller's own marks out: the user's marks are their
  // habit marks, and challenge_marks is only ever other people's (migration 004).
  const marks: ChallengeMark[] = download.marks
    .filter((row) => row.accountId !== accountId)
    .map((row) => ({
      id: markIdOf(row.challengeId, row.accountId, row.dayKey),
      challengeId: row.challengeId,
      memberId: row.accountId,
      dayKey: row.dayKey,
      source: row.source,
      markedAt: row.updatedAt,
    }));

  const kudos: Kudos[] = download.kudos.map((row) => ({
    id: row.id,
    fromId: localId(row.fromId, accountId),
    toId: localId(row.toId, accountId),
    dayKey: row.dayKey,
    createdAt: row.createdAt,
  }));

  const nudges: Nudge[] = download.nudges
    .filter((row) => !local.nudgeIds.has(row.id))
    .map((row) => ({
      id: row.id,
      fromId: localId(row.fromId, accountId),
      toId: localId(row.toId, accountId),
      challengeId: row.challengeId,
      dayKey: row.dayKey,
      createdAt: row.createdAt,
    }));

  return { members, weeks, challenges, marks, kudos, nudges, accepts, joins };
}

// --- Building what goes up ----------------------------------------------------------------

/** Everything the phone knows that the circle may be allowed to see. */
export type LocalUpload = {
  since: number;
  /** The Monday of the week being reported. */
  weekKey: string;
  /** The user's own week, before the share switches are applied. */
  myWeek: { focusMs: number; socialMs: number | null; habitsDone: number; habitsTarget: number };
  share: SharePrefs;
  challenges: readonly Challenge[];
  /** The user's habit marks, already narrowed to the days being reported. */
  myMarks: readonly HabitMark[];
  /** The seven day keys of `weekKey`, Monday first. */
  weekDays: readonly string[];
  kudos: readonly Kudos[];
  nudges: readonly Nudge[];
  accountId: string;
};

/** A UUID v7, which is the only id shape the server stores (server/README.md). */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: string): boolean {
  return value.length === 36 && UUID_V7.test(value);
}

/**
 * What this phone sends up (ADR-0044 §5: local first, then the wire).
 *
 * The week is the one place where a switch turned off has to become **null and not
 * zero**: zero would publish "did nothing this week" about someone who only said "not
 * this one" (ADR-0021 §4). The social figure comes in already vetted by the caller —
 * `sharedWeekUsageMs` is null while the floor is still the demo one, so the estimate
 * the seed invents never leaves the phone as if it were this person's (ADR-0035).
 *
 * Marks go up as the whole week, day by day, marked or not, so unmarking a day travels
 * too. Rows with an id the server would not store are dropped here rather than sent to
 * be ignored: the demo seed's `challenge-read` and `kudos-ana-…` are exactly that.
 */
export function buildUpload(local: LocalUpload): SyncUpload {
  const weeks: WeekUpload[] = [
    {
      weekKey: local.weekKey,
      focusMs: local.share.focus ? local.myWeek.focusMs : null,
      socialMs: local.share.social ? local.myWeek.socialMs : null,
      habitsDone: local.share.habits ? local.myWeek.habitsDone : null,
      habitsTarget: local.share.habits ? local.myWeek.habitsTarget : null,
    },
  ];

  const mine = local.challenges.filter(
    (challenge) => challenge.createdBy === ME && isUuidV7(challenge.id),
  );
  const challenges: ChallengeUpload[] = mine.map((challenge) => ({
    id: challenge.id,
    name: challenge.name,
    weeklyTarget: challenge.weeklyTarget,
    startWeekKey: challenge.startWeekKey,
    endDayKey: challenge.endDayKey,
    participantIds: challenge.participantIds
      .map((id) => (id === ME ? local.accountId : id))
      .filter((id) => isUuidV7(id)),
    archivedAt: challenge.archivedAt,
  }));

  const marks: MarkUpload[] = [];
  for (const challenge of local.challenges) {
    const habitId = challenge.habitId;
    if (habitId === null || !isUuidV7(challenge.id) || challenge.archivedAt !== null) {
      continue;
    }
    for (const dayKey of local.weekDays) {
      const mark = local.myMarks.find((m) => m.habitId === habitId && m.dayKey === dayKey);
      marks.push({
        challengeId: challenge.id,
        dayKey,
        source: mark?.source ?? 'manual',
        marked: mark !== undefined,
      });
    }
  }

  const kudos: KudosUpload[] = local.kudos
    .filter((row) => row.fromId === ME && isUuidV7(row.id) && isUuidV7(row.toId))
    .map((row) => ({ id: row.id, toId: row.toId, dayKey: row.dayKey }));

  const nudges: NudgeUpload[] = local.nudges
    .filter(
      (row) =>
        row.fromId === ME && isUuidV7(row.id) && isUuidV7(row.toId) && isUuidV7(row.challengeId),
    )
    .map((row) => ({
      id: row.id,
      toId: row.toId,
      challengeId: row.challengeId,
      dayKey: row.dayKey,
    }));

  return trimUpload({ since: local.since, weeks, challenges, marks, kudos, nudges });
}
