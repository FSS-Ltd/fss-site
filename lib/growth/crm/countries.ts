import countryNames from "./country-names.json";

// Static ISO 3166-1 labels keep server/client rendering and identity consistent.
const names: Readonly<Record<string, string>> = countryNames;

export function isCrmCountryCode(value: string): boolean {
  return Object.hasOwn(names, value);
}

export function crmCountryName(code: string): string {
  return names[code] ?? code;
}

export const crmCountries = Object.entries(names)
  .map(([code, name]) => ({ code, name }))
  .sort((left, right) => left.name.localeCompare(right.name, "en"));
