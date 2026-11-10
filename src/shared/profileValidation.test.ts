import { describe, expect, it } from 'vitest'
import { suggestHttps, validateProfileField } from './profileValidation'

describe('profileValidation', () => {
  it('rejects bad email', () => {
    expect(validateProfileField('email', 'not-an-email')).toMatch(/valid email/i)
  })

  it('requires http(s) for urls', () => {
    expect(validateProfileField('linkedinUrl', 'linkedin.com/in/x')).toMatch(
      /http/i,
    )
  })

  it('suggests https prepend', () => {
    expect(suggestHttps('example.com')).toBe('https://example.com')
    expect(suggestHttps('https://ok.com')).toBeNull()
  })
})
