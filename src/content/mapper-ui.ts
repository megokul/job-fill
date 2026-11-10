import { defaultPathPattern } from '../shared/pathPattern'
import type { CustomAnswer, FillKey, FormMapping } from '../shared/types'
import { FILL_KEY_LABELS } from '../shared/types'
import { FILL_KEYS } from '../shared/synonyms'
import { clear, h } from '../ui/dom'
import { buildSelector, showToast } from './filler'
import {
  collectFillableElements,
  extractSignals,
  getRadioGroupMembers,
  matchFields,
} from './matcher'
import {
  clearHighlight,
  clearHighlights,
  getUiRoot,
  setBadge,
  setHighlight,
} from './ui/host'

type SaveMappingFn = (
  mapping: FormMapping,
  newAnswers: CustomAnswer[],
) => Promise<void>

type MapperUiOptions = {
  existing?: FormMapping | null
  customAnswers?: CustomAnswer[]
  onSave: SaveMappingFn
}

const MAP_STYLE = `
  :host, .jf-map {
    color-scheme: light dark;
    --jf-accent: #0f766e;
    --jf-accent-hover: #0d9488;
    --jf-ink: #0f172a;
    --jf-muted: #64748b;
    --jf-line: #e2e8f0;
    --jf-surface: #ffffff;
    --jf-page: #f8fafc;
    --jf-radius-control: 8px;
    --jf-radius-card: 12px;
    --jf-font: system-ui, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :host, .jf-map {
      --jf-page: #0b1220;
      --jf-surface: #111a2e;
      --jf-ink: #e2e8f0;
      --jf-muted: #94a3b8;
      --jf-line: #24324d;
      --jf-accent: #2dd4bf;
      --jf-accent-hover: #5eead4;
    }
  }
  .jf-map * { box-sizing: border-box; }
  .jf-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483645;
    display: flex; align-items: center; justify-content: center; gap: 16px;
    padding: 10px 16px; background: var(--jf-accent); color: #fff;
    font: 13px var(--jf-font); box-shadow: 0 2px 8px rgba(0,0,0,.2);
    pointer-events: auto;
  }
  .jf-banner .count { font-weight: 700; }
  .jf-banner button {
    font: inherit; font-weight: 600; padding: 6px 12px; border-radius: 8px;
    border: 1px solid rgba(255,255,255,.45); background: transparent; color: #fff; cursor: pointer;
  }
  .jf-panel {
    position: fixed; top: 48px; right: 16px; width: 320px; max-height: 70vh;
    overflow: auto; z-index: 2147483646; padding: 0;
    border-radius: var(--jf-radius-card); background: var(--jf-surface); color: var(--jf-ink);
    font: 13px var(--jf-font); box-shadow: 0 16px 40px rgba(15, 23, 42, 0.25);
    border: 1px solid var(--jf-line); pointer-events: auto;
  }
  .jf-panel-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 12px 14px; border-bottom: 1px solid var(--jf-line); cursor: grab;
    font-weight: 700; font-size: 14px; user-select: none;
  }
  .jf-panel-head:active { cursor: grabbing; }
  .jf-panel-body { padding: 14px; }
  .jf-label { display: block; margin-bottom: 8px; }
  .jf-label span { display: block; color: var(--jf-muted); margin-bottom: 4px; }
  .jf-input, .jf-select, .jf-textarea {
    width: 100%; padding: 8px 10px; border: 1px solid var(--jf-line);
    border-radius: var(--jf-radius-control); font: inherit;
    background: var(--jf-page); color: var(--jf-ink);
  }
  .jf-muted { color: var(--jf-muted); margin-bottom: 8px; }
  .jf-list { list-style: none; padding: 0; margin: 0 0 12px; }
  .jf-list li {
    display: flex; justify-content: space-between; gap: 8px;
    padding: 6px 0; border-bottom: 1px solid var(--jf-line);
  }
  .jf-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .jf-btn {
    padding: 8px 12px; border-radius: var(--jf-radius-control); border: none;
    background: var(--jf-accent); color: #fff; cursor: pointer; font: inherit; font-weight: 600;
  }
  .jf-btn.secondary {
    background: transparent; color: var(--jf-ink); border: 1px solid var(--jf-line);
  }
  .jf-picker {
    display: none; padding: 10px; background: var(--jf-page);
    border-radius: var(--jf-radius-control); margin-bottom: 10px;
  }
  .jf-picker.visible { display: block; }
  .jf-mode { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
  .jf-confirm {
    display: none; padding: 10px; margin-bottom: 10px;
    background: var(--jf-page); border-radius: var(--jf-radius-control);
    border: 1px solid var(--jf-line);
  }
  .jf-confirm.visible { display: block; }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--jf-accent); outline-offset: 2px;
  }
`

