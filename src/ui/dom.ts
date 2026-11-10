export type Child = Node | string | number | false | null | undefined

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, unknown> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue
      if (key === 'className' && typeof value === 'string') {
        el.className = value
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value as object)
      } else if (key.startsWith('on') && typeof value === 'function') {
        const event = key.slice(2).toLowerCase()
        el.addEventListener(event, value as EventListener)
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(el.dataset, value as object)
      } else if (key in el && key !== 'list') {
        ;(el as unknown as Record<string, unknown>)[key] = value
      } else {
        el.setAttribute(key, String(value))
      }
    }
  }
  for (const child of children.flat()) {
    if (child === false || child === null || child === undefined) continue
    el.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return el
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}
