import { create } from 'zustand';

import * as circleRepo from '../../db/repositories/circle';
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
  type Member,
  type MemberWeek,
  type Nudge,
  type Profile,
  type SharePrefs,
} from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import type { CircleAccount } from '../types';
import { DEMO_CHALLENGE_ID, DEMO_MEMBER_IDS } from '../circleSeed';
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
  /**
   * Writes what the server sent. Rows arrive already folded into domain rows
   * (`foldDownload`), so this store never learns the shape of the wire.
   */
  applyRemote: (rows: RemoteRows) => void;

  // Identity
  createProfile: (input: { name: string; handle: string }, now: number) => void;
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'handle'>>, now: number) => void;
  /** Invalidates the current invite code: the next one derives from a new generation. */
  regenerateInviteCode: (now: number) => void;
  updateShare: (patch: Partial<SharePrefs>, now: number) => void;

  // People
  /**
   * What a typed code amounts to. Without a server no request is sent and no row
   * is written: the user's own code (any generation) is 'self', anything else that
   * looks like a code is 'unavailable', and the rest is 'invalid'.
   */
  invite: (code: string) => InviteResult;
  acceptInvite: (memberId: string, now: number) => AcceptResult;
  declineInvite: (memberId: string) => void;
  /** Also drops their weeks, kudos, nudges and marks, and takes them out of every challenge. */
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
  /** Takes the user out; the habit stays, it is theirs. */
  leaveChallenge: (id: string) => void;
  archiveChallenge: (id: string, now: number) => void;

  /** Deletes every person and their rows and archives every challenge. Profile and share stay. */
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
        members: circleRepo.listMembers(),
        memberWeeks: circleRepo.listMemberWeeks(),
        kudos: circleRepo.listKudos(),
        nudges: circleRepo.listNudges(),
        challenges: circleRepo.listChallenges(),
        challengeMarks: circleRepo.listChallengeMarks(),
      });
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
      set({ account: null, syncedAt: null, syncSince: 0, syncFailed: false });
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
    },

    createProfile: (input, now) => {
      saveProfile(
        {
          id: uuidv7(now),
          name: input.name.trim(),
          handle: normalizeHandle(input.handle),
          codeGeneration: 0,
          createdAt: now,
        },
        now,
      );
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
      set((state) => ({ members: state.members.map((m) => (m.id === memberId ? member : m)) }));
      return 'ok';
    },

    declineInvite: (memberId) => {
      circleRepo.removeMember(memberId);
      set((state) => ({ members: state.members.filter((m) => m.id !== memberId) }));
    },

    removeMember: (memberId) => {
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

    leaveChallenge: (id) => {
      const challenge = get().challenges.find((c) => c.id === id);
      if (challenge === undefined) {
        return;
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
