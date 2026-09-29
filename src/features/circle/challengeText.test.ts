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

  it('keeps it general for sleep', () => {
    expect(challengeConsentText('Dormir 7h', es.circle, 'es-ES')).toBe(
      'Tu círculo verá qué días cumpliste. No verá tus datos de Salud.',
    );
  });

  it('names the kind of a workout and what stays out of sight (ADR-0055)', () => {
    expect(challengeConsentText('gym', es.circle, 'es-ES')).toBe(
      'Tu círculo verá qué días entrenaste. No verá qué hiciste, cuánto ni dónde.',
    );
    expect(challengeConsentText('Rodar juntos', es.circle, 'es-ES')).toBe(
      'Tu círculo verá qué días montaste en bici. No verá distancia, tiempo ni ruta.',
    );
    expect(challengeConsentText('Correr', es.circle, 'es-ES')).toBe(
      'Tu círculo verá qué días corriste. No verá distancia, ritmo ni ruta.',
    );
    expect(challengeConsentText('Nadar', es.circle, 'es-ES')).toBe('Tu círculo verá qué días nadaste. No verá cuánto ni dónde.');
    expect(challengeConsentText('Ride a bike', en.circle, 'en-US')).toBe(
      'Your circle will see which days you rode. Not the distance, the time or the route.',
    );
  });

  it('says the user marks a workout challenge where Health does not exist, whatever its kind', () => {
    expect(challengeConsentText('Montar en bici', es.circle, 'es-ES', 'Salud no existe en este teléfono')).toBe(
      'Salud no existe en este teléfono: el reto lo marcas tú, y tu círculo verá qué días marcaste.',
    );
  });

  it('says the user marks it where Health does not exist, and why (rule 8)', () => {
    expect(challengeConsentText('Caminar 10.000 pasos', es.circle, 'es-ES', 'Salud no existe en este teléfono')).toBe(
      'Salud no existe en este teléfono: el reto lo marcas tú, y tu círculo verá qué días marcaste.',
    );
    expect(challengeConsentText('Leer', es.circle, 'es-ES', 'Salud no existe en este teléfono')).toBeNull();
  });

  it('says nothing where nothing verifies the challenge', () => {
    expect(challengeConsentText('Leer', es.circle, 'es-ES')).toBeNull();
  });
});

describe('challenge.summary', () => {
  it('says a target of one in the singular (ADR-0055)', () => {
    expect(es.circle.challenge.summary(1, '4 semanas')).toBe('1 vez por semana · 4 semanas');
    expect(es.circle.challenge.summary(2, '21 días')).toBe('2 veces por semana · 21 días');
    expect(en.circle.challenge.summary(1, '4 weeks')).toBe('1 time a week · 4 weeks');
    expect(en.circle.challenge.summary(3, '21 days')).toBe('3 times a week · 21 days');
  });
});

describe('standingSourceText', () => {
  it('says how a week was counted, or nothing without marks', () => {
    expect(standingSourceText('health', es.circle)).toBe('con Salud');
    expect(standingSourceText('manual', en.circle)).toBe('marked by hand');
    expect(standingSourceText(null, es.circle)).toBeNull();
  });
});
