import { create } from 'zustand';

import * as circleRepo from '../../db/repositories/circle';
import * as habitsRepo from '../../db/repositories/habits';
import * as settingsRepo from '../../db/repositories/settings';
import {
  circleFull,
  DEFAULT_SHARE_PREFS,
  endDayKeyFor,
  inviteCodeOutcome,
  kudosGivenToday,
  nudgeGivenToday,
  weekKeyOf,
  type InviteCodeOutcome,
} from '../../domain/circle';
import { dayKeyOf } from '../../domain/day';
import { canAddHabit, healthTypeFor } from '../../domain/habits';
import {
  ME,
  type Challenge,
  type ChallengeMark,
  type Kudos,
  type MarkSource,
  type Member,
  type MemberWeek,
  type Nudge,
  type Profile,
  type SharePrefs,
} from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import type { CircleAccount } from '../types';
import { DEMO_CHALLENGE_ID, DEMO_MEMBER_IDS } from '../circleSeed';
import { readIdentity, useIdentityStore } from '../identity';
import { useAppStore } from './app';

/**
 * The circle (ADR-0021), cached in memory from SQLite. Screens read it through the
 * hooks in src/data/index.ts and write through these actions; each one writes
 * through its repository first, then updates the cache, like the app store.
 *
 * Since ADR-0044 there is a server, and the rule that holds this file together is
 * that it still cannot reach it: **everything is written to SQLite first** and the
 * sync in `src/platform/hooks/useCircleSync.ts` carries it up afterwards. A nudge, a
 * kudos, an accepted invitation all land here whether or not there is network, and a
 * failed sync reverts none of them (ADR-0044 §5).
 *
 * The account is the one thing this store only records: it is born in the sync, the
 * first time the user invites someone or uses a code, and never when the local profile
 * is created (ADR-0044 §2). Its secret is not here — it is in the keychain, behind
 * `src/platform/circle.ts`. What is here is the marker, the cursor and when the server
 * last answered, which is all `status()` needs to tell the truth.
 *
 * Nothing here schedules a notification: what the circle notifies is someone else's
 * act, and composing that line is the push half of ADR-0037.
 */

/**
 * Three facts of the account this store keeps next to the marker, in the settings
 * table under keys of their own (the repository's generic JSON reader and writer):
 *
 * - `pendingAccepts`: people accepted on this phone whose "yes" has not reached the
 *   server yet. `/sync` cannot say it (a member row only comes back when it changed),
 *   so the sync sends each one as its own call until the server confirms.
 * - `confirmedGeneration`: the invite-code generation the server last confirmed as
 *   this account's. A code generated offline is not a code anybody can use until the
 *   server has it, and the invite screen draws nothing that would say otherwise.
 * - `profileDirty`: a rename saved while the server could not be reached.
 * - `pendingEnds` / `pendingLeaves`: links ended and challenges left here (ADR-0049)
 *   that the server has not confirmed. `EVERYONE` stands for "Salir del círculo".
 * - `linkEndSupport`: whether the deployed server has the call that ends a link. A
 *   server from before ADR-0049 answers 404, and until it has the call the screens say
 *   what really happens: the other person still sees the user's week.
 */
const ACCOUNT_KEYS = {
  pendingAccepts: 'circle_pending_accepts',
  confirmedGeneration: 'circle_code_confirmed',
  profileDirty: 'circle_profile_dirty',
  pendingEnds: 'circle_pending_ends',
  pendingLeaves: 'circle_pending_leaves',
  linkEndSupport: 'circle_link_end_support',
} as const;

/** The target of "Salir del círculo" in `pendingEnds`: every link at once. */
export const EVERYONE = '*';

/** 'unknown' until the server first answers the call that ends a link (ADR-0049). */
export type LinkEndSupport = 'unknown' | 'yes' | 'no';

function readSupport(raw: unknown): LinkEndSupport {
  return raw === 'yes' || raw === 'no' ? raw : 'unknown';
}

function readIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readGeneration(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null;
}

