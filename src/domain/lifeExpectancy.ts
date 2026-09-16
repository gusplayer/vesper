import type { LifeExpectancyStrings } from '../i18n/es/settings';

/**
 * Life expectancy at birth, by country and sex. Optional inputs: with none, the
 * reference figure applies. The point is a number that is the user's, not a health
 * assessment — weight, height and habits are never used here (docs/PRD.md).
 *
 * Figures are rounded from the WHO / World Bank 2022–2023 tables. They will drift a
 * few tenths over the years; that is fine for counting weeks.
 *
 * Pure: the numbers live here, the words come in as the `lifeExpectancy` slice of the
 * dictionary (ADR-0020). Country names are keyed by `CountryCode` in both languages.
 */

export type Sex = 'female' | 'male';

export const COUNTRY_CODES = [
  'AR', 'BO', 'BR', 'CA', 'CL', 'CO', 'CR', 'CU', 'DE', 'DO', 'EC', 'ES', 'FR', 'GB',
  'GT', 'HN', 'IT', 'JP', 'MX', 'NI', 'PA', 'PE', 'PT', 'PY', 'SV', 'US', 'UY', 'VE',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export type CountryExpectancy = {
  code: CountryCode;
  female: number;
  male: number;
};

/** Reference when nothing is known. Roughly the OECD average. */
export const DEFAULT_LIFE_EXPECTANCY_YEARS = 77.6;

export const COUNTRIES: ReadonlyArray<CountryExpectancy> = [
  { code: 'AR', female: 80.0, male: 73.6 },
  { code: 'BO', female: 71.1, male: 65.6 },
  { code: 'BR', female: 79.4, male: 72.6 },
  { code: 'CA', female: 84.1, male: 79.9 },
  { code: 'CL', female: 83.3, male: 78.0 },
  { code: 'CO', female: 79.3, male: 73.4 },
  { code: 'CR', female: 82.7, male: 77.4 },
  { code: 'CU', female: 80.1, male: 75.4 },
  { code: 'DE', female: 83.2, male: 78.5 },
  { code: 'DO', female: 76.8, male: 70.6 },
  { code: 'EC', female: 80.4, male: 74.9 },
  { code: 'ES', female: 86.0, male: 80.7 },
  { code: 'FR', female: 85.5, male: 79.7 },
  { code: 'GB', female: 82.8, male: 78.9 },
  { code: 'GT', female: 75.4, male: 69.4 },
  { code: 'HN', female: 74.0, male: 68.5 },
  { code: 'IT', female: 85.4, male: 81.1 },
  { code: 'JP', female: 87.1, male: 81.1 },
  { code: 'MX', female: 78.5, male: 72.6 },
  { code: 'NI', female: 77.6, male: 71.3 },
  { code: 'PA', female: 80.9, male: 75.2 },
  { code: 'PE', female: 79.5, male: 74.6 },
  { code: 'PT', female: 84.6, male: 78.7 },
  { code: 'PY', female: 75.9, male: 71.2 },
  { code: 'SV', female: 76.5, male: 68.0 },
  { code: 'US', female: 80.2, male: 74.8 },
  { code: 'UY', female: 80.9, male: 74.1 },
  { code: 'VE', female: 76.2, male: 69.2 },
];

export type ExpectancySource = 'default' | 'country' | 'country-sex';

export type ResolvedExpectancy = {
  years: number;
  source: ExpectancySource;
  countryCode: CountryCode | null;
};

export function findCountry(code: string | null): CountryExpectancy | null {
  return COUNTRIES.find((country) => country.code === code) ?? null;
}

/**
 * The reference expectancy for what is known. Country alone gives the average of both
 * sexes; country and sex give the sex-specific figure; nothing gives the default.
 */
export function resolveExpectancy(countryCode: string | null, sex: Sex | null): ResolvedExpectancy {
  const country = findCountry(countryCode);
  if (country === null) {
    return { years: DEFAULT_LIFE_EXPECTANCY_YEARS, source: 'default', countryCode: null };
  }
  if (sex === null) {
    return {
      years: Math.round(((country.female + country.male) / 2) * 10) / 10,
      source: 'country',
      countryCode: country.code,
    };
  }
  return { years: country[sex], source: 'country-sex', countryCode: country.code };
}

/** '77,6' in Spanish, '77.6' in English: the decimal mark follows the Intl tag. */
export function yearsText(years: number, tag: string): string {
  return years.toLocaleString(tag);
}

/** The country's name in the current language, or null for an unknown code. */
export function countryName(code: string | null, t: LifeExpectancyStrings): string | null {
  const country = findCountry(code);
  return country === null ? null : t.countries[country.code];
}

/** One line saying where the number came from. */
export function expectancySourceText(
  resolved: ResolvedExpectancy,
  sex: Sex | null,
  t: LifeExpectancyStrings,
  tag: string,
): string {
  const years = yearsText(resolved.years, tag);
  const country = countryName(resolved.countryCode, t) ?? '';
  switch (resolved.source) {
    case 'default':
      return t.sourceDefault(years);
    case 'country':
      return t.sourceCountry(years, country);
    case 'country-sex':
      return t.sourceCountrySex(years, country, t.sexWord[sex ?? 'female']);
  }
}
