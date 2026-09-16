import { describe, expect, it } from 'vitest';

import { isLanguagePreference, resolveLocale, resolveTag, type DeviceLocale } from './locale';

const spanishColombia: DeviceLocale = { languageCode: 'es', languageTag: 'es-CO' };
const englishUk: DeviceLocale = { languageCode: 'en', languageTag: 'en-GB' };
const french: DeviceLocale = { languageCode: 'fr', languageTag: 'fr-FR' };

describe('resolveLocale', () => {
  it('follows the phone when the preference is auto', () => {
    expect(resolveLocale('auto', [spanishColombia])).toBe('es');
    expect(resolveLocale('auto', [englishUk])).toBe('en');
  });

  it('takes the first language the app has, in the phone order', () => {
    expect(resolveLocale('auto', [french, spanishColombia, englishUk])).toBe('es');
    expect(resolveLocale('auto', [french, englishUk, spanishColombia])).toBe('en');
  });

  it('falls back to English for a phone in a language the app lacks', () => {
    expect(resolveLocale('auto', [french])).toBe('en');
    expect(resolveLocale('auto', [])).toBe('en');
  });

  it('lets a manual preference win over the phone', () => {
    expect(resolveLocale('en', [spanishColombia])).toBe('en');
    expect(resolveLocale('es', [englishUk])).toBe('es');
  });

  it('reads the language from the tag when the code is missing', () => {
    expect(resolveLocale('auto', [{ languageCode: null, languageTag: 'ES-mx' }])).toBe('es');
  });
});

describe('resolveTag', () => {
  it('keeps the phone region when its language is the one rendered', () => {
    expect(resolveTag('en', [spanishColombia, englishUk])).toBe('en-GB');
    expect(resolveTag('es', [spanishColombia, englishUk])).toBe('es-CO');
  });

  it('uses the default tag when the phone speaks something else', () => {
    expect(resolveTag('en', [spanishColombia])).toBe('en-US');
    expect(resolveTag('es', [french])).toBe('es-CO');
  });
});

describe('isLanguagePreference', () => {
  it('accepts only the three stored values', () => {
    expect(isLanguagePreference('auto')).toBe(true);
    expect(isLanguagePreference('es')).toBe(true);
    expect(isLanguagePreference('en')).toBe(true);
    expect(isLanguagePreference('fr')).toBe(false);
    expect(isLanguagePreference(null)).toBe(false);
  });
});
