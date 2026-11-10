import { countryAliases, stateAliases } from '../shared/regions'
import type { FillKey } from '../shared/types'
import { isComboboxControl } from './matcher'
import { pickOption } from './pickOption'

/** Prefer a long alias so short codes (US/CA) do not substring-filter the menu. */
function filterTextForCombobox(value: string, fillKey: FillKey | null): string {
  const aliases =
    fillKey === 'country'
      ? countryAliases(value)
      : fillKey === 'state'
        ? stateAliases(value)
        : []
  if (aliases.length === 0) return value
  return [...aliases].sort((a, b) => b.length - a.length)[0] ?? value
}

export const CLOSED_COMBOBOX_KEYS = new Set<FillKey>([
  'country',
  'state',
  'location',
  'workAuthorized',
  'requiresSponsorship',
])

export function comboboxDisplayText(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) return el.value
  const single = el.querySelector('[data-value], .job-fill-combo-value')
  if (single?.textContent) {
    return single.textContent.replace(/\s+/g, ' ').trim()
  }
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function isComboboxEmpty(el: HTMLElement): boolean {
  const text = comboboxDisplayText(el).trim().toLowerCase()
  if (!text) return true
  return (
    text.startsWith('select') ||
    text.startsWith('choose') ||
    text.includes('please select') ||
    text === '…' ||
    text === '...'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function setInputText(el: HTMLInputElement, value: string, blur: boolean): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  el.dispatchEvent(new Event('focus', { bubbles: true }))
  if (descriptor?.set) descriptor.set.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  if (blur) {
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }
}

function comboboxHosts(el: HTMLElement): HTMLElement[] {
  const hosts: HTMLElement[] = [el]
  const combo = el.closest('[role="combobox"]')
  if (combo instanceof HTMLElement && combo !== el) hosts.push(combo)
  return hosts
}

function optionsFromAriaRefs(el: HTMLElement): HTMLElement[] {
  for (const host of comboboxHosts(el)) {
    const refs = [host.getAttribute('aria-controls'), host.getAttribute('aria-owns')]
      .filter((v): v is string => Boolean(v))
      .flatMap((v) => v.split(/\s+/).filter(Boolean))
    for (const id of refs) {
      const container = host.ownerDocument.getElementById(id)
      if (!container) continue
      const opts = Array.from(
        container.querySelectorAll<HTMLElement>('[role="option"]'),
      )
      if (opts.length > 0) return opts
    }
  }
  return []
}

function optionsFromActiveDescendant(el: HTMLElement): HTMLElement[] {
  for (const host of comboboxHosts(el)) {
    const id = host.getAttribute('aria-activedescendant')
    if (!id) continue
    const active = host.ownerDocument.getElementById(id)
    if (!active) continue
    const listbox = active.closest('[role="listbox"]')
    if (!listbox) continue
    const opts = Array.from(
      listbox.querySelectorAll<HTMLElement>('[role="option"]'),
    )
    if (opts.length > 0) return opts
  }
  return []
}

/** Listboxes that already expose options before the control is opened. */
export function listboxesWithVisibleOptions(doc: ParentNode = document): Set<Element> {
  const out = new Set<Element>()
  for (const listbox of Array.from(doc.querySelectorAll('[role="listbox"]'))) {
    if ((listbox as HTMLElement).hidden) continue
    const opts = listbox.querySelectorAll('[role="option"]')
    if (opts.length === 0) continue
    out.add(listbox)
  }
  return out
}

/**
 * Discover options only from aria-controls/owns, aria-activedescendant's
 * listbox, or a listbox that gained visible options after open.
 */
export function discoverComboboxOptions(
  el: HTMLElement,
  preexistingListboxes: Set<Element>,
): HTMLElement[] {
  const fromAria = optionsFromAriaRefs(el)
  if (fromAria.length > 0) return fromAria

  const fromActive = optionsFromActiveDescendant(el)
  if (fromActive.length > 0) return fromActive

  const doc = el.ownerDocument
  for (const listbox of Array.from(doc.querySelectorAll('[role="listbox"]'))) {
    if (preexistingListboxes.has(listbox)) continue
    if ((listbox as HTMLElement).hidden) continue
    const opts = Array.from(
      listbox.querySelectorAll<HTMLElement>('[role="option"]'),
    )
    if (opts.length > 0) return opts
  }
  return []
}

async function waitForOptions(
  el: HTMLElement,
  timeoutMs: number,
  preexistingListboxes: Set<Element>,
): Promise<HTMLElement[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = discoverComboboxOptions(el, preexistingListboxes)
    if (found.length > 0) return found
    await sleep(40)
  }
  return []
}

