import { describe, expect, it } from 'vitest';

import { en } from '../i18n/en';
import { es } from '../i18n/es';
import {
  COUNTRIES,
  COUNTRY_CODES,
  countryName,
  DEFAULT_LIFE_EXPECTANCY_YEARS,
  expectancySourceText,
  findCountry,
  resolveExpectancy,
  yearsText,
} from './lifeExpectancy';

const ES = es.settings.lifeExpectancy;
const EN = en.settings.lifeExpectancy;
const ES_TAG = 'es-CO';
const EN_TAG = 'en-US';

describe('resolveExpectancy', () => {
  it('falls back to the reference figure with nothing known', () => {
    expect(resolveExpectancy(null, null)).toEqual({
      years: DEFAULT_LIFE_EXPECTANCY_YEARS,
      source: 'default',
      countryCode: null,
    });
  });

  it('ignores sex without a country: sex alone says nothing usable', () => {
    expect(resolveExpectancy(null, 'female').source).toBe('default');
  });

  it('averages both sexes when only the country is known', () => {
    const resolved = resolveExpectancy('CO', null);
    expect(resolved.source).toBe('country');
    expect(resolved.years).toBe(76.4);
    expect(resolved.countryCode).toBe('CO');
  });

  it('uses the sex-specific figure when both are known', () => {
    expect(resolveExpectancy('CO', 'female').years).toBe(79.3);
    expect(resolveExpectancy('CO', 'male').years).toBe(73.4);
    expect(resolveExpectancy('CO', 'male').source).toBe('country-sex');
  });

  it('treats an unknown country code as nothing known', () => {
    expect(resolveExpectancy('ZZ', 'male').source).toBe('default');
  });
});

describe('the table', () => {
  it('has unique codes and plausible figures', () => {
    const codes = new Set(COUNTRIES.map((country) => country.code));
    expect(codes.size).toBe(COUNTRIES.length);
    for (const country of COUNTRIES) {
      expect(country.female).toBeGreaterThan(60);
      expect(country.female).toBeLessThan(95);
      expect(country.male).toBeGreaterThan(60);
      expect(country.male).toBeLessThan(country.female);
    }
  });

  it('lists exactly the codes the dictionaries name, in both languages', () => {
    expect(COUNTRIES.map((country) => country.code)).toEqual([...COUNTRY_CODES]);
    for (const code of COUNTRY_CODES) {
      expect(ES.countries[code]).not.toBe('');
      expect(EN.countries[code]).not.toBe('');
    }
  });

  it('finds a country by code and null otherwise', () => {
    expect(findCountry('JP')?.code).toBe('JP');
    expect(findCountry(null)).toBeNull();
  });
});

describe('countryName', () => {
  it('names a country in each language and null for an unknown code', () => {
    expect(countryName('JP', ES)).toBe('Japón');
    expect(countryName('JP', EN)).toBe('Japan');
    expect(countryName('ZZ', ES)).toBeNull();
    expect(countryName(null, EN)).toBeNull();
  });
});

describe('yearsText', () => {
  it('uses the decimal mark of the tag', () => {
    expect(yearsText(77.6, ES_TAG)).toBe('77,6');
    expect(yearsText(77.6, EN_TAG)).toBe('77.6');
    expect(yearsText(80, EN_TAG)).toBe('80');
  });
});

describe('expectancySourceText', () => {
  it('names the source in each case, in Spanish', () => {
    expect(expectancySourceText(resolveExpectancy(null, null), null, ES, ES_TAG)).toBe(
      'Sobre 77,6 años, un promedio de referencia.',
    );
    expect(expectancySourceText(resolveExpectancy('CL', null), null, ES, ES_TAG)).toContain('Chile');
    expect(expectancySourceText(resolveExpectancy('MX', 'female'), 'female', ES, ES_TAG)).toBe(
      'Sobre 78,5 años, esperanza de vida en México para mujeres.',
    );
  });

  it('names the source in each case, in English', () => {
    expect(expectancySourceText(resolveExpectancy(null, null), null, EN, EN_TAG)).toBe(
      'About 77.6 years, a reference average.',
    );
    expect(expectancySourceText(resolveExpectancy('DE', null), null, EN, EN_TAG)).toContain('Germany');
    expect(expectancySourceText(resolveExpectancy('MX', 'male'), 'male', EN, EN_TAG)).toBe(
      'About 72.6 years, life expectancy in Mexico for men.',
    );
  });
});