export type InviteResult = InviteCodeOutcome;
export type AcceptResult = 'ok' | 'full';
export type JoinResult = 'ok' | 'habitsFull';

/** What a sync hands over: the same rows the demo seed writes, from a server instead. */
export type RemoteRows = {
  members: readonly Member[];
  weeks: readonly MemberWeek[];
  challenges: readonly Challenge[];
  marks: readonly ChallengeMark[];
  kudos: readonly Kudos[];
  nudges: readonly Nudge[];
  /** People whose link ended on the server (ADR-0049): they leave this phone too. */
  ended?: readonly string[];
};

type ChallengeInput = {
  name: string;
  weeklyTarget: number;
  /** How many days it runs, or null for no end (CHALLENGE_DURATION_OPTIONS). */
  days: number | null;
  participantIds: string[];
  /** Whether the user takes part from the start, which links or creates a habit. */
  join: boolean;
};

type CircleState = {
  profile: Profile | null;
  share: SharePrefs;
  /** Null until the user invites someone or uses a code (ADR-0044 §2). */
  account: CircleAccount | null;
  /** When the server last answered. Null while it never has. */
  syncedAt: number | null;
  /** The cursor: rows the server changed after this come back. 0 asks for everything. */
  syncSince: number;
  /** The last attempt did not reach the server. Not stored: it is about right now. */
  syncFailed: boolean;
  /** Accepted here, not yet confirmed by the server (ACCOUNT_KEYS). */
  pendingAccepts: string[];
  /** The code generation the server confirmed, or null while it has not. */
  confirmedGeneration: number | null;
  /** A rename that still has to reach the server. */
  profileDirty: boolean;
  /** Links ended here, not yet confirmed by the server (member ids, or `EVERYONE`). */
  pendingEnds: string[];
  /** Challenges left here, not yet confirmed by the server. */
  pendingLeaves: string[];
  linkEndSupport: LinkEndSupport;
  members: Member[];
  memberWeeks: MemberWeek[];
  kudos: Kudos[];
  nudges: Nudge[];
  challenges: Challenge[];
  challengeMarks: ChallengeMark[];

  /** Reads everything from the database. Called once at boot and after a reset. */
  hydrate: (now?: number) => void;

  // The account and the sync (ADR-0044). Written by platform/hooks/useCircleSync.
  /**
   * Records that this phone now has an account, and retires the demo circle in the
   * same breath: from here on the people, the weeks and the marks are other people's
   * (ADR-0033 §8). Does nothing if there already is one.
   */
  setAccount: (account: CircleAccount, now: number) => void;
  /** "Borrar la cuenta": the marker, the cursor and every row of the circle. */
  clearAccount: (now: number) => void;
  markSynced: (since: number, now: number) => void;
  markSyncFailed: () => void;
  /** The server confirmed the acceptance, or has no such request: stop sending it. */
  settleAccept: (memberId: string, now: number) => void;
  /** The server holds this code generation for this account. */
  markCodeConfirmed: (generation: number, now: number) => void;
  setProfileDirty: (dirty: boolean, now: number) => void;
  /** The server ended that link (or the target was never the server's): stop sending it. */
  settleEnd: (target: string, now: number) => void;
  settleLeave: (challengeId: string, now: number) => void;
  setLinkEndSupport: (support: LinkEndSupport, now: number) => void;
  /**
   * Writes what the server sent. Rows arrive already folded into domain rows
   * (`foldDownload`), so this store never learns the shape of the wire.
   */
  applyRemote: (rows: RemoteRows) => void;
  /**
   * A restore with the backup key (ADR-0048 §6): the profile the server knows, the
   * account marker, the code generation it holds, and the cursor back at zero so the
   * next sync asks for everything. Replaces whatever marker was there, and retires the
   * demo circle like `setAccount`.
   */
  restoreAccount: (
    input: { profile: Profile; account: CircleAccount; confirmedGeneration: number | null },
    now: number,
  ) => void;
  /**
   * The user's own marks the server kept for their challenges, written into their
   * habits as a union: a day already marked stays as it is (ADR-0048 §6). Only habits
   * that exist are written to; the caller decides which (features/restore).
   */
  restoreOwnMarks: (marks: readonly { habitId: string; dayKey: string; source: MarkSource }[], now: number) => void;

  // Identity
  /** The profile takes the identity's id (ADR-0048 §2); a new one otherwise. */
  createProfile: (input: { name: string; handle: string }, now: number) => void;
  /**
   * The profile follows a new identity id. Only while there is no account: before that
   * the id has never left the phone, and the invite code it derives has never been
   * confirmed by anybody.
   */
  setProfileId: (id: string, now: number) => void;
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'handle'>>, now: number) => void;
  /** Invalidates the current invite code: the next one derives from a new generation. */
  regenerateInviteCode: (now: number) => void;
  updateShare: (patch: Partial<SharePrefs>, now: number) => void;

  // People
  /**
   * What a typed code amounts to on this phone alone, without asking anybody: the
   * user's own code (any generation) is 'self', anything else that looks like a code is
   * 'unavailable' here, and the rest is 'invalid'. The screens send real requests
   * through `redeemCircleCode` in platform/hooks/useCircleSync.ts.
   */
  invite: (code: string) => InviteResult;
  acceptInvite: (memberId: string, now: number) => AcceptResult;
  /** Rechazar: the row goes here, and the end is queued for the server (ADR-0049). */
  declineInvite: (memberId: string, now: number) => void;
  /**
   * Quitar: the person goes with every row of theirs, the challenges they made are
   * archived here, and the end is queued for the server (ADR-0049).
   */
  removeFromCircle: (memberId: string, now: number) => void;
  /**
   * The local half only, with nothing sent: drops their weeks, kudos, nudges and marks,
   * and takes them out of every challenge. For the demo seed, a request the server no
   * longer has, and a link the other person ended.
   */
  removeMember: (memberId: string) => void;

  // Kudos
  /** False when already given today, or when the target is the user. */
  giveKudos: (toId: string, now: number) => boolean;

  // Nudges
  /**
   * Pushes a participant on a challenge, once a day per person (ADR-0027). False
   * when the target is the user, is not in that challenge, or was nudged today.
   */
  nudge: (toId: string, challengeId: string, now: number) => boolean;

  // Challenges
  createChallenge: (input: ChallengeInput, now: number) => { id: string } | 'habitsFull';
  joinChallenge: (id: string, now: number) => JoinResult;
  /** Takes the user out; the habit stays, it is theirs. Queued for the server (ADR-0049). */
  leaveChallenge: (id: string, now: number) => void;
  archiveChallenge: (id: string, now: number) => void;

  /**
   * Deletes every person and their rows and archives every challenge. Profile and share
   * stay. With an account, every link's end is queued for the server (ADR-0049).
   */
  leaveCircle: (now: number) => void;
};

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

