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
  it('uses injectable isVisible for happy-dom', async () => {
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
  it('does not match "How did you hear about this opportunity?"', async () => {
    expect(
      scoreField({ label: 'How did you hear about this opportunity?' }, 'addressLine2'),
    ).toBe(0)
  })

  it('does not match "Ethnicity" to city', async () => {
    expect(scoreField({ label: 'Ethnicity' }, 'city')).toBe(0)
  })

  it('does not match "Personal statement" to state', async () => {
    expect(scoreField({ label: 'Personal statement' }, 'state')).toBe(0)
  })

  it('does not match "Tell us about yourself" to phone', async () => {
    expect(scoreField({ label: 'Tell us about yourself' }, 'phone')).toBe(0)
  })

  it('does not match "Hotel preference" to phone', async () => {
    expect(scoreField({ label: 'Hotel preference' }, 'phone')).toBe(0)
  })

  it('does not match "Reference last name" to lastName', async () => {
    expect(scoreField({ label: 'Reference last name' }, 'lastName')).toBe(0)
  })

  it('matches "Full name" as fullName', async () => {
    expect(scoreField({ label: 'Full name' }, 'fullName')).toBeGreaterThanOrEqual(40)
  })

  it('maps autocomplete address-level2 to city, not addressLine1', async () => {
    expect(scoreField({ autocomplete: 'address-level2' }, 'city')).toBeGreaterThan(
      scoreField({ autocomplete: 'address-level2' }, 'addressLine1'),
    )
  })

  it('maps autocomplete address-level1 to state, not addressLine1', async () => {
    expect(scoreField({ autocomplete: 'address-level1' }, 'state')).toBeGreaterThan(
      scoreField({ autocomplete: 'address-level1' }, 'addressLine1'),
    )
  })

  it('maps autocomplete url to portfolioUrl', async () => {
    expect(scoreField({ autocomplete: 'url' }, 'portfolioUrl')).toBeGreaterThanOrEqual(40)
  })
})

describe('selectOption fixes', () => {
  it('matches Yes/No select options by value or text separately', async () => {
    mount(selectsHtml)
    const select = document.getElementById('auth') as HTMLSelectElement
    const ok = selectOptionForTest(select, 'yes', 'workAuthorized')
    expect(ok).toBe(true)
    expect(select.value).toBe('1')
  })

  it('does not select Australia when country is US via substring', async () => {
    mount(selectsHtml)
    const select = document.getElementById('country') as HTMLSelectElement
    selectOptionForTest(select, 'US', 'country')
    expect(select.selectedOptions[0]?.text).not.toMatch(/Australia/i)
    expect(select.selectedOptions[0]?.text).toMatch(/United States/i)
  })

  it('does not select American Samoa when state is CA via substring', async () => {
    mount(selectsHtml)
    const select = document.getElementById('state') as HTMLSelectElement
    selectOptionForTest(select, 'CA', 'state')
    expect(select.selectedOptions[0]?.text).not.toMatch(/American Samoa/i)
    expect(select.selectedOptions[0]?.text).toMatch(/California/i)
  })
})

