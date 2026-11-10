import type { FillResult, Message } from '../shared/messages'
import { mappingsForUrl } from '../shared/pathMatch'
import { getStore, saveFormMapping } from '../shared/storage'
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
}

let userTyped = false

document.addEventListener(
  'input',
  () => {
    userTyped = true
  },
  true,
)

const api: FrameApi = {
  fill: async () => runFill({ showToastUi: false }),
  undo: async () => undoLastFill(),
  countFillable: () => collectFillableElements().length,
  startMap: async () => runStartMapMode(),
  stopMap: async () => {
    stopMapMode()
    return { ok: true }
  },
}

;(globalThis as typeof globalThis & { __jobFill?: FrameApi }).__jobFill = api

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void handleContentMessage(message)
    .then((result) => sendResponse(result))
    .catch((err: unknown) => {
      const text = err instanceof Error ? err.message : 'Unknown error'
      sendResponse({ error: text })
    })
  return true
})

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
      showToast(formatFillMessage(result), [
        { label: 'Undo', onClick: () => void undoLastFill() },
        { label: 'Dismiss', onClick: () => undefined },
      ])
      return
    }

    if (collectFillableElements().length > 0) return

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
          showToast(formatFillMessage(result), [
            { label: 'Undo', onClick: () => void undoLastFill() },
            { label: 'Dismiss', onClick: () => undefined },
          ])
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

async function handleContentMessage(
  message: Message,
): Promise<FillResult | { ok: true; restored?: number } | { error: string }> {
  switch (message.type) {
    case 'FILL_PAGE':
      return runFill({ showToastUi: true })
    case 'UNDO_FILL':
      return { ok: true, restored: undoLastFill().restored }
    case 'START_MAP_MODE':
      return runStartMapMode()
    case 'STOP_MAP_MODE':
      stopMapMode()
      return { ok: true }
    case 'PING':
      return { ok: true }
  }
}

async function runFill(opts: { showToastUi: boolean }): Promise<FillResult> {
  if (isMapModeActive()) stopMapMode()
  const store = await getStore()
  const result = fillPage(store.profile, store.formMappings, store.settings, {
    customAnswers: store.customAnswers,
  })
  if (opts.showToastUi) {
    showToast(formatFillMessage(result), [
      { label: 'Undo', onClick: () => void undoLastFill() },
      { label: 'Dismiss', onClick: () => undefined },
    ])
  }
  return result
}

async function runStartMapMode(): Promise<{ ok: true }> {
  const store = await getStore()
  const existing =
    mappingsForUrl(store.formMappings, location.href).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )[0] ?? null

  startMapMode({
    existing,
    onSave: async (mapping: FormMapping) => {
      await saveFormMapping(mapping)
    },
  })
  return { ok: true }
}

function formatFillMessage(result: FillResult): string {
  if (result.filled.length === 0) {
    return 'No empty matching fields found. Try Map this form for stubborn sites.'
  }
  const left = result.unmatched.length
  return `Filled ${result.filled.length} fields · ${left} left`
}
