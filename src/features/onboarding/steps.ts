/**
 * The light steps of the onboarding, in the order of ADR-0016, for the dots in their
 * header. Welcome and the tour are dark pages of their own and are not counted; the
 * Android disclosure (`usage-access`) belongs to the Screen Time step. Pure, so it is
 * tested.
 */
export const LIGHT_STEPS = [
  'goal',
  'screen-time',
  'health',
  'apps',
  'routine',
  'routine-set',
  'notifications',
] as const;

export type LightStep = (typeof LIGHT_STEPS)[number];

export type StepProgress = { count: number; index: number; accessibilityLabel: string };

/** `PageHeader`'s `progress` for a step: where it is, and 'Paso 2 de 7' for VoiceOver. */
export function stepProgress(step: LightStep, label: (step: number, total: number) => string): StepProgress {
  const index = LIGHT_STEPS.indexOf(step);
  return { count: LIGHT_STEPS.length, index, accessibilityLabel: label(index + 1, LIGHT_STEPS.length) };
}
