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
  /**
   * The public half of the identity's box key (ADR-0051): X25519, 32 bytes in base64,
   * derived on the phone from the secret with a label of its own, so the server — which
   * keeps only an unlabelled hash of the secret — cannot derive the private half. What
   * other phones wrap a photo's key for. Null until the phone publishes it, and again
   * after the secret rotates, until the new phone publishes its own.
   */
  boxKey: string | null;
  /** The first 8 bytes of SHA-256 of the key, in hex: how a wrap names the key it used. */
  boxKeyId: string | null;
  /**
   * When a moderator banned the account over a report (ADR-0051 §18). A banned account
   * uploads no photo. Written by `banAccount` alone: `putAccount` leaves it as it is, so a
   * write that started from an older read of the row never lifts a ban.
   */
  bannedAt: number | null;
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

/**
 * A recovery email (ADR-0050): verified, one per account and one account per email, with
 * the account's secret sealed under `RECOVERY_KEY` (recovery.ts). Only people who turn it
 * on have one.
 */
export type Recovery = {
  accountId: string;
  /** Trimmed and lowercased. Unique: confirming it elsewhere takes it from here. */
  email: string;
  /** base64(iv | ciphertext | tag), AES-256-GCM with the account id as associated data. */
  secretEnc: string;
  verifiedAt: number;
  updatedAt: number;
};

/** 'verify' confirms an address from Ajustes; 'recover' gets the secret back with it. */
export type CodePurpose = 'verify' | 'recover';

/**
 * A six-digit code, hashed, alive for ten minutes and five wrong attempts. One per
 * `(purpose, subject)`, and a new one replaces the old.
 *
 * `subject` is who the code is for: the account id for 'verify', the email for
 * 'recover'. A 'recover' code is written for **every** email that asks, known or not,
 * with `accountId` null when no account has it — and no message goes out for those. That
 * is what keeps "does this email exist" unanswerable: a wrong code, an expired one and
 * one that ran out of attempts answer the same whoever the email belongs to, because the
 * same row is there to answer.
 */
export type RecoveryCode = {
  purpose: CodePurpose;
  subject: string;
  accountId: string | null;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  createdAt: number;
};

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
  /**
   * "Fotos del día" (ADR-0051 §6): whether the participants may share a photo on a marked
   * day. Set by the maker; a challenge that never said is on.
   */
  photos: boolean;
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

/** Where a photo came from, as the viewer says it ("Con la cámara", "De la galería"). */
export type MediaOrigin = 'camera' | 'library';

export function isMediaOrigin(value: unknown): value is MediaOrigin {
  return value === 'camera' || value === 'library';
}

/** The two objects of a photo: the grid's thumbnail and the viewer's full photo. */
export type MediaVariant = 'thumb' | 'full';

export function isMediaVariant(value: unknown): value is MediaVariant {
  return value === 'thumb' || value === 'full';
}

/**
 * A photo's key, sealed for one person (ADR-0051 §16): ECIES over X25519 with the photo's
 * ephemeral key (`Media.epk`), under the recipient's box key named by `keyId`. base64.
 * The server stores it and cannot open it.
 */
export type MediaWrap = { recipientId: string; keyId: string; box: string };

/**
 * One photo of a challenge (ADR-0051), end to end encrypted: the server keeps who took it,
 * for which challenge and day, how big it is and who holds a wrap of its key, and two
 * objects in the bucket it cannot open (`m/<ownerId>/<id>/thumb` and `/full`).
 *
 * Born `pending` on `POST /media`, `ready` once both objects arrived, which is when it
 * enters the other participants' sync. Deleting it leaves a tombstone (`deletedAt`), not
 * a gap: a cursor over `updatedAt` never sees a row that is gone (ADR-0049). One live
 * photo per (challenge, owner, day).
 */
