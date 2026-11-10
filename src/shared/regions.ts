/** US state code ↔ name pairs. */
export const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
  AS: 'American Samoa',
  GU: 'Guam',
  PR: 'Puerto Rico',
  VI: 'Virgin Islands',
}

export const CA_PROVINCES: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
}

/** Common country aliases → canonical display / ISO-ish names. */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ['US', 'USA', 'United States', 'United States of America', 'U.S.', 'U.S.A.'],
  CA: ['CA', 'CAN', 'Canada'],
  GB: ['GB', 'UK', 'United Kingdom', 'Great Britain', 'England'],
  AU: ['AU', 'AUS', 'Australia'],
  DE: ['DE', 'DEU', 'Germany'],
  FR: ['FR', 'FRA', 'France'],
  IN: ['IN', 'IND', 'India'],
  IE: ['IE', 'IRL', 'Ireland'],
  NL: ['NL', 'NLD', 'Netherlands'],
  NZ: ['NZ', 'NZL', 'New Zealand'],
  SG: ['SG', 'SGP', 'Singapore'],
  ES: ['ES', 'ESP', 'Spain'],
  SE: ['SE', 'SWE', 'Sweden'],
  CH: ['CH', 'CHE', 'Switzerland'],
  JP: ['JP', 'JPN', 'Japan'],
  KR: ['KR', 'KOR', 'South Korea', 'Korea'],
  BR: ['BR', 'BRA', 'Brazil'],
  MX: ['MX', 'MEX', 'Mexico'],
  IT: ['IT', 'ITA', 'Italy'],
  PL: ['PL', 'POL', 'Poland'],
  PT: ['PT', 'PRT', 'Portugal'],
  BE: ['BE', 'BEL', 'Belgium'],
  AT: ['AT', 'AUT', 'Austria'],
  DK: ['DK', 'DNK', 'Denmark'],
  NO: ['NO', 'NOR', 'Norway'],
  FI: ['FI', 'FIN', 'Finland'],
  IL: ['IL', 'ISR', 'Israel'],
  AE: ['AE', 'ARE', 'United Arab Emirates', 'UAE'],
  ZA: ['ZA', 'ZAF', 'South Africa'],
  PH: ['PH', 'PHL', 'Philippines'],
  MY: ['MY', 'MYS', 'Malaysia'],
  ID: ['ID', 'IDN', 'Indonesia'],
  TH: ['TH', 'THA', 'Thailand'],
  VN: ['VN', 'VNM', 'Vietnam'],
  CN: ['CN', 'CHN', 'China'],
  HK: ['HK', 'HKG', 'Hong Kong'],
  TW: ['TW', 'TWN', 'Taiwan'],
  AR: ['AR', 'ARG', 'Argentina'],
  CL: ['CL', 'CHL', 'Chile'],
  CO: ['CO', 'COL', 'Colombia'],
  NG: ['NG', 'NGA', 'Nigeria'],
  KE: ['KE', 'KEN', 'Kenya'],
  EG: ['EG', 'EGY', 'Egypt'],
  PK: ['PK', 'PAK', 'Pakistan'],
  BD: ['BD', 'BGD', 'Bangladesh'],
}

export function stateAliases(value: string): string[] {
  const raw = value.trim()
  if (!raw) return []
  const upper = raw.toUpperCase()
  const aliases = new Set<string>([raw, upper, raw.toLowerCase()])

  if (US_STATES[upper]) {
    aliases.add(US_STATES[upper])
    aliases.add(upper)
  }
  if (CA_PROVINCES[upper]) {
    aliases.add(CA_PROVINCES[upper])
    aliases.add(upper)
  }

  for (const [code, name] of Object.entries(US_STATES)) {
    if (name.toLowerCase() === raw.toLowerCase()) {
      aliases.add(code)
      aliases.add(name)
    }
  }
  for (const [code, name] of Object.entries(CA_PROVINCES)) {
    if (name.toLowerCase() === raw.toLowerCase()) {
      aliases.add(code)
      aliases.add(name)
    }
  }

  return [...aliases]
}

export function countryAliases(value: string): string[] {
  const raw = value.trim()
  if (!raw) return []
  const aliases = new Set<string>([raw, raw.toUpperCase(), raw.toLowerCase()])

  for (const [code, list] of Object.entries(COUNTRY_ALIASES)) {
    const hit = list.some((a) => a.toLowerCase() === raw.toLowerCase())
    if (hit || code.toLowerCase() === raw.toLowerCase()) {
      aliases.add(code)
      for (const a of list) aliases.add(a)
    }
  }

  return [...aliases]
}

export function datalistStateOptions(): string[] {
  return [
    ...Object.entries(US_STATES).flatMap(([code, name]) => [code, name]),
    ...Object.entries(CA_PROVINCES).flatMap(([code, name]) => [code, name]),
  ]
}

export function datalistCountryOptions(): string[] {
  const out = new Set<string>()
  for (const [code, list] of Object.entries(COUNTRY_ALIASES)) {
    out.add(code)
    for (const a of list) out.add(a)
  }
  return [...out]
}