let active = false
let banner: HTMLDivElement | null = null
let panel: HTMLDivElement | null = null
let selectedEl: HTMLElement | null = null
let draft: FormMapping | null = null
let saveFn: SaveMappingFn | null = null
let knownAnswers: CustomAnswer[] = []
let pendingAnswers: CustomAnswer[] = []
let fillableCache: HTMLElement[] = []
let focusIndex = -1
let pageFocusEl: HTMLElement | null = null
let mutationObserver: MutationObserver | null = null
let mutationTimer: number | undefined
let dragOffset: { x: number; y: number } | null = null
let confirmCancel = false
export function isMapModeActive(): boolean {
  return active
}

export function startMapMode(options: MapperUiOptions): void {
  if (active) stopMapMode()
  active = true
  saveFn = options.onSave
  knownAnswers = [...(options.customAnswers ?? [])]
  pendingAnswers = []
  confirmCancel = false
  focusIndex = -1
  pageFocusEl = null

  draft = options.existing
    ? structuredClone(options.existing)
    : {
        id: crypto.randomUUID(),
        name: defaultMappingName(),
        origin: location.origin,
        pathPattern: defaultPathPattern(location.pathname || '/'),
        fields: [],
        updatedAt: Date.now(),
      }

  ensureMapStyles()
  refreshFillable()
  createBanner()
  createPanel()
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  mutationObserver = new MutationObserver(() => {
    if (mutationTimer) window.clearTimeout(mutationTimer)
    mutationTimer = window.setTimeout(() => {
      refreshFillable()
      updateMappedBadges()
    }, 300)
  })
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  renderPanel()
  updateMappedBadges()
}

export function stopMapMode(): void {
  if (!active) return
  active = false
  clearHover()
  clearSelectedOutline()
  clearHighlights()
  clearMappedBadges()
  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  mutationObserver?.disconnect()
  mutationObserver = null
  if (mutationTimer) window.clearTimeout(mutationTimer)
  window.removeEventListener('pointermove', onDragMove, true)
  window.removeEventListener('pointerup', onDragEnd, true)
  banner?.remove()
  panel?.remove()
  banner = null
  panel = null
  selectedEl = null
  draft = null
  saveFn = null
  knownAnswers = []
  pendingAnswers = []
  fillableCache = []
  focusIndex = -1
  pageFocusEl = null
  confirmCancel = false
  dragOffset = null
}

function defaultMappingName(): string {
  const host = location.hostname.replace(/^www\./, '')
  return `${host} application`
}

function ensureMapStyles(): void {
  const root = getUiRoot()
  if (root.getElementById('jf-map-style')) return
  const style = document.createElement('style')
  style.id = 'jf-map-style'
  style.textContent = MAP_STYLE
  root.appendChild(style)
}

function refreshFillable(): void {
  fillableCache = collectFillableElements()
}

function createBanner(): void {
  const root = getUiRoot()
  banner = h('div', {
    className: 'jf-map jf-banner',
    id: 'job-fill-map-banner',
  }) as HTMLDivElement
  root.appendChild(banner)
  renderBanner()
}

function renderBanner(): void {
  if (!banner || !draft) return
  clear(banner)
  banner.append(
    h('span', null, 'Map mode — click a field to bind it.'),
    h('span', { className: 'count' }, `${draft.fields.length} mapped`),
    h(
      'button',
      {
        type: 'button',
        onClick: () => {
          void saveDraft()
        },
      },
      'Done',
    ),
    h(
      'button',
      {
        type: 'button',
        'aria-label': 'Close map mode',
        onClick: () => requestCancel(),
      },
      '✕',
    ),
  )
}

function createPanel(): void {
  const root = getUiRoot()
  panel = h('div', {
    className: 'jf-map jf-panel',
    id: 'job-fill-map-panel',
  }) as HTMLDivElement
  root.appendChild(panel)
}

