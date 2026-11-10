import type { Message } from '../shared/messages'
import { mappingsForUrl } from '../shared/pathMatch'
import {
  deleteFieldMapping,
  deleteFormMapping,
  getStore,
  saveFormMapping,
  saveProfile,
  saveSettings,
} from '../shared/storage'

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((result) => sendResponse(result))
    .catch((err: unknown) => {
      const text = err instanceof Error ? err.message : 'Unknown error'
      sendResponse({ error: text })
    })
  return true
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'fill-page') return
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'FILL_PAGE' } satisfies Message)
    } catch {
      // Content script may be missing on restricted pages (chrome://, Web Store, etc.)
    }
  })()
})

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'GET_STORE':
      return getStore()
    case 'SAVE_PROFILE':
      return saveProfile(message.profile)
    case 'SAVE_SETTINGS':
      return saveSettings(message.settings)
    case 'SAVE_FORM_MAPPING':
      return saveFormMapping(message.mapping)
    case 'DELETE_FORM_MAPPING':
      return deleteFormMapping(message.id)
    case 'DELETE_FIELD_MAPPING':
      return deleteFieldMapping(message.formId, message.fieldId)
    case 'GET_MAPPINGS_FOR_URL': {
      const store = await getStore()
      return mappingsForUrl(store.formMappings, message.url)
    }
    case 'PING':
      return { ok: true }
    case 'FILL_PAGE':
    case 'START_MAP_MODE':
    case 'STOP_MAP_MODE':
      // Content-script targets; ignore if delivered to the worker.
      return { ok: true }
  }
}
