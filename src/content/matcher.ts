import { autocompleteToFillKey, inputTypeBoost } from '../shared/autocomplete'
import {
  BLOCKERS,
  EXACT_ONLY,
  FILL_KEYS,
  hasConsecutiveTokens,
  hasNegativeGroup,
  hasNegativeLabel,
  normalizeText,
  PERSONAL_KEYS,
  splitIdentifier,
  SYNONYMS,
} from '../shared/synonyms'
import type { FieldMatchSignals, FillKey } from '../shared/types'

export type FieldSignals = FieldMatchSignals & {
  ariaLabel?: string
  inputType?: string
}

export type MatchCandidate = {
  element: HTMLElement
  signals: FieldSignals
  fillKey: FillKey
  score: number
}

/** @deprecated use fillKey */
export type MatchCandidateLegacy = MatchCandidate & { profileKey: FillKey }

const SKIP_TYPES = new Set([
  'password',
  'file',
  'hidden',
  'submit',
  'button',
  'image',
  'reset',
  'color',
  'range',
])

const CONFIDENCE_THRESHOLD = 40

export type VisibilityFn = (el: HTMLElement) => boolean

export function collectFillableElements(
  root: ParentNode = document,
  options?: { isVisible?: VisibilityFn },
): HTMLElement[] {
  const visible = options?.isVisible ?? isVisible
  const nodes = queryAllDeep(root, 'input, textarea, select')
  const result: HTMLElement[] = []
  const seenRadioGroups = new Set<string>()

  for (const el of nodes) {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase()
      if (SKIP_TYPES.has(type)) continue
      if (el.disabled || el.readOnly) continue
      if (type === 'radio') {
        const groupKey = radioGroupKey(el)
        if (seenRadioGroups.has(groupKey)) continue
        seenRadioGroups.add(groupKey)
      }
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.disabled || el.readOnly) continue
    } else if (el instanceof HTMLSelectElement) {
      if (el.disabled) continue
    }
    if (!visible(el)) continue
    result.push(el)
  }
  return result
}

/** Query selector including open shadow roots. */
export function queryAllDeep(
  root: ParentNode,
  selector: string,
): HTMLElement[] {
  const out: HTMLElement[] = []
  const visit = (node: ParentNode) => {
    if ('querySelectorAll' in node) {
      node.querySelectorAll<HTMLElement>(selector).forEach((el) => out.push(el))
      node.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot) visit(el.shadowRoot)
      })
    }
  }
  visit(root)
  return out
}

function radioGroupKey(el: HTMLInputElement): string {
  const formId = el.form?.id ?? el.closest('form')?.id ?? 'nofrm'
  const radiogroup = el.closest('[role="radiogroup"]')
  if (radiogroup) {
    return `rg:${formId}:${radiogroup.id || radiogroup.getAttribute('aria-labelledby') || radiogroup.outerHTML.length}`
  }
  return `name:${formId}:${el.name || el.id}`
}

export function extractSignals(el: HTMLElement): FieldSignals {
  const input = el as HTMLInputElement
  const isRadio = el instanceof HTMLInputElement && el.type === 'radio'
  const label = isRadio ? getRadioGroupQuestion(el) : getAssociatedLabelText(el)
  const group = getGroupContext(el)
  return {
    name: input.name || undefined,
    id: el.id || undefined,
    label: label || undefined,
    placeholder: 'placeholder' in input ? input.placeholder || undefined : undefined,
    autocomplete:
      'autocomplete' in input ? input.autocomplete || undefined : undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
    group: group || undefined,
    inputType: el instanceof HTMLInputElement ? el.type : undefined,
  }
}

