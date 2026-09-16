import { describe, expect, it } from 'vitest';

import { demoModeIdeas } from '../../data/seed';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { GOAL_OPTIONS } from './goalOptions';

describe('GOAL_OPTIONS', () => {
  it('points every answer at an existing mode idea, once', () => {
    const ideaIds = new Set(demoModeIdeas(es.demo).map((idea) => idea.id));
    for (const option of GOAL_OPTIONS) {
      expect(ideaIds.has(option.ideaId)).toBe(true);
    }
    expect(new Set(GOAL_OPTIONS.map((option) => option.ideaId)).size).toBe(GOAL_OPTIONS.length);
  });

  it('names every answer in both languages', () => {
    for (const option of GOAL_OPTIONS) {
      const spanish = es.onboarding.goal.options[option.label];
      const english = en.onboarding.goal.options[option.label];
      expect(spanish.length).toBeGreaterThan(0);
      expect(english.length).toBeGreaterThan(0);
      expect(english).not.toBe(spanish);
    }
    expect(es.onboarding.goal.options.work).toBe('Enfocarme en el trabajo');
    expect(en.onboarding.goal.options.work).toBe('Focus on work');
  });
});
