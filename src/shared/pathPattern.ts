/** Replace id-like path segments with `*`. */
export function defaultPathPattern(pathname: string): string {
  const parts = (pathname || '/').split('/').filter(Boolean)
  const mapped = parts.map((seg) => {
    if (/^\d+$/.test(seg)) return '*'
    if (/^[0-9a-f-]{8,}$/i.test(seg)) return '*'
    return seg
  })
  return mapped.length ? `/${mapped.join('/')}` : '/'
}