function renderPanel(): void {
  if (!panel || !draft) return
  clear(panel)
  renderBanner()

  const head = h(
    'div',
    { className: 'jf-panel-head' },
    h('span', null, 'Map this form'),
    h('span', { 'aria-hidden': 'true' }, '⠿'),
  )
  head.addEventListener('pointerdown', onDragStart)

  const body = h('div', { className: 'jf-panel-body' })

  const nameInput = h('input', {
    className: 'jf-input',
    id: 'jf-map-name',
    value: draft.name,
  }) as HTMLInputElement
  nameInput.addEventListener('input', () => {
    if (draft) draft.name = nameInput.value
  })

  const pathInput = h('input', {
    className: 'jf-input',
    id: 'jf-map-path',
    value: draft.pathPattern,
  }) as HTMLInputElement
  pathInput.addEventListener('input', () => {
    if (draft) draft.pathPattern = pathInput.value
  })

  const list = h('ul', { className: 'jf-list' })
  if (draft.fields.length === 0) {
    list.append(h('li', { className: 'jf-muted' }, 'None yet — click a field on the page'))
  } else {
    draft.fields.forEach((f, index) => {
      const remove = h(
        'button',
        { type: 'button', className: 'jf-btn secondary' },
        'Remove',
      )
      remove.addEventListener('click', () => {
        if (!draft) return
        draft.fields = draft.fields.filter((x) => x.id !== f.id)
        renderPanel()
        updateMappedBadges()
      })
      list.append(
        h(
          'li',
          null,
          h(
            'span',
            null,
            `${index + 1}. ${fieldTargetLabel(f)}`,
            h('br'),
            h(
              'small',
              { className: 'jf-muted' },
              f.match.label || f.match.name || f.selector || '',
            ),
          ),
          remove,
        ),
      )
    })
  }

  const picker = h('div', {
    className: 'jf-picker',
    id: 'jf-map-picker',
  })

  const confirm = h(
    'div',
    {
      className: `jf-confirm${confirmCancel ? ' visible' : ''}`,
      id: 'jf-map-confirm',
    },
    h('div', null, 'Discard unsaved mappings?'),
    h(
      'div',
      { className: 'jf-row', style: { marginTop: '8px' } },
      h(
        'button',
        {
          type: 'button',
          className: 'jf-btn',
          onClick: () => {
            stopMapMode()
            showToast('Mapping cancelled')
          },
        },
        'Discard',
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'jf-btn secondary',
          onClick: () => {
            confirmCancel = false
            renderPanel()
          },
        },
        'Keep editing',
      ),
    ),
  )

  body.append(
    h('label', { className: 'jf-label' }, h('span', null, 'Name'), nameInput),
    h(
      'label',
      { className: 'jf-label' },
      h('span', null, 'Path pattern'),
      pathInput,
    ),
    h('div', { className: 'jf-muted' }, `Origin: ${draft.origin}`),
    picker,
    h(
      'div',
      { style: { fontWeight: '600', margin: '10px 0 4px' } },
      `Mapped fields (${draft.fields.length})`,
    ),
    list,
    confirm,
    h(
      'div',
      { className: 'jf-row' },
      h(
        'button',
        {
          type: 'button',
          className: 'jf-btn',
          id: 'jf-map-save',
          onClick: () => {
            void saveDraft()
          },
        },
        'Save mapping',
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'jf-btn secondary',
          id: 'jf-map-cancel',
          onClick: () => requestCancel(),
        },
        'Cancel',
      ),
    ),
  )

  panel.append(head, body)

  if (selectedEl) showFieldPicker(selectedEl)
}

function fieldTargetLabel(f: FormMapping['fields'][number]): string {
  if (f.customAnswerId) {
    const a =
      pendingAnswers.find((x) => x.id === f.customAnswerId) ||
      knownAnswers.find((x) => x.id === f.customAnswerId)
    return a ? `Custom: ${a.question}` : 'Custom answer'
  }
  return f.profileKey ? FILL_KEY_LABELS[f.profileKey] : '—'
}

