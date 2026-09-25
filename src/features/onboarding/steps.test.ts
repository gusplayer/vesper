import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { LIGHT_STEPS, stepProgress } from './steps';

describe('stepProgress', () => {
  it('counts the seven light steps, the permission before the apps (ADR-0016)', () => {
    expect(LIGHT_STEPS.indexOf('screen-time')).toBeLessThan(LIGHT_STEPS.indexOf('apps'));
    expect(stepProgress('goal', es.onboarding.progress)).toEqual({
      count: 7,
      index: 0,
      accessibilityLabel: 'Paso 1 de 7',
    });
  });

  it('says where the step is in both languages', () => {
    expect(stepProgress('notifications', es.onboarding.progress).accessibilityLabel).toBe('Paso 7 de 7');
    expect(stepProgress('apps', en.onboarding.progress).accessibilityLabel).toBe('Step 4 of 7');
  });
});
