import { describe, expect, it } from 'vitest'
import { profileForSave } from './profileValidation'
import { EMPTY_PROFILE } from './types'

describe('profileForSave', () => {
  it('saves valid draft fields and keeps previous value for invalid ones', () => {
    const current = {
      ...EMPTY_PROFILE,
      firstName: 'Ada',
      email: 'ada@example.com',
      linkedinUrl: 'https://linkedin.com/in/ada',
    }
    const draft = {
      ...current,
      firstName: 'Augusta',
      email: 'not-an-email',
      linkedinUrl: 'linkedin.com/in/ada',
      city: 'London',
    }
    const { profile, errors } = profileForSave(current, draft)
    expect(profile.firstName).toBe('Augusta')
    expect(profile.city).toBe('London')
    expect(profile.email).toBe('ada@example.com')
    expect(profile.linkedinUrl).toBe('https://linkedin.com/in/ada')
    expect(errors.map((e) => e.key).sort()).toEqual(['email', 'linkedinUrl'])
  })

  it('returns the draft when every field is valid', () => {
    const current = { ...EMPTY_PROFILE, firstName: 'Ada' }
    const draft = { ...EMPTY_PROFILE, firstName: 'Augusta', city: 'London' }
    const { profile, errors } = profileForSave(current, draft)
    expect(errors).toHaveLength(0)
    expect(profile).toEqual(draft)
  })
})
