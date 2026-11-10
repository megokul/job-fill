import { mappingsForUrl } from '../shared/pathMatch'
import { getStore, profileCompleteness, saveSettings } from '../shared/storage'
import { fillTab, pingTab, startMapInBestFrame, undoTab } from '../shared/tabApi'
import type { FillResult, FilledField } from '../shared/messages'
import type { FormMapping, Store } from '../shared/types'
import { clear, h } from '../ui/dom'

const app = document.getElementById('app')!

type ViewState =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'incomplete'; store: Store; host: string; mappingName?: string }
  | { kind: 'ready'; store: Store; host: string; mappingName?: string; origin: string }
  | {
      kind: 'result'
      store: Store
      host: string
      mappingName?: string
      origin: string
      results: FillResult[]
      tabId: number
    }

let busy = false

void boot()

async function boot(): Promise<void> {
  const store = await getStore()
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
    render({
      kind: 'unsupported',
      reason: 'Open a normal http(s) job application page to fill forms.',
    })
    return
  }

  const reachable = await pingTab(tab.id)
  if (!reachable) {
    render({
      kind: 'unsupported',
      reason:
        'Could not reach this page. Reload the tab (chrome:// and the Web Store are unsupported).',
    })
    return
  }

  const url = new URL(tab.url)
  const mapping = bestMapping(store.formMappings, tab.url)
  const { ready } = profileCompleteness(store.profile)
  const base = {
    store,
    host: url.hostname.replace(/^www\./, ''),
    mappingName: mapping?.name,
    origin: url.origin,
  }
  render(
    ready
      ? { kind: 'ready', ...base }
      : { kind: 'incomplete', store, host: base.host, mappingName: base.mappingName },
  )
}

