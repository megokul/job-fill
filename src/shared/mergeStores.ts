import { PROFILE_KEYS, type Profile, type Store } from './types'

function isNonEmptyProfileValue(value: string): boolean {
  return value.trim().length > 0
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of current) byId.set(item.id, item)
  for (const item of incoming) byId.set(item.id, item)
  return Array.from(byId.values())
}

export function mergeStores(current: Store, incoming: Store): Store {
  const profile = { ...current.profile } as Profile
  for (const key of PROFILE_KEYS) {
    const next = incoming.profile[key]
    if (typeof next === 'string' && isNonEmptyProfileValue(next)) {
      ;(profile as Record<string, string>)[key] = next
    }
  }

  return {
    schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
    profile,
    formMappings: mergeById(current.formMappings, incoming.formMappings),
    customAnswers: mergeById(current.customAnswers, incoming.customAnswers),
    settings: {
      autofillSites: [
        ...new Set([
          ...current.settings.autofillSites,
          ...incoming.settings.autofillSites,
        ]),
      ],
      highlightFilled: current.settings.highlightFilled,
    },
  }
}
