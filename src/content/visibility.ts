export type RectLike = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export type StyleLike = {
  opacity: string
  clip: string
  clipPath: string
  webkitClipPath?: string
  overflow?: string
}

export type VisibilityDeps = {
  getRect: (el: Element) => RectLike
  getStyle: (el: Element) => StyleLike
  checkVisibility?: (el: Element) => boolean | null
  documentScrollSize?: () => { width: number; height: number }
}

const CONTROL_SELECTOR = 'input, select, textarea, button'

function parseOpacity(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 1
}

function isClippedToNothing(style: StyleLike): boolean {
  const clipPath = (style.clipPath || style.webkitClipPath || '').trim().toLowerCase()
  if (clipPath.includes('inset(50%)')) return true
  const clip = style.clip.trim().toLowerCase().replace(/\s+/g, ' ')
  // Legacy clip: rect(0 0 0 0) / rect(0px, 0px, 0px, 0px)
  if (/^rect\(\s*0(px)?\s*,?\s*0(px)?\s*,?\s*0(px)?\s*,?\s*0(px)?\s*\)$/.test(clip)) {
    return true
  }
  return false
}

/** Pure geometry / style checks used by fillable visibility. */
export function passesVisualChecks(
  el: Element,
  deps: VisibilityDeps,
): boolean {
  if (typeof deps.checkVisibility === 'function') {
    const result = deps.checkVisibility(el)
    if (result === false) return false
  }

  let node: Element | null = el
  while (node && node.nodeType === 1) {
    if (
      node.getAttribute('aria-hidden') === 'true' ||
      (node as HTMLElement).inert
    ) {
      return false
    }
    const style = deps.getStyle(node)
    if (parseOpacity(style.opacity) < 0.1) return false
    if (isClippedToNothing(style)) return false
    if (node !== el) {
      const ancestorRect = deps.getRect(node)
      const overflow = (style.overflow || 'visible').toLowerCase()
      if (
        (ancestorRect.width < 4 || ancestorRect.height < 4) &&
        overflow !== 'visible'
      ) {
        return false
      }
    }
    node = node.parentElement
  }

  const rect = deps.getRect(el)
  if (rect.width < 4 || rect.height < 4) return false

  const doc =
    deps.documentScrollSize?.() ??
    ({
      width:
        typeof document !== 'undefined'
          ? Math.max(
              document.documentElement.scrollWidth,
              document.documentElement.clientWidth,
              typeof window !== 'undefined' ? window.innerWidth : 0,
            )
          : Number.POSITIVE_INFINITY,
      height:
        typeof document !== 'undefined'
          ? Math.max(
              document.documentElement.scrollHeight,
              document.documentElement.clientHeight,
              typeof window !== 'undefined' ? window.innerHeight : 0,
            )
          : Number.POSITIVE_INFINITY,
    } as { width: number; height: number })

  if (rect.right <= 0 || rect.bottom <= 0) return false
  // Skip "beyond document" when the environment reports a zero-sized document
  // (common in happy-dom unit tests without layout).
  if (doc.width > 0 && doc.height > 0) {
    if (rect.left >= doc.width || rect.top >= doc.height) return false
  }

  return true
}

export function associatedLabel(el: HTMLElement): HTMLElement | null {
  const wrap = el.closest('label')
  if (wrap) return wrap
  if (!el.id) return null
  const root = el.getRootNode()
  const doc =
    root instanceof Document || root instanceof ShadowRoot ? root : document
  const esc =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(el.id)
      : el.id.replace(/"/g, '\\"')
  return doc.querySelector(`label[for="${esc}"]`)
}

export function isFillableVisible(
  el: HTMLElement,
  deps?: Partial<VisibilityDeps>,
): boolean {
  const fullDeps: VisibilityDeps = {
    getRect: (node) => {
      const r = (node as HTMLElement).getBoundingClientRect()
      return {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      }
    },
    getStyle: (node) => {
      const s = window.getComputedStyle(node)
      return {
        opacity: s.opacity,
        clip: s.clip,
        clipPath: s.clipPath,
        webkitClipPath: (s as CSSStyleDeclaration & { webkitClipPath?: string })
          .webkitClipPath,
        overflow: s.overflow,
      }
    },
    checkVisibility: (node) => {
      // happy-dom's checkVisibility is unreliable for our fillable heuristics.
      if ((globalThis as { happyDOM?: unknown }).happyDOM) return null
      const any = node as Element & {
        checkVisibility?: (opts?: object) => boolean
      }
      if (typeof any.checkVisibility !== 'function') return null
      try {
        return any.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
          opacityProperty: true,
          visibilityProperty: true,
        })
      } catch {
        return null
      }
    },
    ...deps,
  }

  const tag = el.tagName
  const type =
    el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : ''
  const isRadioOrCheckbox =
    el instanceof HTMLInputElement && (type === 'radio' || type === 'checkbox')

  if (isRadioOrCheckbox) {
    const label = associatedLabel(el)
    // Prefer the label (custom-styled radios clip the input). If there is a
    // label, require it to pass; also allow the input itself when the label
    // has no usable box (common in happy-dom without layout).
    if (label) {
      if (passesVisualChecks(label, fullDeps)) return true
      const labelRect = fullDeps.getRect(label)
      if (labelRect.width < 4 || labelRect.height < 4) {
        return passesVisualChecks(el, fullDeps)
      }
      return false
    }
    return passesVisualChecks(el, fullDeps)
  }

  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.matches?.(CONTROL_SELECTOR)
  ) {
    return passesVisualChecks(el, fullDeps)
  }

  return passesVisualChecks(el, fullDeps)
}