function bestMapping(mappings: FormMapping[], href: string): FormMapping | undefined {
  return mappingsForUrl(mappings, href).sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

function render(state: ViewState): void {
  clear(app)
  if (state.kind === 'unsupported') {
    app.append(
      header('Unavailable'),
      h('p', { className: 'hint' }, state.reason),
      h(
        'div',
        { className: 'actions' },
        h('button', { className: 'btn primary', type: 'button', onClick: openOptions }, 'Edit profile'),
      ),
    )
    return
  }

  const { store, host, mappingName } = state
  const { filled, total, ready } = profileCompleteness(store.profile)
  const origin = 'origin' in state ? state.origin : ''

  app.append(
    header(ready ? 'Ready' : 'Incomplete', ready ? 'ready' : 'warn', host, mappingName),
  )

  if (state.kind === 'incomplete') {
    app.append(
      h(
        'div',
        { className: 'card' },
        h('strong', null, 'Complete your profile'),
        h(
          'p',
          { className: 'hint' },
          'Add at least first name, last name, and email for best results.',
        ),
      ),
      h(
        'div',
        { className: 'actions' },
        h(
          'button',
          { className: 'btn primary', type: 'button', onClick: openOptions },
          'Complete profile',
        ),
        h(
          'button',
          {
            className: 'btn',
            type: 'button',
            disabled: busy,
            onClick: () => void doFill(state),
          },
          'Fill this page',
        ),
      ),
    )
  }

  if (state.kind === 'ready') {
    app.append(
      h(
        'div',
        { className: `actions${busy ? ' busy' : ''}` },
        h(
          'button',
          {
            className: 'btn primary',
            type: 'button',
            disabled: busy,
            onClick: () => void doFill(state),
          },
          'Fill this page',
          h('span', { className: 'hint' }, '  Alt+Shift+F'),
        ),
        h(
          'div',
          { className: 'row' },
          h(
            'button',
            {
              className: 'btn',
              type: 'button',
              disabled: busy,
              onClick: () => void doMap(),
            },
            'Map this form',
          ),
          h(
            'button',
            { className: 'btn ghost', type: 'button', onClick: openOptions },
            'Edit profile',
          ),
        ),
      ),
      autofillToggle(store, origin, Boolean(mappingName)),
      progress(filled, total),
    )
  }

  if (state.kind === 'result') {
    const allFilled = state.results.flatMap((r) => r.filled)
    const unmatched = state.results.flatMap((r) => r.unmatched)
    app.append(
      resultCard(allFilled, unmatched, state),
      autofillToggle(store, origin, Boolean(mappingName)),
      progress(filled, total),
    )
  }
}

function header(
  status: string,
  pillClass = '',
  host?: string,
  mappingName?: string,
): HTMLElement {
  return h(
    'header',
    { className: 'header' },
    h(
      'div',
      null,
      h('h1', null, 'Job Fill'),
      host
        ? h(
            'p',
            { className: 'meta' },
            host,
            mappingName ? ` · Mapping: “${mappingName}”` : '',
          )
        : null,
    ),
    h('span', { className: `pill ${pillClass}` }, status),
  )
}

function progress(filled: number, total: number): HTMLElement {
  const pct = total ? Math.round((filled / total) * 100) : 0
  return h(
    'div',
    { className: 'card' },
    h('div', null, `Profile ${filled}/${total}`),
    h('div', { className: 'progress' }, h('span', { style: { width: `${pct}%` } })),
  )
}

function autofillToggle(
  store: Store,
  origin: string,
  hasMapping: boolean,
): HTMLElement {
  const on = store.settings.autofillSites.includes(origin)
  const input = h('input', {
    type: 'checkbox',
    checked: on,
    disabled: !hasMapping,
  }) as HTMLInputElement
  input.addEventListener('change', () => {
    void (async () => {
      const sites = new Set(store.settings.autofillSites)
      if (input.checked) sites.add(origin)
      else sites.delete(origin)
      const next = await saveSettings({
        autofillSites: [...sites],
        highlightFilled: store.settings.highlightFilled,
      })
      store.settings = next.settings
    })()
  })
  return h(
    'label',
    { className: 'check' },
    input,
    hasMapping
      ? 'Autofill on this site'
      : 'Autofill on this site (save a mapping first)',
  )
}

function resultCard(
  filled: FilledField[],
  unmatched: { label: string }[],
  state: Extract<ViewState, { kind: 'result' }>,
): HTMLElement {
  const title =
    filled.length === 0
      ? 'No matching empty fields'
      : `Filled ${filled.length} field${filled.length === 1 ? '' : 's'}`

  return h(
    'div',
    { className: 'card' },
    h(
      'div',
      { className: 'row' },
      h('strong', null, `✓ ${title}`),
      filled.length
        ? h(
            'button',
            {
              className: 'btn',
              type: 'button',
              onClick: () => void doUndo(state),
            },
            'Undo',
          )
        : null,
    ),
    filled.length
      ? h(
          'details',
          { open: true },
          h('summary', null, `Filled (${filled.length})`),
          h(
            'ul',
            { className: 'list' },
            ...filled.map((f) =>
              h('li', null, h('span', null, f.label || f.key), h('span', { className: 'hint' }, f.source)),
            ),
          ),
        )
      : null,
    unmatched.length
      ? h(
          'details',
          { open: filled.length === 0 },
          h('summary', null, `Left empty (${unmatched.length})`),
          h(
            'ul',
            { className: 'list' },
            ...unmatched.slice(0, 20).map((u) => h('li', null, u.label || 'Untitled field')),
          ),
        )
      : null,
    h(
      'div',
      { className: 'row', style: { marginTop: '12px' } },
      h(
        'button',
        {
          className: filled.length === 0 ? 'btn primary' : 'btn',
          type: 'button',
          onClick: () => void doMap(),
        },
        filled.length === 0 ? 'Map this form' : 'Map the rest',
      ),
      h(
        'button',
        {
          className: 'btn',
          type: 'button',
          onClick: () => void doFill(state),
        },
        'Fill again',
      ),
    ),
    h('p', { className: 'hint' }, 'Nothing was submitted.'),
  )
}

async function doFill(
  state: Extract<ViewState, { kind: 'ready' | 'incomplete' | 'result' }>,
): Promise<void> {
  busy = true
  render(state.kind === 'result' ? { ...state, kind: 'ready' } : state)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) {
    busy = false
    return
  }
  try {
    const results = await fillTab(tab.id)
    const store = await getStore()
    const url = new URL(tab.url)
    busy = false
    render({
      kind: 'result',
      store,
      host: url.hostname.replace(/^www\./, ''),
      mappingName: bestMapping(store.formMappings, tab.url)?.name,
      origin: url.origin,
      results,
      tabId: tab.id,
    })
  } catch {
    busy = false
    render({
      kind: 'unsupported',
      reason: 'Fill failed. Reload the tab and try again.',
    })
  }
}

async function doUndo(state: Extract<ViewState, { kind: 'result' }>): Promise<void> {
  await undoTab(state.tabId)
  const store = await getStore()
  render({
    kind: 'ready',
    store,
    host: state.host,
    mappingName: state.mappingName,
    origin: state.origin,
  })
}

async function doMap(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  await startMapInBestFrame(tab.id)
  window.close()
}

function openOptions(): void {
  chrome.runtime.openOptionsPage()
}
