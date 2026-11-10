import { countryAliases, stateAliases } from '../shared/regions'
import type { FillKey } from '../shared/types'

export type PickableOption = { text: string; value?: string }

function isYesToken(raw: string): boolean {
  return /^(yes|y|true|1)$/i.test(raw.trim())
}

function isNoToken(raw: string): boolean {
  return /^(no|n|false|0)$/i.test(raw.trim())
}

/**
 * Pure option picker shared by native selects and comboboxes.
 * Never falls back to substring matching.
 */
export function pickOption(
  options: PickableOption[],
  wanted: string,
  key: FillKey | null,
): number {
  const normalized = wanted.trim().toLowerCase()
  if (!normalized || options.length === 0) return -1

  for (let i = 0; i < options.length; i++) {
    const text = options[i].text.trim().toLowerCase()
    const val = (options[i].value ?? '').trim().toLowerCase()
    if (val === normalized || text === normalized) return i
  }

  const yesNo = normalized === 'yes' || normalized === 'no' ? normalized : null
  if (yesNo) {
    for (let i = 0; i < options.length; i++) {
      const text = options[i].text.trim()
      const val = (options[i].value ?? '').trim()
      if (yesNo === 'yes' && (isYesToken(val) || isYesToken(text))) return i
      if (yesNo === 'no' && (isNoToken(val) || isNoToken(text))) return i
    }
  }

  const aliases =
    key === 'state'
      ? stateAliases(wanted)
      : key === 'country'
        ? countryAliases(wanted)
        : ([] as string[])
  for (const alias of aliases) {
    const a = alias.toLowerCase()
    for (let i = 0; i < options.length; i++) {
      const text = options[i].text.trim().toLowerCase()
      const val = (options[i].value ?? '').trim().toLowerCase()
      if (val === a || text === a) return i
    }
  }

  const valueTokens = normalized.split(/\s+/).filter(Boolean)
  for (let i = 0; i < options.length; i++) {
    const textTokens = options[i].text
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    if (valueTokens.length === 0 || textTokens.length < valueTokens.length) continue
    let prefix = true
    for (let t = 0; t < valueTokens.length; t++) {
      if (textTokens[t] !== valueTokens[t]) {
        prefix = false
        break
      }
    }
    if (prefix) return i
  }

  return -1
}
