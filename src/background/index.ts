import type { Message } from '../shared/messages'
import { migrateStore } from '../shared/storage'
import { fillTab, toastTopFrame, undoTab } from '../shared/tabApi'

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install' && details.reason !== 'update') return
  void (async () => {
    await migrateStore()
    if (details.reason === 'install') {
      await chrome.runtime.openOptionsPage()
    }
  })()
})

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type !== 'UNDO_TAB') return
  const tabId = sender.tab?.id
  if (tabId == null) {
    sendResponse({ restored: 0 })
    return
  }
  void undoTab(tabId)
    .then((restored) => sendResponse({ restored }))
    .catch(() => sendResponse({ restored: 0 }))
  return true
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'fill-page') return
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) return
    try {
      const results = await fillTab(tab.id)
      const filled = results.reduce((n, r) => n + r.filled.length, 0)
      const left = results.reduce((n, r) => n + r.unmatched.length, 0)
      await toastTopFrame(tab.id, { filled, left })
    } catch {
      // Restricted pages or missing content script
    }
  })()
})
