import { normalizeText, SYNONYMS } from '../shared/synonyms'
import type { FieldMatchSignals, ProfileKey } from '../shared/types'

export type FieldSignals = FieldMatchSignals & {
  ariaLabel?: string
}

export type MatchCandidate = {
  element: HTMLElement
  signals: FieldSignals
  profileKey: ProfileKey
  score: number
}

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

export function collectFillableElements(
  root: ParentNode = document,
): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>('input, textarea, select')
  const result: HTMLElement[] = []
  for (const el of nodes) {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase()
      if (SKIP_TYPES.has(type)) continue
      if (el.disabled || el.readOnly) continue
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.disabled || el.readOnly) continue
    } else if (el instanceof HTMLSelectElement) {
      if (el.disabled) continue
    }
    if (!isVisible(el)) continue
    result.push(el)
  }
  return result
}

export function extractSignals(el: HTMLElement): FieldSignals {
  const input = el as HTMLInputElement
  const label = getAssociatedLabelText(el)
  return {
    name: input.name || undefined,
    id: el.id || undefined,
    label: label || undefined,
    placeholder: 'placeholder' in input ? input.placeholder || undefined : undefined,
    autocomplete:
      'autocomplete' in input ? input.autocomplete || undefined : undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
  }
}

export function scoreField(
  signals: FieldSignals,
  profileKey: ProfileKey,
): number {
  const synonyms = SYNONYMS[profileKey]
  const haystacks = [
    signals.label,
    signals.ariaLabel,
    signals.placeholder,
    signals.name,
    signals.id,
    signals.autocomplete,
  ]
    .filter(Boolean)
    .map((s) => normalizeText(String(s)))

  if (haystacks.length === 0) return 0

  let best = 0
  for (const synonym of synonyms) {
    const needle = normalizeText(synonym)
    if (!needle) continue

    for (const hay of haystacks) {
      if (!hay) continue
      let score = 0
      if (hay === needle) {
        score = 100 + needle.length
      } else if (hay.includes(needle)) {
        score = 70 + needle.length
        // Prefer label/aria over name/id slightly
        if (hay === normalizeText(signals.label ?? '')) score += 8
        if (hay === normalizeText(signals.ariaLabel ?? '')) score += 6
      } else if (tokenOverlap(hay, needle) >= 0.7 && needle.length >= 4) {
        score = 45 + needle.length / 2
      }

      // Penalize ambiguous bare "name" matching first/last incorrectly
      if (
        (profileKey === 'firstName' || profileKey === 'lastName') &&
        (hay === 'name' || hay === 'full name')
      ) {
        score = Math.min(score, 20)
      }

      // Prefer address line 2 phrases over generic address
      if (profileKey === 'addressLine1' && /line 2|address2|apt|suite|unit/.test(hay)) {
        score = 0
      }

      best = Math.max(best, score)
    }
  }

  return best
}

export function matchFields(elements: HTMLElement[]): MatchCandidate[] {
  const scored: MatchCandidate[] = []

  for (const el of elements) {
    const signals = extractSignals(el)
    let bestKey: ProfileKey | null = null
    let bestScore = 0

    for (const key of Object.keys(SYNONYMS) as ProfileKey[]) {
      const score = scoreField(signals, key)
      if (score > bestScore) {
        bestScore = score
        bestKey = key
      }
    }

    if (bestKey && bestScore >= CONFIDENCE_THRESHOLD) {
      scored.push({ element: el, signals, profileKey: bestKey, score: bestScore })
    }
  }

  // Keep best unique element per profileKey (highest score wins)
  scored.sort((a, b) => b.score - a.score)
  const usedKeys = new Set<ProfileKey>()
  const usedEls = new Set<HTMLElement>()
  const unique: MatchCandidate[] = []

  for (const candidate of scored) {
    if (usedKeys.has(candidate.profileKey)) continue
    if (usedEls.has(candidate.element)) continue
    usedKeys.add(candidate.profileKey)
    usedEls.add(candidate.element)
    unique.push(candidate)
  }

  return unique
}

function tokenOverlap(a: string, b: string): number {
  const at = new Set(a.split(' ').filter(Boolean))
  const bt = b.split(' ').filter(Boolean)
  if (bt.length === 0) return 0
  const hit = bt.filter((t) => at.has(t)).length
  return hit / bt.length
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

  // Nearby preceding label-like text (common in custom forms)
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