function dispatchEscape(el: HTMLElement): void {
  const opts: KeyboardEventInit = {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true,
  }
  el.dispatchEvent(new KeyboardEvent('keydown', opts))
  el.dispatchEvent(new KeyboardEvent('keyup', opts))
}

/**
 * Close a scripted dropdown without mutating the site's option nodes.
 * Escape + outside click + blur; if the list stays open, leave it alone.
 */
function restoreAndClose(el: HTMLElement, originalText: string): void {
  if (el instanceof HTMLInputElement) {
    setInputText(el, originalText, true)
  }
  dispatchEscape(el)
  const body = el.ownerDocument.body
  body.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
  )
  body.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
  )
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  if (typeof el.blur === 'function') el.blur()
}

function controlShowsChosen(el: HTMLElement, chosenText: string): boolean {
  const want = chosenText.trim().toLowerCase()
  if (!want) return false

  const candidates: string[] = [comboboxDisplayText(el)]
  // react-select keeps the filter input empty after selection and renders
  // the chosen label in a sibling single-value node under the control.
  const controlRoot =
    el.closest('[class*="-control"]') ??
    el.closest('[class*="control"]') ??
    el.closest('[role="combobox"]') ??
    el.parentElement
  if (controlRoot) {
    candidates.push(controlRoot.textContent ?? '')
    const single = controlRoot.querySelector(
      '[class*="single-value"], [class*="SingleValue"]',
    )
    if (single?.textContent) candidates.push(single.textContent)
  }
  const combo = el.closest('[role="combobox"]')
  if (combo && combo !== el) candidates.push(combo.textContent ?? '')

  for (const raw of candidates) {
    const shown = raw.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!shown) continue
    if (shown === want || shown.includes(want) || want.includes(shown)) return true
  }
  return false
}

/**
 * Open a scripted dropdown, pick a matching option, verify the control.
 * On failure restores the original text and closes the menu.
 */
export async function fillCombobox(
  el: HTMLElement,
  value: string,
  fillKey: FillKey | null,
): Promise<boolean> {
  if (!isComboboxControl(el)) return false
  const originalText =
    el instanceof HTMLInputElement ? el.value : comboboxDisplayText(el)

  const preexistingListboxes = listboxesWithVisibleOptions(el.ownerDocument)

  // Open: click the control first (react-select opens on mouse down/focus),
  // then type the filter text into input comboboxes.
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  if (typeof el.focus === 'function') el.focus()

  if (el instanceof HTMLInputElement) {
    setInputText(el, filterTextForCombobox(value, fillKey), false)
  }

  const optionEls = await waitForOptions(el, 1500, preexistingListboxes)
  if (optionEls.length === 0) {
    restoreAndClose(el, originalText)
    return false
  }

  const pickable = optionEls.map((opt) => ({
    text: (opt.textContent ?? '').replace(/\s+/g, ' ').trim(),
    value:
      opt.getAttribute('data-value') ??
      opt.getAttribute('value') ??
      undefined,
  }))
  const idx = pickOption(pickable, value, fillKey)
  if (idx < 0) {
    restoreAndClose(el, originalText)
    return false
  }

  const chosen = optionEls[idx]
  const chosenText = pickable[idx].text
  const mouse = { bubbles: true, cancelable: true, view: window }
  chosen.dispatchEvent(new MouseEvent('mousedown', mouse))
  chosen.dispatchEvent(new MouseEvent('mouseup', mouse))
  chosen.dispatchEvent(new MouseEvent('click', mouse))

  await sleep(50)
  if (!controlShowsChosen(el, chosenText)) {
    // react-select may have applied the value via React state even when the
    // filter input is empty — re-check after a short settle.
    await sleep(100)
    if (!controlShowsChosen(el, chosenText)) {
      restoreAndClose(el, originalText)
      return false
    }
  }
  return true
}

export function canFillAsCombobox(
  el: HTMLElement,
  fillKey: FillKey | null,
  isCustomAnswer: boolean,
): boolean {
  if (!isComboboxControl(el)) return false
  if (isCustomAnswer) return true
  return fillKey != null && CLOSED_COMBOBOX_KEYS.has(fillKey)
}
