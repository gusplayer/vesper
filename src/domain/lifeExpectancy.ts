/**
 * Life expectancy at birth, by country and sex. Optional inputs: with none, the
 * reference figure applies. The point is a number that is the user's, not a health
 * assessment — weight, height and habits are never used here (docs/PRD.md).
 *
 * Figures are rounded from the WHO / World Bank 2022–2023 tables. They will drift a
 * few tenths over the years; that is fine for counting weeks.
 */

export type Sex = 'female' | 'male';

export type CountryExpectancy = {
  code: string;
  name: string;
  female: number;
  male: number;
};

/** Reference when nothing is known. Roughly the OECD average. */
export const DEFAULT_LIFE_EXPECTANCY_YEARS = 77.6;

export const COUNTRIES: ReadonlyArray<CountryExpectancy> = [
  { code: 'AR', name: 'Argentina', female: 80.0, male: 73.6 },
  { code: 'BO', name: 'Bolivia', female: 71.1, male: 65.6 },
  { code: 'BR', name: 'Brasil', female: 79.4, male: 72.6 },
  { code: 'CA', name: 'Canadá', female: 84.1, male: 79.9 },
  { code: 'CL', name: 'Chile', female: 83.3, male: 78.0 },
  { code: 'CO', name: 'Colombia', female: 79.3, male: 73.4 },
  { code: 'CR', name: 'Costa Rica', female: 82.7, male: 77.4 },
  { code: 'CU', name: 'Cuba', female: 80.1, male: 75.4 },
  { code: 'DE', name: 'Alemania', female: 83.2, male: 78.5 },
  { code: 'DO', name: 'República Dominicana', female: 76.8, male: 70.6 },
  { code: 'EC', name: 'Ecuador', female: 80.4, male: 74.9 },
  { code: 'ES', name: 'España', female: 86.0, male: 80.7 },
  { code: 'FR', name: 'Francia', female: 85.5, male: 79.7 },
  { code: 'GB', name: 'Reino Unido', female: 82.8, male: 78.9 },
  { code: 'GT', name: 'Guatemala', female: 75.4, male: 69.4 },
  { code: 'HN', name: 'Honduras', female: 74.0, male: 68.5 },
  { code: 'IT', name: 'Italia', female: 85.4, male: 81.1 },
  { code: 'JP', name: 'Japón', female: 87.1, male: 81.1 },
  { code: 'MX', name: 'México', female: 78.5, male: 72.6 },
  { code: 'NI', name: 'Nicaragua', female: 77.6, male: 71.3 },
  { code: 'PA', name: 'Panamá', female: 80.9, male: 75.2 },
  { code: 'PE', name: 'Perú', female: 79.5, male: 74.6 },
  { code: 'PT', name: 'Portugal', female: 84.6, male: 78.7 },
  { code: 'PY', name: 'Paraguay', female: 75.9, male: 71.2 },
  { code: 'SV', name: 'El Salvador', female: 76.5, male: 68.0 },
  { code: 'US', name: 'Estados Unidos', female: 80.2, male: 74.8 },
  { code: 'UY', name: 'Uruguay', female: 80.9, male: 74.1 },
  { code: 'VE', name: 'Venezuela', female: 76.2, male: 69.2 },
];

export type ExpectancySource = 'default' | 'country' | 'country-sex';

export type ResolvedExpectancy = {
  years: number;
  source: ExpectancySource;
  countryName: string | null;
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
    return { years: DEFAULT_LIFE_EXPECTANCY_YEARS, source: 'default', countryName: null };
  }
  if (sex === null) {
    return {
      years: Math.round(((country.female + country.male) / 2) * 10) / 10,
      source: 'country',
      countryName: country.name,
    };
  }
  return { years: country[sex], source: 'country-sex', countryName: country.name };
}

/** '77,6': Spanish decimal comma. */
export function yearsText(years: number): string {
  return String(years).replace('.', ',');
}

/** One line saying where the number came from. */
export function expectancySourceText(resolved: ResolvedExpectancy, sex: Sex | null): string {
  switch (resolved.source) {
    case 'default':
      return `Sobre ${yearsText(resolved.years)} años, un promedio de referencia.`;
    case 'country':
      return `Sobre ${yearsText(resolved.years)} años, esperanza de vida en ${resolved.countryName ?? ''}.`;
    case 'country-sex':
      return `Sobre ${yearsText(resolved.years)} años, esperanza de vida en ${resolved.countryName ?? ''} para ${sex === 'female' ? 'mujeres' : 'hombres'}.`;
  }
}
