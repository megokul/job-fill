import type { FillResult, ToastSummary } from '../shared/messages'
import { mergeCustomAnswersForMapping } from '../shared/mergeCustomAnswers'
import { mappingsForUrl } from '../shared/pathMatch'
import { getStore, saveCustomAnswers, saveFormMapping } from '../shared/storage'
import type { FormMapping } from '../shared/types'
import { fillPage, showToast } from './filler'
import { collectFillableElements } from './matcher'
import { isMapModeActive, startMapMode, stopMapMode } from './mapper-ui'
import { undoLastFill } from './undo'

type FrameApi = {
  fill: () => Promise<FillResult>
  undo: () => Promise<{ restored: number }>
  countFillable: () => number
  startMap: () => Promise<{ ok: true }>
  stopMap: () => Promise<{ ok: true }>
  toast: (summary: ToastSummary) => void
}

let userTyped = false

document.addEventListener(
  'input',
  (event) => {
    if (event.isTrusted) userTyped = true
  },
  true,
)

const api: FrameApi = {
  fill: async () => runFill(),
  undo: async () => undoLastFill(),
  countFillable: () => collectFillableElements().length,
  startMap: async () => runStartMapMode(),
  stopMap: async () => {
    stopMapMode()
    return { ok: true }
  },
  toast: (summary) => showShortcutToast(summary),
}

;(globalThis as typeof globalThis & { __jobFill?: FrameApi }).__jobFill = api

void bootstrapAutofillOnLoad()

async function bootstrapAutofillOnLoad(): Promise<void> {
  try {
    if (!/^https?:/i.test(location.protocol)) return

    const peek = await chrome.storage.local.get(['settings', 'formMappings'])
    const settingsRaw = peek.settings as
      | { autofillSites?: string[]; autofillOnLoad?: boolean }
      | undefined
    let sites = Array.isArray(settingsRaw?.autofillSites)
      ? settingsRaw!.autofillSites!
      : null
    if (!sites && settingsRaw?.autofillOnLoad === true) {
      const mappings = Array.isArray(peek.formMappings)
        ? (peek.formMappings as { origin: string }[])
        : []
      sites = [...new Set(mappings.map((m) => m.origin))]
    }
    if (!sites || !sites.includes(location.origin)) return

    const store = await getStore()
    const tryFill = (): FillResult =>
      fillPage(store.profile, store.formMappings, store.settings, {
        customAnswers: store.customAnswers,
      })

    let result = tryFill()
    if (result.filled.length > 0) {
      showLocalFillToast(result)
      return
    }

    // Watch for late-rendered fields even when the page already has
    // fillable controls that did not match on the first attempt.
    const started = Date.now()
    let timer: number | undefined
    const observer = new MutationObserver(() => {
      if (userTyped) {
        observer.disconnect()
        return
      }
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (userTyped || Date.now() - started > 15_000) {
          observer.disconnect()
          return
        }
        result = tryFill()
        if (result.filled.length > 0) {
          observer.disconnect()
          showLocalFillToast(result)
        }
      }, 400)
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
    window.setTimeout(() => observer.disconnect(), 15_000)
  } catch {
    // Ignore
  }
}

async function runFill(): Promise<FillResult> {
  if (isMapModeActive()) stopMapMode()
  const store = await getStore()
  return fillPage(store.profile, store.formMappings, store.settings, {
    customAnswers: store.customAnswers,
  })
}

async function runStartMapMode(): Promise<{ ok: true }> {
  const store = await getStore()
  const existing =
    mappingsForUrl(store.formMappings, location.href).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )[0] ?? null

  startMapMode({
    existing,
    customAnswers: store.customAnswers,
    onSave: async (mapping: FormMapping, newAnswers) => {
      if (newAnswers.length) {
        const fresh = await getStore()
        const merged = mergeCustomAnswersForMapping({
          current: fresh.customAnswers,
          pending: newAnswers,
          fields: mapping.fields,
        })
        await saveCustomAnswers(merged)
      }
      await saveFormMapping(mapping)
    },
  })
  return { ok: true }
}

function showLocalFillToast(result: FillResult): void {
  showToast(formatFillMessage(result.filled.length, result.unmatched.length), [
    { label: 'Undo', onClick: () => void undoLastFill() },
    { label: 'Dismiss', onClick: () => undefined },
  ])
}

function showShortcutToast(summary: ToastSummary): void {
  const message =
    summary.filled === 0
      ? 'No matching empty fields'
      : formatFillMessage(summary.filled, summary.left)
  showToast(message, [
    {
      label: 'Undo',
      onClick: () => {
        void chrome.runtime.sendMessage({ type: 'UNDO_TAB' })
      },
    },
    { label: 'Dismiss', onClick: () => undefined },
  ])
}

function formatFillMessage(filled: number, left: number): string {
  return `Filled ${filled} fields · ${left} left`
}