describe('native setter and radios', () => {
  it('does not call focus() when setting text (avoids page scroll)', async () => {
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

  it('sets value through native setter so input listeners see it', async () => {
    mount('<input id="x" />')
    const el = document.getElementById('x') as HTMLInputElement
    let seen = ''
    el.addEventListener('input', () => {
      seen = el.value
    })
    setControlValue(el, 'Ada', 'firstName')
    expect(seen).toBe('Ada')
  })

  it('treats radio groups as one field using the legend question', async () => {
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

  it('collects two identical nameless radiogroups as separate fields and both get answered', async () => {
    const group = `
      <div role="radiogroup">
        <label><input type="radio" value="yes" /> Yes</label>
        <label><input type="radio" value="no" /> No</label>
      </div>
    `
    mount(`<form>${group}${group}</form>`)
    const els = collectFillableElements(document, { isVisible: alwaysVisible })
    const radios = els.filter(
      (el) => el instanceof HTMLInputElement && el.type === 'radio',
    ) as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios[0]).not.toBe(radios[1])

    setControlValue(radios[0], 'yes', 'workAuthorized')
    setControlValue(radios[1], 'no', 'requiresSponsorship')
    const yes0 = radios[0]
      .closest('[role="radiogroup"]')!
      .querySelector<HTMLInputElement>('input[value="yes"]')!
    const no1 = radios[1]
      .closest('[role="radiogroup"]')!
      .querySelector<HTMLInputElement>('input[value="no"]')!
    expect(yes0.checked).toBe(true)
    expect(no1.checked).toBe(true)
  })
})

describe('fixture smoke', () => {
  it('mounts distractors and does not heuristically fill them', async () => {
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
    const result = await fillPage(sampleProfile, [], {
      ...DEFAULT_SETTINGS,
      highlightFilled: false,
    })
    expect(result.filled).toHaveLength(0)
  })

  it('mounts wrapped labels and matches full name', async () => {
    mount(wrappedLabelHtml)
    const els = collectFillableElements(document, { isVisible: alwaysVisible })
    expect(els.length).toBe(4)
    const matches = matchFields(els)
    expect(matches.some((m) => m.fillKey === 'fullName')).toBe(true)
  })

  it('fillPage fills labelFor autocomplete fields', async () => {
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
    const result = await fillPage(sampleProfile, [], {
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

  it('restores text input', async () => {
    mount('<label for="fn">First name</label><input id="fn" name="first_name" />')
    fakeVisible()
    await fillPage(sampleProfile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    expect((document.getElementById('fn') as HTMLInputElement).value).toBe('Ada')
    undoLastFill()
    expect((document.getElementById('fn') as HTMLInputElement).value).toBe('')
  })

  it('restores select', async () => {
    mount(`
      <label for="country">Country</label>
      <select id="country" name="country">
        <option value="">Select…</option>
        <option value="840">United States</option>
        <option value="36">Australia</option>
      </select>
    `)
    fakeVisible()
    const result = await fillPage(sampleProfile, [], {
      ...DEFAULT_SETTINGS,
      highlightFilled: false,
    })
    const country = document.getElementById('country') as HTMLSelectElement
    expect(result.filled.some((f) => f.key === 'country')).toBe(true)
    expect(country.value).toBe('840')
    undoLastFill()
    expect(country.value).toBe('')
  })

  it('restores checkbox', async () => {
    mount(
      '<label><input id="wa" type="checkbox" name="work_authorized" /> Authorized to work</label>',
    )
    fakeVisible()
    await fillPage(sampleProfile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    expect((document.getElementById('wa') as HTMLInputElement).checked).toBe(true)
    undoLastFill()
    expect((document.getElementById('wa') as HTMLInputElement).checked).toBe(false)
  })

  it('restores radio group after filling yes', async () => {
    mount(radioGroupsHtml)
    fakeVisible()
    await fillPage(sampleProfile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    const yes = document.querySelector(
      'input[name="work_auth"][value="yes"]',
    ) as HTMLInputElement
    expect(yes.checked).toBe(true)
    const { restored } = undoLastFill()
    expect(restored).toBeGreaterThan(0)
    const anyChecked = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="work_auth"]'),
    ).some((r) => r.checked)
    expect(anyChecked).toBe(false)
  })

  it('fills a mapped custom answer into a textarea', async () => {
    mount('<label for="why">Why us?</label><textarea id="why" name="why"></textarea>')
    fakeVisible()
    const answerId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const result = await fillPage(
      sampleProfile,
      [
        {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          name: 'Test',
          origin: location.origin,
          pathPattern: '*',
          updatedAt: Date.now(),
          fields: [
            {
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              selector: '#why',
              match: { label: 'Why us?' },
              customAnswerId: answerId,
            },
          ],
        },
      ],
      { ...DEFAULT_SETTINGS, highlightFilled: false },
      {
        customAnswers: [
          {
            id: answerId,
            question: 'Why us?',
            answer: 'Mission fit',
            updatedAt: 1,
          },
        ],
      },
    )
    expect((document.getElementById('why') as HTMLTextAreaElement).value).toBe('Mission fit')
    expect(result.filled[0]?.source).toBe('custom')
    expect(result.filled[0]?.target).toBe('Why us?')
  })

  it('fills a mapped custom answer into a select', async () => {
    mount(`
      <label for="hear">How did you hear?</label>
      <select id="hear" name="hear">
        <option value="">Select</option>
        <option value="linkedin">LinkedIn</option>
        <option value="friend">Friend</option>
      </select>
    `)
    fakeVisible()
    const answerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const result = await fillPage(
      sampleProfile,
      [
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Test',
          origin: location.origin,
          pathPattern: '*',
          updatedAt: Date.now(),
          fields: [
            {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              selector: '#hear',
              match: { label: 'How did you hear?' },
              customAnswerId: answerId,
            },
          ],
        },
      ],
      { ...DEFAULT_SETTINGS, highlightFilled: false },
      {
        customAnswers: [
          {
            id: answerId,
            question: 'How did you hear?',
            answer: 'LinkedIn',
            updatedAt: 1,
          },
        ],
      },
    )
    expect((document.getElementById('hear') as HTMLSelectElement).value).toBe('linkedin')
    expect(result.filled[0]?.source).toBe('custom')
    expect(result.filled[0]?.target).toBe('How did you hear?')
  })

  it('unchecks radio group after filling no then undo', async () => {
    mount(`
      <fieldset>
        <legend>Will you require sponsorship?</legend>
        <label><input type="radio" name="sponsor" value="yes" /> Yes</label>
        <label><input type="radio" name="sponsor" value="no" /> No</label>
      </fieldset>
    `)
    fakeVisible()
    const profile = { ...sampleProfile, requiresSponsorship: 'no' as const }
    await fillPage(profile, [], { ...DEFAULT_SETTINGS, highlightFilled: false })
    const no = document.querySelector(
      'input[name="sponsor"][value="no"]',
    ) as HTMLInputElement
    expect(no.checked).toBe(true)
    const { restored } = undoLastFill()
    expect(restored).toBe(1)
    expect(no.checked).toBe(false)
    const anyChecked = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="sponsor"]'),
    ).some((r) => r.checked)
    expect(anyChecked).toBe(false)
  })
})
