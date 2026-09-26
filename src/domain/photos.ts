import { dayKeyStart, dayStartShifted, shiftDayKey } from './day';
import type { Challenge, ChallengePhoto, DayKey, Millis } from './types';

/**
 * Photos in challenges (ADR-0051): the rules a photo lives by, pure. A photo is pinned to
 * one marked day of one challenge, one per person and day, for today or yesterday only.
 * It is testimony and never verification: nothing here reads or changes a mark, and a
 * photo on a day that is no longer marked is kept but not drawn.
 */

/** A caption fits in two lines of the viewer. The session's intention has 120; this is less. */
export const PHOTO_CAPTION_MAX = 80;

/** On the server, days after the last day of a challenge (tanda 2, ADR-0051 §12). */
export const PHOTO_RETENTION_DAYS_AFTER_END = 14;

/** On the server, days per photo in a challenge with no end (tanda 2, ADR-0051 §12). */
export const PHOTO_RETENTION_DAYS_ROLLING = 28;

/**
 * Whether the user can add (or replace) their photo on a day, and if not, why:
 *
 * - `photosOff`: the challenge was made without "Fotos del día".
 * - `notJoined`: the user is not in it with a habit of theirs behind it.
 * - `notActive`: the challenge has not started, has ended or was archived, or the day
 *   is not one of its days (the day before it started, the day after it ended).
 * - `tooOld`: the day is neither today nor yesterday (a day still to come answers this
 *   too). Two days are enough for forgetting, not for rebuilding the week on Sunday.
 * - `notMarked`: the day has no mark. A photo never stands in for one.
 */
export type PhotoSlot = 'ok' | 'photosOff' | 'notJoined' | 'notMarked' | 'tooOld' | 'notActive';

/**
 * Whether the user can add (or replace) their photo on `dayKey`: today or yesterday,
 * marked, joined, active, photos on. The challenge-wide reasons come first, the day's
 * after them, so the screen can say the one that matters.
 *
 * `linked` is "in it with an active habit behind it" and `active` is "running today and
 * not archived": the caller knows the habits and the status, this function the rules.
 */
export function photoSlot(input: {
  challenge: Challenge;
  linked: boolean;
  active: boolean;
  marked: boolean;
  dayKey: DayKey;
  todayKey: DayKey;
}): PhotoSlot {
  const { challenge, linked, active, marked, dayKey, todayKey } = input;
  if (!challenge.photos) {
    return 'photosOff';
  }
  if (!linked) {
    return 'notJoined';
  }
  if (!active || challenge.archivedAt !== null) {
    return 'notActive';
  }
  if (dayKey !== todayKey && dayKey !== shiftDayKey(todayKey, -1)) {
    return 'tooOld';
  }
  if (!insideChallenge(challenge, dayKey)) {
    return 'notActive';
  }
  if (!marked) {
    return 'notMarked';
  }
  return 'ok';
}

/** From the start Monday to the last day, both included; open-ended without a last day. */
function insideChallenge(challenge: Challenge, dayKey: DayKey): boolean {
  if (dayKey < challenge.startWeekKey) {
    return false;
  }
  return challenge.endDayKey === null || dayKey <= challenge.endDayKey;
}

/** C0 and C1 control characters: never part of a line someone wrote. */
function isControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || (code >= 0x7f && code < 0xa0);
}

const ZERO_WIDTH_JOINER = '‍';

/**
 * Trims, turns line breaks into spaces, collapses spaces, cuts to PHOTO_CAPTION_MAX; ''
 * → null. The limit counts characters as a person does, code points and not UTF-16
 * units, and the text is composed first (NFC), so an accent typed as two code points
 * counts as one and an emoji is never cut in half at a surrogate pair. A cut that lands
 * inside a joined emoji keeps the part before it and drops the dangling joiner.
 * Idempotent: cleaning a clean caption gives it back.
 */
export function cleanCaption(text: string): string | null {
  const flat = Array.from(text.normalize('NFC'), (char) => (isControl(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  let cut = Array.from(flat).slice(0, PHOTO_CAPTION_MAX).join('');
  while (cut.endsWith(ZERO_WIDTH_JOINER)) {
    cut = cut.slice(0, -ZERO_WIDTH_JOINER.length);
  }
  cut = cut.trimEnd();
  return cut === '' ? null : cut;
}

/**
 * When the server forgets a photo (tanda 2, ADR-0051 §12): 14 days after the last day of
 * the challenge, or, in a challenge with no end, 28 days after the day it was taken.
 *
 * Always a local midnight, the one that ends the last day it is kept, so a screen can
 * name that day as a date ("hasta el 25 de octubre": the day before this instant) and
 * never as a countdown. Calendar days, never `n * DAY`: a DST change inside the window
 * would move the instant by an hour and, at midnight, onto the wrong day.
 */
export function photoExpiresAt(challenge: Challenge, takenAt: Millis): Millis {
  if (challenge.endDayKey !== null) {
    return dayKeyStart(shiftDayKey(challenge.endDayKey, PHOTO_RETENTION_DAYS_AFTER_END + 1));
  }
  return dayStartShifted(takenAt, PHOTO_RETENTION_DAYS_ROLLING + 1);
}

/**
 * The photos one person's week row draws, one slot per day, Monday first like
 * `Standing.days`: the photo of that day when the day is marked, null otherwise. A photo
 * on a day without a mark is kept and not drawn (ADR-0051 §2); marking the day again
 * brings it back. `photos` are the photos of one challenge.
 */
export function weekPhotos(
  photos: readonly ChallengePhoto[],
  memberId: string,
  weekDayKeys: readonly DayKey[],
  days: readonly boolean[],
): (ChallengePhoto | null)[] {
  return weekDayKeys.map((dayKey, index) =>
    days[index] === true
      ? (photos.find((photo) => photo.memberId === memberId && photo.dayKey === dayKey) ?? null)
      : null,
  );
}

export type AlbumRow = { id: string; name: string; isMe: boolean; photos: ChallengePhoto[] };

/**
 * The album at the close (ADR-0051 §7): one row per person that has photos, in the
 * participants' order, their photos by day. Only photos on marked days, like the grid;
 * a person whose photos are all on unmarked days has no row. Nothing counts how many
 * each one has. `photos` are the photos of one challenge.
 */
export function albumRows(
  participants: readonly { id: string; name: string; isMe: boolean }[],
  photos: readonly ChallengePhoto[],
  markedDays: (memberId: string) => ReadonlySet<DayKey>,
): AlbumRow[] {
  const rows: AlbumRow[] = [];
  for (const participant of participants) {
    const marked = markedDays(participant.id);
    const theirs = photos
      .filter((photo) => photo.memberId === participant.id && marked.has(photo.dayKey))
      .sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0));
    if (theirs.length > 0) {
      rows.push({ id: participant.id, name: participant.name, isMe: participant.isMe, photos: theirs });
    }
  }
  return rows;
}
