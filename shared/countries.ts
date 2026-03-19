export interface CountryInfo {
  code: string;
  name: string;
  region: string;
  salaryMultiplier: number;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "US", name: "United States", region: "North America", salaryMultiplier: 1.00 },
  { code: "CA", name: "Canada", region: "North America", salaryMultiplier: 0.72 },

  { code: "GB", name: "United Kingdom", region: "Western Europe", salaryMultiplier: 0.68 },
  { code: "DE", name: "Germany", region: "Western Europe", salaryMultiplier: 0.62 },
  { code: "FR", name: "France", region: "Western Europe", salaryMultiplier: 0.55 },
  { code: "NL", name: "Netherlands", region: "Western Europe", salaryMultiplier: 0.65 },
  { code: "CH", name: "Switzerland", region: "Western Europe", salaryMultiplier: 1.05 },
  { code: "SE", name: "Sweden", region: "Western Europe", salaryMultiplier: 0.58 },
  { code: "NO", name: "Norway", region: "Western Europe", salaryMultiplier: 0.60 },
  { code: "DK", name: "Denmark", region: "Western Europe", salaryMultiplier: 0.65 },
  { code: "FI", name: "Finland", region: "Western Europe", salaryMultiplier: 0.55 },
  { code: "IE", name: "Ireland", region: "Western Europe", salaryMultiplier: 0.70 },
  { code: "BE", name: "Belgium", region: "Western Europe", salaryMultiplier: 0.58 },
  { code: "AT", name: "Austria", region: "Western Europe", salaryMultiplier: 0.58 },
  { code: "LU", name: "Luxembourg", region: "Western Europe", salaryMultiplier: 0.72 },
  { code: "IT", name: "Italy", region: "Southern Europe", salaryMultiplier: 0.45 },
  { code: "ES", name: "Spain", region: "Southern Europe", salaryMultiplier: 0.42 },
  { code: "PT", name: "Portugal", region: "Southern Europe", salaryMultiplier: 0.35 },
  { code: "GR", name: "Greece", region: "Southern Europe", salaryMultiplier: 0.30 },

  { code: "PL", name: "Poland", region: "Eastern Europe", salaryMultiplier: 0.45 },
  { code: "CZ", name: "Czech Republic", region: "Eastern Europe", salaryMultiplier: 0.40 },
  { code: "RO", name: "Romania", region: "Eastern Europe", salaryMultiplier: 0.38 },
  { code: "HU", name: "Hungary", region: "Eastern Europe", salaryMultiplier: 0.35 },
  { code: "BG", name: "Bulgaria", region: "Eastern Europe", salaryMultiplier: 0.28 },
  { code: "HR", name: "Croatia", region: "Eastern Europe", salaryMultiplier: 0.32 },
  { code: "SK", name: "Slovakia", region: "Eastern Europe", salaryMultiplier: 0.35 },
  { code: "UA", name: "Ukraine", region: "Eastern Europe", salaryMultiplier: 0.30 },
  { code: "RS", name: "Serbia", region: "Eastern Europe", salaryMultiplier: 0.28 },
  { code: "EE", name: "Estonia", region: "Eastern Europe", salaryMultiplier: 0.38 },
  { code: "LV", name: "Latvia", region: "Eastern Europe", salaryMultiplier: 0.32 },
  { code: "LT", name: "Lithuania", region: "Eastern Europe", salaryMultiplier: 0.33 },

  { code: "IL", name: "Israel", region: "Middle East", salaryMultiplier: 0.82 },
  { code: "AE", name: "United Arab Emirates", region: "Middle East", salaryMultiplier: 0.65 },
  { code: "SA", name: "Saudi Arabia", region: "Middle East", salaryMultiplier: 0.55 },
  { code: "QA", name: "Qatar", region: "Middle East", salaryMultiplier: 0.60 },
  { code: "KW", name: "Kuwait", region: "Middle East", salaryMultiplier: 0.50 },
  { code: "BH", name: "Bahrain", region: "Middle East", salaryMultiplier: 0.48 },
  { code: "OM", name: "Oman", region: "Middle East", salaryMultiplier: 0.42 },
  { code: "JO", name: "Jordan", region: "Middle East", salaryMultiplier: 0.25 },
  { code: "TR", name: "Turkey", region: "Middle East", salaryMultiplier: 0.25 },

  { code: "AU", name: "Australia", region: "Oceania", salaryMultiplier: 0.72 },
  { code: "NZ", name: "New Zealand", region: "Oceania", salaryMultiplier: 0.60 },

  { code: "JP", name: "Japan", region: "East Asia", salaryMultiplier: 0.52 },
  { code: "KR", name: "South Korea", region: "East Asia", salaryMultiplier: 0.50 },
  { code: "SG", name: "Singapore", region: "Southeast Asia", salaryMultiplier: 0.60 },
  { code: "HK", name: "Hong Kong", region: "East Asia", salaryMultiplier: 0.62 },
  { code: "TW", name: "Taiwan", region: "East Asia", salaryMultiplier: 0.38 },
  { code: "CN", name: "China", region: "East Asia", salaryMultiplier: 0.40 },

  { code: "IN", name: "India", region: "South Asia", salaryMultiplier: 0.18 },
  { code: "PK", name: "Pakistan", region: "South Asia", salaryMultiplier: 0.10 },
  { code: "BD", name: "Bangladesh", region: "South Asia", salaryMultiplier: 0.08 },
  { code: "LK", name: "Sri Lanka", region: "South Asia", salaryMultiplier: 0.12 },

  { code: "MY", name: "Malaysia", region: "Southeast Asia", salaryMultiplier: 0.28 },
  { code: "TH", name: "Thailand", region: "Southeast Asia", salaryMultiplier: 0.22 },
  { code: "VN", name: "Vietnam", region: "Southeast Asia", salaryMultiplier: 0.15 },
  { code: "PH", name: "Philippines", region: "Southeast Asia", salaryMultiplier: 0.14 },
  { code: "ID", name: "Indonesia", region: "Southeast Asia", salaryMultiplier: 0.14 },

  { code: "BR", name: "Brazil", region: "Latin America", salaryMultiplier: 0.30 },
  { code: "MX", name: "Mexico", region: "Latin America", salaryMultiplier: 0.32 },
  { code: "AR", name: "Argentina", region: "Latin America", salaryMultiplier: 0.25 },
  { code: "CO", name: "Colombia", region: "Latin America", salaryMultiplier: 0.22 },
  { code: "CL", name: "Chile", region: "Latin America", salaryMultiplier: 0.30 },
  { code: "PE", name: "Peru", region: "Latin America", salaryMultiplier: 0.18 },
  { code: "CR", name: "Costa Rica", region: "Latin America", salaryMultiplier: 0.28 },
  { code: "PA", name: "Panama", region: "Latin America", salaryMultiplier: 0.30 },
  { code: "UY", name: "Uruguay", region: "Latin America", salaryMultiplier: 0.28 },

  { code: "ZA", name: "South Africa", region: "Africa", salaryMultiplier: 0.25 },
  { code: "NG", name: "Nigeria", region: "Africa", salaryMultiplier: 0.10 },
  { code: "KE", name: "Kenya", region: "Africa", salaryMultiplier: 0.12 },
  { code: "EG", name: "Egypt", region: "Africa", salaryMultiplier: 0.12 },
  { code: "GH", name: "Ghana", region: "Africa", salaryMultiplier: 0.10 },
  { code: "MA", name: "Morocco", region: "Africa", salaryMultiplier: 0.15 },
  { code: "TN", name: "Tunisia", region: "Africa", salaryMultiplier: 0.13 },
  { code: "RW", name: "Rwanda", region: "Africa", salaryMultiplier: 0.08 },
  { code: "ET", name: "Ethiopia", region: "Africa", salaryMultiplier: 0.06 },
  { code: "TZ", name: "Tanzania", region: "Africa", salaryMultiplier: 0.07 },
];

export function getCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getSalaryMultiplier(countryCode: string | null | undefined): number {
  if (!countryCode) return 1.0;
  const country = getCountryByCode(countryCode);
  return country?.salaryMultiplier ?? 1.0;
}
