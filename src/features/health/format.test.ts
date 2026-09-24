import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { stepGoalText, syncedText } from './format';

function at(hour: number, minute: number): number {
  return new Date(2026, 7, 19, hour, minute).getTime();
}

describe('syncedText', () => {
  it('says when, or that it never happened', () => {
    expect(syncedText(at(14, 30), es.habits)).toBe('sincronizado 14:30');
    expect(syncedText(null, es.habits)).toBe('sin sincronizar');
  });

  it('says it in English with the English dictionary', () => {
    expect(syncedText(at(14, 30), en.habits)).toBe('synced 14:30');
    expect(syncedText(null, en.habits)).toBe('not synced');
  });
});

describe('stepGoalText', () => {
  it('says the goal a steps habit counts against, in the language and its digits', () => {
    expect(stepGoalText('Caminar 10.000 pasos', es.habits.form, 'es-ES')).toBe(
      'Cuenta los días con 10.000 pasos o más',
    );
    expect(stepGoalText('Walk 10k steps', en.habits.form, 'en-US')).toBe('Counts the days with 10,000 steps or more');
  });

  it('says the default when the name has no number', () => {
    expect(stepGoalText('caminar', en.habits.form, 'en-US')).toBe('Counts the days with 8,000 steps or more');
  });

  it('says nothing for a habit that is not steps', () => {
    expect(stepGoalText('dormir 7h', es.habits.form, 'es-ES')).toBeNull();
    expect(stepGoalText('leer', es.habits.form, 'es-ES')).toBeNull();
  });
});
