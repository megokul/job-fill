import type { FillKey } from '../shared/types'
import { getRadioGroupMembers } from './matcher'

export type UndoEntry = {
  element: HTMLElement
  fillKey: FillKey
  previous: {
    kind: 'value' | 'checked' | 'select' | 'radio'
    value?: string
    checked?: boolean
    checkedMember?: HTMLInputElement | null
  }
}

let snapshot: UndoEntry[] = []

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
    if (type === 'radio') {
      const group = getRadioGroupMembers(el)
      const checkedMember = group.find((r) => r.checked) ?? null
      return { kind: 'radio', checkedMember }
    }
    if (type === 'checkbox') {
      return { kind: 'checked', checked: el.checked }
    }
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return { kind: 'value', value: el.value }
  }
  return { kind: 'value', value: '' }
}

function setNativeChecked(el: HTMLInputElement, checked: boolean): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'checked',
  )
  if (descriptor?.set) descriptor.set.call(el, checked)
  else el.checked = checked
}

export function undoLastFill(): { restored: number } {
  let restored = 0
  for (const entry of [...snapshot].reverse()) {
    const { element, previous, fillKey } = entry
    void fillKey

    if (previous.kind === 'radio' && element instanceof HTMLInputElement) {
      const group = getRadioGroupMembers(element)
      const currentlyChecked = group.find((r) => r.checked) ?? null
      const want = previous.checkedMember ?? null

      if (want === null) {
        if (currentlyChecked) {
          setNativeChecked(currentlyChecked, false)
          currentlyChecked.dispatchEvent(new Event('input', { bubbles: true }))
          currentlyChecked.dispatchEvent(new Event('change', { bubbles: true }))
        }
      } else if (currentlyChecked !== want) {
        want.click()
        if (!want.checked) {
          setNativeChecked(want, true)
          want.dispatchEvent(new Event('input', { bubbles: true }))
          want.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }

      const after = group.find((r) => r.checked) ?? null
      if (after === want) restored++
      continue
    }

    if (previous.kind === 'checked' && element instanceof HTMLInputElement) {
      const want = Boolean(previous.checked)
      if (element.checked !== want) {
        if (want) element.click()
        else {
          setNativeChecked(element, false)
          element.dispatchEvent(new Event('input', { bubbles: true }))
          element.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      if (element.checked === want) restored++
      continue
    }

    if (previous.kind === 'select' && element instanceof HTMLSelectElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )
      if (descriptor?.set) descriptor.set.call(element, previous.value ?? '')
      else element.value = previous.value ?? ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      if (element.value === (previous.value ?? '')) restored++
      continue
    }

    if (
      previous.kind === 'value' &&
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
    ) {
      const descriptor = Object.getOwnPropertyDescriptor(
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value',
      )
      if (descriptor?.set) descriptor.set.call(element, previous.value ?? '')
      else element.value = previous.value ?? ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      if (element.value === (previous.value ?? '')) restored++
    }
  }
  snapshot = []
  return { restored }
}
