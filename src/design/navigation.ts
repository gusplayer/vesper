import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

import { colors, motion } from './tokens';

/**
 * Navigation chrome lives here so screens never import tokens. Headers are drawn by
 * the screens themselves (PageHeader); the stack only fades.
 */
export const stackScreenOptions: ComponentProps<typeof Stack>['screenOptions'] = {
  headerShown: false,
  animation: 'fade',
  animationDuration: motion.fadeMs,
  contentStyle: { backgroundColor: colors.light.bg },
};

/**
 * Full-screen routes that must not be swiped away: the dark half of the session —
 * active, the exit ritual, the emergency unlock.
 */
export const lockedScreenOptions = {
  gestureEnabled: false,
  animation: 'fade' as const,
  contentStyle: { backgroundColor: colors.dark.bg },
};

/**
 * The same, for the session routes that are paper: closed and complete (ADR-0025).
 * They carry the page's own background, or a sheet of ink shows through the 160 ms
 * fade and around the safe area.
 */
export const lockedPaperScreenOptions = {
  ...lockedScreenOptions,
  contentStyle: { backgroundColor: colors.light.bg },
};
