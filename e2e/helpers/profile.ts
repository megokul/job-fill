import type { CustomAnswer, FormMapping, Profile, Settings, Store } from '../../src/shared/types'

export const TEST_PROFILE: Profile = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  preferredName: 'Ada',
  pronouns: 'she/her',
  email: 'ada@example.com',
  phone: '555-0100',
  addressLine1: '1 Analytical Engine Rd',
  addressLine2: 'Suite 2',
  city: 'London',
  state: 'CA',
  postalCode: 'EC1A 1BB',
  country: 'US',
  linkedinUrl: 'https://linkedin.com/in/ada',
  portfolioUrl: 'https://ada.dev',
  githubUrl: 'https://github.com/ada',
  currentCompany: 'Analytical Engines Ltd',
  currentTitle: 'Mathematician',
  yearsExperience: '10',
  noticePeriod: '2 weeks',
  howDidYouHear: '',
  workAuthorized: 'yes',
  requiresSponsorship: 'no',
  salaryExpectation: '120000',
}

export function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    schemaVersion: 2,
    profile: { ...TEST_PROFILE, ...(overrides.profile ?? {}) },
    formMappings: overrides.formMappings ?? [],
    customAnswers: overrides.customAnswers ?? [],
    settings: {
      autofillSites: [],
      highlightFilled: false,
      ...(overrides.settings ?? {}),
    },
  }
}

export function mappingFor(
  origin: string,
  pathPattern: string,
  fields: FormMapping['fields'],
  name = 'E2E mapping',
): FormMapping {
  return {
    id: crypto.randomUUID(),
    name,
    origin,
    pathPattern,
    fields,
    updatedAt: Date.now(),
  }
}

export function customAnswer(
  question: string,
  answer: string,
): CustomAnswer {
  return {
    id: crypto.randomUUID(),
    question,
    answer,
    updatedAt: Date.now(),
  }
}

export type SeedSettings = Settings
