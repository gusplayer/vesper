import { dayKeyStart, daysLeftInWeek, shiftDayKey, weekDayKeys } from './day';
import { DICTATION_ALPHABET, dictationPattern } from './dictation';
import { DAY } from './time';
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
  type Nudge,
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
export { dayKeyStart, daysLeftInWeek, shiftDayKey, weekDayKeys, weekdayIndex, weekKeyOf } from './day';

/**
 * The last day, inclusive, of a challenge that starts on `startWeekKey` and runs
 * `days` days: 21 days from a Monday end on a Sunday three weeks later. Null days is
 * a challenge with no end (ADR-0027).
 */
export function endDayKeyFor(startWeekKey: DayKey, days: number | null): DayKey | null {
  if (days === null) {
    return null;
  }
  return shiftDayKey(startWeekKey, Math.max(1, days) - 1);
}

/**
 * Calendar days from one key to another, inclusive of both. Rounded, because the ms
 * distance between two local midnights is off by an hour across a DST change.
 */
function daysInclusive(fromKey: DayKey, toKey: DayKey): number {
  return Math.round((dayKeyStart(toKey) - dayKeyStart(fromKey)) / DAY) + 1;
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
  /** Null when that person does not share their focus hours. */
  focusMs: number | null;
  /** Estimated floor, null when not shared. Shown on its own line, never summed. */
  socialMs: number | null;
  /** Null as a pair when that person does not share their habits and challenges. */
  habitsDone: number | null;
  habitsTarget: number | null;
  /** False for a member with no MemberWeek row for that week. Sorted last. */
  hasData: boolean;
};

export type MyWeek = {
  focusMs: number | null;
  socialMs: number | null;
  habitsDone: number | null;
  habitsTarget: number | null;
};

/**
 * The user's week with the share preferences applied: what is switched off reads null
 * and never leaves the phone (ADR-0021 §4, "lo que no compartes no sale del teléfono").
 *
 * This is the piece the three switches in Ajustes › Círculo were always supposed to
 * pass through. Until now only `social` had a consumer, so a user who turned focus or
 * habits off kept sharing them — a promise written on screen that the code did not
 * keep. It is pure and tested here so the sync, when it exists, cannot forget it either.
 *
 * The wire contract, for whoever writes `platform/circleApi.ts`: a null travels as null
 * or is left out of the body, **never as zero**. The server can only tell the two apart
 * by absence (ADR-0033, `server/src/schema.sql`: the three columns are nullable since
 * the phone learned to say "not shared"), and a zero would put the lie back on the other
 * side of the wire.
 */
