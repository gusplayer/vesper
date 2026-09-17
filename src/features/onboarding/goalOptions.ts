import type { Strings } from '../../i18n/es';

/** A key under `t.onboarding.goal.options`. */
export type GoalOptionLabel = keyof Strings['onboarding']['goal']['options'];

/**
 * The five answers to "What is your first mode for?", each pointing at a MODE_IDEAS
 * entry and at the dictionary key that names it. The order is the one Brick shows,
 * not the order of the seed.
 */
export const GOAL_OPTIONS: readonly { ideaId: string; label: GoalOptionLabel }[] = [
  { ideaId: 'idea-work', label: 'work' },
  { ideaId: 'idea-mindfulness', label: 'mindfulness' },
  { ideaId: 'idea-family', label: 'family' },
  { ideaId: 'idea-sleep', label: 'sleep' },
  { ideaId: 'idea-no-socials', label: 'noSocials' },
];
