import { dayKeyStart, shiftDayKey, weekDayKeys } from './day';
import { WEEK } from './time';
import {
  MAX_CIRCLE,
  ME,
  type Challenge,
  type ChallengeMark,
  type DayKey,
  type HabitMark,
  type Kudos,
  type Member,
  type MemberWeek,
  type Profile,
  type SharePrefs,
} from './types';

/**
 * The circle (ADR-0021): a few people, one week at a time, no ranking. Everything a
 * circle screen shows is derived here from member rows, the weeks a server would
 * deliver, and the user's own numbers. Pure: no store, no database.
 *
 * Week keys are the DayKey of a Monday. Week arithmetic goes through the Date
 * constructor, never through `n * DAY`: a week that crosses a DST change is not
 * 7 * 24 hours long, and a key computed by subtraction would land on Sunday night.
 */

/** What the user shares until they say otherwise: focus and habits, never social use. */
export const DEFAULT_SHARE_PREFS: SharePrefs = { focus: true, habits: true, social: false };

// --- Week keys ---------------------------------------------------------------------

/**
 * The calendar arithmetic lives in ./day with the rest of the day and week
 * boundaries; it is re-exported here because the circle is where week keys are used
 * most, and every caller that learned it here keeps working.
 */
export { dayKeyStart, shiftDayKey, weekDayKeys, weekKeyOf } from './day';

/** The Monday DayKey of the last week of a challenge that starts on `startWeekKey`. */
export function endWeekKeyFor(startWeekKey: DayKey, weeks: number): DayKey {
  return shiftDayKey(startWeekKey, Math.max(0, weeks - 1) * 7);
}

/**
 * Whole weeks from one Monday key to another, inclusive of both. Rounded, because
 * the ms distance between two local midnights is off by an hour across a DST change.
 */
function weeksInclusive(fromWeekKey: DayKey, toWeekKey: DayKey): number {
  const span = Math.round((dayKeyStart(toWeekKey) - dayKeyStart(fromWeekKey)) / WEEK);
  return span + 1;
}

// --- Seats -------------------------------------------------------------------------

/**
 * Seats taken, out of MAX_CIRCLE: everyone with a row, whether in the circle,
 * invited, or asking to join. One rule for the cap and for the header count.
 */
export function seatsTaken(members: readonly Member[]): number {
  return members.length;
}

export function circleFull(members: readonly Member[]): boolean {
  return seatsTaken(members) >= MAX_CIRCLE;
}

// --- The week ----------------------------------------------------------------------

export type CircleWeekRow = {
  id: string;
  name: string;
  handle: string;
  isMe: boolean;
  focusMs: number;
  /** Estimated floor, null when not shared. Shown on its own line, never summed. */
  socialMs: number | null;
  habitsDone: number;
  habitsTarget: number;
  /** False for a member with no MemberWeek row for that week. Sorted last. */
  hasData: boolean;
};

export type MyWeek = {
  focusMs: number;
  socialMs: number | null;
  habitsDone: number;
  habitsTarget: number;
};

/**
 * The circle's week: members with status 'member' plus the user, sorted by focus,
 * most first, with the members that have no row for that week at the end. The
 * user's row carries `me.week` as given; the caller applies the share preferences
 * before building it (a metric not shared reads null), so this function never has
 * to know what the user chose.
 */
export function circleWeek(
  members: readonly Member[],
  weeks: readonly MemberWeek[],
  me: { profile: Profile; week: MyWeek },
  weekKey: DayKey,
): CircleWeekRow[] {
  const rows: CircleWeekRow[] = [
    {
      id: ME,
      name: me.profile.name,
      handle: me.profile.handle,
      isMe: true,
      ...me.week,
      hasData: true,
    },
  ];
  for (const member of members) {
    if (member.status !== 'member') {
      continue;
    }
    const week = weeks.find((w) => w.memberId === member.id && w.weekKey === weekKey);
    rows.push({
      id: member.id,
      name: member.name,
      handle: member.handle,
      isMe: false,
      focusMs: week?.focusMs ?? 0,
      socialMs: week?.socialMs ?? null,
      habitsDone: week?.habitsDone ?? 0,
      habitsTarget: week?.habitsTarget ?? 0,
      hasData: week !== undefined,
    });
  }
  // Array.prototype.sort is stable: ties keep the input order, the user first.
  return rows.sort((a, b) => {
    if (a.hasData !== b.hasData) {
      return a.hasData ? -1 : 1;
    }
    return b.focusMs - a.focusMs;
  });
}

// --- Kudos -------------------------------------------------------------------------

/** Whether the user already cheered `toId` on `dayKey`. Once a day, no more. */
export function kudosGivenToday(kudos: readonly Kudos[], toId: string, dayKey: DayKey): boolean {
  return kudos.some((k) => k.fromId === ME && k.toId === toId && k.dayKey === dayKey);
}

/** The kudos the user received between Monday and today, inclusive. */
export function kudosReceivedInWeek(
  kudos: readonly Kudos[],
  weekKey: DayKey,
  todayKey: DayKey,
): Kudos[] {
  return kudos.filter((k) => k.toId === ME && k.dayKey >= weekKey && k.dayKey <= todayKey);
}

/**
 * Who sent these kudos, one name per person in the order they first appear. Someone
 * no longer in the circle is left out: the line names people, not ids.
 */
export function kudosSenderNames(kudos: readonly Kudos[], members: readonly Member[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const k of kudos) {
    if (seen.has(k.fromId)) {
      continue;
    }
    const member = members.find((m) => m.id === k.fromId);
    if (member === undefined) {
      continue;
    }
    seen.add(k.fromId);
    names.push(member.name);
  }
  return names;
}

