import { describe, expect, it } from 'vitest';

import { aHabit, aMark } from '../domain/fixtures';
import {
  CHALLENGE_TARGET_OPTIONS,
  ME,
  type Challenge,
  type ChallengeMark,
  type ChallengePhoto,
  type HabitMark,
} from '../domain/types';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { challengeAlbum, challengeIdeas, challengeReminders, myChallengeWeeks, myPhotoSlot } from './challenges';

/** Monday the 17th of August 2026 through Sunday the 30th: two weeks. */
const WEEK = '2026-08-17';
const WEDNESDAY = new Date(2026, 7, 19, 12, 0).getTime();

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'challenge-1',
    name: 'Leer',
    weeklyTarget: 4,
    startWeekKey: WEEK,
    endDayKey: '2026-08-30',
    createdBy: ME,
    participantIds: [ME, 'ana'],
    habitId: 'habit-read',
    photos: true,
    createdAt: 0,
    archivedAt: null,
    ...overrides,
  };
}

function marks(...dayKeys: string[]): HabitMark[] {
  return dayKeys.map((dayKey) => aMark({ habitId: 'habit-read', dayKey }));
}

describe('challengeReminders', () => {
  it('counts what is missing this week and the days that are left', () => {
    const [reminder] = challengeReminders([challenge()], marks(WEEK), WEDNESDAY);

    // Wednesday: five days left, one of four marks delivered.
    expect(reminder).toMatchObject({ id: 'challenge-1', name: 'Leer', needed: 3, daysLeft: 5, atRisk: false });
  });

  it('is at risk only when every remaining day has to be marked', () => {
    const risky = challengeReminders([challenge({ weeklyTarget: 5 })], marks(), WEDNESDAY);
    const lost = challengeReminders([challenge({ weeklyTarget: 6 })], marks(), WEDNESDAY);

    expect(risky[0]?.atRisk).toBe(true);
    expect(lost[0]?.atRisk).toBe(false);
    expect(lost[0]?.needed).toBe(6);
  });

  it('knows whether today is already marked', () => {
    expect(challengeReminders([challenge()], marks('2026-08-19'), WEDNESDAY)[0]?.markedToday).toBe(true);
    expect(challengeReminders([challenge()], marks('2026-08-18'), WEDNESDAY)[0]?.markedToday).toBe(false);
  });

  it('leaves out what is not the user own: archived, not joined, or without a habit', () => {
    const notMine = challenge({ participantIds: ['ana'], habitId: null });

    expect(challengeReminders([challenge({ archivedAt: 1 })], marks(), WEDNESDAY)).toEqual([]);
    expect(challengeReminders([notMine], marks(), WEDNESDAY)).toEqual([]);
    expect(challengeReminders([challenge({ habitId: null })], marks(), WEDNESDAY)).toEqual([]);
  });

  it('reports nothing to chase for a challenge that has not started or already ended', () => {
    const upcoming = challengeReminders([challenge({ startWeekKey: '2026-08-24' })], marks(), WEDNESDAY);
    const over = challengeReminders([challenge({ endDayKey: '2026-08-16' })], marks(), WEDNESDAY);

    expect(upcoming[0]).toMatchObject({ needed: 0, daysLeft: 0, atRisk: false });
    expect(over[0]?.atRisk).toBe(false);
  });

  it('carries the last day and the weeks met once the challenge ran out', () => {
    const over = challenge({ endDayKey: '2026-08-18' });

    const [reminder] = challengeReminders([over], marks(WEEK, '2026-08-18'), WEDNESDAY);

    expect(reminder?.endsOn).toEqual({ dayKey: '2026-08-18', met: 0, total: 1 });
  });

  it('carries the last day before it arrives too, so the closing notice can be planned ahead', () => {
    // Both weeks of the challenge are counted, the one still to run included; how
    // many were met is what the app knows today and every later sync corrects.
    const [reminder] = challengeReminders([challenge()], marks(WEEK), WEDNESDAY);

    expect(reminder?.endsOn).toEqual({ dayKey: '2026-08-30', met: 0, total: 2 });
  });

  it('leaves endsOn null only for a challenge with no end', () => {
    expect(challengeReminders([challenge({ endDayKey: null })], marks(), WEDNESDAY)[0]?.endsOn).toBeNull();
  });
});

