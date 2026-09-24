import { dayKeyStart, daysLeftInWeek, shiftDayKey, weekDayKeys } from './day';
import { DAY } from './time';
import {
  MAX_CIRCLE,
  ME,
  type Challenge,
  type ChallengeMark,
  type DayKey,
  type HabitMark,
  type Kudos,
  type MarkSource,
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
  /** Focus in the week, null when that person does not share it. Never zero for null. */
  focusMs: number | null;
  /** Estimated floor, null when not shared. Shown on its own line, never summed. */
  socialMs: number | null;
  /** Habit marks kept, null when that person does not share habits. */
  habitsDone: number | null;
  /** Habit marks promised, null when that person does not share habits. */
  habitsTarget: number | null;
  /** False for a member with no MemberWeek row for that week. Sorted last. */
  hasData: boolean;
};

/** The user's own week, with the same nulls as anyone else's: see `circleWeek`. */
export type MyWeek = {
  focusMs: number | null;
  socialMs: number | null;
  habitsDone: number | null;
  habitsTarget: number | null;
};

/**
 * Which of three different things one number on a circle row is. They look alike on
 * a screen and mean opposite things, so nothing derives them by squinting at a value:
 *
 * - `shared`: there is a number, and **zero is one of them** — a real week in which
 *   that person focused nothing, which they chose to publish.
 * - `private`: they do not share that metric (ADR-0021 §4). Nothing is known and
 *   nothing may be guessed; showing it as 0 is the lie ADR-0033 named on the server
 *   and ADR-0035 named again for the user's own social floor.
 * - `missing`: there is no row for that week at all — they have not synced it, or
 *   they joined the circle after it ended. Not a choice, just an absence.
 */
export type MetricState = 'shared' | 'private' | 'missing';

/**
 * The state of one metric of one row: `metricState(row.focusMs, row.hasData)`. The
 * single place the app is allowed to decide what a null means, so a screen never has
 * to, and so the user's own row and everyone else's answer the same way.
 */
export function metricState(value: number | null, hasData: boolean): MetricState {
  if (!hasData) {
    return 'missing';
  }
  return value === null ? 'private' : 'shared';
}

/**
 * Where a row falls when the week is ordered. ADR-0021 §3 orders by focus hours and
 * nothing else, without positions — which only says what to do with the people who
 * published a number. Someone who does not share their focus has no hours to be
 * ordered by, and sorting them as zero would hand them the last place as if they had
 * earned it: a position, invented out of a silence. So they leave the ordered part
 * and keep the circle's own order (stable sort, the user first), after everyone with
 * a number and before the people with no row for that week at all, who are the older
 * absence and stay last, as they already did.
 */
function focusRank(row: CircleWeekRow): number {
  if (!row.hasData) {
    return 2;
  }
  return row.focusMs === null ? 1 : 0;
}

/**
 * The circle's week: members with status 'member' plus the user, sorted by focus,
 * most first, then the people who do not share their focus, then the ones with no
 * row for that week. The user's row carries `me.week` as given; the caller applies
 * the share preferences before building it (a metric not shared reads null), so this
 * function never has to know what the user chose — and the user's row is built out of
 * the same nulls as everybody else's, which is what keeps the screen honest about
 * what the circle actually sees of them (ADR-0035 §2).
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
      // `?? null` only ever fires for a member with no row: inside a row a null is
      // already the answer, and must reach the screen untouched.
      focusMs: week?.focusMs ?? null,
      socialMs: week?.socialMs ?? null,
      habitsDone: week?.habitsDone ?? null,
      habitsTarget: week?.habitsTarget ?? null,
      hasData: week !== undefined,
    });
  }
  // Array.prototype.sort is stable: ties keep the input order, the user first.
  return rows.sort((a, b) => {
    const rank = focusRank(a) - focusRank(b);
    if (rank !== 0) {
      return rank;
    }
    // Both ranks are the same, so either both have hours or neither does; with
    // neither, this is 0 and the input order stands.
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
  /**
   * How this person's week was counted (ADR-0042): 'health' only when Health confirmed
   * every mark, 'manual' as soon as one was tapped, 'session' otherwise. Null with no
   * marks. Said next to the person, never used to rank or to add anything up.
   */
  source: MarkSource | null;
};

/** The one word for a week of marks: the least verified of them decides. */
export function weekSource(sources: readonly MarkSource[]): MarkSource | null {
  if (sources.length === 0) {
    return null;
  }
  if (sources.includes('manual')) {
    return 'manual';
  }
  return sources.includes('session') ? 'session' : 'health';
}

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

  /** `sourceOn` is the source of the day's mark, or null when the day has none. */
  const standing = (id: string, name: string, isMe: boolean, sourceOn: (dayKey: DayKey) => MarkSource | null): Standing => {
    const sources = dayKeys.map(sourceOn);
    const days = sources.map((source) => source !== null);
    const done = days.filter(Boolean).length;
    return {
      id,
      name,
      isMe,
      done,
      target: challenge.weeklyTarget,
      met: done >= challenge.weeklyTarget,
      days,
      source: weekSource(sources.filter((source): source is MarkSource => source !== null)),
    };
  };

  for (const id of challenge.participantIds) {
    if (id === ME) {
      const habitId = challenge.habitId;
      standings.unshift(
        standing(ME, profile?.name ?? '', true, (dayKey) =>
          habitId === null ? null : (myMarks.find((m) => m.habitId === habitId && m.dayKey === dayKey)?.source ?? null),
        ),
      );
      continue;
    }
    const member = members.find((m) => m.id === id);
    if (member === undefined) {
      continue;
    }
    standings.push(
      standing(
        member.id,
        member.name,
        false,
        (dayKey) =>
          marks.find((m) => m.challengeId === challenge.id && m.memberId === member.id && m.dayKey === dayKey)
            ?.source ?? null,
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
  /**
   * Days this week that can still take a mark, today included while it is free.
   * Today drops out of it once it is marked: the mark is already inside `done`, and
   * counting the day again would say a week is still winnable when it is not.
   */
  daysLeft: number;
};

/**
 * The outlook of one standing at `now`. Pure and free of the challenge: a standing
 * already carries its target and what was delivered, and the week's remaining days
 * come from the clock.
 *
 * `markedToday` is what keeps the two sides of the arithmetic in step. `done` already
 * counts today's mark, so leaving today among the days left counts that day twice: a
 * challenge of six with five marks, on a Sunday that is already marked, would read as
 * `atRisk` — the screen saying "only marking today saves it" about a day that is
 * marked and a week that is gone.
 */
export function challengeOutlook(
  standing: Pick<Standing, 'done' | 'target'>,
  now: number,
  markedToday: boolean,
): ChallengeOutlook {
  const daysLeft = daysLeftInWeek(now) - (markedToday ? 1 : 0);
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
      // Its Sunday has to be behind us: while it is today, the week can still change.
      closed: shiftDayKey(weekKey, 6) < todayKey,
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

/** No 0, O, 1 or I: a code is read out loud or typed from a screenshot. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
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
