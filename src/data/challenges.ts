import {
  challengeOutlook,
  challengeStatus,
  challengeWeeks,
  challengeWeeksMet,
  weekDayKeys,
  weekdayIndex,
  weekKeyOf,
  type ChallengeOutlook,
  type ChallengeStatus,
} from '../domain/circle';
import { dayKeyOf, shiftDayKey } from '../domain/day';
import { albumRows, photoSlot, type AlbumRow } from '../domain/photos';
import type { ChallengeReminder } from '../domain/reminders';
import {
  DEFAULT_CHALLENGE_DAYS,
  ME,
  type Challenge,
  type ChallengeMark,
  type ChallengePhoto,
  type DayKey,
  type Habit,
  type HabitMark,
} from '../domain/types';
import type { Strings } from '../i18n';

/**
 * The user's own side of their challenges, in the shape the reminder planner reads
 * (ADR-0031). Only the challenges they joined have one: a challenge is a habit with
 * witnesses, and without the habit there is nothing of theirs to count.
 *
 * Pure, so the rules can be tested without a store: which week is running, how many
 * marks are missing, whether today is already marked, and whether the challenge ran
 * out. What to do with all that is `domain/reminders.ts`.
 */
export function challengeReminders(
  challenges: readonly Challenge[],
  marks: readonly HabitMark[],
  now: number,
): ChallengeReminder[] {
  const todayKey = dayKeyOf(now);
  const weekKey = weekKeyOf(now);
  const reminders: ChallengeReminder[] = [];

  for (const challenge of challenges) {
    if (challenge.archivedAt !== null || !challenge.participantIds.includes(ME) || challenge.habitId === null) {
      continue;
    }
    const weeks = challengeWeeks(challenge, marks, todayKey);
    const running = challengeStatus(challenge, todayKey) === 'active';
    const thisWeek = weeks.find((week) => week.weekKey === weekKey);
    const markedToday = marks.some((mark) => mark.habitId === challenge.habitId && mark.dayKey === todayKey);
    const outlook =
      running && thisWeek !== undefined
        ? challengeOutlook(thisWeek, now, markedToday)
        : { risk: 'met' as const, needed: 0, daysLeft: 0 };

    reminders.push({
      id: challenge.id,
      name: challenge.name,
      needed: outlook.needed,
      daysLeft: outlook.daysLeft,
      atRisk: outlook.risk === 'atRisk',
      markedToday,
      // The last day, from the day it is known: the closing notice is planned ahead
      // so it still arrives on a phone nobody opens that day (domain/reminders).
      endsOn:
        challenge.endDayKey === null
          ? null
          : { dayKey: challenge.endDayKey, ...challengeWeeksMet(weeks) },
    });
  }
  return reminders;
}

export type MyChallengeWeek = {
  id: string;
  name: string;
  status: ChallengeStatus;
  /** The user's marks this week, Monday first: the row of dots Focus and the card draw. */
  days: boolean[];
  done: number;
  target: number;
  outlook: ChallengeOutlook;
  markedToday: boolean;
};

/**
 * The user's own week in every challenge they are in, active ones first. This is what
 * the home page, the card and the habit line read: one row of seven days and one line
 * that says how it is going (ADR-0031). Pure, like `challengeReminders`.
 */
export function myChallengeWeeks(
  challenges: readonly Challenge[],
  marks: readonly HabitMark[],
  now: number,
): MyChallengeWeek[] {
  const todayKey = dayKeyOf(now);
  const weeks: MyChallengeWeek[] = [];

  for (const challenge of challenges) {
    if (challenge.archivedAt !== null || !challenge.participantIds.includes(ME) || challenge.habitId === null) {
      continue;
    }
    const days = weekDayKeys(weekKeyOf(now)).map((dayKey) =>
      marks.some((mark) => mark.habitId === challenge.habitId && mark.dayKey === dayKey),
    );
    const done = days.filter(Boolean).length;
    const markedToday = days[weekdayIndex(now)] ?? false;
    weeks.push({
      id: challenge.id,
      name: challenge.name,
      status: challengeStatus(challenge, todayKey),
      days,
      done,
      target: challenge.weeklyTarget,
      outlook: challengeOutlook({ done, target: challenge.weeklyTarget }, now, markedToday),
      markedToday,
    });
  }
  return weeks.sort((a, b) => MY_WEEK_ORDER[a.status] - MY_WEEK_ORDER[b.status]);
}

const MY_WEEK_ORDER: Record<ChallengeStatus, number> = { active: 0, upcoming: 1, ended: 2 };

export type ChallengeIdea = {
  id: string;
  name: string;
  weeklyTarget: number;
  /** How many days it runs, in the shape `challenge-new` uses. */
  days: number | null;
  /**
   * "Fotos del día" as the suggestion starts (ADR-0051 §6): off where a photo would mean
   * taking the phone out during the very thing the challenge is about.
   */
  photos: boolean;
};