export function scoreField(signals: FieldSignals, fillKey: FillKey): number {
  if (isBlockedByNegativeContext(fillKey, signals)) {
    return 0
  }

  const autoKey = autocompleteToFillKey(signals.autocomplete)
  if (autoKey) {
    return autoKey === fillKey
      ? 200 + inputTypeBoost(signals.inputType, fillKey)
      : 0
  }

  const synonyms = SYNONYMS[fillKey]
  const labelHay = signals.label ? normalizeText(signals.label) : ''
  const ariaHay = signals.ariaLabel ? normalizeText(signals.ariaLabel) : ''
  const placeholderHay = signals.placeholder
    ? normalizeText(signals.placeholder)
    : ''
  const nameHay = signals.name
    ? normalizeText(splitIdentifier(signals.name))
    : ''
  const idHay = signals.id ? normalizeText(splitIdentifier(signals.id)) : ''

  const haystacks: Array<{ hay: string; kind: 'label' | 'aria' | 'other' }> = []
  if (labelHay) haystacks.push({ hay: labelHay, kind: 'label' })
  if (ariaHay) haystacks.push({ hay: ariaHay, kind: 'aria' })
  if (placeholderHay) haystacks.push({ hay: placeholderHay, kind: 'other' })
  if (nameHay) haystacks.push({ hay: nameHay, kind: 'other' })
  if (idHay) haystacks.push({ hay: idHay, kind: 'other' })

  if (haystacks.length === 0) {
    return inputTypeBoost(signals.inputType, fillKey)
  }

  const labelForBlockers = normalizeText(
    [signals.label, signals.ariaLabel].filter(Boolean).join(' '),
  )
  if (isBlockedByKeyBlockers(fillKey, labelForBlockers)) {
    return 0
  }

  let best = 0
  for (const synonym of synonyms) {
    const needle = normalizeText(synonym)
    if (!needle) continue
    const needleTokens = needle.split(' ').filter(Boolean)
    const exactOnly = EXACT_ONLY.has(needle)

    for (const { hay, kind } of haystacks) {
      const isNameOrId =
        (signals.name && hay === normalizeText(splitIdentifier(signals.name))) ||
        (signals.id && hay === normalizeText(splitIdentifier(signals.id)))
      // Short-label rule: single-token synonym vs label/aria/placeholder only if ≤4 tokens.
      if (
        needleTokens.length === 1 &&
        !isNameOrId &&
        fillKey !== 'workAuthorized' &&
        fillKey !== 'requiresSponsorship'
      ) {
        const hayTokenCount = hay.split(' ').filter(Boolean).length
        if (hayTokenCount > 4) continue
      }

      let score = 0
      if (hay === needle) {
        score = 100 + needle.length
      } else if (exactOnly) {
        score = 0
      } else if (hasConsecutiveTokens(hay, needleTokens)) {
        score = 70 + needle.length
        if (kind === 'label') score += 8
        if (kind === 'aria') score += 6
      } else if (
        needleTokens.length === 1 &&
        tokenOverlap(hay, needle) >= 0.7 &&
        needle.length >= 4
      ) {
        // Multi-token synonyms require consecutive whole tokens; overlap is for single tokens only.
        score = 45 + needle.length / 2
      }

      best = Math.max(best, score)
    }
  }

  best += inputTypeBoost(signals.inputType, fillKey)
  return best
}

export function bestFillKey(signals: FieldSignals): FillKey | null {
  let bestKey: FillKey | null = null
  let bestScore = 0
  for (const key of FILL_KEYS) {
    const score = scoreField(signals, key)
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }
  return bestKey && bestScore >= CONFIDENCE_THRESHOLD ? bestKey : null
}

