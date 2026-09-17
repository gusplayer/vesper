/**
 * Which language the app speaks, decided from the user's preference and the phone's
 * languages. Pure and tested; the device read lives in `device.ts` (ADR-0020).
 */

export type Locale = 'es' | 'en';

/** What the user chose in Ajustes › Idioma. `auto` follows the phone. */
export type LanguagePreference = 'auto' | Locale;

export const LOCALES: readonly Locale[] = ['es', 'en'];

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ['auto', 'es', 'en'];

/**
 * A phone in any language the app does not have opens in English: it is the language
 * most people read as a second one. Spanish is the project's language, not the fallback.
 */
export const FALLBACK_LOCALE: Locale = 'en';

/** The BCP 47 tag used for Intl when the phone's region says nothing useful. */
export const DEFAULT_TAG: Record<Locale, string> = {
  es: 'es-CO',
  en: 'en-US',
};

/** One entry of what the phone reports. Mirrors the fields of expo-localization we use. */
export type DeviceLocale = {
  /** 'es', 'en', 'pt'... Null when the OS could not say. */
  languageCode: string | null;
  /** 'es-CO', 'en-GB'. */
  languageTag: string;
};

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === 'string' && (LANGUAGE_PREFERENCES as readonly string[]).includes(value);
}

function languageOf(device: DeviceLocale): string | null {
  const code = device.languageCode ?? device.languageTag.split('-')[0] ?? null;
  return code === null || code === '' ? null : code.toLowerCase();
}

/**
 * The locale to render with. A manual preference wins; `auto` walks the phone's
 * languages in order and takes the first one the app has.
 */
export function resolveLocale(preference: LanguagePreference, devices: readonly DeviceLocale[]): Locale {
  if (preference !== 'auto') {
    return preference;
  }
  for (const device of devices) {
    const language = languageOf(device);
    if (language !== null && isLocale(language)) {
      return language;
    }
  }
  return FALLBACK_LOCALE;
}

/**
 * The tag Intl formats dates and numbers with. The phone's region is kept when its
 * language is the one being rendered (en-GB stays British); otherwise the default.
 */
export function resolveTag(locale: Locale, devices: readonly DeviceLocale[]): string {
  const match = devices.find((device) => languageOf(device) === locale);
  return match?.languageTag ?? DEFAULT_TAG[locale];
}
