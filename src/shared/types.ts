export type YesNo = 'yes' | 'no' | ''

export type Profile = {
  firstName: string
  lastName: string
  preferredName: string
  pronouns: string
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
  githubUrl: string
  currentCompany: string
  currentTitle: string
  yearsExperience: string
  noticePeriod: string
  howDidYouHear: string
  workAuthorized: YesNo
  requiresSponsorship: YesNo
  salaryExpectation: string
}

export type ProfileKey = keyof Profile

/** Keys that can be filled, including derived values. */
export type FillKey = ProfileKey | 'fullName' | 'location'

export type FieldMatchSignals = {
  name?: string
  id?: string
  label?: string
  placeholder?: string
  autocomplete?: string
  group?: string
}

export type FieldMapping = {
  id: string
  selector?: string
  match: FieldMatchSignals
  /** Profile key to fill — mutually exclusive with customAnswerId in practice. */
  profileKey?: ProfileKey
  customAnswerId?: string
}

export type CustomAnswer = {
  id: string
  question: string
  answer: string
  updatedAt: number
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
  /** Origins where autofill-on-load is enabled. */
  autofillSites: string[]
  highlightFilled: boolean
  /** @deprecated migrated to autofillSites */
  autofillOnLoad?: boolean
}

export type Store = {
  schemaVersion: number
  profile: Profile
  formMappings: FormMapping[]
  settings: Settings
  customAnswers: CustomAnswer[]
}

export const CURRENT_SCHEMA_VERSION = 2

export const PROFILE_KEYS: ProfileKey[] = [
  'firstName',
  'lastName',
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
  'linkedinUrl',
  'portfolioUrl',
  'githubUrl',
  'currentCompany',
  'currentTitle',
  'yearsExperience',
  'noticePeriod',
  'howDidYouHear',
  'workAuthorized',
  'requiresSponsorship',
  'salaryExpectation',
]

export const PROFILE_LABELS: Record<ProfileKey, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  preferredName: 'Preferred name',
  pronouns: 'Pronouns',
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
  githubUrl: 'GitHub URL',
  currentCompany: 'Current company',
  currentTitle: 'Current title',
  yearsExperience: 'Years of experience',
  noticePeriod: 'Notice period',
  howDidYouHear: 'How did you hear about us?',
  workAuthorized: 'Authorized to work',
  requiresSponsorship: 'Requires sponsorship',
  salaryExpectation: 'Salary expectation',
}

export const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  preferredName: '',
  pronouns: '',
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
  githubUrl: '',
  currentCompany: '',
  currentTitle: '',
  yearsExperience: '',
  noticePeriod: '',
  howDidYouHear: '',
  workAuthorized: '',
  requiresSponsorship: '',
  salaryExpectation: '',
}

export const DEFAULT_SETTINGS: Settings = {
  autofillSites: [],
  highlightFilled: true,
}

export const REQUIRED_PROFILE_KEYS: ProfileKey[] = [
  'firstName',
  'lastName',
  'email',
]
