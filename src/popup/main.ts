import { mappingsForUrl } from '../shared/pathMatch'
import { getStore, profileCompleteness, saveSettings } from '../shared/storage'
import {
  canUndoTab,
  fillTab,
  frameInfo,
  pickFormFrame,
  pingTab,
  startMapInBestFrame,
  undoTab,
} from '../shared/tabApi'
import type { FillResult, FilledField } from '../shared/messages'
import type { FormMapping, Store } from '../shared/types'
import { clear, h } from '../ui/dom'

const app = document.getElementById('app')!

type PageContext = {
  store: Store
  host: string
  mappingName?: string
  origin: string
  formHostNote?: string
  formHref: string
  canUndo: boolean
  tabId: number
}

type ViewState =
  | { kind: 'unsupported'; reason: string }
  | ({ kind: 'incomplete' } & PageContext)
  | ({ kind: 'ready' } & PageContext)
  | ({
      kind: 'result'
      results: FillResult[]
      tabId: number
    } & PageContext)

let busy = false

void boot()

async function resolveTargetTab(): Promise<chrome.tabs.Tab | null> {
  const params = new URLSearchParams(location.search)
  const raw = params.get('tabId')
  if (raw) {
    const id = Number(raw)
    if (Number.isFinite(id) && id > 0) {
      try {
        return await chrome.tabs.get(id)
      } catch {
        return null
      }
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab ?? null
}

async function boot(): Promise<void> {
  const store = await getStore()
  const tab = await resolveTargetTab()
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

  const ctx = await resolvePageContext(store, tab.id, tab.url)
  const { ready } = profileCompleteness(store.profile)
  render(ready ? { kind: 'ready', ...ctx } : { kind: 'incomplete', ...ctx })
}

async function resolvePageContext(
  store: Store,
  tabId: number,
  tabUrl: string,
): Promise<PageContext> {
  const tab = new URL(tabUrl)
  const frames = await frameInfo(tabId)
  const formFrame = pickFormFrame(frames)
  const formHref = formFrame?.href || tabUrl
  const formOrigin = formFrame?.origin || tab.origin
  const mapping = bestMapping(store.formMappings, formHref)
  let formHostNote: string | undefined
  if (formFrame && formOrigin !== tab.origin) {
    try {
      formHostNote = `Form hosted on ${new URL(formOrigin).hostname.replace(/^www\./, '')}`
    } catch {
      formHostNote = `Form hosted on ${formOrigin}`
    }
  }
  const canUndo = await canUndoTab(tabId)
  return {
    store,
    host: tab.hostname.replace(/^www\./, ''),
    mappingName: mapping?.name,
    origin: formOrigin,
    formHostNote,
    formHref,
    canUndo,
    tabId,
  }
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

  const { store, host, mappingName, formHostNote } = state
  const { filled, total, ready } = profileCompleteness(store.profile)
  const origin = 'origin' in state ? state.origin : ''

  app.append(
    header(
      ready ? 'Ready' : 'Incomplete',
      ready ? 'ready' : 'warn',
      host,
      mappingName,
      formHostNote,
    ),
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
    const actionChildren: HTMLElement[] = [
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
    ]
    if (state.canUndo) {
      actionChildren.push(
        h(
          'button',
          {
            className: 'btn',
            type: 'button',
            disabled: busy,
            onClick: () => void doUndoReady(state),
          },
          'Undo last fill',
        ),
      )
    }
    actionChildren.push(
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
    )
    app.append(
      h('div', { className: `actions${busy ? ' busy' : ''}` }, ...actionChildren),
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
  formHostNote?: string,
): HTMLElement {
  const metaParts: string[] = []
  if (host) metaParts.push(host)
  if (mappingName) metaParts.push(`Mapping: “${mappingName}”`)
  if (formHostNote) metaParts.push(formHostNote)
  return h(
    'header',
    { className: 'header' },
    h(
      'div',
      null,
      h('h1', null, 'Job Fill'),
      metaParts.length
        ? h('p', { className: 'meta' }, metaParts.join(' · '))
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
              h(
                'li',
                null,
                h(
                  'span',
                  null,
                  f.label || 'Untitled field',
                  f.target ? ` → ${f.target}` : '',
                ),
                h('span', { className: 'hint' }, f.source),
              ),
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
  const tab = await resolveTargetTab()
  if (!tab?.id || !tab.url) {
    busy = false
    return
  }
  try {
    const results = await fillTab(tab.id)
    const store = await getStore()
    const ctx = await resolvePageContext(store, tab.id, tab.url)
    busy = false
    render({
      kind: 'result',
      ...ctx,
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
  const tab = await resolveTargetTab()
  if (!tab?.id || !tab.url) {
    render({
      kind: 'ready',
      store,
      host: state.host,
      mappingName: state.mappingName,
      origin: state.origin,
      formHostNote: state.formHostNote,
      formHref: state.formHref,
      canUndo: false,
      tabId: state.tabId,
    })
    return
  }
  const ctx = await resolvePageContext(store, tab.id, tab.url)
  render({ kind: 'ready', ...ctx })
}

async function doUndoReady(
  state: Extract<ViewState, { kind: 'ready' }>,
): Promise<void> {
  busy = true
  render(state)
  await undoTab(state.tabId)
  const store = await getStore()
  const tab = await resolveTargetTab()
  busy = false
  if (tab?.id && tab.url) {
    render({ kind: 'ready', ...(await resolvePageContext(store, tab.id, tab.url)) })
    return
  }
  render({ ...state, store, canUndo: false })
}

async function doMap(): Promise<void> {
  const tab = await resolveTargetTab()
  if (!tab?.id) return
  await startMapInBestFrame(tab.id)
  window.close()
}

function openOptions(): void {
  chrome.runtime.openOptionsPage()
}