// --- Challenges --------------------------------------------------------------------

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export function challengeStatus(challenge: Challenge, weekKey: DayKey): ChallengeStatus {
  if (weekKey < challenge.startWeekKey) {
    return 'upcoming';
  }
  if (weekKey > challenge.endWeekKey) {
    return 'ended';
  }
  return 'active';
}

/** How many weeks the challenge runs in total. */
export function challengeWeeks(challenge: Challenge): number {
  return Math.max(1, weeksInclusive(challenge.startWeekKey, challenge.endWeekKey));
}

/** Weeks still to run, the current one included. Every week before it starts; 0 once ended. */
export function challengeWeeksLeft(challenge: Challenge, weekKey: DayKey): number {
  switch (challengeStatus(challenge, weekKey)) {
    case 'ended':
      return 0;
    case 'upcoming':
      return challengeWeeks(challenge);
    case 'active':
      return weeksInclusive(weekKey, challenge.endWeekKey);
  }
}

export type Standing = {
  id: string;
  name: string;
  isMe: boolean;
  /** Distinct days marked in the week. */
  done: number;
  target: number;
  met: boolean;
  /** One flag per day, Monday first. A mark and a dash, not points — ADR-0021. */
  days: boolean[];
};

/**
 * Where every participant stands in the week starting at `weekKey`. The user's marks
 * are the habit marks of `challenge.habitId` (none while not joined); the others'
 * arrive as ChallengeMark rows. Participants keep the challenge's order, except the
 * user, who goes first. Ids that match no member are skipped: they left the circle.
 */
export function challengeStandings(
  challenge: Challenge,
  members: readonly Member[],
  marks: readonly ChallengeMark[],
  myMarks: readonly HabitMark[],
  profile: Profile | null,
  weekKey: DayKey,
): Standing[] {
  const dayKeys = weekDayKeys(weekKey);
  const standings: Standing[] = [];

  const standing = (id: string, name: string, isMe: boolean, isMarked: (dayKey: DayKey) => boolean): Standing => {
    const days = dayKeys.map(isMarked);
    const done = days.filter(Boolean).length;
    return { id, name, isMe, done, target: challenge.weeklyTarget, met: done >= challenge.weeklyTarget, days };
  };

  for (const id of challenge.participantIds) {
    if (id === ME) {
      const habitId = challenge.habitId;
      standings.unshift(
        standing(ME, profile?.name ?? '', true, (dayKey) =>
          habitId !== null && myMarks.some((m) => m.habitId === habitId && m.dayKey === dayKey),
        ),
      );
      continue;
    }
    const member = members.find((m) => m.id === id);
    if (member === undefined) {
      continue;
    }
    standings.push(
      standing(member.id, member.name, false, (dayKey) =>
        marks.some((m) => m.challengeId === challenge.id && m.memberId === member.id && m.dayKey === dayKey),
      ),
    );
  }
  return standings;
}

// --- Invite codes ------------------------------------------------------------------

/** No 0, O, 1 or I: a code is read out loud or typed from a screenshot. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** FNV-1a, 32 bits. Enough to spread a UUID over six symbols; not a secret. */
function hash32(text: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The user's invite code: six symbols, always the same for the same profile and
 * generation, so it can be shown before any server exists. "Generar código nuevo"
 * bumps the generation and the old code stops matching. When the backend arrives the
 * server will hand one out and this becomes a fallback.
 */
export function inviteCodeFor(profile: Profile): string {
  const source = `${profile.id}:${profile.codeGeneration}`;
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = hash32(source, i * 0x9e3779b9) % CODE_ALPHABET.length;
    code += CODE_ALPHABET[index] ?? 'A';
  }
  return code;
}

/**
 * The link that carries a code: the app's own scheme, so the phone camera and any
 * messenger open Vesper on it. A universal https link replaces this once there is a
 * domain; the code inside stays the same.
 */
export const INVITE_LINK_PREFIX = 'vesper://circle/join?code=';

export function inviteLinkFor(code: string): string {
  return `${INVITE_LINK_PREFIX}${code}`;
}

/** The code inside an invite link, or inside plain text that holds one. Null otherwise. */
export function codeFromInviteLink(text: string): string | null {
  const match = /code=([A-Za-z0-9]{6})(?![A-Za-z0-9])/.exec(text);
  return match === null ? null : normalizeInviteCode(match[1] ?? '');
}

/** What the user typed, cleaned up: trimmed and uppercased. Null unless it is a code. */
export function normalizeInviteCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * Whether `code` is one this profile ever showed: the current one or any earlier
 * generation. "Generar código nuevo" only bumps the generation, so the history is
 * derived, not stored.
 */
export function isOwnInviteCode(profile: Profile, code: string): boolean {
  for (let generation = 0; generation <= profile.codeGeneration; generation += 1) {
    if (inviteCodeFor({ ...profile, codeGeneration: generation }) === code) {
      return true;
    }
  }
  return false;
}

/**
 * 'invalid' is not shaped like a code; 'self' is one of the user's own; 'unavailable'
 * is any other well-formed code, because without a server nobody can look it up
 * (src/platform/circle.ts says why). Nothing is ever verified here.
 */
export type InviteCodeOutcome = 'invalid' | 'self' | 'unavailable';

export function inviteCodeOutcome(profile: Profile | null, text: string): InviteCodeOutcome {
  const code = normalizeInviteCode(text);
  if (code === null) {
    return 'invalid';
  }
  if (profile !== null && isOwnInviteCode(profile, code)) {
    return 'self';
  }
  return 'unavailable';
}