function showFieldPicker(el: HTMLElement): void {
  if (!panel || !draft) return
  const picker = panel.querySelector('#jf-map-picker') as HTMLDivElement | null
  if (!picker) return

  const signals = extractSignals(el)
  const guess = matchFields([el])[0]?.fillKey
  const fieldLabel =
    signals.label || signals.name || signals.placeholder || el.tagName.toLowerCase()

  clear(picker)
  picker.classList.add('visible')

  const keySelect = h('select', {
    className: 'jf-select',
    id: 'jf-map-key',
  }) as HTMLSelectElement
  for (const key of FILL_KEYS) {
    const opt = h('option', { value: key }, FILL_KEY_LABELS[key]) as HTMLOptionElement
    if (guess === key) opt.selected = true
    keySelect.append(opt)
  }

  const answerSelect = h('select', {
    className: 'jf-select',
    id: 'jf-map-answer',
  }) as HTMLSelectElement
  answerSelect.append(h('option', { value: '' }, 'Select…'))
  for (const a of [...knownAnswers, ...pendingAnswers]) {
    answerSelect.append(
      h('option', { value: a.id }, a.question || 'Untitled'),
    )
  }
  answerSelect.append(h('option', { value: '__new__' }, 'New answer…'))

  const newBox = h('div', {
    id: 'jf-map-new',
    style: { display: 'none', marginBottom: '8px' },
  })
  const qInput = h('input', {
    className: 'jf-input',
    id: 'jf-map-q',
    value: fieldLabel,
    placeholder: 'Question',
    style: { marginBottom: '6px' },
  }) as HTMLInputElement
  const aInput = h('textarea', {
    className: 'jf-textarea',
    id: 'jf-map-a',
    placeholder: 'Answer',
  }) as HTMLTextAreaElement
  newBox.append(qInput, aInput)

  answerSelect.addEventListener('change', () => {
    newBox.style.display = answerSelect.value === '__new__' ? 'block' : 'none'
  })

  const profileRadio = h('input', {
    type: 'radio',
    name: 'jf-map-mode',
    value: 'profile',
    checked: true,
  }) as HTMLInputElement
  const customRadio = h('input', {
    type: 'radio',
    name: 'jf-map-mode',
    value: 'custom',
  }) as HTMLInputElement

  const addBtn = h(
    'button',
    { type: 'button', className: 'jf-btn', id: 'jf-map-add' },
    'Add',
  )
  addBtn.addEventListener('click', () => {
    if (!draft) return
    const mode = profileRadio.checked ? 'profile' : 'custom'
    const selector = buildSelector(el)
    draft.fields = draft.fields.filter((f) => f.selector !== selector)
    const match = {
      name: signals.name,
      id: signals.id,
      label: signals.label,
      placeholder: signals.placeholder,
      autocomplete: signals.autocomplete,
    }

    if (mode === 'custom') {
      let answerId = answerSelect.value
      if (answerId === '__new__') {
        const q = qInput.value.trim()
        const a = aInput.value
        if (!q || !a.trim()) {
          showToast('Enter a question and answer')
          return
        }
        const created: CustomAnswer = {
          id: crypto.randomUUID(),
          question: q,
          answer: a,
          updatedAt: Date.now(),
        }
        pendingAnswers.push(created)
        answerId = created.id
      }
      if (!answerId) {
        showToast('Choose a custom answer')
        return
      }
      draft.fields.push({
        id: crypto.randomUUID(),
        selector,
        match,
        customAnswerId: answerId,
      })
    } else {
      const key = keySelect.value as FillKey
      draft.fields.push({
        id: crypto.randomUUID(),
        selector,
        match,
        profileKey: key,
      })
    }
    selectedEl = null
    clearSelectedOutline()
    picker.classList.remove('visible')
    renderPanel()
    updateMappedBadges()
    restorePageFocus()
  })

  picker.append(
    h('div', { style: { marginBottom: '6px', fontWeight: '600' } }, 'Selected field'),
    h(
      'div',
      { className: 'jf-muted', style: { wordBreak: 'break-word' } },
      fieldLabel,
    ),
    h('label', { className: 'jf-mode' }, profileRadio, ' Profile field'),
    keySelect,
    h('label', { className: 'jf-mode' }, customRadio, ' Custom answer'),
    answerSelect,
    newBox,
    addBtn,
  )

  window.setTimeout(() => keySelect.focus(), 0)
  movePanelAwayFrom(el)
}

async function saveDraft(): Promise<void> {
  if (!draft || !saveFn) return
  if (!draft.name.trim()) {
    showToast('Give this mapping a name')
    return
  }
  if (draft.fields.length === 0) {
    showToast('Add at least one field mapping')
    return
  }
  draft.updatedAt = Date.now()
  draft.pathPattern = draft.pathPattern.trim() || '/'
  await saveFn(draft, pendingAnswers)
  stopMapMode()
  showToast('Form mapping saved')
}

function requestCancel(): void {
  if (draft && draft.fields.length > 0) {
    confirmCancel = true
    renderPanel()
    return
  }
  stopMapMode()
  showToast('Mapping cancelled')
}

function onMouseOver(event: MouseEvent): void {
  if (!active) return
  const target = event.target as HTMLElement | null
  if (!target || isUi(target)) return
  const field = findFillable(target)
  if (!field || field === selectedEl) return
  clearHover()
  setHighlight('map-hover', field, 'hover')
}

function onClick(event: MouseEvent): void {
  if (!active) return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (isUi(target)) return

  const field = findFillable(target)
  if (!field) return

  event.preventDefault()
  event.stopPropagation()
  selectField(field)
}

