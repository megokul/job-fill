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

describe('score helpers', () => {
  it('exposes confidence threshold', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(40)
    expect(scoreField({ label: 'Email' }, 'email')).toBeGreaterThanOrEqual(
      CONFIDENCE_THRESHOLD,
    )
  })
})
