import { describe, expect, it } from 'vitest';

import { dayKeyOf, dayKeyStart, weekDayKeys } from './day';
import {
  albumRows,
  cleanCaption,
  PHOTO_CAPTION_MAX,
  PHOTO_RETENTION_DAYS_AFTER_END,
  PHOTO_RETENTION_DAYS_ROLLING,
  photoExpiresAt,
  photoSlot,
  weekPhotos,
} from './photos';
import { DAY } from './time';
import { ME, type Challenge, type ChallengePhoto } from './types';

/** Monday the 17th of August 2026 through Sunday the 30th: two weeks. */
const WEEK = '2026-08-17';
const TODAY = '2026-08-19';
const YESTERDAY = '2026-08-18';
const DAY_BEFORE = '2026-08-17';

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

function photo(overrides: Partial<ChallengePhoto> = {}): ChallengePhoto {
  const memberId = overrides.memberId ?? ME;
  const dayKey = overrides.dayKey ?? TODAY;
  return {
    id: `${memberId}-${dayKey}`,
    challengeId: 'challenge-1',
    memberId,
    dayKey,
    origin: 'camera',
    caption: null,
    width: 1280,
    height: 960,
    fullFile: `${memberId}-${dayKey}.jpg`,
    thumbFile: `${memberId}-${dayKey}.thumb.jpg`,
    takenAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

/** Everything in order: joined, running, marked, today. */
function slot(overrides: Partial<Parameters<typeof photoSlot>[0]> = {}) {
  return photoSlot({
    challenge: challenge(),
    linked: true,
    active: true,
    marked: true,
    dayKey: TODAY,
    todayKey: TODAY,
    ...overrides,
  });
}

/** A lone half of a surrogate pair anywhere in the text. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('photoSlot', () => {
  it('offers today and yesterday when they are marked', () => {
    expect(slot()).toBe('ok');
    expect(slot({ dayKey: YESTERDAY })).toBe('ok');
  });

  it('refuses the day before yesterday and any day still to come', () => {
    expect(slot({ dayKey: DAY_BEFORE })).toBe('tooOld');
    expect(slot({ dayKey: '2026-08-20' })).toBe('tooOld');
  });

  it('refuses a day without a mark: a photo never stands in for one', () => {
    expect(slot({ marked: false })).toBe('notMarked');
    expect(slot({ marked: false, dayKey: YESTERDAY })).toBe('notMarked');
  });

  it('refuses everything on a challenge made without photos, before any other reason', () => {
    const off = challenge({ photos: false });

    expect(slot({ challenge: off })).toBe('photosOff');
    expect(slot({ challenge: off, linked: false, active: false, marked: false })).toBe('photosOff');
  });

  it('refuses a challenge the user is not in with a habit behind it', () => {
    expect(slot({ linked: false })).toBe('notJoined');
    expect(slot({ linked: false, active: false })).toBe('notJoined');
  });

  it('refuses a challenge that is not running: upcoming, ended or archived', () => {
    expect(slot({ active: false })).toBe('notActive');
    expect(slot({ challenge: challenge({ archivedAt: 5 }) })).toBe('notActive');
    // The challenge-wide reason wins over the day's.
    expect(slot({ active: false, dayKey: DAY_BEFORE, marked: false })).toBe('notActive');
  });

  it('refuses yesterday when yesterday was before the challenge started', () => {
    // Starts today, Monday: Sunday's mark on the same habit is not a day of the challenge.
    const startsToday = challenge({ startWeekKey: '2026-08-24', endDayKey: '2026-09-13' });

    expect(slot({ challenge: startsToday, dayKey: '2026-08-24', todayKey: '2026-08-24' })).toBe('ok');
    expect(slot({ challenge: startsToday, dayKey: '2026-08-23', todayKey: '2026-08-24' })).toBe('notActive');
  });

  it('refuses a day after the last one even if the caller still calls it running', () => {
    const endedYesterday = challenge({ endDayKey: YESTERDAY });

    expect(slot({ challenge: endedYesterday, dayKey: YESTERDAY })).toBe('ok');
    expect(slot({ challenge: endedYesterday })).toBe('notActive');
  });

  it('keeps offering both days in a challenge with no end', () => {
    const endless = challenge({ endDayKey: null });

    expect(slot({ challenge: endless })).toBe('ok');
    expect(slot({ challenge: endless, dayKey: YESTERDAY })).toBe('ok');
  });

  it('counts yesterday by the calendar across the first of the month and of the year', () => {
    const endless = challenge({ startWeekKey: '2025-12-29', endDayKey: null });

    expect(slot({ challenge: endless, todayKey: '2026-01-01', dayKey: '2025-12-31' })).toBe('ok');
    expect(slot({ challenge: endless, todayKey: '2026-03-01', dayKey: '2026-02-28' })).toBe('ok');
    expect(slot({ challenge: endless, todayKey: '2026-03-01', dayKey: '2026-02-27' })).toBe('tooOld');
  });
});

describe('cleanCaption', () => {
  it('trims, and gives null for nothing but spaces', () => {
    expect(cleanCaption('  Pierna, por fin.  ')).toBe('Pierna, por fin.');
    expect(cleanCaption('')).toBeNull();
    expect(cleanCaption('   \n\t  \r\n ')).toBeNull();
  });

  it('turns every kind of line break into one space: a caption is one line', () => {
    expect(cleanCaption('Pierna,\npor fin.')).toBe('Pierna, por fin.');
    expect(cleanCaption('Pierna,\r\n\r\npor fin.')).toBe('Pierna, por fin.');
    expect(cleanCaption('uno dos tres\rcuatro')).toBe('uno dos tres cuatro');
  });

  it('collapses runs of spaces and tabs, and turns control characters into spaces', () => {
    expect(cleanCaption('a   b\t\tc')).toBe('a b c');
    expect(cleanCaption('a\u0000b\u0007c\u009fd')).toBe('a b c d');
    expect(cleanCaption('a  b')).toBe('a b');
  });

  it(`keeps ${PHOTO_CAPTION_MAX} characters and cuts the rest`, () => {
    expect(cleanCaption('a'.repeat(80))).toBe('a'.repeat(80));
    expect(cleanCaption('a'.repeat(81))).toBe('a'.repeat(80));
    expect(cleanCaption('a'.repeat(200))).toHaveLength(80);
  });

  it('counts after collapsing, and never leaves a space at the cut', () => {
    expect(cleanCaption(`${'a'.repeat(40)}${' '.repeat(30)}${'b'.repeat(40)}`)).toBe(
      `${'a'.repeat(40)} ${'b'.repeat(39)}`,
    );
    expect(cleanCaption(`${'a'.repeat(79)} bcd`)).toBe('a'.repeat(79));
  });

  it('counts an emoji as one character and never cuts it in half', () => {
    const cut = cleanCaption('😀'.repeat(81)) ?? '';

    expect(Array.from(cut)).toHaveLength(80);
    expect(cut).toBe('😀'.repeat(80));
    expect(LONE_SURROGATE.test(cut)).toBe(false);

    const edge = cleanCaption(`${'a'.repeat(79)}😀😀`) ?? '';
    expect(edge).toBe(`${'a'.repeat(79)}😀`);
    expect(LONE_SURROGATE.test(edge)).toBe(false);
  });

  it('drops the joiner a cut leaves dangling inside a joined emoji', () => {
    // Woman, zero-width joiner, laptop: three code points, the cut falls after the joiner.
    const cut = cleanCaption(`${'a'.repeat(78)}👩‍💻`);

    expect(cut).toBe(`${'a'.repeat(78)}👩`);
  });

  it('keeps accents whole, however they were typed', () => {
    // "é" as e + combining acute is composed first, so it counts once.
    expect(cleanCaption('é'.repeat(81))).toBe('é'.repeat(80));
    expect(cleanCaption('Mañana, otra vez: ñandú.')).toBe('Mañana, otra vez: ñandú.');
    expect(cleanCaption('ñ'.repeat(90))).toBe('ñ'.repeat(80));
  });

  it('is idempotent', () => {
    for (const text of ['  hola\n\nmundo  ', 'a'.repeat(120), '😀'.repeat(90), `${'a'.repeat(78)}👩‍💻`]) {
      const once = cleanCaption(text) ?? '';
      expect(cleanCaption(once)).toBe(once);
    }
  });
});

describe('photoExpiresAt', () => {
  it(`is the midnight after the ${PHOTO_RETENTION_DAYS_AFTER_END}th day past the last day, whenever it was taken`, () => {
    // Ends Sunday the 11th of October: the photos are there until the 25th, inclusive.
    const ended = challenge({ startWeekKey: '2026-09-21', endDayKey: '2026-10-11' });

    const early = photoExpiresAt(ended, new Date(2026, 8, 22, 9, 0).getTime());
    const late = photoExpiresAt(ended, new Date(2026, 9, 11, 23, 30).getTime());

    expect(early).toBe(dayKeyStart('2026-10-26'));
    expect(late).toBe(early);
    expect(dayKeyOf(early - 1)).toBe('2026-10-25');
  });

  it(`is the midnight after the ${PHOTO_RETENTION_DAYS_ROLLING}th day past the day it was taken, with no end`, () => {
    const endless = challenge({ endDayKey: null });
    const takenAt = new Date(2026, 7, 19, 18, 40).getTime();

    const expires = photoExpiresAt(endless, takenAt);

    expect(expires).toBe(dayKeyStart('2026-09-17'));
    expect(dayKeyOf(expires - 1)).toBe('2026-09-16');
    // Per photo: one taken the next day lives a day longer.
    expect(photoExpiresAt(endless, new Date(2026, 7, 20, 7, 0).getTime())).toBe(dayKeyStart('2026-09-18'));
  });

  it('lands on a local midnight across a DST change, where adding days of 24 h would not', () => {
    // Chile moves its clocks on the first Sunday of September and of April; the
    // `test:dst` run puts these in America/Santiago, the default run in Bogotá.
    const september = challenge({ startWeekKey: '2026-08-17', endDayKey: '2026-08-30' });
    const aprilTaken = new Date(2026, 2, 20, 12, 0).getTime();
    const endless = challenge({ endDayKey: null });

    const afterEnd = photoExpiresAt(september, 0);
    const rolling = photoExpiresAt(endless, aprilTaken);

    expect(afterEnd).toBe(dayKeyStart('2026-09-14'));
    expect(new Date(afterEnd).getHours()).toBe(0);
    expect(rolling).toBe(dayKeyStart('2026-04-18'));
    expect(new Date(rolling).getHours()).toBe(0);
    // What the naive sum would give: right in Bogotá, an hour off wherever the window
    // crosses a change. Either way the answer above is the calendar's.
    const naive = dayKeyStart('2026-08-30') + 15 * DAY;
    expect(dayKeyOf(afterEnd)).toBe('2026-09-14');
    expect(Math.abs(naive - afterEnd)).toBeLessThanOrEqual(3_600_000);
  });
});

describe('weekPhotos', () => {
  const keys = weekDayKeys(WEEK);

  it('puts each photo on its day, Monday first, and nothing on the rest', () => {
    const monday = photo({ dayKey: '2026-08-17' });
    const wednesday = photo({ dayKey: '2026-08-19' });
    const days = [true, true, true, false, false, false, false];

    expect(weekPhotos([wednesday, monday], ME, keys, days)).toEqual([monday, null, wednesday, null, null, null, null]);
  });

  it('draws no photo on a day that is not marked: kept, not drawn', () => {
    const tuesday = photo({ dayKey: '2026-08-18' });

    expect(weekPhotos([tuesday], ME, keys, [true, false, true, false, false, false, false])).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    // Marked again, it comes back.
    expect(weekPhotos([tuesday], ME, keys, [false, true, false, false, false, false, false])[1]).toBe(tuesday);
  });

  it("only draws that person's photos", () => {
    const mine = photo({ dayKey: '2026-08-19' });
    const anas = photo({ memberId: 'ana', dayKey: '2026-08-19' });
    const days = [false, false, true, false, false, false, false];

    expect(weekPhotos([mine, anas], 'ana', keys, days)[2]).toBe(anas);
    expect(weekPhotos([mine, anas], ME, keys, days)[2]).toBe(mine);
    expect(weekPhotos([anas], ME, keys, days)[2]).toBeNull();
  });

  it('is seven nulls without photos, and reads a missing flag as unmarked', () => {
    expect(weekPhotos([], ME, keys, [true, true, true, true, true, true, true])).toEqual(Array(7).fill(null));
    expect(weekPhotos([photo({ dayKey: '2026-08-23' })], ME, keys, [true])).toEqual(Array(7).fill(null));
  });
});

describe('albumRows', () => {
  const participants = [
    { id: ME, name: 'Gus', isMe: true },
    { id: 'ana', name: 'Ana', isMe: false },
    { id: 'luis', name: 'Luis', isMe: false },
  ];

  function marked(byMember: Record<string, string[]>) {
    return (memberId: string): ReadonlySet<string> => new Set(byMember[memberId] ?? []);
  }

  it('gives one row per person with photos, in the participants order, photos by day', () => {
    const photos = [
      photo({ memberId: 'luis', dayKey: '2026-08-20' }),
      photo({ dayKey: '2026-08-19' }),
      photo({ dayKey: '2026-08-17' }),
      photo({ memberId: 'luis', dayKey: '2026-08-18' }),
    ];
    const days = marked({ [ME]: ['2026-08-17', '2026-08-19'], luis: ['2026-08-18', '2026-08-20'] });

    const rows = albumRows(participants, photos, days);

    expect(rows.map((row) => row.id)).toEqual([ME, 'luis']);
    expect(rows[0]).toMatchObject({ name: 'Gus', isMe: true });
    expect(rows[0]?.photos.map((p) => p.dayKey)).toEqual(['2026-08-17', '2026-08-19']);
    expect(rows[1]?.photos.map((p) => p.dayKey)).toEqual(['2026-08-18', '2026-08-20']);
  });

  it('leaves out a photo on an unmarked day, and a person whose photos are all hidden', () => {
    const photos = [photo({ dayKey: '2026-08-17' }), photo({ dayKey: '2026-08-18' }), photo({ memberId: 'ana', dayKey: '2026-08-19' })];

    const rows = albumRows(participants, photos, marked({ [ME]: ['2026-08-18'] }));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.photos.map((p) => p.dayKey)).toEqual(['2026-08-18']);
  });

  it('is empty without photos, and ignores photos of someone who is not a participant', () => {
    expect(albumRows(participants, [], marked({ [ME]: ['2026-08-18'] }))).toEqual([]);
    expect(albumRows(participants, [photo({ memberId: 'sofia', dayKey: '2026-08-18' })], marked({ sofia: ['2026-08-18'] }))).toEqual([]);
  });

  it('follows whatever order it is given', () => {
    const photos = [photo({ dayKey: '2026-08-18' }), photo({ memberId: 'ana', dayKey: '2026-08-18' })];
    const reversed = [...participants].reverse();

    const rows = albumRows(reversed, photos, marked({ [ME]: ['2026-08-18'], ana: ['2026-08-18'] }));

    expect(rows.map((row) => row.id)).toEqual(['ana', ME]);
  });
});
