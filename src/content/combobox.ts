import type { FillKey } from '../shared/types'
import { isComboboxControl } from './matcher'
import { pickOption } from './pickOption'

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

function optionsFromAriaRefs(el: HTMLElement): HTMLElement[] {
  const hosts: HTMLElement[] = [el]
  const combo = el.closest('[role="combobox"]')
  if (combo instanceof HTMLElement && combo !== el) hosts.push(combo)

  for (const host of hosts) {
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

async function waitForOptions(
  el: HTMLElement,
  timeoutMs: number,
): Promise<HTMLElement[]> {
  const doc = el.ownerDocument
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const fromAria = optionsFromAriaRefs(el)
    if (fromAria.length > 0) return fromAria

    for (const listbox of Array.from(doc.querySelectorAll('[role="listbox"]'))) {
      const opts = Array.from(
        listbox.querySelectorAll<HTMLElement>('[role="option"]'),
      )
      if (opts.length > 0) return opts
    }
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

function hideOwnedListboxes(el: HTMLElement): void {
  const hosts: HTMLElement[] = [el]
  const combo = el.closest('[role="combobox"]')
  if (combo instanceof HTMLElement) hosts.push(combo)
  for (const host of hosts) {
    const refs = [host.getAttribute('aria-controls'), host.getAttribute('aria-owns')]
      .filter((v): v is string => Boolean(v))
      .flatMap((v) => v.split(/\s+/).filter(Boolean))
    for (const id of refs) {
      const node = host.ownerDocument.getElementById(id)
      if (!node) continue
      node.setAttribute('hidden', '')
      ;(node as HTMLElement).style.display = 'none'
      node.querySelectorAll('[role="option"]').forEach((opt) => opt.remove())
    }
  }
}

function restoreAndClose(el: HTMLElement, originalText: string): void {
  if (el instanceof HTMLInputElement) {
    setInputText(el, originalText, true)
  }
  dispatchEscape(el)
  hideOwnedListboxes(el)
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  if (typeof el.blur === 'function') el.blur()
}

function controlShowsChosen(el: HTMLElement, chosenText: string): boolean {
  const shown = comboboxDisplayText(el).trim().toLowerCase()
  const want = chosenText.trim().toLowerCase()
  if (!shown || !want) return false
  return shown === want || shown.includes(want) || want.includes(shown)
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

  if (el instanceof HTMLInputElement) {
    setInputText(el, value, false)
  } else {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  }

  const optionEls = await waitForOptions(el, 1500)
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

  await sleep(30)
  if (!controlShowsChosen(el, chosenText)) {
    restoreAndClose(el, originalText)
    return false
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
