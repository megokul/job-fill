/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import {
  collectFillableElements,
  extractSignals,
  isComboboxControl,
  queryAllDeep,
} from './matcher'

describe('shadow DOM and iframe document collection', () => {
  it('collects inputs inside open shadow roots', () => {
    document.body.innerHTML = `<div id="host"></div>`
    const host = document.getElementById('host')!
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<label>Email<input id="shadow-email" type="email" /></label>`
    const els = collectFillableElements(document, { isVisible: () => true })
    expect(els.some((el) => el.id === 'shadow-email')).toBe(true)
  })

  it('collects fillable elements from a nested document root (iframe stand-in)', () => {
    // happy-dom disables iframe page loading; use a detached document as the frame document.
    const doc = document.implementation.createHTMLDocument('frame')
    doc.body.innerHTML = `
      <label for="fn">First name</label>
      <input id="fn" name="first_name" />
    `
    const els = collectFillableElements(doc, { isVisible: () => true })
    expect(els).toHaveLength(1)
    expect(queryAllDeep(doc, 'input')).toHaveLength(1)
  })
})

describe('combobox detection', () => {
  it('classifies input role=combobox and inputs inside role=combobox', () => {
    document.body.innerHTML = `
      <label id="country-label">Country</label>
      <input id="country-cb" role="combobox" aria-labelledby="country-label" />
      <div role="combobox">
        <input id="inner-cb" />
      </div>
      <input id="plain" />
    `
    expect(isComboboxControl(document.getElementById('country-cb')!)).toBe(true)
    expect(isComboboxControl(document.getElementById('inner-cb')!)).toBe(true)
    expect(isComboboxControl(document.getElementById('plain')!)).toBe(false)
  })

  it('collects button/div listbox popups and reads aria-labelledby labels', () => {
    document.body.innerHTML = `
      <span id="auth-label">Work authorized</span>
      <button id="auth-btn" aria-haspopup="listbox" aria-labelledby="auth-label">Select…</button>
      <div id="loc-div" aria-haspopup="listbox" aria-label="Location">Choose</div>
    `
    const els = collectFillableElements(document, { isVisible: () => true })
    const btn = document.getElementById('auth-btn')!
    const div = document.getElementById('loc-div')!
    expect(els).toContain(btn)
    expect(els).toContain(div)
    expect(isComboboxControl(btn)).toBe(true)
    expect(isComboboxControl(div)).toBe(true)
    expect(extractSignals(btn).label).toMatch(/Work authorized/i)
  })

  it('prefers the inner combobox input over a wrapping listbox host', () => {
    document.body.innerHTML = `
      <div id="wrap" aria-haspopup="listbox">
        <input id="inner" role="combobox" />
      </div>
    `
    const els = collectFillableElements(document, { isVisible: () => true })
    expect(els.some((el) => el.id === 'inner')).toBe(true)
    expect(els.some((el) => el.id === 'wrap')).toBe(false)
  })
})