export type Media = {
  id: string;
  challengeId: string;
  ownerId: string;
  dayKey: string;
  width: number;
  height: number;
  origin: MediaOrigin;
  /** The ephemeral X25519 public key the wraps were made with, base64. */
  epk: string;
  /** The caption, sealed with the photo's key, base64; the server never sees it. */
  captionBox: string | null;
  /** One per recipient, the owner's own included. */
  wraps: MediaWrap[];
  /** The exact byte counts `PUT /media/:id/thumb|full` must bring. */
  thumbSize: number;
  fullSize: number;
  state: 'pending' | 'ready';
  /** When each object arrived; both set is `ready`. */
  thumbAt: number | null;
  fullAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** 14 days after the challenge's last day, or 28 per photo without one (ADR-0051 §12). */
  expiresAt: number;
  deletedAt: number | null;
};

export type ReportReason = 'unwanted' | 'consent' | 'minor' | 'other';

export function isReportReason(value: unknown): value is ReportReason {
  return value === 'unwanted' || value === 'consent' || value === 'minor' || value === 'other';
}

export type ReportAction = 'dismiss' | 'remove' | 'ban';

export function isReportAction(value: unknown): value is ReportAction {
  return value === 'dismiss' || value === 'remove' || value === 'ban';
}

/**
 * A report on one photo (ADR-0051 §18). The reporter hands over the key of that photo,
 * never more, and the server checks that it opens what the owner uploaded: the GCM tag
 * proves who it came from. The two objects are copied to `r/<id>/` the moment the report
 * lands, so the owner deleting the photo, or its expiry, does not take the evidence
 * before a moderator reads it.
 *
 * It outlives the photo and the owner's account on purpose (what was reported to NCMEC is
 * kept a year): `ownerId` and `mediaId` are plain columns with no cascade. The reporter's
 * id is kept only to answer a second report from the same person alike, and is shown to
 * nobody, a moderator included.
 */
export type Report = {
  id: string;
  mediaId: string;
  /** Null once the reporter deleted their account. */
  reporterId: string | null;
  ownerId: string;
  challengeId: string;
  dayKey: string;
  reason: ReportReason;
  /** Up to 200 characters, the reporter's words. */
  note: string | null;
  /** The photo's key, base64. Cleared when the report is resolved without preserving. */
  contentKey: string | null;
  createdAt: number;
  resolvedAt: number | null;
  action: ReportAction | null;
  /** Set when the moderator preserved it: `r/<id>/` is kept until then (365 days). */
  preservedUntil: number | null;
};

