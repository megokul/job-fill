import { comboboxDisplayText } from './combobox'
import { getRadioGroupMembers, isComboboxControl } from './matcher'

export type UndoEntry = {
  element: HTMLElement
  previous: {
    kind: 'value' | 'checked' | 'select' | 'radio' | 'combobox'
    value?: string
    checked?: boolean
    checkedMember?: HTMLInputElement | null
  }
}

let snapshot: UndoEntry[] = []

export function beginUndoSnapshot(): void {
  snapshot = []
}

export function canUndo(): boolean {
  return snapshot.length > 0
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
    if (isComboboxControl(el)) {
      return { kind: 'combobox', value: el.value }
    }
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return { kind: 'value', value: el.value }
  }
  if (isComboboxControl(el)) {
    return { kind: 'combobox', value: comboboxDisplayText(el) }
  }
  return { kind: 'value', value: '' }
}

function setNativeChecked(el: HTMLInputElement, checked: boolean): void {
  // Bust React's value tracker so controlled radios/checkboxes see the change.
  const tracker = (el as HTMLInputElement & {
    _valueTracker?: { setValue: (v: string) => void }
  })._valueTracker
  if (tracker) tracker.setValue(checked ? 'false' : 'true')

  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'checked',
  )
  if (descriptor?.set) descriptor.set.call(el, checked)
  else el.checked = checked
}

function dispatchCheckEvents(el: HTMLInputElement): void {
  el.dispatchEvent(new Event('click', { bubbles: true }))
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function undoLastFill(): { restored: number } {
  let restored = 0
  for (const entry of [...snapshot].reverse()) {
    const { element, previous } = entry

    if (previous.kind === 'radio' && element instanceof HTMLInputElement) {
      const group = getRadioGroupMembers(element)
      const currentlyChecked = group.find((r) => r.checked) ?? null
      const want = previous.checkedMember ?? null

      if (want === null) {
        if (currentlyChecked) {
          setNativeChecked(currentlyChecked, false)
          dispatchCheckEvents(currentlyChecked)
        }
      } else if (currentlyChecked !== want) {
        want.click()
        if (!want.checked) {
          setNativeChecked(want, true)
          dispatchCheckEvents(want)
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
      continue
    }

    if (previous.kind === 'combobox') {
      const want = previous.value ?? ''
      if (element instanceof HTMLInputElement) {
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )
        if (descriptor?.set) descriptor.set.call(element, want)
        else element.value = want
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        if (element.value === want) restored++
      } else {
        // Best-effort for button/div hosts — scripted widgets may keep internal state.
        if ('value' in element) {
          try {
            ;(element as HTMLInputElement).value = want
          } catch {
            // ignore
          }
        }
        if (!want) element.textContent = ''
        else if (comboboxDisplayText(element) !== want) {
          const label = element.querySelector('[class*="single-value"], [data-value]')
          if (label) label.textContent = want
          else element.textContent = want
        }
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        if (comboboxDisplayText(element) === want || want === '') restored++
      }
    }
  }
  snapshot = []
  return { restored }
}
