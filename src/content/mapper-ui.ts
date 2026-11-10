import { defaultPathPattern } from '../shared/pathPattern'
import type { CustomAnswer, FillKey, FormMapping } from '../shared/types'
import { FILL_KEY_LABELS } from '../shared/types'
import { FILL_KEYS } from '../shared/synonyms'
import { buildSelector, showToast } from './filler'
import { collectFillableElements, extractSignals, matchFields } from './matcher'
import { clearHighlight, clearHighlights, getUiRoot, setHighlight } from './ui/host'

type SaveMappingFn = (
  mapping: FormMapping,
  newAnswers: CustomAnswer[],
) => Promise<void>

type MapperUiOptions = {
  existing?: FormMapping | null
  customAnswers?: CustomAnswer[]
  onSave: SaveMappingFn
}

let active = false
let overlay: HTMLDivElement | null = null
let panel: HTMLDivElement | null = null
let selectedEl: HTMLElement | null = null
let draft: FormMapping | null = null
let saveFn: SaveMappingFn | null = null
let knownAnswers: CustomAnswer[] = []
let pendingAnswers: CustomAnswer[] = []

export function isMapModeActive(): boolean {
  return active
}

export function startMapMode(options: MapperUiOptions): void {
  if (active) stopMapMode()
  active = true
  saveFn = options.onSave
  knownAnswers = [...(options.customAnswers ?? [])]
  pendingAnswers = []

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

  createOverlay()
  createPanel()
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  renderPanel()
}

export function stopMapMode(): void {
  if (!active) return
  active = false
  clearHover()
  clearSelectedOutline()
  clearHighlights()
  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  overlay?.remove()
  panel?.remove()
  overlay = null
  panel = null
  selectedEl = null
  draft = null
  saveFn = null
  knownAnswers = []
  pendingAnswers = []
}

function defaultMappingName(): string {
  const host = location.hostname.replace(/^www\./, '')
  return `${host} application`
}

function createOverlay(): void {
  const root = getUiRoot()
  overlay = document.createElement('div')
  overlay.id = 'job-fill-map-banner'
  overlay.textContent =
    'Map mode: click a form field, choose a profile key, then Save mapping. Esc to cancel.'
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483645',
    padding: '10px 16px',
    background: '#0f766e',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    pointerEvents: 'auto',
  })
  root.appendChild(overlay)
}

function createPanel(): void {
  const root = getUiRoot()
  panel = document.createElement('div')
  panel.id = 'job-fill-map-panel'
  Object.assign(panel.style, {
    position: 'fixed',
    top: '48px',
    right: '16px',
    width: '320px',
    maxHeight: '70vh',
    overflow: 'auto',
    zIndex: '2147483646',
    padding: '14px',
    borderRadius: '12px',
    background: '#fff',
    color: '#0f172a',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.25)',
    border: '1px solid #e2e8f0',
    pointerEvents: 'auto',
  })
  root.appendChild(panel)
}

