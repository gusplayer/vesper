import { createContext, useContext, type ReactNode } from 'react';

/**
 * The few words the design system's own chrome needs: the back and close buttons of
 * PageHeader and Sheet, the clear and cancel of SearchField, the dismiss of Banner.
 * Components never import the dictionary (ADR-0020); the root layout hands these in
 * once, from `useStrings().common`, and every component reads them from here.
 *
 * Without a provider the labels are undefined: VoiceOver falls back to the icon name.
 * Nothing in the design layer writes a word of its own.
 */
export type ChromeStrings = {
  back: string;
  close: string;
  cancel: string;
  clear: string;
  dismiss: string;
};

const ChromeContext = createContext<ChromeStrings | null>(null);

export function ChromeProvider({ strings, children }: { strings: ChromeStrings; children: ReactNode }) {
  return <ChromeContext.Provider value={strings}>{children}</ChromeContext.Provider>;
}

export function useChrome(): Partial<ChromeStrings> {
  return useContext(ChromeContext) ?? {};
}
