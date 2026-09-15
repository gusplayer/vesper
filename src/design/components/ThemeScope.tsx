import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';

import { ForcedTheme } from '../theme';
import type { Scheme } from '../tokens';

type ThemeScopeProps = {
  scheme: Scheme;
  children: ReactNode;
};

/**
 * A page that ignores the app's scheme: the onboarding welcome and tour are dark
 * whatever the session is doing. Screens reach ForcedTheme through this component so
 * they never import from src/design/theme.
 *
 * The status bar follows the scope only while its screen is focused. A pushed screen
 * keeps this one mounted underneath, and a StatusBar left mounted would win over the
 * next page's.
 */
export function ThemeScope({ scheme, children }: ThemeScopeProps) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return (
    <ForcedTheme scheme={scheme}>
      {focused ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      {children}
    </ForcedTheme>
  );
}
