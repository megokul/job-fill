import type { FilledField, FillResult } from '../shared/messages'
import { mappingsForUrl } from '../shared/pathMatch'
import { resolveValue } from '../shared/resolveValue'
import { pickOption } from './pickOption'
import type {
  CustomAnswer,
  FieldMapping,
  FillKey,
  FormMapping,
  Profile,
  Settings,
} from '../shared/types'
import { FILL_KEY_LABELS } from '../shared/types'
import {
  canFillAsCombobox,
  comboboxDisplayText,
  fillCombobox,
  isComboboxEmpty,
} from './combobox'
import {
  collectFillableElements,
  extractSignals,
  getRadioGroupMembers,
  isComboboxControl,
  labelOwnText,
  matchFields,
  type FieldSignals,
} from './matcher'
import { setHighlight, showHostToast } from './ui/host'
import {
  beginUndoSnapshot,
  capturePrevious,
  recordUndo,
} from './undo'

const CHECKBOX_KEYS = new Set<FillKey>(['workAuthorized', 'requiresSponsorship'])

async function applyValue(
  el: HTMLElement,
  value: string,
  fillKey: FillKey | null,
  isCustomAnswer: boolean,
): Promise<boolean> {
  if (isComboboxControl(el)) {
    if (canFillAsCombobox(el, fillKey, isCustomAnswer)) {
      return fillCombobox(el, value, fillKey)
    }
    // Address-style autocomplete widgets mark inputs as comboboxes but take
    // free text. Fill as plain text and Escape any suggestion popup.
    // Button-style comboboxes with open keys stay skipped.
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const ok = setControlValue(el, value, fillKey)
      if (ok) {
        el.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
          }),
        )
      }
      return ok
    }
    return false
  }
  return setControlValue(el, value, fillKey)
}

export async function fillPage(
  profile: Profile,
  formMappings: FormMapping[],
  settings: Settings,
  options?: {
    isVisible?: (el: HTMLElement) => boolean
    customAnswers?: CustomAnswer[]
    /** Watcher: skip and never re-fill these elements (even if cleared). */
    alreadyFilled?: WeakSet<HTMLElement>
  },
): Promise<FillResult> {
  beginUndoSnapshot()

  const filled: FilledField[] = []
  let skippedNonEmpty = 0
  const filledElements = new Set<HTMLElement>()
  const customAnswers = options?.customAnswers ?? []
  const alreadyFilled = options?.alreadyFilled

  const elements = collectFillableElements(document, options).filter(
    (el) => !alreadyFilled?.has(el),
  )
  const applicable = mappingsForUrl(formMappings, location.href)

  for (const mapping of applicable) {
    for (const field of mapping.fields) {
      const el = resolveMappedElement(field, elements)
      if (!el || filledElements.has(el)) continue
      if (alreadyFilled?.has(el)) continue
      if (!isEmptyControl(el)) {
        skippedNonEmpty++
        continue
      }

      if (field.customAnswerId) {
        const answer = customAnswers.find((a) => a.id === field.customAnswerId)
        if (!answer?.answer.trim()) continue
        const previous = capturePrevious(el)
        if (await applyValue(el, answer.answer, null, true)) {
          filledElements.add(el)
          alreadyFilled?.add(el)
          recordUndo({ element: el, previous })
          filled.push({
            label: bestLabel(extractSignals(el)),
            target: answer.question || 'Custom answer',
            source: 'custom',
          })
          if (settings.highlightFilled) highlight(el)
        }
        continue
      }

      if (!field.profileKey) continue
      const value = resolveValue(profile, field.profileKey)
      if (!String(value ?? '').trim()) continue
      const previous = capturePrevious(el)
      if (await applyValue(el, value, field.profileKey, false)) {
        filledElements.add(el)
        alreadyFilled?.add(el)
        recordUndo({ element: el, previous })
        filled.push({
          label: bestLabel(extractSignals(el)),
          target: FILL_KEY_LABELS[field.profileKey],
          key: field.profileKey,
          source: 'mapping',
        })
        if (settings.highlightFilled) highlight(el)
      }
    }
  }

  const remaining = elements.filter((el) => !filledElements.has(el) && isEmptyControl(el))
  const matches = matchFields(remaining)

  for (const match of matches) {
    if (filledElements.has(match.element)) continue
    if (alreadyFilled?.has(match.element)) continue
    const value = resolveValue(profile, match.fillKey)
    if (!String(value ?? '').trim()) continue
    const previous = capturePrevious(match.element)
    if (await applyValue(match.element, value, match.fillKey, false)) {
      filledElements.add(match.element)
      alreadyFilled?.add(match.element)
      recordUndo({ element: match.element, previous })
      filled.push({
        label: bestLabel(match.signals),
        target: FILL_KEY_LABELS[match.fillKey],
        key: match.fillKey,
        source: 'heuristic',
      })
      if (settings.highlightFilled) highlight(match.element)
    }
  }

  const unmatched = elements
    .filter((el) => !filledElements.has(el) && isEmptyControl(el))
    .map((el) => ({ label: bestLabel(extractSignals(el)) }))
    .filter((u) => u.label)
    .slice(0, 20)

  return {
    filled,
    skippedNonEmpty,
    unmatched,
    frameUrl: typeof location !== 'undefined' ? location.href : '',
  }
}

