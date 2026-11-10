import { describe, expect, it } from 'vitest'
import { CONFIDENCE_THRESHOLD, bestFillKey, scoreField } from './matcher'
import type { FieldSignals } from './matcher'
import type { FillKey } from '../shared/types'

function expectBest(signals: FieldSignals, expected: FillKey | null): void {
  expect(bestFillKey(signals)).toBe(expected)
}

describe('review table — negative context (fix 1)', () => {
  it('allows email under Engineering Manager group', () => {
    expectBest({ label: 'Email', group: 'Engineering Manager' }, 'email')
  })

  it('allows first name under Apply to Acme Company group', () => {
    expectBest({ label: 'First name', group: 'Apply to Acme Company' }, 'firstName')
  })

  it('matches workAuthorized despite employer in the question', () => {
    expectBest(
      {
        label:
          'Are you legally authorized to work in the United States for any employer?',
      },
      'workAuthorized',
    )
  })

  it('matches requiresSponsorship despite company in the question', () => {
    expectBest(
      { label: 'Will you require sponsorship from the company?' },
      'requiresSponsorship',
    )
  })

  it('still blocks reference last name', () => {
    expectBest({ label: 'Reference last name' }, null)
  })
})

describe('review table — synonym tightening (fix 2)', () => {
  it('does not match Middle name to fullName', () => {
    expectBest({ label: 'Middle name' }, null)
  })

  it('matches Preferred pronouns to pronouns', () => {
    expectBest({ label: 'Preferred pronouns' }, 'pronouns')
  })

  it('does not match Preferred contact method', () => {
    expectBest({ label: 'Preferred contact method' }, null)
  })

  it('does not match Start date to noticePeriod', () => {
    expectBest({ label: 'Start date' }, null)
  })

  it('does not match Current salary to salaryExpectation', () => {
    expectBest({ label: 'Current salary' }, null)
  })

  it('does not match Phone extension to phone', () => {
    expectBest({ label: 'Phone extension' }, null)
  })

  it('does not match Phone country code to country', () => {
    expectBest({ label: 'Phone country code' }, null)
  })

  it('does not match State your reason for leaving to state', () => {
    expectBest({ label: 'State your reason for leaving' }, null)
  })

  it('does not match How did you find our website? to portfolioUrl', () => {
    expectBest({ label: 'How did you find our website?' }, null)
  })

  it('does not match Job title you are applying for to currentTitle', () => {
    expectBest({ label: 'Job title you are applying for' }, null)
  })

  it('keeps Name → fullName and City → city', () => {
    expectBest({ label: 'Name' }, 'fullName')
    expectBest({ label: 'City' }, 'city')
  })
})

describe('score helpers', () => {
  it('exposes confidence threshold', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(40)
    expect(scoreField({ label: 'Email' }, 'email')).toBeGreaterThanOrEqual(
      CONFIDENCE_THRESHOLD,
    )
  })
})
