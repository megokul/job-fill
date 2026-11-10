export type YesNo = 'yes' | 'no' | ''

export type Profile = {
  firstName: string
  lastName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  linkedinUrl: string
  portfolioUrl: string
  workAuthorized: YesNo
  requiresSponsorship: YesNo
  salaryExpectation: string
}

export type ProfileKey = keyof Profile

export type FieldMatchSignals = {
  name?: string
  id?: string
  label?: string
  placeholder?: string
  autocomplete?: string
}

export type FieldMapping = {
  id: string
  selector?: string
  match: FieldMatchSignals
  profileKey: ProfileKey
}

export type FormMapping = {
  id: string
  name: string
  origin: string
  pathPattern: string
  fields: FieldMapping[]
  updatedAt: number
}

export type Settings = {
  autofillOnLoad: boolean
  highlightFilled: boolean
}

export type Store = {
  profile: Profile
  formMappings: FormMapping[]
  settings: Settings
}

export const PROFILE_KEYS: ProfileKey[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
  'linkedinUrl',
  'portfolioUrl',
  'workAuthorized',
  'requiresSponsorship',
  'salaryExpectation',
]

export const PROFILE_LABELS: Record<ProfileKey, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  state: 'State / Province',
  postalCode: 'Postal code',
  country: 'Country',
  linkedinUrl: 'LinkedIn URL',
  portfolioUrl: 'Portfolio / website',
  workAuthorized: 'Authorized to work',
  requiresSponsorship: 'Requires sponsorship',
  salaryExpectation: 'Salary expectation',
}

export const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  linkedinUrl: '',
  portfolioUrl: '',
  workAuthorized: '',
  requiresSponsorship: '',
  salaryExpectation: '',
}

export const DEFAULT_SETTINGS: Settings = {
  autofillOnLoad: false,
  highlightFilled: true,
}

export const REQUIRED_PROFILE_KEYS: ProfileKey[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
]
