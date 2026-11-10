/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_PROFILE } from '../shared/types'
import { fillCombobox } from './combobox'
import { fillPage } from './filler'

const alwaysVisible = () => true

function mountTypeahead(): HTMLInputElement {
  document.body.innerHTML = `
    <label for="loc">Location</label>
    <input id="loc" role="combobox" aria-controls="loc-list" aria-expanded="false" value="" />
    <div id="loc-list" role="listbox" hidden></div>
  `
  const input = document.getElementById('loc') as HTMLInputElement
  const list = document.getElementById('loc-list') as HTMLElement
  input.addEventListener('input', () => {
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    const cities = ['San Francisco, CA', 'Austin, TX', 'Remote']
    list.innerHTML = cities
      .map((c) => `<div role="option" data-value="${c}">${c}</div>`)
      .join('')
  })
  list.addEventListener('click', (ev) => {
    const opt = (ev.target as HTMLElement).closest('[role="option"]') as HTMLElement | null
    if (!opt) return
    input.value = opt.getAttribute('data-value') ?? opt.textContent ?? ''
    list.hidden = true
    list.innerHTML = ''
    input.setAttribute('aria-expanded', 'false')
  })
  const close = () => {
    list.hidden = true
    list.innerHTML = ''
    input.setAttribute('aria-expanded', 'false')
  }
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') close()
  })
  return input
}

function mountButtonListbox(): HTMLButtonElement {
  document.body.innerHTML = `
    <span id="wa-label">Work authorized</span>
    <button id="wa" aria-haspopup="listbox" aria-labelledby="wa-label" aria-expanded="false">Select…</button>
  `
  const btn = document.getElementById('wa') as HTMLButtonElement
  btn.addEventListener('click', () => {
    let list = document.getElementById('wa-list')
    if (!list) {
      list = document.createElement('div')
      list.id = 'wa-list'
      list.setAttribute('role', 'listbox')
      list.innerHTML = `
        <div role="option" data-value="yes">Yes</div>
        <div role="option" data-value="no">No</div>
      `
      document.body.appendChild(list)
      list.addEventListener('click', (ev) => {
        const opt = (ev.target as HTMLElement).closest('[role="option"]') as HTMLElement | null
        if (!opt) return
        btn.textContent = opt.textContent
        btn.dataset.value = opt.getAttribute('data-value') ?? ''
        list?.remove()
        btn.setAttribute('aria-expanded', 'false')
      })
    }
    btn.setAttribute('aria-expanded', 'true')
  })
  return btn
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('fillCombobox', () => {
  it('selects a type-ahead option and leaves the chosen text', async () => {
    const input = mountTypeahead()
    const ok = await fillCombobox(input, 'San Francisco, CA', 'location')
    expect(ok).toBe(true)
    expect(input.value).toBe('San Francisco, CA')
    expect(document.getElementById('loc-list')?.hidden).toBe(true)
  })

  it('restores the original value when no option matches', async () => {
    const input = mountTypeahead()
    input.value = ''
    const ok = await fillCombobox(input, 'Atlantis', 'location')
    expect(ok).toBe(false)
    expect(input.value).toBe('')
    expect(document.getElementById('loc-list')?.hidden).toBe(true)
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0)
  })

  it('fills a button-style listbox for yes/no', async () => {
    const btn = mountButtonListbox()
    const ok = await fillCombobox(btn, 'yes', 'workAuthorized')
    expect(ok).toBe(true)
    expect(btn.textContent).toMatch(/Yes/i)
  })
})

describe('fillPage combobox integration', () => {
  it('fills closed-set combobox keys via heuristics', async () => {
    mountTypeahead()
    const result = await fillPage(
      { ...EMPTY_PROFILE, city: 'Austin', state: 'TX' },
      [],
      { ...DEFAULT_SETTINGS, highlightFilled: false },
      { isVisible: alwaysVisible },
    )
    expect(result.filled.some((f) => f.key === 'location')).toBe(true)
    expect((document.getElementById('loc') as HTMLInputElement).value).toBe('Austin, TX')
  })
})
