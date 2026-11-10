import type { Message } from '../shared/messages'
import { fillTab } from '../shared/tabApi'

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true })
    return
  }
  sendResponse({ ok: true })
  return true
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'fill-page') return
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) return
    try {
      await fillTab(tab.id)
    } catch {
      // Restricted pages or missing content script
    }
  })()
})
