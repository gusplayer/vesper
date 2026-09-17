import { endWeekKeyFor, shiftDayKey, weekDayKeys, weekKeyOf } from '../domain/circle';
import { dayKeyOf, dayStartShifted, weekStart } from '../domain/day';
import { HOUR, MINUTE } from '../domain/time';
import { ME, type Challenge, type ChallengeMark, type Kudos, type Member, type MemberWeek } from '../domain/types';
import type { Strings } from '../i18n/es';

/**
 * Demo data for the circle (ADR-0021): four people, two weeks of numbers, one active
 * challenge, two kudos and one pending invitation. Deterministic for a given `now`,
 * so a screenshot today matches one tomorrow; every date is relative to `now` so the
 * week is always this week. Nothing here is real. The user's own profile is not
 * seeded: creating it is part of the flow.
 *
 * Names are data, not copy, and stay the same in both languages. The challenge's
 * name is the one word with a translation, and comes from the dictionary.
 */

type DemoStrings = Strings['demo'];

export const DEMO_MEMBER_IDS = ['ana', 'luis', 'sofia', 'mateo'] as const;

export const DEMO_CHALLENGE_ID = 'challenge-read';

/** Kudos and challenge marks live on days; `now` itself is never a seeded day. */
function daysAgoKey(now: number, days: number): string {
  return shiftDayKey(dayKeyOf(now), -days);
}

export function demoMembers(now: number): Member[] {
  const threeWeeksAgo = dayStartShifted(weekStart(now), -21);
  return [
    { id: 'ana', name: 'Ana', handle: 'ana', status: 'member', joinedAt: threeWeeksAgo, createdAt: threeWeeksAgo },
    { id: 'luis', name: 'Luis', handle: 'luis', status: 'member', joinedAt: threeWeeksAgo + HOUR, createdAt: threeWeeksAgo + HOUR },
    { id: 'sofia', name: 'Sofía', handle: 'sofia', status: 'member', joinedAt: threeWeeksAgo + 2 * HOUR, createdAt: threeWeeksAgo + 2 * HOUR },
    // Mateo invited the user and waits: accept and decline can both be tried.
    { id: 'mateo', name: 'Mateo', handle: 'mateo', status: 'pending', joinedAt: null, createdAt: dayStartShifted(now, -1) },
  ];
}

type WeekShape = {
  memberId: string;
  /** A full week's focus. This week gets the share of it that has elapsed. */
  focusMs: number;
  /** A full week's social floor, or null when the member does not share it. */
  socialMs: number | null;
  habitsDone: number;
  habitsTarget: number;
};

/** Between 2 h and 9 h of focus a week, so nobody towers over the user's own numbers. */
const WEEK_SHAPES: readonly WeekShape[] = [
  { memberId: 'ana', focusMs: 8 * HOUR + 10 * MINUTE, socialMs: 6 * HOUR + 35 * MINUTE, habitsDone: 9, habitsTarget: 10 },
  { memberId: 'luis', focusMs: 3 * HOUR + 25 * MINUTE, socialMs: null, habitsDone: 4, habitsTarget: 6 },
  { memberId: 'sofia', focusMs: 6 * HOUR + 40 * MINUTE, socialMs: null, habitsDone: 8, habitsTarget: 8 },
];

/** Rounds to whole minutes, so a scaled number still reads like a clock. */
function minutes(ms: number): number {
  return Math.round(ms / MINUTE) * MINUTE;
}

/**
 * Last week complete for the three members; this week scaled to the days elapsed,
 * today included, so a Monday shows a Monday's worth and a Sunday a whole week.
 */
export function demoMemberWeeks(now: number): MemberWeek[] {
  const thisWeek = weekKeyOf(now);
  const lastWeek = shiftDayKey(thisWeek, -7);
  const elapsed = ((new Date(now).getDay() + 6) % 7) + 1;
  const share = elapsed / 7;
  const weeks: MemberWeek[] = [];
  for (const shape of WEEK_SHAPES) {
    weeks.push({
      memberId: shape.memberId,
      weekKey: lastWeek,
      focusMs: shape.focusMs,
      socialMs: shape.socialMs,
      habitsDone: shape.habitsDone,
      habitsTarget: shape.habitsTarget,
      updatedAt: weekStart(now),
    });
    weeks.push({
      memberId: shape.memberId,
      weekKey: thisWeek,
      focusMs: minutes(shape.focusMs * share),
      socialMs: shape.socialMs === null ? null : minutes(shape.socialMs * share),
      habitsDone: Math.min(shape.habitsTarget, Math.round(shape.habitsDone * share)),
      habitsTarget: shape.habitsTarget,
      updatedAt: now,
    });
  }
  return weeks;
}

/** Ana two days ago, Luis yesterday. The user has cheered nobody yet. */
export function demoKudos(now: number): Kudos[] {
  const anaDay = daysAgoKey(now, 2);
  const luisDay = daysAgoKey(now, 1);
  return [
    { id: `kudos-ana-${anaDay}`, fromId: 'ana', toId: ME, dayKey: anaDay, createdAt: dayStartShifted(now, -2) },
    { id: `kudos-luis-${luisDay}`, fromId: 'luis', toId: ME, dayKey: luisDay, createdAt: dayStartShifted(now, -1) },
  ];
}

/**
 * One active challenge that started this Monday and runs two weeks, linked to the
 * demo habit `habit-read` (src/data/seed.ts), which is what makes the user's own
 * marks count in it.
 */
export function demoChallenge(now: number, t: DemoStrings): Challenge {
  const startWeekKey = weekKeyOf(now);
  return {
    id: DEMO_CHALLENGE_ID,
    name: t.challengeName.reading,
    weeklyTarget: 4,
    startWeekKey,
    endWeekKey: endWeekKeyFor(startWeekKey, 2),
    createdBy: 'ana',
    participantIds: [ME, 'ana', 'luis'],
    habitId: 'habit-read',
    createdAt: weekStart(now),
    archivedAt: null,
  };
}

/** Ana on the first three days of the week, Luis on Monday, never past today. */
export function demoChallengeMarks(now: number): ChallengeMark[] {
  const todayKey = dayKeyOf(now);
  const days = weekDayKeys(weekKeyOf(now)).filter((dayKey) => dayKey <= todayKey);
  const marks: ChallengeMark[] = [];
  for (const dayKey of days.slice(0, 3)) {
    marks.push({ id: `cm-ana-${dayKey}`, challengeId: DEMO_CHALLENGE_ID, memberId: 'ana', dayKey, markedAt: now });
  }
  for (const dayKey of days.slice(0, 1)) {
    marks.push({ id: `cm-luis-${dayKey}`, challengeId: DEMO_CHALLENGE_ID, memberId: 'luis', dayKey, markedAt: now });
  }
  return marks;
}
