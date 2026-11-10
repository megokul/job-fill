import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_PROFILE,
  REQUIRED_PROFILE_KEYS,
  type CustomAnswer,
  type FormMapping,
  type Profile,
  type Settings,
  type Store,
} from './types'

const STORE_KEYS = [
  'schemaVersion',
  'profile',
  'formMappings',
  'settings',
  'customAnswers',
] as const

let writeChain: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn)
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

type LegacySettings = Partial<Settings> & { autofillOnLoad?: boolean }

/** Read-only. Returns a migrated in-memory view; never writes. */
export async function getStore(): Promise<Store> {
  const raw = await chrome.storage.local.get([...STORE_KEYS])
  const formMappings = Array.isArray(raw.formMappings)
    ? (raw.formMappings as FormMapping[])
    : []

  const settings = migrateSettings(
    raw.settings as LegacySettings | undefined,
    formMappings,
  )

  return {
    schemaVersion:
      typeof raw.schemaVersion === 'number'
        ? raw.schemaVersion
        : CURRENT_SCHEMA_VERSION,
    profile: { ...EMPTY_PROFILE, ...(raw.profile as Partial<Profile> | undefined) },
    formMappings,
    settings,
    customAnswers: Array.isArray(raw.customAnswers)
      ? (raw.customAnswers as CustomAnswer[])
      : [],
  }
}

/**
 * Persist schema/settings migration. Runs inside enqueueWrite so it cannot
 * race past a newer seed. Writes settings only when legacy autofillOnLoad is
 * present; on empty storage writes schemaVersion alone.
 */
export async function migrateStore(): Promise<void> {
  await enqueueWrite(async () => {
    const raw = await chrome.storage.local.get([...STORE_KEYS])
    const formMappings = Array.isArray(raw.formMappings)
      ? (raw.formMappings as FormMapping[])
      : []
    const settingsRaw = raw.settings as LegacySettings | undefined
    const hasLegacyAutofill =
      settingsRaw != null && typeof settingsRaw.autofillOnLoad === 'boolean'
    const needsSchema =
      typeof raw.schemaVersion !== 'number' ||
      raw.schemaVersion !== CURRENT_SCHEMA_VERSION

    if (!hasLegacyAutofill && !needsSchema) return

    const patch: Record<string, unknown> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
    }
    if (hasLegacyAutofill) {
      const migrated = migrateSettings(settingsRaw, formMappings)
      patch.settings = {
        autofillSites: migrated.autofillSites,
        highlightFilled: migrated.highlightFilled,
      }
    }
    await chrome.storage.local.set(patch)
  })
}

function migrateSettings(
  raw: LegacySettings | undefined,
  formMappings: FormMapping[],
): Settings {
  const highlightFilled = raw?.highlightFilled !== false
  if (Array.isArray(raw?.autofillSites)) {
    return {
      autofillSites: raw.autofillSites.filter((s) => typeof s === 'string'),
      highlightFilled,
    }
  }
  if (raw?.autofillOnLoad === true) {
    const origins = [...new Set(formMappings.map((m) => m.origin))]
    return { autofillSites: origins, highlightFilled }
  }
  return { autofillSites: [], highlightFilled }
}

export async function saveProfile(profile: Profile): Promise<Store> {
  return enqueueWrite(async () => {
    await chrome.storage.local.set({ profile })
    return getStore()
  })
}

export async function saveSettings(settings: Settings): Promise<Store> {
  return enqueueWrite(async () => {
    const clean: Settings = {
      autofillSites: settings.autofillSites,
      highlightFilled: settings.highlightFilled,
    }
    await chrome.storage.local.set({ settings: clean })
    return getStore()
  })
}

export async function saveFormMapping(mapping: FormMapping): Promise<Store> {
  return enqueueWrite(async () => {
    const store = await getStore()
    const idx = store.formMappings.findIndex((m) => m.id === mapping.id)
    const next = [...store.formMappings]
    if (idx >= 0) next[idx] = mapping
    else next.push(mapping)
    await chrome.storage.local.set({ formMappings: next })
    return getStore()
  })
}

export async function deleteFormMapping(id: string): Promise<Store> {
  return enqueueWrite(async () => {
    const store = await getStore()
    const next = store.formMappings.filter((m) => m.id !== id)
    await chrome.storage.local.set({ formMappings: next })
    return getStore()
  })
}

export async function deleteFieldMapping(
  formId: string,
  fieldId: string,
): Promise<Store> {
  return enqueueWrite(async () => {
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
  })
}

export async function saveCustomAnswers(
  customAnswers: CustomAnswer[],
): Promise<Store> {
  return enqueueWrite(async () => {
    await chrome.storage.local.set({ customAnswers })
    return getStore()
  })
}

export async function replaceStore(store: Store): Promise<Store> {
  return enqueueWrite(async () => {
    await chrome.storage.local.set({
      schemaVersion: store.schemaVersion ?? CURRENT_SCHEMA_VERSION,
      profile: store.profile,
      formMappings: store.formMappings,
      settings: {
        autofillSites: store.settings.autofillSites,
        highlightFilled: store.settings.highlightFilled,
      },
      customAnswers: store.customAnswers ?? [],
    })
    return getStore()
  })
}

export function profileCompleteness(profile: Profile): {
  filled: number
  total: number
  ready: boolean
} {
  const keys = Object.keys(EMPTY_PROFILE) as (keyof Profile)[]
  const filled = keys.filter((k) => String(profile[k] ?? '').trim() !== '').length
  const ready = REQUIRED_PROFILE_KEYS.every((k) => Boolean(String(profile[k]).trim()))
  return { filled, total: keys.length, ready }
}