/**
 * The user's habit a challenge counts against: an active one with the same name,
 * kept as it is, or a new one. The new one is verified when Health can confirm the
 * name and is connected (ADR-0042) — the screen asks for Health before joining — and
 * declared otherwise. Null when the fifth slot is taken — rule 4 applies to a
 * challenge like to any habit, and nothing is created.
 */
function linkHabit(name: string, weeklyTarget: number): string | null {
  const app = useAppStore.getState();
  const active = app.habits.filter((h) => h.archivedAt === null);
  const wanted = name.trim().toLowerCase();
  const existing = active.find((h) => h.name.trim().toLowerCase() === wanted);
  if (existing !== undefined) {
    return existing.id;
  }
  if (!canAddHabit(active.length)) {
    return null;
  }
  const healthType = app.settings.healthConnected ? healthTypeFor(name.trim()) : null;
  const countMode = healthType === null ? 'declared' : 'verified';
  if (!app.upsertHabit({ name: name.trim(), activityId: null, weeklyTarget, countMode, healthType })) {
    return null;
  }
  const created = useAppStore
    .getState()
    .habits.find((h) => h.archivedAt === null && h.name.trim().toLowerCase() === wanted);
  return created?.id ?? null;
}

/**
 * The cache after a sync: what arrived replaces what was there by id, what did not
 * arrive is left alone. The server is the authority over its own rows and silent
 * about everyone else's, so a row it did not mention is not a row it deleted.
 */
