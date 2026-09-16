import { en } from './en';
import { es, type Strings } from './es';
import type { Locale } from './locale';
import { useLocaleStore } from './store';

/**
 * How text reaches the UI (ADR-0020).
 *
 * - Screens and feature components: `const t = useStrings()`.
 * - Stores, platform modules and anything outside React: `getStrings()`.
 * - `src/domain/` never imports this file: it receives the dictionary, or the slice it
 *   needs, as a parameter. Tests pass `es` or `en` from `src/i18n/es` and `src/i18n/en`.
 */

export type { Strings } from './es';
export type { LanguagePreference, Locale } from './locale';
export { LANGUAGE_PREFERENCES } from './locale';
export { useLocaleStore } from './store';

export const STRINGS: Record<Locale, Strings> = { es, en };

export function stringsFor(locale: Locale): Strings {
  return STRINGS[locale];
}

/** The dictionary for the current language. Re-renders when the language changes. */
export function useStrings(): Strings {
  const locale = useLocaleStore((state) => state.locale);
  return STRINGS[locale];
}

/** The current language and the Intl tag to format dates and numbers with. */
export function useLocale(): { locale: Locale; tag: string } {
  const locale = useLocaleStore((state) => state.locale);
  const tag = useLocaleStore((state) => state.tag);
  return { locale, tag };
}

/** For code outside React. Reads the store once; do not cache the result across renders. */
export function getStrings(): Strings {
  return STRINGS[useLocaleStore.getState().locale];
}

export function getLocaleTag(): string {
  return useLocaleStore.getState().tag;
}