export function matchFields(elements: HTMLElement[]): MatchCandidate[] {
  const scored: MatchCandidate[] = []

  for (const el of elements) {
    const signals = extractSignals(el)
    let bestKey: FillKey | null = null
    let bestScore = 0

    for (const key of FILL_KEYS) {
      const score = scoreField(signals, key)
      if (score > bestScore) {
        bestScore = score
        bestKey = key
      }
    }

    if (bestKey && bestScore >= CONFIDENCE_THRESHOLD) {
      scored.push({ element: el, signals, fillKey: bestKey, score: bestScore })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const usedKeys = new Set<FillKey>()
  const usedEls = new Set<HTMLElement>()
  const unique: MatchCandidate[] = []

  for (const candidate of scored) {
    if (usedKeys.has(candidate.fillKey)) continue
    if (usedEls.has(candidate.element)) continue
    usedKeys.add(candidate.fillKey)
    usedEls.add(candidate.element)
    unique.push(candidate)
  }

  return unique
}

function isBlockedByNegativeContext(key: FillKey, signals: FieldSignals): boolean {
  const negLabel = hasNegativeLabel(signals.label, signals.ariaLabel)
  const negGroup = hasNegativeGroup(signals.group)

  if (key === 'currentCompany' || key === 'currentTitle') {
    if (!negLabel && !negGroup) return false
    const text = normalizeText(
      [signals.label, signals.ariaLabel, signals.group].filter(Boolean).join(' '),
    )
    // Exempt when the label/aria/group says current or present.
    if (/\b(current|present)\b/.test(text)) return false
    return true
  }

  if (!PERSONAL_KEYS.has(key)) return false
  return negLabel || negGroup
}

function isBlockedByKeyBlockers(key: FillKey, labelText: string): boolean {
  const blockers = BLOCKERS[key]
  if (!blockers || !labelText) return false
  return blockers.some((phrase) => {
    const tokens = normalizeText(phrase).split(' ').filter(Boolean)
    return hasConsecutiveTokens(labelText, tokens)
  })
}

function tokenOverlap(a: string, b: string): number {
  const at = new Set(a.split(' ').filter(Boolean))
  const bt = b.split(' ').filter(Boolean)
  if (bt.length === 0) return 0
  const hit = bt.filter((t) => at.has(t)).length
  return hit / bt.length
}

function getRadioGroupQuestion(el: HTMLInputElement): string {
  const group = el.closest('[role="radiogroup"]')
  if (group) {
    const labelledBy = group.getAttribute('aria-labelledby')
    if (labelledBy) {
      const parts = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
      const text = parts.join(' ').replace(/\s+/g, ' ').trim()
      if (text) return text
    }
    const aria = group.getAttribute('aria-label')
    if (aria) return aria
  }

  const fieldset = el.closest('fieldset')
  const legend = fieldset?.querySelector('legend')
  if (legend?.textContent?.trim()) return legend.textContent.trim()

  return getAssociatedLabelText(el)
}

function getGroupContext(el: HTMLElement): string {
  const fieldset = el.closest('fieldset')
  const legend = fieldset?.querySelector(':scope > legend')
  if (legend?.textContent?.trim()) return legend.textContent.trim()

  const form = el.closest('form') ?? document.body
  // Walk previous siblings of the field and of its ancestors up to the form.
  // Never use h1; never use "first heading in enclosing section".
  let node: HTMLElement | null = el
  while (node && node !== form) {
    let prev = node.previousElementSibling
    while (prev) {
      if (/^H[2-6]$/.test(prev.tagName)) {
        return (prev.textContent ?? '').trim()
      }
      const nested = prev.querySelector('h2,h3,h4,h5,h6')
      if (nested?.textContent?.trim()) return nested.textContent.trim()
      prev = prev.previousElementSibling
    }
    node = node.parentElement
  }
  return ''
}

function getAssociatedLabelText(el: HTMLElement): string {
  const parts: string[] = []

  if (el.id) {
    const byFor = document.querySelectorAll(`label[for="${cssEscape(el.id)}"]`)
    byFor.forEach((label) => parts.push(label.textContent ?? ''))
  }

  const wrapping = el.closest('label')
  if (wrapping) parts.push(wrapping.textContent ?? '')

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const ref = document.getElementById(id)
      if (ref) parts.push(ref.textContent ?? '')
    }
  }

  const prev = el.previousElementSibling
  if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV')) {
    const text = (prev.textContent ?? '').trim()
    if (text.length > 0 && text.length < 80) parts.push(text)
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  if (style.opacity === '0') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 || rect.height > 0
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/"/g, '\\"')
}

export { CONFIDENCE_THRESHOLD }