/**
 * The few challenges the app suggests when the user has none (ADR-0031): ours, short,
 * and only a starting point — the screen prefills them and everything stays editable.
 * There is no catalogue of other people's challenges and no counter of how many are
 * doing each: that would need a server and would be a feed (ADR-0021, ADR-0032).
 */
export function challengeIdeas(t: Strings['circle']['challengeNew']): ChallengeIdea[] {
  return [
    { id: 'read', name: t.ideaName.read, weeklyTarget: 4, days: DEFAULT_CHALLENGE_DAYS, photos: true },
    { id: 'walk', name: t.ideaName.walk, weeklyTarget: 5, days: DEFAULT_CHALLENGE_DAYS, photos: true },
    // A photo of the table is a phone on the table, and one of the bed is a screen in it.
    { id: 'table', name: t.ideaName.table, weeklyTarget: 6, days: DEFAULT_CHALLENGE_DAYS, photos: false },
    { id: 'sleep', name: t.ideaName.sleep, weeklyTarget: 5, days: DEFAULT_CHALLENGE_DAYS, photos: false },
    // Health counts both on their own, and the name says which workouts (ADR-0055): any
    // for the first, only rides for the second. A photo of the view, never the route.
    { id: 'exercise', name: t.ideaName.exercise, weeklyTarget: 3, days: 28, photos: true },
    { id: 'bike', name: t.ideaName.bike, weeklyTarget: 1, days: 28, photos: true },
  ];
}

// --- Photos (ADR-0051) ----------------------------------------------------------------

/** The day the "Agregar la foto" row offers, and the photo a new one would replace. */
export type MyPhotoSlot = { dayKey: DayKey; which: 'today' | 'yesterday'; existing: ChallengePhoto | null };

/**
 * The user's photo slot on a challenge (`useMyPhotoSlot`): today when today can take a
 * photo (`domain/photos.photoSlot`), otherwise yesterday when yesterday can, otherwise
 * null. Joined is "in it with an active habit behind it", the same `linked` the page
 * uses; marked is a mark of that habit on the day, whatever counted it. A photo only
 * ever sits on a mark, it never makes one.
 */
export function myPhotoSlot(
  challenge: Challenge,
  habits: readonly Habit[],
  marks: readonly HabitMark[],
  photos: readonly ChallengePhoto[],
  now: number,
): MyPhotoSlot | null {
  const todayKey = dayKeyOf(now);
  const habitId = challenge.habitId;
  const linked =
    challenge.participantIds.includes(ME) && habits.some((habit) => habit.id === habitId && habit.archivedAt === null);
  const active = challenge.archivedAt === null && challengeStatus(challenge, todayKey) === 'active';
  const offered = (dayKey: DayKey): boolean => {
    const marked = habitId !== null && marks.some((mark) => mark.habitId === habitId && mark.dayKey === dayKey);
    return photoSlot({ challenge, linked, active, marked, dayKey, todayKey }) === 'ok';
  };
  const yesterdayKey = shiftDayKey(todayKey, -1);
  const slot: Pick<MyPhotoSlot, 'dayKey' | 'which'> | null = offered(todayKey)
    ? { dayKey: todayKey, which: 'today' }
    : offered(yesterdayKey)
      ? { dayKey: yesterdayKey, which: 'yesterday' }
      : null;
  if (slot === null) {
    return null;
  }
  const existing =
    photos.find((photo) => photo.challengeId === challenge.id && photo.memberId === ME && photo.dayKey === slot.dayKey) ??
    null;
  return { ...slot, existing };
}

/**
 * "Tu álbum" / "El álbum" of one challenge (`useAlbum`): `albumRows` over its photos,
 * the user first and then the participants' order, with the days each person marked
 * inside the challenge and up to today. The user's marks are the habit marks of the
 * challenge's habit; everyone else's are their challenge marks.
 */
export function challengeAlbum(
  challenge: Challenge,
  participants: readonly { id: string; name: string; isMe: boolean }[],
  challengeMarks: readonly ChallengeMark[],
  myMarks: readonly HabitMark[],
  photos: readonly ChallengePhoto[],
  now: number,
): AlbumRow[] {
  const todayKey = dayKeyOf(now);
  const lastKey = challenge.endDayKey !== null && challenge.endDayKey < todayKey ? challenge.endDayKey : todayKey;
  const inside = (dayKey: DayKey): boolean => dayKey >= challenge.startWeekKey && dayKey <= lastKey;
  const habitId = challenge.habitId;
  const markedDays = (memberId: string): ReadonlySet<DayKey> =>
    new Set(
      memberId === ME
        ? myMarks.filter((mark) => habitId !== null && mark.habitId === habitId && inside(mark.dayKey)).map((m) => m.dayKey)
        : challengeMarks
            .filter((mark) => mark.challengeId === challenge.id && mark.memberId === memberId && inside(mark.dayKey))
            .map((mark) => mark.dayKey),
    );
  const ordered = [...participants.filter((p) => p.isMe), ...participants.filter((p) => !p.isMe)];
  return albumRows(
    ordered,
    photos.filter((photo) => photo.challengeId === challenge.id),
    markedDays,
  );
}
