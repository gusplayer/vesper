import { describe, expect, it } from 'vitest';

import { DAY, HOUR, MINUTE } from '../../domain/time';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { IN_USE_WINDOW_MS, lastUseWhen, foundUseOf, welcomeChoices } from './foundUse';

const NOW = Date.UTC(2026, 8, 25, 15, 0);

describe('foundUseOf (ADR-0050 §9)', () => {
  it('is in use when another device used it within 30 days', () => {
    expect(foundUseOf(NOW - 2 * HOUR, NOW)).toEqual({ kind: 'inUse', lastSeenAt: NOW - 2 * HOUR });
    expect(foundUseOf(NOW - IN_USE_WINDOW_MS + MINUTE, NOW)).toMatchObject({ kind: 'inUse' });
  });

  it('is idle after 30 days, and when it was never seen', () => {
    expect(foundUseOf(NOW - IN_USE_WINDOW_MS, NOW)).toEqual({ kind: 'idle' });
    expect(foundUseOf(NOW - 90 * DAY, NOW)).toEqual({ kind: 'idle' });
    expect(foundUseOf(null, NOW)).toEqual({ kind: 'idle' });
  });

  it('reads a use a little in the future (a clock behind the server) as in use', () => {
    expect(foundUseOf(NOW + MINUTE, NOW)).toMatchObject({ kind: 'inUse' });
  });
});

describe('welcomeChoices', () => {
  it('offers "Traerlo aquí" and "Empezar aparte" for a Vesper in use', () => {
    expect(welcomeChoices({ kind: 'inUse', lastSeenAt: NOW })).toEqual({
      primary: 'bringHere',
      secondary: 'startApart',
      ready: true,
    });
  });

  it('offers restore and start over, which deletes, only for one nobody uses', () => {
    expect(welcomeChoices({ kind: 'idle' })).toEqual({ primary: 'restore', secondary: 'startFresh', ready: true });
  });

  it('never offers to delete a Vesper it could not check on', () => {
    expect(welcomeChoices({ kind: 'unknown' }).secondary).toBe('startApart');
    expect(welcomeChoices({ kind: 'loading' })).toEqual({ primary: 'restore', secondary: null, ready: false });
  });
});

describe('lastUseWhen', () => {
  it('says how long ago in the app\'s language', () => {
    expect(lastUseWhen(NOW - 2 * HOUR, NOW, es.identity.welcome.ago)).toBe('hace 2 horas');
    expect(lastUseWhen(NOW - 2 * HOUR, NOW, en.identity.welcome.ago)).toBe('2 hours ago');
    expect(lastUseWhen(NOW - 3 * DAY - HOUR, NOW, en.identity.welcome.ago)).toBe('3 days ago');
    expect(lastUseWhen(NOW - 30 * HOUR, NOW, es.identity.welcome.ago)).toBe('hace 1 día');
  });

  it('never says "0 minutes", and treats a future instant as a minute ago', () => {
    expect(lastUseWhen(NOW - 10_000, NOW, en.identity.welcome.ago)).toBe('1 minute ago');
    expect(lastUseWhen(NOW + MINUTE, NOW, es.identity.welcome.ago)).toBe('hace 1 minuto');
  });
});
