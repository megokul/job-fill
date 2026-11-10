import type { FillKey, ProfileKey } from './types'

/** Personal keys blocked by NEGATIVE_LABEL / NEGATIVE_GROUP. */
export const PERSONAL_KEYS = new Set<FillKey>([
  'firstName',
  'lastName',
  'fullName',
  'preferredName',
  'pronouns',
  'email',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
  'location',
  'linkedinUrl',
  'portfolioUrl',
  'githubUrl',
])

/** Checked against label and aria-label. */
export const NEGATIVE_LABEL = [
  'reference',
  'references',
  'referee',
  'referees',
  'emergency',
  'company',
  'employer',
  'manager',
  'recruiter',
  'school',
  'university',
  'spouse',
] as const

/** Checked against the group/section signal only. */
export const NEGATIVE_GROUP = [
  'reference',
  'references',
  'referee',
  'referees',
  'emergency',
  'spouse',
] as const

/** @deprecated use NEGATIVE_LABEL / NEGATIVE_GROUP */
export const NEGATIVE_CONTEXT = NEGATIVE_LABEL

/** Lowercased synonym phrases mapped to fill keys. */
export const SYNONYMS: Record<FillKey, string[]> = {
  firstName: [
    'first name',
    'given name',
    'forename',
    'fname',
    'first_name',
    'firstname',
    'legal first name',
  ],
  lastName: [
    'last name',
    'family name',
    'surname',
    'lname',
    'last_name',
    'lastname',
    'legal last name',
  ],
  preferredName: ['preferred name', 'preferred', 'nickname', 'goes by'],
  pronouns: ['pronouns', 'personal pronouns'],
  fullName: ['full name', 'your name', 'legal name', 'name'],
  location: ['current location', 'city state', 'location'],
  email: ['email address', 'e-mail', 'email', 'work email', 'contact email'],
  phone: [
    'phone number',
    'mobile phone',
    'mobile number',
    'telephone',
    'cell phone',
    'phone',
    'mobile',
    'tel',
  ],
  addressLine1: [
    'street address',
    'address line 1',
    'address1',
    'address_1',
    'mailing address',
    'home address',
    'street',
    'address',
  ],
  addressLine2: [
    'address line 2',
    'address2',
    'address_2',
    'apartment',
    'apt',
    'suite',
    'unit',
    'floor',
  ],
  city: ['city', 'town', 'municipality'],
  state: ['state/province', 'state / province', 'province', 'region', 'state'],
  postalCode: ['postal code', 'zip code', 'zipcode', 'postcode', 'postal', 'zip'],
  country: ['country/region', 'country', 'nation'],
  linkedinUrl: ['linkedin profile', 'linkedin url', 'linkedin.com', 'linkedin'],
  portfolioUrl: [
    'portfolio url',
    'personal website',
    'personal site',
    'website',
    'portfolio',
    'homepage',
  ],
  githubUrl: ['github url', 'github profile', 'github.com', 'github'],
  currentCompany: [
    'current company',
    'present employer',
    'current employer',
    'company name',
    'employer',
  ],
  currentTitle: [
    'current title',
    'present title',
    'current role',
    'job title',
    'title',
  ],
  yearsExperience: [
    'years of experience',
    'years experience',
    'total experience',
    'experience years',
  ],
  noticePeriod: ['notice period', 'availability', 'when can you start', 'start date'],
  howDidYouHear: [
    'how did you hear about this opportunity',
    'how did you hear about us',
    'how did you hear',
    'referral source',
  ],
  workAuthorized: [
    'authorized to work',
    'legally authorized',
    'work authorization',
    'eligible to work',
    'work authorized',
    'right to work',
    'authorization to work',
  ],
  requiresSponsorship: [
    'require sponsorship',
    'requires sponsorship',
    'need sponsorship',
    'visa sponsorship',
    'sponsorship',
    'work visa',
  ],
  salaryExpectation: [
    'salary expectation',
    'expected salary',
    'desired salary',
    'compensation expectation',
    'salary requirements',
    'expected compensation',
    'pay expectation',
    'salary',
    'compensation',
  ],
}

export const FILL_KEYS = Object.keys(SYNONYMS) as FillKey[]

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split camelCase and digit boundaries for name/id signals. */
export function splitIdentifier(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
}

export function hasNegativeLabel(...parts: Array<string | undefined>): boolean {
  return hasNegativeTokens(parts, NEGATIVE_LABEL)
}

export function hasNegativeGroup(...parts: Array<string | undefined>): boolean {
  return hasNegativeTokens(parts, NEGATIVE_GROUP)
}

function hasNegativeTokens(
  parts: Array<string | undefined>,
  list: readonly string[],
): boolean {
  const text = normalizeText(parts.filter(Boolean).join(' '))
  if (!text) return false
  const tokens = new Set(text.split(' ').filter(Boolean))
  return list.some((neg) => tokens.has(neg))
}

/** @deprecated */
export function hasNegativeContext(...parts: Array<string | undefined>): boolean {
  return hasNegativeLabel(...parts) || hasNegativeGroup(...parts)
}

export function isProfileKey(key: string): key is ProfileKey {
  return key in SYNONYMS && key !== 'fullName' && key !== 'location'
}
