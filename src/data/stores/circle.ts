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
import { canAddHabit } from '../../domain/habits';
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
import { useAppStore } from './app';

/**
 * The circle (ADR-0021), cached in memory from SQLite. Screens read it through the
 * hooks in src/data/index.ts and write through these actions; each one writes
 * through its repository first, then updates the cache, like the app store.
 *
 * There is no server yet, so a code typed in goes nowhere: `invite` answers with why
 * and creates nothing; `src/platform/circle.ts` says the same to the screens. A nudge
 * (ADR-0027) is recorded here and shown as sent; delivering it is the backend's job.
 * Nothing here schedules a notification: what the circle notifies is someone else's
 * act, and that arrives with the server.
 */

export type InviteResult = InviteCodeOutcome;
export type AcceptResult = 'ok' | 'full';
export type JoinResult = 'ok' | 'habitsFull';

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
  members: Member[];
  memberWeeks: MemberWeek[];
  kudos: Kudos[];
  nudges: Nudge[];
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
  if (!canAddHabit(active.length)) {
    return null;
  }
  if (!app.upsertHabit({ name: name.trim(), activityId: null, weeklyTarget, countMode: 'declared', healthType: null })) {
    return null;
  }
  const created = useAppStore
    .getState()
    .habits.find((h) => h.archivedAt === null && h.name.trim().toLowerCase() === wanted);
  return created?.id ?? null;
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
    nudges: [],
    challenges: [],
    challengeMarks: [],

    hydrate: () => {
      set({
        profile: settingsRepo.getProfile(),
        share: settingsRepo.getSharePrefs(DEFAULT_SHARE_PREFS),
        members: circleRepo.listMembers(),
        memberWeeks: circleRepo.listMemberWeeks(),
        kudos: circleRepo.listKudos(),
        nudges: circleRepo.listNudges(),
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
