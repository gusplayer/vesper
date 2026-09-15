import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { create } from 'zustand';

import { colors, type Colors, type Scheme } from './tokens';

/**
 * The active scheme. Light is the page; dark is the active session. Stored outside
 * React so the session store can flip it without a provider chain.
 */
export const useSchemeStore = create<{ scheme: Scheme; setScheme: (scheme: Scheme) => void }>(
  (set) => ({
    scheme: 'light',
    setScheme: (scheme) => set({ scheme }),
  }),
);

export type Theme = {
  scheme: Scheme;
  colors: Colors;
};

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: colors.light });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useSchemeStore((state) => state.scheme);
  const value = useMemo<Theme>(() => ({ scheme, colors: colors[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** A subtree rendered in a fixed scheme, whatever the app is doing. */
export function ForcedTheme({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  const value = useMemo<Theme>(() => ({ scheme, colors: colors[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Styles that depend on the theme. The factory runs once per scheme change.
 *
 *   const styles = useStyles((c) => ({ box: { backgroundColor: c.card } }));
 */
export function useStyles<T extends Record<string, object>>(factory: (colors: Colors) => T): T {
  const { colors: current } = useTheme();
  return useMemo(() => factory(current), [current, factory]);
}