function mergeById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  if (incoming.length === 0) {
    return [...current];
  }
  const byId = new Map(incoming.map((row) => [row.id, row]));
  const merged = current.map((row) => byId.get(row.id) ?? row);
  const known = new Set(current.map((row) => row.id));
  return [...merged, ...incoming.filter((row) => !known.has(row.id))];
}

/** The same, keyed on (member, week), which is what member_weeks is unique on. */
function mergeWeeks(current: readonly MemberWeek[], incoming: readonly MemberWeek[]): MemberWeek[] {
  if (incoming.length === 0) {
    return [...current];
  }
  const keyOf = (week: MemberWeek): string => `${week.memberId}/${week.weekKey}`;
  const byKey = new Map(incoming.map((week) => [keyOf(week), week]));
  const merged = current.map((week) => byKey.get(keyOf(week)) ?? week);
  const known = new Set(current.map(keyOf));
  return [...merged, ...incoming.filter((week) => !known.has(keyOf(week)))];
}

/**
 * The demo circle, withdrawn (ADR-0033 §8, ADR-0044). It stands in only while nothing
 * is real; the moment an account exists, the people in the circle are people, and
 * leaving four invented ones among them would be the flag-instead-of-capability this
 * project refuses (rule 8).
 *
 * The four seeded people go with everything of theirs — weeks, kudos, nudges, marks —
 * and the seeded challenge is archived rather than deleted, because the user's own
 * marks in it are habit marks of their own and those are not demo data.
 */
function retireDemoCircle(now: number): void {
  const store = useCircleStore.getState();
  for (const id of DEMO_MEMBER_IDS) {
    if (!store.members.some((member) => member.id === id)) {
      continue;
    }
    store.removeMember(id);
  }
  const demoChallenge = useCircleStore
    .getState()
    .challenges.find((challenge) => challenge.id === DEMO_CHALLENGE_ID && challenge.archivedAt === null);
  if (demoChallenge !== undefined) {
    useCircleStore.getState().archiveChallenge(DEMO_CHALLENGE_ID, now);
  }
}