export function bestLabel(signals: FieldSignals): string {
  return (
    signals.label ||
    signals.ariaLabel ||
    signals.placeholder ||
    signals.name ||
    signals.id ||
    ''
  )
}

export function resolveMappedElement(
  field: FieldMapping,
  elements: HTMLElement[] = collectFillableElements(),
): HTMLElement | null {
  if (field.selector) {
    try {
      const found = document.querySelector<HTMLElement>(field.selector)
      if (found && elements.includes(found)) return found
    } catch {
      // invalid selector
    }
  }

  let best: HTMLElement | null = null
  let bestScore = 0
  for (const el of elements) {
    const signals = extractSignals(el)
    const score = signalSimilarity(field.match, signals)
    if (score > bestScore) {
      bestScore = score
      best = el
    }
  }
  return bestScore >= 50 ? best : null
}

export function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${cssEscape(el.id)}`

  const input = el as HTMLInputElement
  if (input.name) {
    const tag = el.tagName.toLowerCase()
    const sel = `${tag}[name="${cssAttr(input.name)}"]`
    if (document.querySelectorAll(sel).length === 1) return sel
  }

  const path: string[] = []
  let current: HTMLElement | null = el
  while (current && current !== document.body && path.length < 5) {
    let part = current.tagName.toLowerCase()
    if (current.id) {
      path.unshift(`#${cssEscape(current.id)}`)
      break
    }
    const parent: HTMLElement | null = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => (c as HTMLElement).tagName === current!.tagName,
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        part += `:nth-of-type(${index})`
      }
    }
    path.unshift(part)
    current = parent
  }
  return path.join(' > ')
}

export function setControlValue(
  el: HTMLElement,
  value: string,
  fillKey: FillKey | null,
): boolean {
  if (el instanceof HTMLSelectElement) {
    return selectOption(el, value, fillKey)
  }

  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (type === 'checkbox') {
      if (!fillKey || !CHECKBOX_KEYS.has(fillKey)) return false
      const shouldCheck = toBoolean(value)
      if (shouldCheck === null) return false
      return setChecked(el, shouldCheck)
    }
    if (type === 'radio') {
      return selectRadio(el, value)
    }
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value)
    return true
  }

  return false
}

/** Exported for unit tests. */
export function selectOptionForTest(
  select: HTMLSelectElement,
  value: string,
  fillKey: FillKey = 'country',
): boolean {
  return selectOption(select, value, fillKey)
}

function selectOption(
  select: HTMLSelectElement,
  value: string,
  fillKey: FillKey | null,
): boolean {
  const options = Array.from(select.options).map((opt) => ({
    text: opt.text,
    value: opt.value,
  }))
  const idx = pickOption(options, value, fillKey)
  if (idx < 0) return false
  setNativeSelect(select, select.options[idx].value)
  return true
}

function isYesToken(raw: string): boolean {
  return /^(yes|y|true|1)$/i.test(raw.trim())
}

function isNoToken(raw: string): boolean {
  return /^(no|n|false|0)$/i.test(raw.trim())
}

