import { describe, expect, it } from 'vitest';

import { MINUTE } from '../../domain/time';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { shieldLineText } from './shieldText';

const summary = (overrides = {}) => ({
  attempts: 4,
  backs: 2,
  breaks: 2,
  breakMs: 20 * MINUTE,
  floor: false,
  byApp: [],
  ...overrides,
});

describe('shieldLineText', () => {
  it('says the attempts and the breaks with what they took', () => {
    expect(shieldLineText(summary(), es.activity.shield)).toBe('4 intentos · 2 pausas, 20m');
    expect(shieldLineText(summary(), en.activity.shield)).toBe('4 attempts · 2 breaks, 20m');
  });

  it('speaks in the singular, and leaves the breaks out when there were none', () => {
    expect(shieldLineText(summary({ attempts: 1, breaks: 1, breakMs: 5 * MINUTE }), es.activity.shield)).toBe(
      '1 intento · 1 pausa, 5m',
    );
    expect(shieldLineText(summary({ attempts: 3, breaks: 0, breakMs: 0 }), es.activity.shield)).toBe('3 intentos');
  });

  it('says it is a floor where only taps are counted', () => {
    expect(shieldLineText(summary({ attempts: 3, breaks: 0, breakMs: 0, floor: true }), es.activity.shield)).toBe(
      'al menos 3 intentos',
    );
  });

  it('says nothing when the shield saw nothing', () => {
    expect(shieldLineText(summary({ attempts: 0, breaks: 0, breakMs: 0 }), es.activity.shield)).toBeNull();
    expect(shieldLineText(null, es.activity.shield)).toBeNull();
  });
});
