import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

import { color } from './tokens';

/**
 * Navigation chrome lives here so screens in src/app/ never import tokens.
 * Fade only, 120ms max, no spring or parallax — docs/adr/0006-eink-design-language.md.
 */
export const stackScreenOptions: ComponentProps<typeof Stack>['screenOptions'] = {
  headerShown: false,
  animation: 'fade',
  animationDuration: 120,
  contentStyle: { backgroundColor: color.paper },
};
