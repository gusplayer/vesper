import { ConflictError } from './store.ts';
import type {
  Account,
  Backup,
  Challenge,
  ChallengeMark,
  EndedLink,
  Kudos,
  Link,
  Nudge,
  Store,
  Week,
} from './store.ts';

/**
 * The store the tests run against. Same contract as Postgres, no SQL: what the tests
 * are about is who may write which row and what a cursor returns, and that logic lives
 * in `app.ts`, not in the database.
 */
export function createMemoryStore(): Store {
  const accounts = new Map<string, Account>();
  const links = new Map<string, Link>();
  const weeks = new Map<string, Week>();
  const challenges = new Map<string, Challenge>();
  const marks = new Map<string, ChallengeMark>();
  const kudos = new Map<string, Kudos>();
  const nudges = new Map<string, Nudge>();
  const backups = new Map<string, Backup>();
  /** Keyed on the pair in a fixed order, like `ended_links` (a_id < b_id). */
  const ended = new Map<string, { a: string; b: string; endedAt: number }>();

  const linkKey = (ownerId: string, memberId: string) => `${ownerId}|${memberId}`;
  const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const weekKey = (accountId: string, key: string) => `${accountId}|${key}`;
  const markKey = (challengeId: string, accountId: string, dayKey: string) =>
    `${challengeId}|${accountId}|${dayKey}`;

  return {
    async getAccount(id) {
      return accounts.get(id) ?? null;
    },
    async getAccountByHandle(handle) {
      return [...accounts.values()].find((account) => account.handle === handle) ?? null;
    },
    async getAccountByInviteCode(code) {
      return [...accounts.values()].find((account) => account.inviteCode === code) ?? null;
    },
    async putAccount(account) {
      // The same two unique constraints Postgres carries, so the tests see the same
      // refusals the deployed server gives (schema.sql: handle and invite_code).
      for (const other of accounts.values()) {
        if (other.id === account.id) {
          continue;
        }
        // Null is not a claim, and Postgres counts nulls as distinct: every account
        // without a circle profile coexists with every other (ADR-0048).
        if (account.handle !== null && other.handle === account.handle) {
          throw new ConflictError('handle');
        }
        if (account.inviteCode !== null && other.inviteCode === account.inviteCode) {
          throw new ConflictError('inviteCode');
        }
      }
      // `lastSeenAt` has one writer after the insert, `touchAccount`, as in pgStore.
      const previous = accounts.get(account.id);
      accounts.set(account.id, {
        ...account,
        lastSeenAt: previous === undefined ? account.lastSeenAt : previous.lastSeenAt,
      });
    },
    async touchAccount(id, at) {
      const account = accounts.get(id);
      if (account !== undefined && (account.lastSeenAt === null || account.lastSeenAt < at)) {
        accounts.set(id, { ...account, lastSeenAt: at });
      }
    },
    async deleteAccount(id) {
      accounts.delete(id);
      // `backups.account_id` cascades in Postgres.
      backups.delete(id);
      for (const [key, link] of links) {
        if (link.ownerId === id || link.memberId === id) {
          links.delete(key);
        }
      }
      for (const [key, row] of ended) {
        if (row.a === id || row.b === id) {
          ended.delete(key);
        }
      }
      for (const [key, week] of weeks) {
        if (week.accountId === id) {
          weeks.delete(key);
        }
      }
      for (const [key, mark] of marks) {
        if (mark.accountId === id) {
          marks.delete(key);
        }
      }
      for (const [key, row] of kudos) {
        if (row.fromId === id || row.toId === id) {
          kudos.delete(key);
        }
      }
      for (const [key, row] of nudges) {
        if (row.fromId === id || row.toId === id) {
          nudges.delete(key);
        }
      }
      for (const [key, challenge] of challenges) {
        if (challenge.createdBy === id) {
          challenges.delete(key);
          continue;
        }
        challenge.participantIds = challenge.participantIds.filter((participant) => participant !== id);
      }
    },

    async getLink(ownerId, memberId) {
      return links.get(linkKey(ownerId, memberId)) ?? null;
    },
    async putLink(link) {
      links.set(linkKey(link.ownerId, link.memberId), link);
      ended.delete(pairKey(link.ownerId, link.memberId));
    },
    async linksOf(id) {
      return [...links.values()].filter((link) => link.ownerId === id || link.memberId === id);
    },
    async endLink(a, b, at) {
      links.delete(linkKey(a, b));
      links.delete(linkKey(b, a));
      const [first, second] = a < b ? [a, b] : [b, a];
      ended.set(pairKey(a, b), { a: first, b: second, endedAt: at });
    },
    async endedLinksOf(id, since) {
      const rows: EndedLink[] = [];
      for (const row of ended.values()) {
        if (row.endedAt > since && (row.a === id || row.b === id)) {
          rows.push({ otherId: row.a === id ? row.b : row.a, endedAt: row.endedAt });
        }
      }
      return rows;
    },

    async putWeek(week) {
      weeks.set(weekKey(week.accountId, week.weekKey), week);
    },
    async weeksOf(accountIds, since) {
      const wanted = new Set(accountIds);
      return [...weeks.values()].filter((week) => wanted.has(week.accountId) && week.updatedAt > since);
    },

    async getChallenge(id) {
      return challenges.get(id) ?? null;
    },
    async putChallenge(challenge) {
      challenges.set(challenge.id, challenge);
    },
    async challengesOf(id, since) {
      return [...challenges.values()].filter(
        (challenge) =>
          challenge.updatedAt > since &&
          (challenge.createdBy === id || challenge.participantIds.includes(id)),
      );
    },

    async putMark(mark) {
      marks.set(markKey(mark.challengeId, mark.accountId, mark.dayKey), mark);
    },
    async deleteMark(mark) {
      marks.delete(markKey(mark.challengeId, mark.accountId, mark.dayKey));
    },
    async marksOf(challengeIds, since) {
      const wanted = new Set(challengeIds);
      return [...marks.values()].filter((mark) => wanted.has(mark.challengeId) && mark.updatedAt > since);
    },

    async putKudos(row) {
      kudos.set(row.id, row);
    },
    async kudosFor(id, since) {
      return [...kudos.values()].filter(
        (row) => row.updatedAt > since && (row.toId === id || row.fromId === id),
      );
    },

    async putNudge(row) {
      nudges.set(row.id, row);
    },
    async nudgesFor(id, since) {
      return [...nudges.values()].filter(
        (row) => row.updatedAt > since && (row.toId === id || row.fromId === id),
      );
    },

    async putBackup(backup) {
      // A copy, as Postgres would keep: the caller's buffer is not the stored one.
      backups.set(backup.accountId, { ...backup, data: new Uint8Array(backup.data) });
    },
    async getBackup(accountId) {
      const backup = backups.get(accountId);
      return backup === undefined ? null : { ...backup, data: new Uint8Array(backup.data) };
    },
    async getBackupMeta(accountId) {
      const backup = backups.get(accountId);
      if (backup === undefined) {
        return null;
      }
      const { data: _bytes, ...meta } = backup;
      return meta;
    },
    async deleteBackup(accountId) {
      backups.delete(accountId);
    },
  };
}
