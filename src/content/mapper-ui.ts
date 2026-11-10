import { v4 as uuidv4 } from 'uuid'
import type { FormMapping, ProfileKey } from '../shared/types'
import { PROFILE_KEYS, PROFILE_LABELS } from '../shared/types'
import { buildSelector, showToast } from './filler'
import { collectFillableElements, extractSignals } from './matcher'

type SaveMappingFn = (mapping: FormMapping) => Promise<void>

type MapperUiOptions = {
  existing?: FormMapping | null
  onSave: SaveMappingFn
}

let active = false
let overlay: HTMLDivElement | null = null
let panel: HTMLDivElement | null = null
let hoverEl: HTMLElement | null = null
let selectedEl: HTMLElement | null = null
let draft: FormMapping | null = null
let saveFn: SaveMappingFn | null = null

const HOVER_OUTLINE = '2px solid #f59e0b'
const SELECT_OUTLINE = '2px solid #0f766e'

export function isMapModeActive(): boolean {
  return active
}

export function startMapMode(options: MapperUiOptions): void {
  if (active) stopMapMode()
  active = true
  saveFn = options.onSave

  draft = options.existing
    ? structuredClone(options.existing)
    : {
        id: uuidv4(),
        name: defaultMappingName(),
        origin: location.origin,
        pathPattern: location.pathname || '/',
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
  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  overlay?.remove()
  panel?.remove()
  overlay = null
  panel = null
  hoverEl = null
  selectedEl = null
  draft = null
  saveFn = null
}

function defaultMappingName(): string {
  const host = location.hostname.replace(/^www\./, '')
  return `${host} application`
}

function createOverlay(): void {
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
  })
  document.documentElement.appendChild(overlay)
}

function createPanel(): void {
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
  })
  document.documentElement.appendChild(panel)
}

function renderPanel(): void {
  if (!panel || !draft) return

  const fieldRows = draft.fields
    .map(
      (f) => `
      <li style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <span>${escapeHtml(PROFILE_LABELS[f.profileKey])}<br>
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

function showFieldPicker(el: HTMLElement): void {
  if (!panel || !draft) return
  const picker = panel.querySelector('#jf-map-picker') as HTMLDivElement | null
  if (!picker) return

  const signals = extractSignals(el)
  const options = PROFILE_KEYS.map(
    (key) => `<option value="${key}">${escapeHtml(PROFILE_LABELS[key])}</option>`,
  ).join('')

  picker.style.display = 'block'
  picker.innerHTML = `
    <div style="margin-bottom:6px;font-weight:600;">Selected field</div>
    <div style="color:#475569;margin-bottom:8px;word-break:break-word;">
      ${escapeHtml(signals.label || signals.name || signals.placeholder || el.tagName.toLowerCase())}
    </div>
    <label style="display:block;margin-bottom:8px;">
      <span style="display:block;margin-bottom:4px;">Map to profile field</span>
      <select id="jf-map-key" style="${inputStyle}">${options}</select>
    </label>
    <button type="button" id="jf-map-add" style="${btnStyle()}">Add field mapping</button>
  `

  picker.querySelector('#jf-map-add')?.addEventListener('click', () => {
    const key = (picker.querySelector('#jf-map-key') as HTMLSelectElement).value as ProfileKey
    if (!draft) return
    // Replace existing mapping for same key on this form
    draft.fields = draft.fields.filter((f) => f.profileKey !== key)
    draft.fields.push({
      id: uuidv4(),
      selector: buildSelector(el),
      match: {
        name: signals.name,
        id: signals.id,
        label: signals.label,
        placeholder: signals.placeholder,
        autocomplete: signals.autocomplete,
      },
      profileKey: key,
    })
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
  await saveFn(draft)
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
  hoverEl = field
  hoverEl.style.outline = HOVER_OUTLINE
  hoverEl.style.outlineOffset = '2px'
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
  selectedEl.style.outline = SELECT_OUTLINE
  selectedEl.style.outlineOffset = '2px'
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
  return Boolean(
    el.closest('#job-fill-map-banner, #job-fill-map-panel, #job-fill-toast'),
  )
}

function clearHover(): void {
  if (hoverEl && hoverEl !== selectedEl) {
    hoverEl.style.outline = ''
    hoverEl.style.outlineOffset = ''
  }
  hoverEl = null
}

function clearSelectedOutline(): void {
  if (selectedEl) {
    selectedEl.style.outline = ''
    selectedEl.style.outlineOffset = ''
  }
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
