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

/** Full-screen routes that must not be swiped away: the session. */
export const lockedScreenOptions = {
  gestureEnabled: false,
  animation: 'fade' as const,
  contentStyle: { backgroundColor: colors.dark.bg },
};
