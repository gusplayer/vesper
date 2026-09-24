import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { challengeConsentText, standingSourceText } from './challengeText';

describe('challengeConsentText', () => {
  it('names the step goal and says the count stays on the phone', () => {
    expect(challengeConsentText('Caminar 10.000 pasos', es.circle, 'es-ES')).toBe(
      'Tu círculo verá qué días llegaste a 10.000 pasos. No verá cuántos.',
    );
    expect(challengeConsentText('Walk', en.circle, 'en-US')).toBe(
      'Your circle will see which days you reached 8,000 steps. Not how many.',
    );
  });

  it('keeps it general for workouts and sleep', () => {
    expect(challengeConsentText('gym', es.circle, 'es-ES')).toBe(
      'Tu círculo verá qué días cumpliste. No verá tus datos de Salud.',
    );
  });

  it('says nothing where nothing verifies the challenge', () => {
    expect(challengeConsentText('Leer', es.circle, 'es-ES')).toBeNull();
  });
});

describe('standingSourceText', () => {
  it('says how a week was counted, or nothing without marks', () => {
    expect(standingSourceText('health', es.circle)).toBe('con Salud');
    expect(standingSourceText('manual', en.circle)).toBe('marked by hand');
    expect(standingSourceText(null, es.circle)).toBeNull();
  });
});
