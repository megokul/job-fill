/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_PROFILE, type Profile } from '../shared/types'
import { fillPage, selectOptionForTest, setControlValue } from './filler'
import { undoLastFill } from './undo'
import { distractorsHtml } from './fixtures/distractors'
import { labelForHtml } from './fixtures/labelFor'
import { radioGroupsHtml } from './fixtures/radioGroups'
import { selectsHtml } from './fixtures/selects'
import { wrappedLabelHtml } from './fixtures/wrappedLabel'
import {
  collectFillableElements,
  extractSignals,
  matchFields,
  scoreField,
} from './matcher'

const alwaysVisible = () => true

const sampleProfile: Profile = {
  ...EMPTY_PROFILE,
  firstName: 'Ada',
  lastName: 'Lovelace',
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
  workAuthorized: 'yes',
  requiresSponsorship: 'no',
  salaryExpectation: '120000',
}

export function mount(html: string): void {
  document.body.innerHTML = html
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('collectFillableElements visibility injection', () => {
  it('uses injectable isVisible for happy-dom', () => {
    mount(labelForHtml)
    const none = collectFillableElements(document, {
      isVisible: () => false,
    })
    const all = collectFillableElements(document, { isVisible: alwaysVisible })
    expect(none).toHaveLength(0)
    expect(all.length).toBeGreaterThan(0)
  })
})

describe('confirmed matcher false positives fixed', () => {
  it('does not match "How did you hear about this opportunity?"', () => {
    expect(
      scoreField({ label: 'How did you hear about this opportunity?' }, 'addressLine2'),
    ).toBe(0)
  })

  it('does not match "Ethnicity" to city', () => {
    expect(scoreField({ label: 'Ethnicity' }, 'city')).toBe(0)
  })

  it('does not match "Personal statement" to state', () => {
    expect(scoreField({ label: 'Personal statement' }, 'state')).toBe(0)
  })

  it('does not match "Tell us about yourself" to phone', () => {
    expect(scoreField({ label: 'Tell us about yourself' }, 'phone')).toBe(0)
  })

  it('does not match "Hotel preference" to phone', () => {
    expect(scoreField({ label: 'Hotel preference' }, 'phone')).toBe(0)
  })

  it('does not match "Reference last name" to lastName', () => {
    expect(scoreField({ label: 'Reference last name' }, 'lastName')).toBe(0)
  })

  it('matches "Full name" as fullName', () => {
    expect(scoreField({ label: 'Full name' }, 'fullName')).toBeGreaterThanOrEqual(40)
  })

  it('maps autocomplete address-level2 to city, not addressLine1', () => {
    expect(scoreField({ autocomplete: 'address-level2' }, 'city')).toBeGreaterThan(
      scoreField({ autocomplete: 'address-level2' }, 'addressLine1'),
    )
  })

  it('maps autocomplete address-level1 to state, not addressLine1', () => {
    expect(scoreField({ autocomplete: 'address-level1' }, 'state')).toBeGreaterThan(
      scoreField({ autocomplete: 'address-level1' }, 'addressLine1'),
    )
  })

  it('maps autocomplete url to portfolioUrl', () => {
    expect(scoreField({ autocomplete: 'url' }, 'portfolioUrl')).toBeGreaterThanOrEqual(40)
  })
})

describe('selectOption fixes', () => {
  it('matches Yes/No select options by value or text separately', () => {
    mount(selectsHtml)
    const select = document.getElementById('auth') as HTMLSelectElement
    const ok = selectOptionForTest(select, 'yes', 'workAuthorized')
    expect(ok).toBe(true)
    expect(select.value).toBe('1')
  })

  it('does not select Australia when country is US via substring', () => {
    mount(selectsHtml)
    const select = document.getElementById('country') as HTMLSelectElement
    selectOptionForTest(select, 'US', 'country')
    expect(select.selectedOptions[0]?.text).not.toMatch(/Australia/i)
    expect(select.selectedOptions[0]?.text).toMatch(/United States/i)
  })

  it('does not select American Samoa when state is CA via substring', () => {
    mount(selectsHtml)
    const select = document.getElementById('state') as HTMLSelectElement
    selectOptionForTest(select, 'CA', 'state')
    expect(select.selectedOptions[0]?.text).not.toMatch(/American Samoa/i)
    expect(select.selectedOptions[0]?.text).toMatch(/California/i)
  })
})

describe('native setter and radios', () => {
  it('does not call focus() when setting text (avoids page scroll)', () => {
    mount('<input id="x" />')
    const el = document.getElementById('x') as HTMLInputElement
    let focused = false
    el.focus = () => {
      focused = true
    }
    setControlValue(el, 'Ada', 'firstName')
    expect(focused).toBe(false)
    expect(el.value).toBe('Ada')
  })

  it('sets value through native setter so input listeners see it', () => {
    mount('<input id="x" />')
    const el = document.getElementById('x') as HTMLInputElement
    let seen = ''
    el.addEventListener('input', () => {
      seen = el.value
    })
    setControlValue(el, 'Ada', 'firstName')
    expect(seen).toBe('Ada')
  })

  it('treats radio groups as one field using the legend question', () => {
    mount(radioGroupsHtml)
    const els = collectFillableElements(document, { isVisible: alwaysVisible })
    const radios = els.filter(
      (el) => el instanceof HTMLInputElement && el.type === 'radio',
    )
    expect(radios.length).toBe(3)
    const work = radios.find((r) => (r as HTMLInputElement).name === 'work_auth')!
    const signals = extractSignals(work)
    expect(signals.label?.toLowerCase()).toContain('authorized to work')
  })
})

describe('fixture smoke', () => {
  it('mounts distractors and does not heuristically fill them', () => {
    mount(distractorsHtml)
    for (const el of document.querySelectorAll('input,textarea,select')) {
      Object.defineProperty(el, 'getBoundingClientRect', {
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
    const result = fillPage(sampleProfile, [], {
      ...DEFAULT_SETTINGS,
      highlightFilled: false,
    })
    expect(result.filled).toHaveLength(0)
  })

  it('mounts wrapped labels and matches full name', () => {
    mount(wrappedLabelHtml)
    const els = collectFillableElements(document, { isVisible: alwaysVisible })
    expect(els.length).toBe(4)
    const matches = matchFields(els)
    expect(matches.some((m) => m.fillKey === 'fullName')).toBe(true)
  })

  it('fillPage fills labelFor autocomplete fields', () => {
    mount(labelForHtml)
    for (const el of document.querySelectorAll('input,textarea,select')) {
      Object.defineProperty(el, 'getBoundingClientRect', {
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
    const result = fillPage(sampleProfile, [], {
      ...DEFAULT_SETTINGS,
      highlightFilled: false,
    })
    expect(result.filled.length).toBeGreaterThan(5)
    expect((document.getElementById('given') as HTMLInputElement).value).toBe('Ada')
    expect((document.getElementById('city') as HTMLInputElement).value).toBe('London')
  })
})

describe('fill → undo round trip', () => {
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

  it('restores text input', () => {
    mount('<label for="fn">First name</label><input id="fn" name="first_name" />')
    fakeVisible()
    fillPage(sampleProfile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    expect((document.getElementById('fn') as HTMLInputElement).value).toBe('Ada')
    undoLastFill()
    expect((document.getElementById('fn') as HTMLInputElement).value).toBe('')
  })

  it('restores select', () => {
    mount(`
      <label for="country">Country</label>
      <select id="country" name="country">
        <option value="">Select…</option>
        <option value="840">United States</option>
        <option value="36">Australia</option>
      </select>
    `)
    fakeVisible()
    const result = fillPage(sampleProfile, [], {
      ...DEFAULT_SETTINGS,
      highlightFilled: false,
    })
    const country = document.getElementById('country') as HTMLSelectElement
    expect(result.filled.some((f) => f.key === 'country')).toBe(true)
    expect(country.value).toBe('840')
    undoLastFill()
    expect(country.value).toBe('')
  })

  it('restores checkbox', () => {
    mount(
      '<label><input id="wa" type="checkbox" name="work_authorized" /> Authorized to work</label>',
    )
    fakeVisible()
    fillPage(sampleProfile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    expect((document.getElementById('wa') as HTMLInputElement).checked).toBe(true)
    undoLastFill()
    expect((document.getElementById('wa') as HTMLInputElement).checked).toBe(false)
  })

  it('restores radio group', () => {
    mount(radioGroupsHtml)
    fakeVisible()
    fillPage(sampleProfile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    const yes = document.querySelector(
      'input[name="work_auth"][value="yes"]',
    ) as HTMLInputElement
    expect(yes.checked).toBe(true)
    undoLastFill()
    const anyChecked = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="work_auth"]'),
    ).some((r) => r.checked)
    expect(anyChecked).toBe(false)
  })
})
