import { describe, expect, it } from 'vitest'
import { scoreField } from './matcher'
import type { FieldSignals } from './matcher'

describe('scoreField', () => {
  it('scores exact email label highly', () => {
    const signals: FieldSignals = { label: 'Email address' }
    expect(scoreField(signals, 'email')).toBeGreaterThanOrEqual(70)
  })

  it('scores linkedin placeholder', () => {
    const signals: FieldSignals = { placeholder: 'LinkedIn profile URL' }
    expect(scoreField(signals, 'linkedinUrl')).toBeGreaterThanOrEqual(70)
  })

  it('does not strongly match bare name to firstName', () => {
    const signals: FieldSignals = { label: 'Name' }
    expect(scoreField(signals, 'firstName')).toBeLessThan(40)
  })

  it('prefers first name synonyms', () => {
    const signals: FieldSignals = { name: 'first_name', label: 'First name' }
    expect(scoreField(signals, 'firstName')).toBeGreaterThan(
      scoreField(signals, 'lastName'),
    )
  })

  it('matches work authorization phrasing', () => {
    const signals: FieldSignals = {
      label: 'Are you legally authorized to work in the US?',
    }
    expect(scoreField(signals, 'workAuthorized')).toBeGreaterThanOrEqual(40)
  })
})