describe('myChallengeWeeks', () => {
  it('draws the week as seven days, Monday first, and counts what is done', () => {
    const [week] = myChallengeWeeks([challenge()], marks(WEEK, '2026-08-19'), WEDNESDAY);

    expect(week?.days).toEqual([true, false, true, false, false, false, false]);
    expect(week).toMatchObject({ id: 'challenge-1', name: 'Leer', done: 2, target: 4, markedToday: true });
    // Today is marked, so it is not one of the days a mark can still land on.
    expect(week?.outlook).toEqual({ risk: 'onTrack', needed: 2, daysLeft: 4 });
  });

  it('keeps only the user own live challenges, active ones first', () => {
    const weeks = myChallengeWeeks(
      [
        challenge({ id: 'ended', endDayKey: '2026-08-18' }),
        challenge({ id: 'active' }),
        challenge({ id: 'theirs', participantIds: ['ana'] }),
        challenge({ id: 'archived', archivedAt: 1 }),
      ],
      marks(),
      WEDNESDAY,
    );

    expect(weeks.map((week) => week.id)).toEqual(['active', 'ended']);
  });
});

describe('challengeIdeas', () => {
  it('starts "Fotos del día" off only where a photo would take the phone out (ADR-0051 §6)', () => {
    for (const t of [es, en]) {
      const photos = Object.fromEntries(challengeIdeas(t.circle.challengeNew).map((idea) => [idea.id, idea.photos]));

      expect(photos).toEqual({ read: true, walk: true, table: false, sleep: false, exercise: true, bike: true });
    }
  });

  it('asks only for targets the screen offers, so none falls back to the default', () => {
    for (const idea of challengeIdeas(es.circle.challengeNew)) {
      expect(CHALLENGE_TARGET_OPTIONS).toContain(idea.weeklyTarget);
    }
  });
});

