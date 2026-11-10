import type { FillResult } from '../shared/messages'
import { mappingsForUrl } from '../shared/pathMatch'
import type {
  FieldMapping,
  FormMapping,
  Profile,
  ProfileKey,
  Settings,
} from '../shared/types'
import {
  collectFillableElements,
  extractSignals,
  matchFields,
  type FieldSignals,
} from './matcher'

const HIGHLIGHT_CLASS = 'job-fill-highlighted'
const HIGHLIGHT_STYLE_ID = 'job-fill-highlight-style'

export function fillPage(
  profile: Profile,
  formMappings: FormMapping[],
  settings: Settings,
): FillResult {
  const result: FillResult = {
    filled: 0,
    fromMapping: 0,
    fromHeuristic: 0,
    skipped: 0,
  }

  const elements = collectFillableElements()
  const filledElements = new Set<HTMLElement>()
  const applicable = mappingsForUrl(formMappings, location.href)

  for (const mapping of applicable) {
    for (const field of mapping.fields) {
      const el = resolveMappedElement(field, elements)
      if (!el || filledElements.has(el)) continue
      if (!isEmptyControl(el)) {
        result.skipped++
        continue
      }
      const value = profile[field.profileKey]
      if (!String(value ?? '').trim()) continue
      if (setControlValue(el, value, field.profileKey)) {
        filledElements.add(el)
        result.filled++
        result.fromMapping++
        if (settings.highlightFilled) highlight(el)
      }
    }
  }

  const remaining = elements.filter((el) => !filledElements.has(el) && isEmptyControl(el))
  const matches = matchFields(remaining)

  for (const match of matches) {
    if (filledElements.has(match.element)) continue
    const value = profile[match.profileKey]
    if (!String(value ?? '').trim()) continue
    if (setControlValue(match.element, value, match.profileKey)) {
      filledElements.add(match.element)
      result.filled++
      result.fromHeuristic++
      if (settings.highlightFilled) highlight(match.element)
    }
  }

  return result
}

export function resolveMappedElement(
  field: FieldMapping,
  elements: HTMLElement[] = collectFillableElements(),
): HTMLElement | null {
  if (field.selector) {
    try {
      const found = document.querySelector<HTMLElement>(field.selector)
      if (found && elements.includes(found)) return found
      if (found) return found
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
  profileKey: ProfileKey,
): boolean {
  if (el instanceof HTMLSelectElement) {
    return selectOption(el, value)
  }

  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (type === 'checkbox') {
      const shouldCheck = toBoolean(value, profileKey)
      if (shouldCheck === null) return false
      if (el.checked !== shouldCheck) {
        el.checked = shouldCheck
        dispatch(el)
      }
      return true
    }
    if (type === 'radio') {
      return selectRadio(el, value, profileKey)
    }
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus()
    el.value = value
    dispatch(el)
    return true
  }

  return false
}

function selectOption(select: HTMLSelectElement, value: string): boolean {
  const normalized = value.trim().toLowerCase()
  const yesNo = normalized === 'yes' || normalized === 'no' ? normalized : null

  for (const opt of Array.from(select.options)) {
    const text = opt.text.trim().toLowerCase()
    const val = opt.value.trim().toLowerCase()
    if (val === normalized || text === normalized) {
      select.value = opt.value
      dispatch(select)
      return true
    }
    if (yesNo) {
      if (
        (yesNo === 'yes' && /^(yes|y|true|1)$/i.test(opt.value + ' ' + opt.text)) ||
        (yesNo === 'no' && /^(no|n|false|0)$/i.test(opt.value + ' ' + opt.text))
      ) {
        select.value = opt.value
        dispatch(select)
        return true
      }
    }
  }

  // Partial text match
  for (const opt of Array.from(select.options)) {
    if (opt.text.toLowerCase().includes(normalized) && normalized.length >= 2) {
      select.value = opt.value
      dispatch(select)
      return true
    }
  }
  return false
}

function selectRadio(
  radio: HTMLInputElement,
  value: string,
  profileKey: ProfileKey,
): boolean {
  const name = radio.name
  if (!name) return false
  const group = document.querySelectorAll<HTMLInputElement>(
    `input[type="radio"][name="${cssAttr(name)}"]`,
  )
  const bool = toBoolean(value, profileKey)
  for (const r of group) {
    const label = (extractSignals(r).label ?? '').toLowerCase()
    const val = (r.value ?? '').toLowerCase()
    if (bool === true && /^(yes|y|true|1)$/i.test(val)) {
      r.checked = true
      dispatch(r)
      return true
    }
    if (bool === false && /^(no|n|false|0)$/i.test(val)) {
      r.checked = true
      dispatch(r)
      return true
    }
    if (bool === true && /\byes\b/.test(label)) {
      r.checked = true
      dispatch(r)
      return true
    }
    if (bool === false && /\bno\b/.test(label)) {
      r.checked = true
      dispatch(r)
      return true
    }
    if (val === value.toLowerCase() || label.includes(value.toLowerCase())) {
      r.checked = true
      dispatch(r)
      return true
    }
  }
  return false
}

function toBoolean(value: string, profileKey: ProfileKey): boolean | null {
  const v = value.trim().toLowerCase()
  if (v === 'yes' || v === 'true' || v === '1' || v === 'y') return true
  if (v === 'no' || v === 'false' || v === '0' || v === 'n') return false
  if (profileKey === 'workAuthorized' || profileKey === 'requiresSponsorship') {
    return null
  }
  return null
}

function isEmptyControl(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') return !el.checked
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
  return true
}

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

function dispatch(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function highlight(el: HTMLElement): void {
  ensureHighlightStyle()
  el.classList.add(HIGHLIGHT_CLASS)
  window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 1600)
}

function ensureHighlightStyle(): void {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = HIGHLIGHT_STYLE_ID
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 2px solid #0f766e !important;
      outline-offset: 2px !important;
      transition: outline-color 0.2s ease;
    }
  `
  document.documentElement.appendChild(style)
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

export function showToast(message: string): void {
  const existing = document.getElementById('job-fill-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'job-fill-toast'
  toast.textContent = message
  Object.assign(toast.style, {
    position: 'fixed',
    zIndex: '2147483646',
    right: '16px',
    bottom: '16px',
    maxWidth: '360px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    lineHeight: '1.4',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.35)',
  })
  document.documentElement.appendChild(toast)
  window.setTimeout(() => toast.remove(), 3200)
}
