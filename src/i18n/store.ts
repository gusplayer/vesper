import { create } from 'zustand';

import * as settingsRepo from '../db/repositories/settings';
import { setClockLocale } from '../lib/format';
import { readDeviceLocales } from './device';
import { isLanguagePreference, resolveLocale, resolveTag, type LanguagePreference, type Locale } from './locale';

/**
 * The language the app renders in, as ephemeral UI state backed by the settings table
 * (ADR-0020). Hydrated at boot with the rest of the stores; changing the preference
 * from Ajustes › Idioma writes through the repository and re-renders everything that
 * reads `useStrings()`.
 */

type LocaleState = {
  preference: LanguagePreference;
  locale: Locale;
  /** BCP 47 tag for Intl: dates and numbers. */
  tag: string;

  /** Reads the stored preference and the phone's languages. Sync, like the other stores. */
  hydrate: () => void;
  setPreference: (preference: LanguagePreference, now: number) => void;
};

function resolve(preference: LanguagePreference): Pick<LocaleState, 'preference' | 'locale' | 'tag'> {
  const devices = readDeviceLocales();
  const locale = resolveLocale(preference, devices);
  const tag = resolveTag(locale, devices);
  // Clock times follow the language like everything else: 12 h in English, 24 h in
  // Spanish (lib/format). Set here so every `clockText(at)` picks it up with no param.
  setClockLocale(tag);
  return { preference, locale, tag };
}

/**
 * The strings a fresh database is seeded with. There is no stored preference on a
 * first boot (nor after "Borrar todo y reiniciar"), so the phone decides; the demo
 * data becomes the user's from then on and does not follow later language changes.
 */
export function freshInstallLocale(): Locale {
  return resolveLocale('auto', readDeviceLocales());
}

export const useLocaleStore = create<LocaleState>((set) => ({
  ...resolve('auto'),

  hydrate: () => {
    const stored = settingsRepo.get(settingsRepo.SETTING_KEYS.language);
    set(resolve(isLanguagePreference(stored) ? stored : 'auto'));
  },

  setPreference: (preference, now) => {
    settingsRepo.set(settingsRepo.SETTING_KEYS.language, preference, now);
    set(resolve(preference));
  },
}));
