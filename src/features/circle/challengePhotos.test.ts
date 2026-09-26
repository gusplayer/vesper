import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { photoDayNumber, photoDayText, photoMarkText, photoOriginText, shownWeekKey } from './challengePhotos';

/** Local time, like the app: 2026-09-22 is a Tuesday. */
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('shownWeekKey', () => {
  const challenge = { startWeekKey: '2026-09-07', endDayKey: '2026-09-27' };

  it('is this week while the challenge runs', () => {
    expect(shownWeekKey(challenge, at(2026, 9, 23))).toBe('2026-09-21');
  });

  it('is the first week before it starts, and the last once it is over', () => {
    expect(shownWeekKey(challenge, at(2026, 9, 2))).toBe('2026-09-07');
    expect(shownWeekKey(challenge, at(2026, 10, 8))).toBe('2026-09-21');
  });

  it('follows the calendar forever in a challenge with no end', () => {
    expect(shownWeekKey({ startWeekKey: '2026-09-07', endDayKey: null }, at(2026, 12, 2))).toBe('2026-11-30');
  });
});

describe('photoDayText', () => {
  it('says the weekday and the day in each language', () => {
    expect(photoDayText('2026-09-22', 'es-CO', es.photos)).toBe('martes 22');
    expect(photoDayText('2026-09-22', 'en-US', en.photos)).toBe('Tuesday, September 22');
  });

  it('reads as the viewer line', () => {
    expect(es.photos.viewer.whoDay(es.circle.member.me, photoDayText('2026-09-24', 'es-ES', es.photos))).toBe(
      'Tú · jueves 24',
    );
  });
});

describe('photoDayNumber', () => {
  it('is the day of the month, no leading zero', () => {
    expect(photoDayNumber('2026-09-04')).toBe('4');
    expect(photoDayNumber('2026-09-24')).toBe('24');
  });
});

describe('photoOriginText', () => {
  it('gives the time only for the camera', () => {
    expect(photoOriginText({ origin: 'camera', takenAt: at(2026, 9, 22, 18, 40) }, 'es-CO', es.photos)).toBe(
      'Con la cámara · 18:40',
    );
    expect(photoOriginText({ origin: 'camera', takenAt: at(2026, 9, 22, 18, 40) }, 'en-US', en.photos)).toBe(
      'With the camera · 6:40 PM',
    );
    expect(photoOriginText({ origin: 'library', takenAt: at(2026, 9, 22, 18, 40) }, 'es-CO', es.photos)).toBe(
      'De la galería',
    );
  });
});

describe('photoMarkText', () => {
  it('says how the mark was counted, or nothing without one', () => {
    expect(photoMarkText('health', es.photos)).toBe('Marcado con Salud');
    expect(photoMarkText('manual', en.photos)).toBe('Marked by hand');
    expect(photoMarkText(null, es.photos)).toBeNull();
  });
});