function aPhoto(dayKey: string, overrides: Partial<ChallengePhoto> = {}): ChallengePhoto {
  const memberId = overrides.memberId ?? ME;
  return {
    id: `${memberId}-${dayKey}`,
    challengeId: 'challenge-1',
    memberId,
    dayKey,
    origin: 'camera',
    caption: null,
    width: 1280,
    height: 960,
    fullFile: null,
    thumbFile: null,
    takenAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('myPhotoSlot', () => {
  const habits = [aHabit()];

  it('offers today when today is marked, with no photo yet', () => {
    expect(myPhotoSlot(challenge(), habits, marks('2026-08-19'), [], WEDNESDAY)).toEqual({
      dayKey: '2026-08-19',
      which: 'today',
      existing: null,
    });
  });

  it('offers yesterday when only yesterday is marked, and nothing older', () => {
    expect(myPhotoSlot(challenge(), habits, marks('2026-08-18'), [], WEDNESDAY)).toMatchObject({
      dayKey: '2026-08-18',
      which: 'yesterday',
    });
    expect(myPhotoSlot(challenge(), habits, marks('2026-08-17'), [], WEDNESDAY)).toBeNull();
  });

  it('prefers today when both are marked, and carries the photo a new one would replace', () => {
    const today = aPhoto('2026-08-19');
    const slot = myPhotoSlot(challenge(), habits, marks('2026-08-18', '2026-08-19'), [aPhoto('2026-08-18'), today], WEDNESDAY);

    expect(slot).toEqual({ dayKey: '2026-08-19', which: 'today', existing: today });
  });

  it("only takes the user's own photo on that challenge as the existing one", () => {
    const others = [aPhoto('2026-08-19', { memberId: 'ana' }), aPhoto('2026-08-19', { id: 'x', challengeId: 'other' })];

    expect(myPhotoSlot(challenge(), habits, marks('2026-08-19'), others, WEDNESDAY)?.existing).toBeNull();
  });

  it("counts a mark from Health or a session like a tap: it is the habit's mark", () => {
    const health = [aMark({ habitId: 'habit-read', dayKey: '2026-08-19', source: 'health' })];

    expect(myPhotoSlot(challenge(), habits, health, [], WEDNESDAY)?.which).toBe('today');
  });

  it('offers nothing without a mark, with photos off, or on a mark of another habit', () => {
    expect(myPhotoSlot(challenge(), habits, [], [], WEDNESDAY)).toBeNull();
    expect(myPhotoSlot(challenge({ photos: false }), habits, marks('2026-08-19'), [], WEDNESDAY)).toBeNull();
    const walking = [aMark({ habitId: 'habit-walk', dayKey: '2026-08-19' })];
    expect(myPhotoSlot(challenge(), habits, walking, [], WEDNESDAY)).toBeNull();
  });

  it('offers nothing when the user is not in it with an active habit behind it', () => {
    const today = marks('2026-08-19');

    expect(myPhotoSlot(challenge({ participantIds: ['ana'] }), habits, today, [], WEDNESDAY)).toBeNull();
    expect(myPhotoSlot(challenge({ habitId: null }), habits, today, [], WEDNESDAY)).toBeNull();
    expect(myPhotoSlot(challenge(), [aHabit({ archivedAt: 1 })], today, [], WEDNESDAY)).toBeNull();
    expect(myPhotoSlot(challenge(), [], today, [], WEDNESDAY)).toBeNull();
  });

  it('offers nothing on a challenge that is archived, upcoming or over', () => {
    const today = marks('2026-08-19');

    expect(myPhotoSlot(challenge({ archivedAt: 5 }), habits, today, [], WEDNESDAY)).toBeNull();
    expect(myPhotoSlot(challenge({ startWeekKey: '2026-08-24' }), habits, today, [], WEDNESDAY)).toBeNull();
    // Ended yesterday: the last day was marked, but the challenge is no longer running.
    expect(myPhotoSlot(challenge({ endDayKey: '2026-08-18' }), habits, marks('2026-08-18'), [], WEDNESDAY)).toBeNull();
  });

  it('does not offer yesterday on the first day when yesterday was before the start', () => {
    const monday = new Date(2026, 7, 17, 9, 0).getTime();
    const sundayMark = marks('2026-08-16');

    expect(myPhotoSlot(challenge(), habits, sundayMark, [], monday)).toBeNull();
    expect(myPhotoSlot(challenge(), habits, marks('2026-08-17'), [], monday)?.which).toBe('today');
  });
});

describe('challengeAlbum', () => {
  const participants = [
    { id: 'ana', name: 'Ana', isMe: false },
    { id: ME, name: 'Gus', isMe: true },
    { id: 'luis', name: 'Luis', isMe: false },
  ];
  /** Monday the 31st, the day after the last one: the whole challenge is behind. */
  const CLOSED = new Date(2026, 7, 31, 10, 0).getTime();

  function challengeMark(memberId: string, dayKey: string): ChallengeMark {
    return { id: `${memberId}-${dayKey}`, challengeId: 'challenge-1', memberId, dayKey, source: 'manual', markedAt: 0 };
  }

  it('puts the user first, then the participants in order, each with their photos by day', () => {
    const photos = [
      aPhoto('2026-08-20', { memberId: 'luis' }),
      aPhoto('2026-08-19'),
      aPhoto('2026-08-17'),
      aPhoto('2026-08-18', { memberId: 'ana' }),
    ];
    const others = [challengeMark('ana', '2026-08-18'), challengeMark('luis', '2026-08-20')];

    const rows = challengeAlbum(challenge(), participants, others, marks('2026-08-17', '2026-08-19'), photos, CLOSED);

    expect(rows.map((row) => row.id)).toEqual([ME, 'ana', 'luis']);
    expect(rows[0]?.photos.map((photo) => photo.dayKey)).toEqual(['2026-08-17', '2026-08-19']);
  });

  it("hides a photo on a day that is not marked, the user's by habit mark and the rest by challenge mark", () => {
    const photos = [aPhoto('2026-08-17'), aPhoto('2026-08-18', { memberId: 'ana' })];

    expect(challengeAlbum(challenge(), participants, [], [], photos, CLOSED)).toEqual([]);
    // Ana's mark on another challenge does not count here.
    const elsewhere = [{ ...challengeMark('ana', '2026-08-18'), challengeId: 'other' }];
    expect(challengeAlbum(challenge(), participants, elsewhere, [], photos, CLOSED)).toEqual([]);
  });

  it('leaves out photos of other challenges and days outside this one', () => {
    const photos = [aPhoto('2026-08-19', { challengeId: 'other' }), aPhoto('2026-08-31'), aPhoto('2026-08-16')];
    const myMarks = marks('2026-08-16', '2026-08-19', '2026-08-31');

    expect(challengeAlbum(challenge(), participants, [], myMarks, photos, CLOSED)).toEqual([]);
  });

  it('shows nothing of the user once they left: no habit, no marks to sit on', () => {
    const photos = [aPhoto('2026-08-17')];

    expect(challengeAlbum(challenge({ habitId: null }), participants, [], marks('2026-08-17'), photos, CLOSED)).toEqual([]);
  });

  it('counts up to today while the challenge still runs', () => {
    const photos = [aPhoto('2026-08-19'), aPhoto('2026-08-20')];

    const rows = challengeAlbum(challenge(), participants, [], marks('2026-08-19', '2026-08-20'), photos, WEDNESDAY);

    expect(rows[0]?.photos.map((photo) => photo.dayKey)).toEqual(['2026-08-19']);
  });
});
