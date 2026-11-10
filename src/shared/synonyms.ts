import type { ProfileKey } from './types'

/** Lowercased synonym phrases / tokens mapped to profile keys. Longer phrases score higher. */
export const SYNONYMS: Record<ProfileKey, string[]> = {
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
  email: [
    'email address',
    'e-mail',
    'email',
    'work email',
    'contact email',
  ],
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
  state: [
    'state/province',
    'state / province',
    'province',
    'region',
    'state',
  ],
  postalCode: [
    'postal code',
    'zip code',
    'zipcode',
    'postcode',
    'postal',
    'zip',
  ],
  country: ['country/region', 'country', 'nation'],
  linkedinUrl: [
    'linkedin profile',
    'linkedin url',
    'linkedin.com',
    'linkedin',
  ],
  portfolioUrl: [
    'portfolio url',
    'personal website',
    'personal site',
    'github url',
    'website',
    'portfolio',
    'github',
    'homepage',
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

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
