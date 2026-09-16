import { create } from 'zustand';

import * as circleRepo from '../../db/repositories/circle';
import * as settingsRepo from '../../db/repositories/settings';
import {
  DEFAULT_SHARE_PREFS,
  endWeekKeyFor,
  inviteCodeFor,
  kudosGivenToday,
  normalizeInviteCode,
  weekKeyOf,
} from '../../domain/circle';
import { dayKeyOf } from '../../domain/day';
import {
  MAX_CIRCLE,
  MAX_HABITS,
  ME,
  type Challenge,
  type ChallengeMark,
  type Kudos,
  type Member,
  type MemberWeek,
  type Profile,
  type SharePrefs,
} from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { useAppStore } from './app';

/**
 * The circle (ADR-0021), cached in memory from SQLite. Screens read it through the
 * hooks in src/data/index.ts and write through these actions; each one writes
 * through its repository first, then updates the cache, like the app store.
 *
 * There is no server yet. Inviting someone adds a row on this phone and nothing
 * leaves it; `src/platform/circle.ts` says so to the screens. Nothing here schedules
 * a notification, and nothing ever will: the circle is silent by decision.
 */

export type InviteResult = 'ok' | 'invalid' | 'full' | 'self';
export type AcceptResult = 'ok' | 'full';
export type JoinResult = 'ok' | 'habitsFull';

type ChallengeInput = {
  name: string;
  weeklyTarget: number;
  weeks: number;
  participantIds: string[];
  /** Whether the user takes part from the start, which links or creates a habit. */
  join: boolean;
};

type CircleState = {
  profile: Profile | null;
  share: SharePrefs;
  members: Member[];
  memberWeeks: MemberWeek[];
  kudos: Kudos[];
  challenges: Challenge[];
  challengeMarks: ChallengeMark[];

  /** Reads everything from the database. Called once at boot and after a reset. */
  hydrate: (now?: number) => void;

  // Identity
  createProfile: (input: { name: string; handle: string }, now: number) => void;
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'handle'>>, now: number) => void;
  /** Invalidates the current invite code: the next one derives from a new generation. */
  regenerateInviteCode: (now: number) => void;
  updateShare: (patch: Partial<SharePrefs>, now: number) => void;

  // People
  /** Prototype: a valid code adds an 'invited' member named after the code. */
  invite: (code: string, now: number) => InviteResult;
  acceptInvite: (memberId: string, now: number) => AcceptResult;
  declineInvite: (memberId: string) => void;
  /** Also drops their weeks, kudos and marks, and takes them out of every challenge. */
  removeMember: (memberId: string) => void;

  // Kudos
  /** False when already given today, or when the target is the user. */
  giveKudos: (toId: string, now: number) => boolean;

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
 * or a new declared one. Null when the fifth slot is taken — rule 4 applies to a
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
  if (active.length >= MAX_HABITS) {
    return null;
  }
  app.upsertHabit({ name: name.trim(), activityId: null, weeklyTarget, countMode: 'declared', healthType: null });
  const created = useAppStore
    .getState()
    .habits.find((h) => h.archivedAt === null && h.name.trim().toLowerCase() === wanted);
  return created?.id ?? null;
}

/** Seats taken: people in the circle and people the user has invited. */
function seatsTaken(members: ReadonlyArray<Member>): number {
  return members.filter((m) => m.status !== 'pending').length;
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
    members: [],
    memberWeeks: [],
    kudos: [],
    challenges: [],
    challengeMarks: [],

    hydrate: () => {
      set({
        profile: settingsRepo.getProfile(),
        share: settingsRepo.getSharePrefs(DEFAULT_SHARE_PREFS),
        members: circleRepo.listMembers(),
        memberWeeks: circleRepo.listMemberWeeks(),
        kudos: circleRepo.listKudos(),
        challenges: circleRepo.listChallenges(),
        challengeMarks: circleRepo.listChallengeMarks(),
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

    invite: (code, now) => {
      const normalized = normalizeInviteCode(code);
      if (normalized === null) {
        return 'invalid';
      }
      const { profile, members } = get();
      if (profile !== null && inviteCodeFor(profile) === normalized) {
        return 'self';
      }
      const handle = normalized.toLowerCase();
      if (members.some((m) => m.handle === handle)) {
        // Already in the circle or already invited: nothing to add, nothing to say.
        return 'ok';
      }
      if (seatsTaken(members) >= MAX_CIRCLE) {
        return 'full';
      }
      const member: Member = {
        id: uuidv7(now),
        name: normalized,
        handle,
        status: 'invited',
        joinedAt: null,
        createdAt: now,
      };
      circleRepo.upsertMember(member);
      set((state) => ({ members: [...state.members, member] }));
      return 'ok';
    },

    acceptInvite: (memberId, now) => {
      const { members } = get();
      const pending = members.find((m) => m.id === memberId);
      if (pending === undefined) {
        return 'ok';
      }
      if (seatsTaken(members) >= MAX_CIRCLE) {
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
      circleRepo.deleteChallengeMarksByMember(memberId);
      circleRepo.deleteKudosByMember(memberId);
      circleRepo.deleteWeeksByMember(memberId);
      circleRepo.removeMember(memberId);
      const challenges = get().challenges.map((c) => {
        if (!c.participantIds.includes(memberId)) {
          return c;
        }
        const dropped = { ...c, participantIds: c.participantIds.filter((id) => id !== memberId) };
        circleRepo.upsertChallenge(dropped);
        return dropped;
      });
      set((state) => ({
        members: state.members.filter((m) => m.id !== memberId),
        memberWeeks: state.memberWeeks.filter((w) => w.memberId !== memberId),
        kudos: state.kudos.filter((k) => k.fromId !== memberId && k.toId !== memberId),
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
        endWeekKey: endWeekKeyFor(startWeekKey, input.weeks),
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
        challengeMarks: [],
        challenges: state.challenges.map((c) => (c.archivedAt === null ? { ...c, archivedAt: now } : c)),
      }));
    },
  };
});