export function sharedWeek(week: MyWeek, prefs: SharePrefs): MyWeek {
  return {
    focusMs: prefs.focus ? week.focusMs : null,
    socialMs: prefs.social ? week.socialMs : null,
    habitsDone: prefs.habits ? week.habitsDone : null,
    habitsTarget: prefs.habits ? week.habitsTarget : null,
  };
}

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
      focusMs: week?.focusMs ?? null,
      socialMs: week?.socialMs ?? null,
      habitsDone: week?.habitsDone ?? null,
      habitsTarget: week?.habitsTarget ?? null,
      hasData: week !== undefined,
    });
  }
  // Array.prototype.sort is stable: ties keep the input order, the user first. Someone
  // who does not share their hours has nothing to sort by and goes with the rows that
  // have no data — sorting them as zero would read as "did nothing this week".
  return rows.sort((a, b) => {
    const aHas = a.hasData && a.focusMs !== null;
    const bHas = b.hasData && b.focusMs !== null;
    if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    return (b.focusMs ?? 0) - (a.focusMs ?? 0);
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

// --- Nudges ------------------------------------------------------------------------

/** Whether the user already nudged `toId` on that challenge on `dayKey`. Once a day. */
export function nudgeGivenToday(
  nudges: readonly Nudge[],
  toId: string,
  challengeId: string,
  dayKey: DayKey,
): boolean {
  return nudges.some(
    (n) => n.fromId === ME && n.toId === toId && n.challengeId === challengeId && n.dayKey === dayKey,
  );
}

/** The nudges the user received on `dayKey`, on any challenge. */
export function nudgesReceivedToday(nudges: readonly Nudge[], dayKey: DayKey): Nudge[] {
  return nudges.filter((n) => n.toId === ME && n.dayKey === dayKey);
}

// --- Challenges --------------------------------------------------------------------

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

/** Upcoming until its Monday, ended the day after its last day; never ended without one. */
export function challengeStatus(challenge: Challenge, todayKey: DayKey): ChallengeStatus {
  if (todayKey < challenge.startWeekKey) {
    return 'upcoming';
  }
  if (challenge.endDayKey !== null && todayKey > challenge.endDayKey) {
    return 'ended';
  }
  return 'active';
}

/** How many days the challenge runs in total, first and last included. Null for no end. */
export function challengeDays(challenge: Challenge): number | null {
  if (challenge.endDayKey === null) {
    return null;
  }
  return Math.max(1, daysInclusive(challenge.startWeekKey, challenge.endDayKey));
}

/**
 * Days still to run, today included: every day before it starts, never 0 while
 * active (the last day reads 1), 0 once ended. Null for a challenge with no end.
 */
export function challengeDaysLeft(challenge: Challenge, todayKey: DayKey): number | null {
  if (challenge.endDayKey === null) {
    return null;
  }
  switch (challengeStatus(challenge, todayKey)) {
    case 'ended':
      return 0;
    case 'upcoming':
      return challengeDays(challenge);
    case 'active':
      return daysInclusive(todayKey, challenge.endDayKey);
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

// --- How a week is going (ADR-0031) -------------------------------------------------

/**
 * Where a week stands for one participant, in words the screens and the reminder
 * planner share:
 *
 * - `met`: the promise is kept, whatever is left of the week.
 * - `onTrack`: there is room to miss a day and still make it.
 * - `tight`: exactly one day of slack left.
 * - `atRisk`: every remaining day has to be marked. This is the only state that
 *   earns a notice, because it is the last moment where saying something changes
 *   the outcome.
 * - `missed`: more marks are needed than there are days. The week is gone; nothing
 *   notifies, and the screen says it plainly instead of pretending.
 */
export type ChallengeRisk = 'met' | 'onTrack' | 'tight' | 'atRisk' | 'missed';

export type ChallengeOutlook = {
  risk: ChallengeRisk;
  /** Marks still missing this week; 0 once met. */
  needed: number;
  /** Days still to run this week, today included. */
  daysLeft: number;
};

/**
 * The outlook of one standing at `now`. Pure and free of the challenge: a standing
 * already carries its target and what was delivered, and the week's remaining days
 * come from the clock.
 */
export function challengeOutlook(standing: Pick<Standing, 'done' | 'target'>, now: number): ChallengeOutlook {
  const daysLeft = daysLeftInWeek(now);
  const needed = Math.max(0, standing.target - standing.done);
  return { risk: riskOf(needed, daysLeft), needed, daysLeft };
}

function riskOf(needed: number, daysLeft: number): ChallengeRisk {
  if (needed === 0) {
    return 'met';
  }
  if (needed > daysLeft) {
    return 'missed';
  }
  if (needed === daysLeft) {
    return 'atRisk';
  }
  if (needed === daysLeft - 1) {
    return 'tight';
  }
  return 'onTrack';
}

export type ChallengeWeek = {
  weekKey: DayKey;
  done: number;
  target: number;
  met: boolean;
  /** False for a week that has not finished yet: `met` can still change. */
  closed: boolean;
};

/**
 * Every week the challenge runs, with what the user delivered in each: the closing
 * card counts the ones that were met, and nothing else in the app knows how a
 * challenge went as a whole. Weeks are counted from the start Monday up to the last
 * day; a challenge with no end is counted up to the week of `todayKey`.
 */
export function challengeWeeks(
  challenge: Challenge,
  myMarks: readonly HabitMark[],
  todayKey: DayKey,
): ChallengeWeek[] {
  const habitId = challenge.habitId;
  const lastKey = challenge.endDayKey ?? todayKey;
  const weeks: ChallengeWeek[] = [];
  let weekKey = challenge.startWeekKey;
  while (weekKey <= lastKey) {
    const done = weekDayKeys(weekKey).filter(
      (dayKey) =>
        dayKey <= lastKey &&
        habitId !== null &&
        myMarks.some((mark) => mark.habitId === habitId && mark.dayKey === dayKey),
    ).length;
    weeks.push({
      weekKey,
      done,
      target: challenge.weeklyTarget,
      met: done >= challenge.weeklyTarget,
      closed: shiftDayKey(weekKey, 6) <= todayKey,
    });
    weekKey = shiftDayKey(weekKey, 7);
  }
  return weeks;
}

/** Weeks met out of weeks run, for the one line a finished challenge leaves behind. */
export function challengeWeeksMet(weeks: readonly ChallengeWeek[]): { met: number; total: number } {
  return { met: weeks.filter((week) => week.met).length, total: weeks.length };
}

// --- Invite codes ------------------------------------------------------------------

/** The shared alphabet: no 0, O, 1 or I, because a code is read out loud (ADR-0037). */
const CODE_ALPHABET = DICTATION_ALPHABET;
export const CODE_LENGTH = 6;
const CODE_PATTERN = dictationPattern(CODE_LENGTH);

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
