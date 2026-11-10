/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_PROFILE, type FillKey } from '../shared/types'
import { fillPage } from './filler'
import {
  CONFIDENCE_THRESHOLD,
  bestFillKey,
  extractSignals,
  scoreField,
} from './matcher'
import type { FieldSignals } from './matcher'

function expectBest(signals: FieldSignals, expected: FillKey | null): void {
  expect(bestFillKey(signals)).toBe(expected)
}

function mount(html: string): void {
  document.body.innerHTML = html
}

beforeEach(() => {
  document.body.innerHTML = ''
})

function fakeVisible(): void {
  for (const el of document.querySelectorAll('input,textarea,select')) {
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 100,
        height: 20,
        top: 0,
        left: 0,
        bottom: 20,
        right: 100,
        x: 0,
        y: 0,
        toJSON() {
          return {}
        },
      }),
    })
  }
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

  it('matches common salary expectation phrasings', () => {
    expectBest({ label: 'Salary expectations' }, 'salaryExpectation')
    expectBest({ label: 'Salary' }, 'salaryExpectation')
    expectBest({ label: 'Desired compensation' }, 'salaryExpectation')
    expectBest({ label: 'Compensation expectations' }, 'salaryExpectation')
    expectBest({ label: 'Expected annual salary' }, 'salaryExpectation')
    expectBest(
      { label: 'What are your salary expectations?' },
      'salaryExpectation',
    )
    expectBest({ label: 'What is your desired salary?' }, 'salaryExpectation')
  })

  it('still blocks current/history salary labels', () => {
    expectBest({ label: 'Current salary' }, null)
    expectBest({ label: 'What is your current salary?' }, null)
    expectBest({ label: 'Salary history' }, null)
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

describe('review table — wrapped label own text (fix 1)', () => {
  it('strips select options from a wrapping label', () => {
    mount(`
      <label>Country
        <select id="c">
          <option value="">Select...</option>
          <option value="14">Australia</option>
          <option value="231">United States of America</option>
        </select>
      </label>
    `)
    fakeVisible()
    const select = document.getElementById('c') as HTMLSelectElement
    expect(extractSignals(select).label).toBe('Country')
    const result = fillPage(
      { ...EMPTY_PROFILE, country: 'United States' },
      [],
      { ...DEFAULT_SETTINGS, highlightFilled: false },
    )
    expect(select.value).toBe('231')
    expect(result.filled.some((f) => f.key === 'country')).toBe(true)
  })

  it('keeps Email for a wrapped text input', () => {
    mount('<label>Email <input id="e" type="email"></label>')
    const input = document.getElementById('e') as HTMLInputElement
    expect(extractSignals(input).label).toBe('Email')
  })

  it('dedupes wrapping label and label[for]', () => {
    mount(`
      <label for="c">Country</label>
      <label>Country <select id="c"><option value="">Select...</option></select></label>
    `)
    const select = document.getElementById('c') as HTMLSelectElement
    expect(extractSignals(select).label).toBe('Country')
  })
})