function selectField(field: HTMLElement): void {
  clearHover()
  clearSelectedOutline()
  selectedEl = field
  pageFocusEl = document.activeElement as HTMLElement | null
  setHighlight('map-selected', field, 'selected')
  showFieldPicker(field)
}

function onKeyDown(event: KeyboardEvent): void {
  if (!active) return
  if (event.key === 'Escape') {
    event.preventDefault()
    requestCancel()
    return
  }
  if (isUi(event.target as HTMLElement)) return

  if (event.key === 'Tab' && fillableCache.length) {
    event.preventDefault()
    const dir = event.shiftKey ? -1 : 1
    focusIndex =
      (focusIndex + dir + fillableCache.length) % fillableCache.length
    const el = fillableCache[focusIndex]
    el.focus({ preventScroll: false })
    clearHover()
    setHighlight('map-hover', el, 'hover')
    return
  }

  if (event.key === 'Enter') {
    const focused = document.activeElement as HTMLElement | null
    const field = focused ? findFillable(focused) : null
    if (field) {
      event.preventDefault()
      selectField(field)
    }
  }
}

function findFillable(target: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = target
  while (current) {
    if (
      current instanceof HTMLInputElement &&
      (current.type || 'text').toLowerCase() === 'radio'
    ) {
      const members = getRadioGroupMembers(current)
      const representative =
        fillableCache.find((el) => members.includes(el as HTMLInputElement)) ||
        members[0] ||
        null
      if (representative && fillableCache.includes(representative)) {
        return representative
      }
    }
    if (fillableCache.includes(current)) return current
    current = current.parentElement
  }
  return null
}

function isUi(el: HTMLElement | null): boolean {
  if (!el) return false
  const root = el.getRootNode()
  if (root instanceof ShadowRoot && root.host?.tagName === 'JOB-FILL-ROOT') {
    return true
  }
  return Boolean(
    el.closest('#job-fill-map-banner, #job-fill-map-panel, #job-fill-toast, job-fill-root'),
  )
}

function clearHover(): void {
  clearHighlight('map-hover')
}

function clearSelectedOutline(): void {
  clearHighlight('map-selected')
}

function updateMappedBadges(): void {
  clearMappedBadges()
  if (!draft) return
  draft.fields.forEach((field, index) => {
    const el = resolveMappedElement(field)
    if (!el) return
    setBadge(`map-badge-${field.id}`, el, String(index + 1))
  })
}

function clearMappedBadges(): void {
  clearHighlights('badge')
}

function resolveMappedElement(
  field: FormMapping['fields'][number],
): HTMLElement | null {
  if (field.selector) {
    try {
      const el = document.querySelector(field.selector)
      if (el instanceof HTMLElement) {
        return findFillable(el) || el
      }
    } catch {
      // ignore bad selectors
    }
  }
  return null
}

function restorePageFocus(): void {
  const el = pageFocusEl
  pageFocusEl = null
  if (el && document.contains(el)) {
    try {
      el.focus()
    } catch {
      // ignore
    }
  }
}

function onDragStart(event: PointerEvent): void {
  if (!panel || event.button !== 0) return
  const target = event.target as HTMLElement
  if (target.closest('button, input, select, textarea, a')) return
  const rect = panel.getBoundingClientRect()
  dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  window.addEventListener('pointermove', onDragMove, true)
  window.addEventListener('pointerup', onDragEnd, true)
  event.preventDefault()
}

function onDragMove(event: PointerEvent): void {
  if (!panel || !dragOffset) return
  panel.style.left = `${Math.max(8, event.clientX - dragOffset.x)}px`
  panel.style.top = `${Math.max(40, event.clientY - dragOffset.y)}px`
  panel.style.right = 'auto'
}

function onDragEnd(): void {
  dragOffset = null
  window.removeEventListener('pointermove', onDragMove, true)
  window.removeEventListener('pointerup', onDragEnd, true)
}

function movePanelAwayFrom(el: HTMLElement): void {
  if (!panel) return
  const fieldRect = el.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const overlaps =
    fieldRect.left < panelRect.right &&
    fieldRect.right > panelRect.left &&
    fieldRect.top < panelRect.bottom &&
    fieldRect.bottom > panelRect.top
  if (!overlaps) return
  const leftSide = Math.max(8, fieldRect.left - panelRect.width - 16)
  panel.style.left = `${leftSide}px`
  panel.style.right = 'auto'
  if (leftSide < 8 || fieldRect.left < panelRect.width + 24) {
    panel.style.left = 'auto'
    panel.style.right = '16px'
  }
}
