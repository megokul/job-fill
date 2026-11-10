type HighlightKind = 'hover' | 'selected' | 'filled'

type Box = { top: number; left: number; width: number; height: number }

const HOST_TAG = 'job-fill-root'

let shadow: ShadowRoot | null = null
let highlightLayer: HTMLElement | null = null
const highlightBoxes = new Map<string, { el: HTMLElement; target: HTMLElement; kind: HighlightKind }>()

export function ensureUiHost(): ShadowRoot {
  if (shadow) return shadow
  let existing = document.querySelector(HOST_TAG) as HTMLElement | null
  if (!existing) {
    existing = document.createElement(HOST_TAG)
    existing.style.all = 'initial'
    existing.style.position = 'fixed'
    existing.style.zIndex = '2147483646'
    existing.style.top = '0'
    existing.style.left = '0'
    existing.style.width = '0'
    existing.style.height = '0'
    document.documentElement.appendChild(existing)
  }
  shadow = existing.shadowRoot ?? existing.attachShadow({ mode: 'closed' })
  if (shadow.querySelector('.layer')) return shadow
  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
    .box { position: fixed; pointer-events: none; border-radius: 4px; box-sizing: border-box; }
    .box.hover { border: 2px solid #f59e0b; }
    .box.selected { border: 2px solid #0f766e; }
    .box.filled { border: 2px solid #0f766e; }
    @media (prefers-reduced-motion: reduce) {
      .box.filled { transition: none; }
    }
    #toast {
      position: fixed; right: 16px; bottom: 16px; max-width: 360px;
      padding: 12px 16px; border-radius: 10px; background: #0f172a; color: #f8fafc;
      font: 13px system-ui, sans-serif; box-shadow: 0 10px 30px rgba(15,23,42,.35);
      pointer-events: auto; display: none;
    }
    #toast.visible { display: block; }
    #toast .actions { display: flex; gap: 8px; margin-top: 8px; }
    #toast button {
      font: inherit; font-weight: 600; padding: 6px 10px; border-radius: 8px; cursor: pointer;
      border: 1px solid #334155; background: #1e293b; color: #f8fafc;
    }
  `
  shadow.appendChild(style)
  highlightLayer = document.createElement('div')
  highlightLayer.className = 'layer'
  shadow.appendChild(highlightLayer)

  const toast = document.createElement('div')
  toast.id = 'toast'
  shadow.appendChild(toast)

  window.addEventListener('scroll', repositionAll, true)
  window.addEventListener('resize', repositionAll)
  return shadow
}

export function showHostToast(
  message: string,
  actions?: { label: string; onClick: () => void }[],
): void {
  const root = ensureUiHost()
  const toast = root.getElementById('toast')
  if (!toast) return
  toast.textContent = ''
  const text = document.createElement('div')
  text.textContent = message
  toast.appendChild(text)
  if (actions?.length) {
    const row = document.createElement('div')
    row.className = 'actions'
    for (const action of actions) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = action.label
      btn.addEventListener('click', () => action.onClick())
      row.appendChild(btn)
    }
    toast.appendChild(row)
  }
  toast.classList.add('visible')
  window.setTimeout(() => toast.classList.remove('visible'), 6000)
}

export function hideHostToast(): void {
  const root = shadow
  root?.getElementById('toast')?.classList.remove('visible')
}

export function setHighlight(
  id: string,
  target: HTMLElement,
  kind: HighlightKind,
  durationMs?: number,
): void {
  ensureUiHost()
  let entry = highlightBoxes.get(id)
  if (!entry) {
    const box = document.createElement('div')
    box.className = `box ${kind}`
    highlightLayer!.appendChild(box)
    entry = { el: box, target, kind }
    highlightBoxes.set(id, entry)
  } else {
    entry.target = target
    entry.kind = kind
    entry.el.className = `box ${kind}`
  }
  reposition(entry.el, target)
  if (durationMs) {
    window.setTimeout(() => clearHighlight(id), durationMs)
  }
}

export function clearHighlight(id: string): void {
  const entry = highlightBoxes.get(id)
  if (!entry) return
  entry.el.remove()
  highlightBoxes.delete(id)
}

export function clearHighlights(kind?: HighlightKind): void {
  for (const [id, entry] of [...highlightBoxes.entries()]) {
    if (!kind || entry.kind === kind) clearHighlight(id)
  }
}

function reposition(box: HTMLElement, target: HTMLElement): void {
  const rect = target.getBoundingClientRect()
  const b: Box = {
    top: rect.top - 2,
    left: rect.left - 2,
    width: rect.width + 4,
    height: rect.height + 4,
  }
  box.style.top = `${b.top}px`
  box.style.left = `${b.left}px`
  box.style.width = `${b.width}px`
  box.style.height = `${b.height}px`
}

function repositionAll(): void {
  for (const entry of highlightBoxes.values()) {
    reposition(entry.el, entry.target)
  }
}

export function getUiRoot(): ShadowRoot {
  return ensureUiHost()
}