function renderPanel(): void {
  if (!panel || !draft) return

  const fieldRows = draft.fields
    .map(
      (f) => `
      <li style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <span>${escapeHtml(fieldTargetLabel(f))}<br>
          <small style="color:#64748b">${escapeHtml(f.match.label || f.match.name || f.selector || '')}</small>
        </span>
        <button type="button" data-remove="${f.id}" style="${btnStyle(true)}">Remove</button>
      </li>`,
    )
    .join('')

  panel.innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:8px;">Map this form</div>
    <label style="display:block;margin-bottom:8px;">
      <span style="display:block;color:#475569;margin-bottom:4px;">Name</span>
      <input id="jf-map-name" value="${escapeAttr(draft.name)}" style="${inputStyle}" />
    </label>
    <label style="display:block;margin-bottom:8px;">
      <span style="display:block;color:#475569;margin-bottom:4px;">Path pattern</span>
      <input id="jf-map-path" value="${escapeAttr(draft.pathPattern)}" style="${inputStyle}" />
    </label>
    <div style="color:#64748b;margin-bottom:8px;">Origin: ${escapeHtml(draft.origin)}</div>
    <div style="font-weight:600;margin:10px 0 4px;">Mapped fields (${draft.fields.length})</div>
    <ul style="list-style:none;padding:0;margin:0 0 12px;">${fieldRows || '<li style="color:#94a3b8;">None yet — click a field on the page</li>'}</ul>
    <div id="jf-map-picker" style="display:none;padding:10px;background:#f8fafc;border-radius:8px;margin-bottom:10px;"></div>
    <div style="display:flex;gap:8px;">
      <button type="button" id="jf-map-save" style="${btnStyle()}">Save mapping</button>
      <button type="button" id="jf-map-cancel" style="${btnStyle(true)}">Cancel</button>
    </div>
  `

  panel.querySelector('#jf-map-name')?.addEventListener('input', (e) => {
    if (draft) draft.name = (e.target as HTMLInputElement).value
  })
  panel.querySelector('#jf-map-path')?.addEventListener('input', (e) => {
    if (draft) draft.pathPattern = (e.target as HTMLInputElement).value
  })
  panel.querySelector('#jf-map-save')?.addEventListener('click', () => {
    void saveDraft()
  })
  panel.querySelector('#jf-map-cancel')?.addEventListener('click', () => {
    stopMapMode()
    showToast('Mapping cancelled')
  })
  panel.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.remove
      if (!draft || !id) return
      draft.fields = draft.fields.filter((f) => f.id !== id)
      renderPanel()
    })
  })
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
  const keyOptions = FILL_KEYS.map((key) => {
    const selected = guess === key ? ' selected' : ''
    return `<option value="${key}"${selected}>${escapeHtml(FILL_KEY_LABELS[key])}</option>`
  }).join('')
  const answerOptions = [
    `<option value="">Select…</option>`,
    ...[...knownAnswers, ...pendingAnswers].map(
      (a) => `<option value="${escapeAttr(a.id)}">${escapeHtml(a.question || 'Untitled')}</option>`,
    ),
    `<option value="__new__">New answer…</option>`,
  ].join('')

  picker.style.display = 'block'
  picker.innerHTML = `
    <div style="margin-bottom:6px;font-weight:600;">Selected field</div>
    <div style="color:#475569;margin-bottom:8px;word-break:break-word;">
      ${escapeHtml(fieldLabel)}
    </div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
      <input type="radio" name="jf-map-mode" value="profile" checked /> Profile field
    </label>
    <select id="jf-map-key" style="${inputStyle};margin-bottom:8px;">${keyOptions}</select>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
      <input type="radio" name="jf-map-mode" value="custom" /> Custom answer
    </label>
    <select id="jf-map-answer" style="${inputStyle};margin-bottom:8px;">${answerOptions}</select>
    <div id="jf-map-new" style="display:none;margin-bottom:8px;">
      <input id="jf-map-q" style="${inputStyle};margin-bottom:6px;" value="${escapeAttr(fieldLabel)}" placeholder="Question" />
      <textarea id="jf-map-a" style="${inputStyle};min-height:64px;" placeholder="Answer"></textarea>
    </div>
    <button type="button" id="jf-map-add" style="${btnStyle()}">Add</button>
  `

  const answerSelect = picker.querySelector('#jf-map-answer') as HTMLSelectElement
  const newBox = picker.querySelector('#jf-map-new') as HTMLDivElement
  answerSelect.addEventListener('change', () => {
    newBox.style.display = answerSelect.value === '__new__' ? 'block' : 'none'
  })

  picker.querySelector('#jf-map-add')?.addEventListener('click', () => {
    if (!draft) return
    const mode = (
      picker.querySelector('input[name="jf-map-mode"]:checked') as HTMLInputElement
    ).value
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
        const q = (picker.querySelector('#jf-map-q') as HTMLInputElement).value.trim()
        const a = (picker.querySelector('#jf-map-a') as HTMLTextAreaElement).value
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
      const key = (picker.querySelector('#jf-map-key') as HTMLSelectElement)
        .value as FillKey
      draft.fields.push({
        id: crypto.randomUUID(),
        selector,
        match,
        profileKey: key,
      })
    }
    selectedEl = null
    clearSelectedOutline()
    picker.style.display = 'none'
    renderPanel()
  })
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

  clearHover()
  clearSelectedOutline()
  selectedEl = field
  setHighlight('map-selected', field, 'selected')
  showFieldPicker(field)
}

function onKeyDown(event: KeyboardEvent): void {
  if (!active) return
  if (event.key === 'Escape') {
    event.preventDefault()
    stopMapMode()
    showToast('Mapping cancelled')
  }
}

function findFillable(target: HTMLElement): HTMLElement | null {
  const fillable = collectFillableElements()
  let current: HTMLElement | null = target
  while (current) {
    if (fillable.includes(current)) return current
    current = current.parentElement
  }
  return null
}

function isUi(el: HTMLElement): boolean {
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

const inputStyle =
  'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;'

function btnStyle(secondary = false): string {
  if (secondary) {
    return 'padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font:inherit;'
  }
  return 'padding:8px 12px;border-radius:8px;border:none;background:#0f766e;color:#fff;cursor:pointer;font:inherit;font-weight:600;'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
