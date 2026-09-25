/**
 * What the API needs from a database, and nothing more (ADR-0033). Two implementations:
 * `PgStore` over Postgres, and `MemoryStore` for the tests, which is where the ownership
 * and cursor rules are checked. Every row carries `updatedAt`, because the sync is a
 * cursor over that column and nothing else.
 */

/**
 * Two accounts cannot hold the same handle or the same invite code. The store raises
 * this instead of a bare database error so the API can answer 409 and the phone can act
 * on it: a taken handle asks the user for another one, a taken invite code means the
 * phone bumps `codeGeneration` and derives the next one.
 */
export class ConflictError extends Error {
  field: 'handle' | 'inviteCode';

  constructor(field: 'handle' | 'inviteCode') {
    super(`${field} taken`);
    this.name = 'ConflictError';
    this.field = field;
  }
}

/** What `POST /device` and `PUT /backup` accept as the phone's system. */
export type Platform = 'ios' | 'android';

export function isPlatform(value: unknown): value is Platform {
  return value === 'ios' || value === 'android';
}

/**
 * One person's identity (ADR-0048). It is born on the phone's first launch with an id and
 * a secret and nothing else: `name` and `handle` stay null until the person enters the
 * circle, and they arrive together. A null handle is an account with nothing social —
 * nobody sees it as a member and it cannot redeem, accept or join.
 */
export type Account = {
  id: string;
  secretHash: string;
  name: string | null;
  handle: string | null;
  inviteCode: string | null;
  pushToken: string | null;
  timeZone: string | null;
  nudgesOn: boolean;
  /** What answers "who is the user" without a login (ADR-0048 §3). Null until the phone says. */
  platform: Platform | null;
  appVersion: string | null;
  /**
   * Written by `touchAccount` alone, at most once an hour. `putAccount` sets it on the
   * insert and leaves it alone afterwards, so a write that started from an older read of
   * the account never moves it back.
   */
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * A copy of the phone's database, encrypted on the phone with a key derived from the
 * secret (ADR-0048 §7). The server keeps the bytes and never looks inside: it cannot,
 * and nothing here tries. One per account, replaced on every upload.
 */
export type Backup = {
  accountId: string;
  data: Uint8Array;
  /** The envelope's version, which the phone reads before it decrypts. */
  format: number;
  /** The phone's migration number inside, so an older app can say it is too old. */
  schema: number;
  platform: Platform;
  size: number;
  updatedAt: number;
};

/** Everything about a backup but its bytes, which is all a settings row needs. */
export type BackupMeta = Omit<Backup, 'data'>;

export type Link = {
  ownerId: string;
  memberId: string;
  status: 'pending' | 'member';
  createdAt: number;
  updatedAt: number;
};

/**
 * A link that ended (ADR-0049): the other person of the pair, seen from `id`, and when.
 * Both directions of the link are gone; this row is what tells the other phone, whose
 * cursor would otherwise never see a row disappear.
 */
export type EndedLink = {
  otherId: string;
  endedAt: number;
};

/**
 * One person's week, as the circle sees it. Every metric is null when its switch in
 * Ajustes › Círculo is off: null is "not shared", and it is not zero — zero says the
 * person did nothing this week, which is a different and false thing to say.
 */
export type Week = {
  accountId: string;
  weekKey: string;
  focusMs: number | null;
  /** An estimated floor, never summed with focus (ADR-0005). */
  socialMs: number | null;
  habitsDone: number | null;
  habitsTarget: number | null;
  updatedAt: number;
};

export type Challenge = {
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

/** The phone's MarkSource (ADR-0042). Anything else arrives as 'manual'. */
export type MarkSource = 'health' | 'session' | 'manual';

export type ChallengeMark = {
  challengeId: string;
  accountId: string;
  dayKey: string;
  source: MarkSource;
  updatedAt: number;
};

export function markSourceOf(value: unknown): MarkSource {
  return value === 'health' || value === 'session' ? value : 'manual';
}

export type Kudos = {
  id: string;
  fromId: string;
  toId: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
};

export type Nudge = {
  id: string;
  fromId: string;
  toId: string;
  challengeId: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
};

export type Store = {
  getAccount(id: string): Promise<Account | null>;
  getAccountByHandle(handle: string): Promise<Account | null>;
  getAccountByInviteCode(code: string): Promise<Account | null>;
  /** Raises `ConflictError` when the handle or the invite code belongs to someone else. */
  putAccount(account: Account): Promise<void>;
  /** Moves `lastSeenAt` forward to `at`, and touches nothing else on the row. */
  touchAccount(id: string, at: number): Promise<void>;
  /** The account and every row of it, its backup included. */
  deleteAccount(id: string): Promise<void>;

  getLink(ownerId: string, memberId: string): Promise<Link | null>;
  /** Also forgets an earlier end between the two: a new link supersedes it (ADR-0049). */
  putLink(link: Link): Promise<void>;
  /** Every link where `id` is on either side, whatever the status. */
  linksOf(id: string): Promise<Link[]>;
  /**
   * Ends whatever links the two accounts have, in both directions and whatever the
   * status, and records that it ended at `at` so both phones can learn it (ADR-0049).
   */
  endLink(a: string, b: string, at: number): Promise<void>;
  /** The links of `id` that ended after `since`, one per other person. */
  endedLinksOf(id: string, since: number): Promise<EndedLink[]>;

  putWeek(week: Week): Promise<void>;
  weeksOf(accountIds: readonly string[], since: number): Promise<Week[]>;

  getChallenge(id: string): Promise<Challenge | null>;
  putChallenge(challenge: Challenge): Promise<void>;
  /** Every challenge `id` takes part in or created, changed after `since`. */
  challengesOf(id: string, since: number): Promise<Challenge[]>;

  putMark(mark: ChallengeMark): Promise<void>;
  deleteMark(mark: Omit<ChallengeMark, 'updatedAt'>): Promise<void>;
  marksOf(challengeIds: readonly string[], since: number): Promise<ChallengeMark[]>;

  putKudos(kudos: Kudos): Promise<void>;
  kudosFor(id: string, since: number): Promise<Kudos[]>;

  putNudge(nudge: Nudge): Promise<void>;
  nudgesFor(id: string, since: number): Promise<Nudge[]>;

  /** Replaces the account's backup, whatever was there. */
  putBackup(backup: Backup): Promise<void>;
  getBackup(accountId: string): Promise<Backup | null>;
  /** Without the bytes: a settings row asking "when" should not pull five megabytes. */
  getBackupMeta(accountId: string): Promise<BackupMeta | null>;
  /** Turning the backup off in Ajustes: the copy goes, the account stays. */
  deleteBackup(accountId: string): Promise<void>;
};
