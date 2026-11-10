import { setControlValue } from './filler'
import type { FillKey } from '../shared/types'

export type UndoEntry = {
  element: HTMLElement
  fillKey: FillKey
  previous: {
    kind: 'value' | 'checked' | 'select'
    value?: string
    checked?: boolean
  }
}

let snapshot: UndoEntry[] = []

export function clearUndoSnapshot(): void {
  snapshot = []
}

export function beginUndoSnapshot(): void {
  snapshot = []
}

export function recordUndo(entry: UndoEntry): void {
  snapshot.push(entry)
}

export function capturePrevious(el: HTMLElement): UndoEntry['previous'] {
  if (el instanceof HTMLSelectElement) {
    return { kind: 'select', value: el.value }
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') {
      return { kind: 'checked', checked: el.checked }
    }
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return { kind: 'value', value: el.value }
  }
  return { kind: 'value', value: '' }
}

export function undoLastFill(): { restored: number } {
  let restored = 0
  for (const entry of [...snapshot].reverse()) {
    const { element, previous, fillKey } = entry
    if (previous.kind === 'checked' && element instanceof HTMLInputElement) {
      const want = Boolean(previous.checked)
      if (element.checked !== want) {
        if (want) element.click()
        else {
          const descriptor = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'checked',
          )
          if (descriptor?.set) descriptor.set.call(element, false)
          else element.checked = false
          element.dispatchEvent(new Event('input', { bubbles: true }))
          element.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      restored++
      continue
    }
    if (previous.kind === 'select' && element instanceof HTMLSelectElement) {
      setControlValue(element, previous.value ?? '', fillKey)
      // Force exact previous value even if alias path differs
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )
      if (descriptor?.set) descriptor.set.call(element, previous.value ?? '')
      else element.value = previous.value ?? ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      restored++
      continue
    }
    if (
      previous.kind === 'value' &&
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
    ) {
      setControlValue(element, previous.value ?? '', fillKey)
      restored++
    }
  }
  snapshot = []
  return { restored }
}

export function hasUndoSnapshot(): boolean {
  return snapshot.length > 0
}
