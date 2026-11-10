import type { FillResult, Message } from '../shared/messages'
import { getStore, profileCompleteness } from '../shared/storage'

const statusPill = document.getElementById('status-pill')!
const statusText = document.getElementById('status-text')!
const fillBtn = document.getElementById('fill-btn') as HTMLButtonElement
const mapBtn = document.getElementById('map-btn') as HTMLButtonElement
const optionsBtn = document.getElementById('options-btn') as HTMLButtonElement
const messageEl = document.getElementById('message')!

void init()

async function init(): Promise<void> {
  const store = await getStore()
  const { filled, total, ready } = profileCompleteness(store.profile)

  statusPill.textContent = ready ? 'Ready' : 'Incomplete'
  statusPill.classList.toggle('ready', ready)
  statusPill.classList.toggle('incomplete', !ready)
  statusText.textContent = ready
    ? `Profile ${filled}/${total} fields set. Fill the active tab when you're ready.`
    : `Profile ${filled}/${total} fields set. Add at least first name, last name, and email.`

  fillBtn.addEventListener('click', () => {
    void sendToActiveTab({ type: 'FILL_PAGE' })
  })
  mapBtn.addEventListener('click', () => {
    void sendToActiveTab({ type: 'START_MAP_MODE' })
  })
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })
}

async function sendToActiveTab(message: Message): Promise<void> {
  setMessage('')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    setMessage('No active tab found.')
    return
  }
  if (!tab.url || !/^https?:/i.test(tab.url)) {
    setMessage('Open a normal http(s) job application page first.')
    return
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as
      | FillResult
      | { ok: true }
      | { error: string }

    if ('error' in response) {
      setMessage(response.error)
      return
    }

    if (message.type === 'FILL_PAGE' && 'filled' in response) {
      setMessage(
        response.filled === 0
          ? 'No matching empty fields. Try Map this form.'
          : `Filled ${response.filled} fields (${response.fromMapping} mapped, ${response.fromHeuristic} heuristic).`,
      )
    } else if (message.type === 'START_MAP_MODE') {
      setMessage('Map mode started on the page. Click fields to bind them.')
      window.close()
    }
  } catch {
    setMessage(
      'Could not reach this page. Reload the tab, then try again (restricted pages like chrome:// are unsupported).',
    )
  }
}

function setMessage(text: string): void {
  if (!text) {
    messageEl.hidden = true
    messageEl.textContent = ''
    return
  }
  messageEl.hidden = false
  messageEl.textContent = text
}