export const useCircleStore = create<CircleState>((set, get) => {
  /** Adds to a persisted queue, once. */
  const enqueue = (key: 'pendingEnds' | 'pendingLeaves', value: string, now: number): void => {
    const current = get()[key];
    if (current.includes(value)) {
      return;
    }
    const next = [...current, value];
    settingsRepo.setJson(ACCOUNT_KEYS[key], next, now);
    set({ [key]: next } as Pick<CircleState, typeof key>);
  };

  const dequeue = (key: 'pendingEnds' | 'pendingLeaves', value: string, now: number): void => {
    const current = get()[key];
    if (!current.includes(value)) {
      return;
    }
    const next = current.filter((entry) => entry !== value);
    settingsRepo.setJson(ACCOUNT_KEYS[key], next, now);
    set({ [key]: next } as Pick<CircleState, typeof key>);
  };

  /**
   * A person out of the circle, locally: their rows go, and a challenge they made is
   * archived here, because its maker is no longer someone the user shares a circle with
   * (the server takes the user out of it too, ADR-0049). The user's habit stays.
   */
  const dropPerson = (memberId: string, now: number): void => {
    if (get().pendingAccepts.includes(memberId)) {
      get().settleAccept(memberId, now);
    }
    get().removeMember(memberId);
    for (const challenge of get().challenges) {
      if (challenge.createdBy === memberId && challenge.archivedAt === null) {
        get().archiveChallenge(challenge.id, now);
      }
    }
  };

  const saveProfile = (profile: Profile, now: number): void => {
    settingsRepo.setProfile(profile, now);
    set({ profile });
  };

  const saveChallenge = (challenge: Challenge): void => {
    circleRepo.upsertChallenge(challenge);
    set((state) => ({
      challenges: state.challenges.some((c) => c.id === challenge.id)
        ? state.challenges.map((c) => (c.id === challenge.id ? challenge : c))
        : [...state.challenges, challenge],
    }));
  };

  return {
    profile: null,
    share: DEFAULT_SHARE_PREFS,
    account: null,
    syncedAt: null,
    syncSince: 0,
    syncFailed: false,
    pendingAccepts: [],
    confirmedGeneration: null,
    profileDirty: false,
    pendingEnds: [],
    pendingLeaves: [],
    linkEndSupport: 'unknown',
    members: [],
    memberWeeks: [],
    kudos: [],
    nudges: [],
    challenges: [],
    challengeMarks: [],

    hydrate: () => {
      set({
        profile: settingsRepo.getProfile(),
        share: settingsRepo.getSharePrefs(DEFAULT_SHARE_PREFS),
        account: settingsRepo.getAccount(),
        syncedAt: settingsRepo.getSyncedAt(),
        syncSince: settingsRepo.getSyncSince(),
        syncFailed: false,
        pendingAccepts: readIds(settingsRepo.getJson<unknown>(ACCOUNT_KEYS.pendingAccepts)),
        confirmedGeneration: readGeneration(settingsRepo.getJson<unknown>(ACCOUNT_KEYS.confirmedGeneration)),
        profileDirty: settingsRepo.getJson<unknown>(ACCOUNT_KEYS.profileDirty) === true,
        pendingEnds: readIds(settingsRepo.getJson<unknown>(ACCOUNT_KEYS.pendingEnds)),
        pendingLeaves: readIds(settingsRepo.getJson<unknown>(ACCOUNT_KEYS.pendingLeaves)),
        linkEndSupport: readSupport(settingsRepo.getJson<unknown>(ACCOUNT_KEYS.linkEndSupport)),
        members: circleRepo.listMembers(),
        memberWeeks: circleRepo.listMemberWeeks(),
        kudos: circleRepo.listKudos(),
        nudges: circleRepo.listNudges(),
        challenges: circleRepo.listChallenges(),
        challengeMarks: circleRepo.listChallengeMarks(),
      });
      // The identity record lives in the same table and is replaced by the same resets
      // and restores that call this, so its mirror is refreshed here too.
      useIdentityStore.getState().refresh();
    },

    setAccount: (account, now) => {
      if (get().account !== null) {
        return;
      }
      settingsRepo.setAccount(account, now);
      set({ account });
      retireDemoCircle(now);
    },

    clearAccount: (now) => {
      settingsRepo.clearAccount();
      settingsRepo.setJson(ACCOUNT_KEYS.pendingAccepts, [], now);
      settingsRepo.setJson(ACCOUNT_KEYS.confirmedGeneration, null, now);
      settingsRepo.setJson(ACCOUNT_KEYS.profileDirty, false, now);
      settingsRepo.setJson(ACCOUNT_KEYS.pendingEnds, [], now);
      settingsRepo.setJson(ACCOUNT_KEYS.pendingLeaves, [], now);
      set({
        account: null,
        syncedAt: null,
        syncSince: 0,
        syncFailed: false,
        pendingAccepts: [],
        confirmedGeneration: null,
        profileDirty: false,
        pendingEnds: [],
        pendingLeaves: [],
      });
      // Deleting the account deletes its rows on the server (ADR-0033 §6); keeping
      // the copies here would leave a circle that answers to nobody. The profile and
      // the habits stay: the app goes back to being local and keeps working whole.
      get().leaveCircle(now);
    },

    markSynced: (since, now) => {
      settingsRepo.setSynced(since, now);
      set({ syncedAt: now, syncSince: since, syncFailed: false });
    },

    markSyncFailed: () => {
      set({ syncFailed: true });
    },

    settleAccept: (memberId, now) => {
      const pendingAccepts = get().pendingAccepts.filter((id) => id !== memberId);
      if (pendingAccepts.length === get().pendingAccepts.length) {
        return;
      }
      settingsRepo.setJson(ACCOUNT_KEYS.pendingAccepts, pendingAccepts, now);
      set({ pendingAccepts });
    },

    markCodeConfirmed: (generation, now) => {
      settingsRepo.setJson(ACCOUNT_KEYS.confirmedGeneration, generation, now);
      set({ confirmedGeneration: generation });
    },

    settleEnd: (target, now) => {
      dequeue('pendingEnds', target, now);
    },

    settleLeave: (challengeId, now) => {
      dequeue('pendingLeaves', challengeId, now);
    },

    setLinkEndSupport: (support, now) => {
      if (get().linkEndSupport === support) {
        return;
      }
      settingsRepo.setJson(ACCOUNT_KEYS.linkEndSupport, support, now);
      set({ linkEndSupport: support });
    },

    setProfileDirty: (dirty, now) => {
      if (get().profileDirty === dirty) {
        return;
      }
      settingsRepo.setJson(ACCOUNT_KEYS.profileDirty, dirty, now);
      set({ profileDirty: dirty });
    },

    applyRemote: (rows) => {
      const before = get();
      // The database first, row by row through the repository, then the cache — the
      // same order every other action here follows. A row that fails to write is one
      // row missing from the next hydrate, not a cache that claims something the
      // database does not have.
      for (const member of rows.members) {
        circleRepo.upsertMember(member);
      }
      for (const week of rows.weeks) {
        circleRepo.upsertMemberWeek(week);
      }
      for (const challenge of rows.challenges) {
        circleRepo.upsertChallenge(challenge);
      }
      for (const mark of rows.marks) {
        circleRepo.upsertChallengeMark(mark);
      }
      for (const kudos of rows.kudos) {
        circleRepo.insertKudos(kudos);
      }
      // `insertNudge` is a plain INSERT: the table has no rule for a repeat, so the
      // same nudge arriving twice would be a primary key error, not a no-op.
      const freshNudges = rows.nudges.filter((nudge) => !before.nudges.some((n) => n.id === nudge.id));
      for (const nudge of freshNudges) {
        circleRepo.insertNudge(nudge);
      }
      set({
        members: mergeById(before.members, rows.members),
        memberWeeks: mergeWeeks(before.memberWeeks, rows.weeks),
        challenges: mergeById(before.challenges, rows.challenges),
        challengeMarks: mergeById(before.challengeMarks, rows.marks),
        kudos: mergeById(before.kudos, rows.kudos),
        nudges: [...before.nudges, ...freshNudges],
      });
      // Someone declined, removed the user, or left: nothing of theirs stays, and the
      // challenges they made end here, because the server took the user out of them.
      const now = Date.now();
      for (const memberId of rows.ended ?? []) {
        dropPerson(memberId, now);
        dequeue('pendingEnds', memberId, now);
      }
    },

    restoreAccount: ({ profile, account, confirmedGeneration }, now) => {
      saveProfile(profile, now);
      settingsRepo.setAccount(account, now);
      settingsRepo.resetSync();
      settingsRepo.setJson(ACCOUNT_KEYS.confirmedGeneration, confirmedGeneration, now);
      settingsRepo.setJson(ACCOUNT_KEYS.profileDirty, false, now);
      set({ account, syncedAt: null, syncSince: 0, syncFailed: false, confirmedGeneration, profileDirty: false });
      retireDemoCircle(now);
    },

    restoreOwnMarks: (marks, now) => {
      if (marks.length === 0) {
        return;
      }
      const active = new Set(useAppStore.getState().habits.filter((h) => h.archivedAt === null).map((h) => h.id));
      for (const mark of marks) {
        if (active.has(mark.habitId)) {
          habitsRepo.mark({ habitId: mark.habitId, dayKey: mark.dayKey, source: mark.source }, now);
        }
      }
      // The app store caches the marks of its window; re-reading it is simpler than
      // merging by hand, and a restore happens once.
      useAppStore.getState().hydrate(now);
    },

    createProfile: (input, now) => {
      // The identity is born on the first launch (ADR-0048 §2), so there is almost always
      // an id to take. A profile made before it — offline on the very first launch, say —
      // gets its own, and the identity sync makes the two agree before any claim.
      saveProfile(
        {
          id: readIdentity()?.id ?? uuidv7(now),
          name: input.name.trim(),
          handle: normalizeHandle(input.handle),
          codeGeneration: 0,
          createdAt: now,
        },
        now,
      );
    },

    setProfileId: (id, now) => {
      const current = get().profile;
      if (current === null || current.id === id || get().account !== null) {
        return;
      }
      saveProfile({ ...current, id, codeGeneration: 0 }, now);
      settingsRepo.setJson(ACCOUNT_KEYS.confirmedGeneration, null, now);
      set({ confirmedGeneration: null });
    },

    updateProfile: (patch, now) => {
      const current = get().profile;
      if (current === null) {
        return;
      }
      saveProfile(
        {
          ...current,
          name: patch.name === undefined ? current.name : patch.name.trim(),
          handle: patch.handle === undefined ? current.handle : normalizeHandle(patch.handle),
        },
        now,
      );
    },

    regenerateInviteCode: (now) => {
      const current = get().profile;
      if (current === null) {
        return;
      }
      saveProfile({ ...current, codeGeneration: current.codeGeneration + 1 }, now);
    },

    updateShare: (patch, now) => {
      const share = { ...get().share, ...patch };
      settingsRepo.setSharePrefs(share, now);
      set({ share });
    },

    invite: (code) => inviteCodeOutcome(get().profile, code),

    acceptInvite: (memberId, now) => {
      const { members } = get();
      const pending = members.find((m) => m.id === memberId);
      if (pending === undefined) {
        return 'ok';
      }
      // Someone asking already holds a seat; accepting only changes their status.
      if (pending.status !== 'member' && circleFull(members.filter((m) => m.id !== memberId))) {
        return 'full';
      }
      const member: Member = { ...pending, status: 'member', joinedAt: now };
      circleRepo.upsertMember(member);
      // With an account, this "yes" still has to reach the server, and `/sync` will not
      // carry it: remember it until the server confirms (ACCOUNT_KEYS). Without one the
      // circle is the demo, and nobody is waiting for an answer.
      const queue = get().account !== null && !get().pendingAccepts.includes(memberId);
      const pendingAccepts = queue ? [...get().pendingAccepts, memberId] : get().pendingAccepts;
      if (queue) {
        settingsRepo.setJson(ACCOUNT_KEYS.pendingAccepts, pendingAccepts, now);
      }
      set((state) => ({ members: state.members.map((m) => (m.id === memberId ? member : m)), pendingAccepts }));
      return 'ok';
    },

    declineInvite: (memberId, now) => {
      if (get().account !== null) {
        enqueue('pendingEnds', memberId, now);
      }
      circleRepo.removeMember(memberId);
      set((state) => ({ members: state.members.filter((m) => m.id !== memberId) }));
    },

    removeFromCircle: (memberId, now) => {
      if (get().account !== null) {
        enqueue('pendingEnds', memberId, now);
      }
      dropPerson(memberId, now);
    },

    removeMember: (memberId) => {
      // Someone accepted here and removed before the "yes" went out: it must not go out.
      if (get().pendingAccepts.includes(memberId)) {
        get().settleAccept(memberId, Date.now());
      }
      const dropped: Challenge[] = [];
      const challenges = get().challenges.map((c) => {
        if (!c.participantIds.includes(memberId)) {
          return c;
        }
        const without = { ...c, participantIds: c.participantIds.filter((id) => id !== memberId) };
        dropped.push(without);
        return without;
      });
      circleRepo.removeMemberEverywhere(memberId, dropped);
      set((state) => ({
        members: state.members.filter((m) => m.id !== memberId),
        memberWeeks: state.memberWeeks.filter((w) => w.memberId !== memberId),
        kudos: state.kudos.filter((k) => k.fromId !== memberId && k.toId !== memberId),
        nudges: state.nudges.filter((n) => n.fromId !== memberId && n.toId !== memberId),
        challengeMarks: state.challengeMarks.filter((m) => m.memberId !== memberId),
        challenges,
      }));
    },

    giveKudos: (toId, now) => {
      if (toId === ME) {
        return false;
      }
      const dayKey = dayKeyOf(now);
      if (kudosGivenToday(get().kudos, toId, dayKey)) {
        return false;
      }
      const kudos: Kudos = { id: uuidv7(now), fromId: ME, toId, dayKey, createdAt: now };
      circleRepo.insertKudos(kudos);
      set((state) => ({ kudos: [...state.kudos, kudos] }));
      return true;
    },

    nudge: (toId, challengeId, now) => {
      if (toId === ME) {
        return false;
      }
      const challenge = get().challenges.find((c) => c.id === challengeId);
      if (challenge === undefined || !challenge.participantIds.includes(toId)) {
        return false;
      }
      const dayKey = dayKeyOf(now);
      if (nudgeGivenToday(get().nudges, toId, challengeId, dayKey)) {
        return false;
      }
      const nudge: Nudge = { id: uuidv7(now), fromId: ME, toId, challengeId, dayKey, createdAt: now };
      circleRepo.insertNudge(nudge);
      set((state) => ({ nudges: [...state.nudges, nudge] }));
      return true;
    },

    createChallenge: (input, now) => {
      const name = input.name.trim();
      let habitId: string | null = null;
      if (input.join) {
        habitId = linkHabit(name, input.weeklyTarget);
        if (habitId === null) {
          return 'habitsFull';
        }
      }
      const others = input.participantIds.filter((id) => id !== ME);
      const startWeekKey = weekKeyOf(now);
      const challenge: Challenge = {
        id: uuidv7(now),
        name,
        weeklyTarget: input.weeklyTarget,
        startWeekKey,
        endDayKey: endDayKeyFor(startWeekKey, input.days),
        createdBy: ME,
        participantIds: input.join ? [ME, ...others] : others,
        habitId,
        createdAt: now,
        archivedAt: null,
      };
      saveChallenge(challenge);
      return { id: challenge.id };
    },

    joinChallenge: (id) => {
      const challenge = get().challenges.find((c) => c.id === id);
      if (challenge === undefined) {
        return 'ok';
      }
      const habitId = linkHabit(challenge.name, challenge.weeklyTarget);
      if (habitId === null) {
        return 'habitsFull';
      }
      saveChallenge({
        ...challenge,
        habitId,
        participantIds: challenge.participantIds.includes(ME)
          ? challenge.participantIds
          : [ME, ...challenge.participantIds],
      });
      return 'ok';
    },

    leaveChallenge: (id, now) => {
      const challenge = get().challenges.find((c) => c.id === id);
      if (challenge === undefined) {
        return;
      }
      if (get().account !== null) {
        enqueue('pendingLeaves', id, now);
      }
      saveChallenge({
        ...challenge,
        habitId: null,
        participantIds: challenge.participantIds.filter((pid) => pid !== ME),
      });
    },

    archiveChallenge: (id, now) => {
      circleRepo.archiveChallenge(id, now);
      set((state) => ({
        challenges: state.challenges.map((c) => (c.id === id ? { ...c, archivedAt: now } : c)),
      }));
    },

    leaveCircle: (now) => {
      // With an account, every link ends on the server too (ADR-0049). Individual ends
      // still queued are covered by this one.
      if (get().account !== null) {
        for (const target of get().pendingEnds) {
          dequeue('pendingEnds', target, now);
        }
        enqueue('pendingEnds', EVERYONE, now);
        for (const memberId of get().pendingAccepts) {
          get().settleAccept(memberId, now);
        }
      }
      circleRepo.clearAll();
      circleRepo.archiveAllChallenges(now);
      set((state) => ({
        members: [],
        memberWeeks: [],
        kudos: [],
        nudges: [],
        challengeMarks: [],
        challenges: state.challenges.map((c) => (c.archivedAt === null ? { ...c, archivedAt: now } : c)),
      }));
    },
  };
});
