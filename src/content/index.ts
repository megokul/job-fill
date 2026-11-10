import type { FillResult, Message } from '../shared/messages'
import { mappingsForUrl } from '../shared/pathMatch'
import { getStore, saveFormMapping } from '../shared/storage'
import type { FormMapping } from '../shared/types'
import { fillPage, showToast } from './filler'
import { isMapModeActive, startMapMode, stopMapMode } from './mapper-ui'

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
    const store = await getStore()
    if (!store.settings.autofillOnLoad) return
    const result = fillPage(store.profile, store.formMappings, store.settings)
    if (result.filled > 0) {
      showToast(formatFillMessage(result))
    }
  } catch {
    // Ignore on pages where storage is unavailable
  }
}

async function handleContentMessage(
  message: Message,
): Promise<FillResult | { ok: true } | { error: string }> {
  switch (message.type) {
    case 'FILL_PAGE':
      return runFill()
    case 'START_MAP_MODE':
      return runStartMapMode()
    case 'STOP_MAP_MODE':
      stopMapMode()
      return { ok: true }
    case 'PING':
      return { ok: true }
    default:
      return { error: `Content script ignores ${message.type}` }
  }
}

async function runFill(): Promise<FillResult> {
  if (isMapModeActive()) stopMapMode()
  const store = await getStore()
  const result = fillPage(store.profile, store.formMappings, store.settings)
  showToast(formatFillMessage(result))
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
  if (result.filled === 0) {
    return 'No empty matching fields found. Try Map this form for stubborn sites.'
  }
  return `Filled ${result.filled} field${result.filled === 1 ? '' : 's'} (${result.fromMapping} from saved mapping, ${result.fromHeuristic} heuristic).`
}
