import type { FillResult, ToastSummary } from '../shared/messages'
import { mergeCustomAnswersForMapping } from '../shared/mergeCustomAnswers'
import { mappingsForUrl } from '../shared/pathMatch'
import { getStore, saveCustomAnswers, saveFormMapping } from '../shared/storage'
import type { FormMapping, Profile, Settings, CustomAnswer } from '../shared/types'
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
    // Unlisted origins: do no work beyond this check.
    if (!sites || !sites.includes(location.origin)) return

    const store = await getStore()
    startAutofillWatcher({
      profile: store.profile,
      formMappings: store.formMappings,
      settings: store.settings,
      customAnswers: store.customAnswers,
    })
  } catch {
    // Ignore
  }
}

function startAutofillWatcher(args: {
  profile: Profile
  formMappings: FormMapping[]
  settings: Settings
  customAnswers: CustomAnswer[]
}): void {
  let autoFillCount = 0
  let stopped = false
  let debounceTimer: number | undefined
  let lastHref = location.href
  let seen = new Set<HTMLElement>()
  let hrefPollId = 0

  const tryFill = (): Promise<FillResult> =>
    fillPage(args.profile, args.formMappings, args.settings, {
      customAnswers: args.customAnswers,
    })

  const rememberSeen = (): void => {
    seen = new Set(collectFillableElements())
  }

  const teardown = (): void => {
    stopped = true
    if (debounceTimer !== undefined) window.clearTimeout(debounceTimer)
    if (hrefPollId) window.clearInterval(hrefPollId)
    observer.disconnect()
    const nav = getNavigation()
    if (nav && navListener) {
      try {
        nav.removeEventListener('navigatesuccess', navListener)
      } catch {
        // ignore
      }
    }
  }

  const showAutofillToast = (result: FillResult): void => {
    showToast(formatFillMessage(result.filled.length, result.unmatched.length), [
      {
        label: 'Undo',
        onClick: () => {
          // Stop further automatic fills for the rest of this page load.
          teardown()
          void undoLastFill()
        },
      },
      { label: 'Dismiss', onClick: () => undefined },
    ])
  }

  const runAutoFill = async (): Promise<void> => {
    if (stopped || userTyped || autoFillCount >= 10) {
      teardown()
      return
    }
    const result = await tryFill()
    autoFillCount += 1
    lastHref = location.href
    rememberSeen()
    if (result.filled.length > 0) {
      showAutofillToast(result)
    }
    if (autoFillCount >= 10 || userTyped) teardown()
  }

  const shouldRefill = (): boolean => {
    if (location.href !== lastHref) return true
    const current = collectFillableElements()
    return current.some((el) => !seen.has(el))
  }

  const schedule = (): void => {
    if (stopped || userTyped) return
    if (debounceTimer !== undefined) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      debounceTimer = undefined
      if (stopped || userTyped) return
      if (!shouldRefill()) return
      void runAutoFill()
    }, 500)
  }

  const observer = new MutationObserver(() => schedule())
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  let navListener: EventListener | null = null
  const nav = getNavigation()
  if (nav) {
    navListener = () => schedule()
    nav.addEventListener('navigatesuccess', navListener)
  }

  // Fallback when the Navigation API is unavailable.
  hrefPollId = window.setInterval(() => {
    if (stopped) return
    if (location.href !== lastHref) schedule()
  }, 1000)

  void runAutoFill()
}

function getNavigation(): {
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
} | null {
  const nav = (window as Window & { navigation?: unknown }).navigation
  if (
    nav &&
    typeof nav === 'object' &&
    'addEventListener' in nav &&
    typeof (nav as { addEventListener: unknown }).addEventListener === 'function'
  ) {
    return nav as {
      addEventListener: (type: string, listener: EventListener) => void
      removeEventListener: (type: string, listener: EventListener) => void
    }
  }
  return null
}

async function runFill(): Promise<FillResult> {
  if (isMapModeActive()) stopMapMode()
  const store = await getStore()
  return await fillPage(store.profile, store.formMappings, store.settings, {
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
