/**
 * Match a pathname against a simple glob pattern.
 * Supports `*` (any chars except `/` by segment, or across if used mid-string)
 * and `**` for multi-segment wildcards. Exact path also matches.
 */
export function pathMatches(pathname: string, pattern: string): boolean {
  const path = normalizePath(pathname)
  const pat = normalizePath(pattern)

  if (pat === '*' || pat === '/**' || pat === '**') return true
  if (pat === path) return true

  const regex = globToRegExp(pat)
  return regex.test(path)
}

export function normalizePath(input: string): string {
  if (!input) return '/'
  let p = input.trim()
  if (!p.startsWith('/')) p = `/${p}`
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

function globToRegExp(pattern: string): RegExp {
  let source = '^'
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*'
        i++
        if (pattern[i + 1] === '/') i++
      } else {
        source += '[^/]*'
      }
    } else if ('+.?^${}()|[]\\'.includes(ch)) {
      source += `\\${ch}`
    } else {
      source += ch
    }
  }
  source += '$'
  return new RegExp(source, 'i')
}

export function mappingsForUrl<T extends { origin: string; pathPattern: string }>(
  mappings: T[],
  url: string,
): T[] {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return []
  }

  return mappings.filter(
    (m) => m.origin === parsed.origin && pathMatches(parsed.pathname, m.pathPattern),
  )
}
