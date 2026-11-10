import { describe, expect, it } from 'vitest'
import { pickOption } from './pickOption'

describe('pickOption', () => {
  const countries = [
    { text: 'Select…', value: '' },
    { text: 'Australia', value: '14' },
    { text: 'United States of America', value: '231' },
  ]

  it('does not select Australia when country is US via substring', () => {
    const idx = pickOption(countries, 'US', 'country')
    expect(idx).toBeGreaterThan(0)
    expect(countries[idx].text).toMatch(/United States/i)
    expect(countries[idx].text).not.toMatch(/Australia/i)
  })

  it('does not select American Samoa when state is CA via substring', () => {
    const states = [
      { text: 'Select…', value: '' },
      { text: 'California', value: '6' },
      { text: 'American Samoa', value: 'as' },
    ]
    const idx = pickOption(states, 'CA', 'state')
    expect(states[idx].text).toMatch(/California/i)
    expect(states[idx].text).not.toMatch(/American Samoa/i)
  })

  it('matches yes/no tokens separately on value or text', () => {
    const opts = [
      { text: 'Please choose', value: '' },
      { text: 'Yes', value: '1' },
      { text: 'No', value: '0' },
    ]
    expect(pickOption(opts, 'yes', 'workAuthorized')).toBe(1)
    expect(pickOption(opts, 'no', 'requiresSponsorship')).toBe(2)
  })
})