export type Store = {
  getAccount(id: string): Promise<Account | null>;
  getAccountByHandle(handle: string): Promise<Account | null>;
  getAccountByInviteCode(code: string): Promise<Account | null>;
  /** Raises `ConflictError` when the handle or the invite code belongs to someone else. */
  putAccount(account: Account): Promise<void>;
  /** Moves `lastSeenAt` forward to `at`, and touches nothing else on the row. */
  touchAccount(id: string, at: number): Promise<void>;
  /** Sets `bannedAt` if it is not set yet (ADR-0051 §18). Nothing else writes it. */
  banAccount(id: string, at: number): Promise<void>;
  /** The account and every row of it, its backup and its recovery email included. */
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

  getRecovery(accountId: string): Promise<Recovery | null>;
  getRecoveryByEmail(email: string): Promise<Recovery | null>;
  /**
   * Writes the account's recovery row, and takes the email away from any other account
   * that had it: one email, one account (ADR-0050 §6).
   */
  putRecovery(recovery: Recovery): Promise<void>;
  /** The email, the sealed secret and every code of the account. */
  deleteRecovery(accountId: string): Promise<void>;

  /** Replaces whatever code `(purpose, subject)` had. */
  putRecoveryCode(code: RecoveryCode): Promise<void>;
  getRecoveryCode(purpose: CodePurpose, subject: string): Promise<RecoveryCode | null>;
  /**
   * Counts one attempt at the code, in one step, and returns it as it now stands — or null
   * when there is none or it already spent `max`. In one step because five parallel
   * guesses must not all read "no attempts yet".
   */
  spendRecoveryAttempt(purpose: CodePurpose, subject: string, max: number): Promise<RecoveryCode | null>;
  /** Deletes the code if it is still the one hashed `codeHash`. True when this call did. */
  consumeRecoveryCode(purpose: CodePurpose, subject: string, codeHash: string): Promise<boolean>;
  /** Forgets codes that expired before `before`. */
  deleteExpiredRecoveryCodes(before: number): Promise<void>;

  // --- Photos (ADR-0051) ----------------------------------------------------------------

  getMedia(id: string): Promise<Media | null>;
  /**
   * Writes the row (a new one, or the same id again), and puts a tombstone on every other
   * live photo of the same (challenge, owner, day): one per day, and a new one replaces
   * the last. Returns the rows it tombstoned, whose objects the caller deletes.
   */
  putMediaReplacing(media: Media): Promise<Media[]>;
  /**
   * Records that one object of a live photo arrived at `at`. When both are there the row
   * turns `ready` and its `updatedAt` moves to `at`, which is what puts it in the other
   * participants' sync. Null when there is no live row with that id.
   */
  markMediaObject(id: string, variant: MediaVariant, at: number): Promise<Media | null>;
  /**
   * Tombstones the live rows among `ids` at `at` (`deletedAt` and `updatedAt`), and
   * returns them as they were, so the caller deletes their objects. Rows already gone or
   * already tombstoned are left alone.
   */
  tombstoneMedia(ids: readonly string[], at: number): Promise<Media[]>;
  /** Live rows (pending or ready, not tombstoned) of one owner, one challenge, or both. */
  liveMedia(filter: { ownerId?: string; challengeId?: string }): Promise<Media[]>;
  /**
   * What a sync may hand `viewerId`: rows changed after `since` that are theirs or carry a
   * wrap for them, and that are `ready` or tombstoned. Participation and blocks are the
   * API's to check.
   */
  mediaChangedFor(viewerId: string, since: number): Promise<Media[]>;
  /** Live rows whose `expiresAt` is at or before `at`. */
  expiredMedia(at: number): Promise<Media[]>;
  /** Live `pending` rows created before `before`: uploads that never finished. */
  stalePendingMedia(before: number): Promise<Media[]>;
  /** Deletes rows outright, whatever their state. */
  deleteMediaRows(ids: readonly string[]): Promise<void>;
  /** Deletes tombstones older than `before`; returns how many. */
  purgeMediaTombstones(before: number): Promise<number>;
  /** The ids among `ids` with a live row: what the bucket may keep objects for. */
  liveMediaIds(ids: readonly string[]): Promise<Set<string>>;

  /**
   * Writes the report (a new one, or a resolution of the same id). False, and nothing
   * written, when it is new and the same reporter already reported that photo: two taps
   * in flight are one report.
   */
  putReport(report: Report): Promise<boolean>;
  getReport(id: string): Promise<Report | null>;
  /** The report one person made on one photo, if any: a second one is the same report. */
  findReport(reporterId: string, mediaId: string): Promise<Report | null>;
  /** Open ones first, newest first within each group, at most `limit`. */
  listReports(limit: number): Promise<Report[]>;
  /** Preserved reports whose year ran out before `at`. */
  expiredPreservedReports(at: number): Promise<Report[]>;
  /** Resolved, unpreserved reports resolved before `before`. */
  staleResolvedReports(before: number): Promise<Report[]>;
  deleteReports(ids: readonly string[]): Promise<void>;
  /**
   * The ids among `ids` whose evidence the bucket keeps at `at`: open reports, and
   * preserved ones whose year has not run out.
   */
  heldReportIds(ids: readonly string[], at: number): Promise<Set<string>>;

  /** `blockerId` blocks `blockedId`. Idempotent. */
  putBlock(blockerId: string, blockedId: string, at: number): Promise<void>;
  /** Everyone `id` blocked or was blocked by: a block works both ways. */
  blockedWith(id: string): Promise<Set<string>>;
};
