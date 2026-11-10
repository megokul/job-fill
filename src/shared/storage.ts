import {
  DEFAULT_SETTINGS,
  EMPTY_PROFILE,
  type FormMapping,
  type Profile,
  type Settings,
  type Store,
} from './types'

const STORE_KEYS = ['profile', 'formMappings', 'settings'] as const

export function createDefaultStore(): Store {
  return {
    profile: { ...EMPTY_PROFILE },
    formMappings: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

export async function getStore(): Promise<Store> {
  const raw = await chrome.storage.local.get([...STORE_KEYS])
  return {
    profile: { ...EMPTY_PROFILE, ...(raw.profile as Partial<Profile> | undefined) },
    formMappings: Array.isArray(raw.formMappings)
      ? (raw.formMappings as FormMapping[])
      : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings as Partial<Settings> | undefined),
    },
  }
}

export async function saveProfile(profile: Profile): Promise<Store> {
  await chrome.storage.local.set({ profile })
  return getStore()
}

export async function saveSettings(settings: Settings): Promise<Store> {
  await chrome.storage.local.set({ settings })
  return getStore()
}

export async function saveFormMapping(mapping: FormMapping): Promise<Store> {
  const store = await getStore()
  const idx = store.formMappings.findIndex((m) => m.id === mapping.id)
  const next = [...store.formMappings]
  if (idx >= 0) next[idx] = mapping
  else next.push(mapping)
  await chrome.storage.local.set({ formMappings: next })
  return getStore()
}

export async function deleteFormMapping(id: string): Promise<Store> {
  const store = await getStore()
  const next = store.formMappings.filter((m) => m.id !== id)
  await chrome.storage.local.set({ formMappings: next })
  return getStore()
}

export async function deleteFieldMapping(
  formId: string,
  fieldId: string,
): Promise<Store> {
  const store = await getStore()
  const next = store.formMappings.map((m) => {
    if (m.id !== formId) return m
    return {
      ...m,
      fields: m.fields.filter((f) => f.id !== fieldId),
      updatedAt: Date.now(),
    }
  })
  await chrome.storage.local.set({ formMappings: next })
  return getStore()
}

export function profileCompleteness(profile: Profile): {
  filled: number
  total: number
  ready: boolean
} {
  const keys = Object.keys(EMPTY_PROFILE) as (keyof Profile)[]
  const filled = keys.filter((k) => String(profile[k] ?? '').trim() !== '').length
  const ready =
    Boolean(profile.firstName.trim()) &&
    Boolean(profile.lastName.trim()) &&
    Boolean(profile.email.trim())
  return { filled, total: keys.length, ready }
}