function selectRadio(radio: HTMLInputElement, value: string): boolean {
  const group = getRadioGroupMembers(radio)
  const bool = toBoolean(value)
  for (const r of group) {
    const label = optionLabel(r).toLowerCase()
    const val = (r.value ?? '').toLowerCase()
    if (bool === true && (isYesToken(val) || /\byes\b/.test(label))) {
      return setChecked(r, true)
    }
    if (bool === false && (isNoToken(val) || /\bno\b/.test(label))) {
      return setChecked(r, true)
    }
    if (val === value.toLowerCase() || label === value.toLowerCase()) {
      return setChecked(r, true)
    }
  }
  return false
}

export { getRadioGroupMembers }

function optionLabel(r: HTMLInputElement): string {
  if (r.id) {
    const lab = document.querySelector(`label[for="${cssEscape(r.id)}"]`)
    if (lab) {
      const text = labelOwnText(lab)
      if (text) return text
    }
  }
  const wrap = r.closest('label')
  if (wrap) {
    const text = labelOwnText(wrap)
    if (text) return text
  }
  return r.value
}

function toBoolean(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (v === 'yes' || v === 'true' || v === '1' || v === 'y') return true
  if (v === 'no' || v === 'false' || v === '0' || v === 'n') return false
  return null
}

export function isEmptyControl(el: HTMLElement): boolean {
  if (isComboboxControl(el) && !(el instanceof HTMLInputElement)) {
    return isComboboxEmpty(el)
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (type === 'checkbox') return !el.checked
    if (type === 'radio') {
      return getRadioGroupMembers(el).every((r) => !r.checked)
    }
    if (isComboboxControl(el)) return isComboboxEmpty(el)
    return el.value.trim() === ''
  }
  if (el instanceof HTMLTextAreaElement) return el.value.trim() === ''
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions[0]
    if (!opt) return true
    const text = opt.text.trim().toLowerCase()
    const val = opt.value.trim()
    return (
      val === '' ||
      text === '' ||
      text.startsWith('select') ||
      text.startsWith('choose') ||
      text.includes('please select')
    )
  }
  if (isComboboxControl(el)) return isComboboxEmpty(el)
  return true
}

export { comboboxDisplayText }

function signalSimilarity(a: FieldSignals, b: FieldSignals): number {
  let score = 0
  if (a.id && b.id && a.id === b.id) score += 60
  if (a.name && b.name && a.name === b.name) score += 50
  if (a.autocomplete && b.autocomplete && a.autocomplete === b.autocomplete) score += 20
  if (a.placeholder && b.placeholder && a.placeholder === b.placeholder) score += 15
  if (a.label && b.label) {
    const al = a.label.toLowerCase().trim()
    const bl = b.label.toLowerCase().trim()
    if (al === bl) score += 40
    else if (al && bl && (al.includes(bl) || bl.includes(al))) score += 20
  }
  return score
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  el.dispatchEvent(new Event('focus', { bubbles: true }))
  if (descriptor?.set) {
    descriptor.set.call(el, value)
  } else {
    el.value = value
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))
}

function setNativeSelect(select: HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
  select.dispatchEvent(new Event('focus', { bubbles: true }))
  if (descriptor?.set) {
    descriptor.set.call(select, value)
  } else {
    select.value = value
  }
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
  select.dispatchEvent(new Event('blur', { bubbles: true }))
}

function setChecked(el: HTMLInputElement, checked: boolean): boolean {
  if (el.checked === checked) {
    dispatch(el)
    return true
  }
  if (checked) {
    el.click()
    if (!el.checked) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'checked',
      )
      if (descriptor?.set) descriptor.set.call(el, true)
      else el.checked = true
      dispatch(el)
    }
    return true
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'checked',
  )
  if (descriptor?.set) descriptor.set.call(el, false)
  else el.checked = false
  dispatch(el)
  return true
}

function dispatch(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function highlight(el: HTMLElement): void {
  const id = `filled-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  setHighlight(id, el, 'filled', 1600)
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
}

function cssAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function showToast(
  message: string,
  actions?: { label: string; onClick: () => void }[],
): void {
  showHostToast(message, actions)
}
