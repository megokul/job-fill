/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { collectFillableElements, queryAllDeep } from './matcher'

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
