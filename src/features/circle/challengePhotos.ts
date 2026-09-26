import { dayKeyStart, weekKeyOf } from '../../domain/day';
import type { Challenge, ChallengePhoto, DayKey, MarkSource } from '../../domain/types';
import type { Strings } from '../../i18n';
import { clockText } from '../../lib/format';

type PhotoStrings = Strings['photos'];

/**
 * The week a challenge's page draws, the same one `useChallengeStandings` reads: this
 * week while it runs, its first before it starts, its last once it is over. The photos
 * in the grid have to sit on the days the marks sit on.
 */
export function shownWeekKey(challenge: Pick<Challenge, 'startWeekKey' | 'endDayKey'>, now: number): DayKey {
  const current = weekKeyOf(now);
  if (current < challenge.startWeekKey) {
    return challenge.startWeekKey;
  }
  const last = challenge.endDayKey === null ? null : weekKeyOf(dayKeyStart(challenge.endDayKey));
  return last !== null && current > last ? last : current;
}

function spanish(tag: string): boolean {
  return tag.toLowerCase().startsWith('es');
}

/**
 * The day a photo belongs to: 'martes 24' in Spanish, 'Tuesday, September 24' in
 * English. Spanish reads in lowercase, like `dayText`; English keeps its capitals.
 */
export function photoDayText(dayKey: DayKey, tag: string, t: PhotoStrings): string {
  const date = new Date(dayKeyStart(dayKey));
  const weekday = date.toLocaleDateString(tag, { weekday: 'long' });
  const month = date.toLocaleDateString(tag, { month: 'long' });
  return spanish(tag)
    ? t.day(weekday.toLowerCase(), date.getDate(), month.toLowerCase())
    : t.day(weekday, date.getDate(), month);
}

/** The day of the month, under a thumbnail of the album: '24'. */
export function photoDayNumber(dayKey: DayKey): string {
  return String(new Date(dayKeyStart(dayKey)).getDate());
}

/**
 * Where the photo came from, said quietly in the viewer and nowhere else (ADR-0051
 * §4): 'Con la cámara · 18:40' — the moment it was added, which with the camera is
 * the moment it was taken — or 'De la galería', with no time, because the library
 * cannot say when and the metadata is never read to guess.
 */
export function photoOriginText(
  photo: Pick<ChallengePhoto, 'origin' | 'takenAt'>,
  tag: string,
  t: PhotoStrings,
): string {
  return photo.origin === 'camera' ? t.viewer.fromCamera(clockText(photo.takenAt, tag)) : t.viewer.fromLibrary;
}

/** How the day's mark was counted, as a line of the viewer. Null when the day has no mark. */
export function photoMarkText(source: MarkSource | null, t: PhotoStrings): string | null {
  return source === null ? null : t.viewer.markSource[source];
}
