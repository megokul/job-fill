import type { FillKey } from './types'

const SECTION_PREFIXES = /^(section-|shipping |billing |shipping-|billing-)/i

/** Map a raw autocomplete token to a fill key (score 200 in matcher). */
export function autocompleteToFillKey(raw: string | undefined): FillKey | null {
  if (!raw) return null
  let token = raw.trim().toLowerCase()
  if (!token || token === 'on' || token === 'off') return null

  // Drop section / shipping / billing prefixes (may appear space- or hyphen-separated)
  token = token.replace(SECTION_PREFIXES, '').trim()
  // Also handle "shipping address-line1" style
  const parts = token.split(/\s+/)
  token = parts[parts.length - 1] ?? token
  token = token.replace(/^(shipping|billing)-/, '')

  const map: Record<string, FillKey> = {
    'given-name': 'firstName',
    'family-name': 'lastName',
    name: 'fullName',
    email: 'email',
    tel: 'phone',
    'tel-national': 'phone',
    'tel-local': 'phone',
    'address-line1': 'addressLine1',
    'address-line2': 'addressLine2',
    'address-level2': 'city',
    'address-level1': 'state',
    'postal-code': 'postalCode',
    country: 'country',
    'country-name': 'country',
    url: 'portfolioUrl',
    organization: 'currentCompany',
  }

  return map[token] ?? null
}

export function inputTypeBoost(
  inputType: string | undefined,
  key: FillKey,
): number {
  const t = (inputType ?? '').toLowerCase()
  if (t === 'email' && key === 'email') return 30
  if ((t === 'tel' || t === 'telephone') && key === 'phone') return 30
  return 0
}
