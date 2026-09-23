/**
 * What the API needs from a database, and nothing more (ADR-0033). Two implementations:
 * `PgStore` over Postgres, and `MemoryStore` for the tests, which is where the ownership
 * and cursor rules are checked. Every row carries `updatedAt`, because the sync is a
 * cursor over that column and nothing else.
 */

export type Account = {
  id: string;
  secretHash: string;
  name: string;
  handle: string;
  inviteCode: string | null;
  pushToken: string | null;
  timeZone: string | null;
  nudgesOn: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Link = {
  ownerId: string;
  memberId: string;
  status: 'pending' | 'member';
  createdAt: number;
  updatedAt: number;
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

export type ChallengeMark = {
  challengeId: string;
  accountId: string;
  dayKey: string;
  updatedAt: number;
};

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
  putAccount(account: Account): Promise<void>;
  deleteAccount(id: string): Promise<void>;

  getLink(ownerId: string, memberId: string): Promise<Link | null>;
  putLink(link: Link): Promise<void>;
  /** Every link where `id` is on either side, whatever the status. */
  linksOf(id: string): Promise<Link[]>;

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
};
