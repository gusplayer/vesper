import { describe, expect, it } from 'vitest';

import {
  COUNTRIES,
  DEFAULT_LIFE_EXPECTANCY_YEARS,
  expectancySourceText,
  findCountry,
  resolveExpectancy,
} from './lifeExpectancy';

describe('resolveExpectancy', () => {
  it('falls back to the reference figure with nothing known', () => {
    expect(resolveExpectancy(null, null)).toEqual({
      years: DEFAULT_LIFE_EXPECTANCY_YEARS,
      source: 'default',
      countryName: null,
    });
  });

  it('ignores sex without a country: sex alone says nothing usable', () => {
    expect(resolveExpectancy(null, 'female').source).toBe('default');
  });

  it('averages both sexes when only the country is known', () => {
    const resolved = resolveExpectancy('CO', null);
    expect(resolved.source).toBe('country');
    expect(resolved.years).toBe(76.4);
    expect(resolved.countryName).toBe('Colombia');
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

  it('finds a country by code and null otherwise', () => {
    expect(findCountry('JP')?.name).toBe('Japón');
    expect(findCountry(null)).toBeNull();
  });
});

describe('expectancySourceText', () => {
  it('names the source in each case', () => {
    expect(expectancySourceText(resolveExpectancy(null, null), null)).toContain('77,6');
    expect(expectancySourceText(resolveExpectancy('CL', null), null)).toContain('Chile');
    expect(expectancySourceText(resolveExpectancy('CL', 'female'), 'female')).toContain('mujeres');
  });
});
