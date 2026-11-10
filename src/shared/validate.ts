import {
  DEFAULT_SETTINGS,
  EMPTY_PROFILE,
  PROFILE_KEYS,
  type CustomAnswer,
  type FieldMapping,
  type FormMapping,
  type Profile,
  type ProfileKey,
  type Settings,
  type Store,
  type YesNo,
} from './types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ParseBackupResult = {
  store: Store
  errors: string[]
}

export function parseBackup(json: string): ParseBackupResult {
  const errors: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return {
      store: {
        profile: { ...EMPTY_PROFILE },
        formMappings: [],
        settings: { ...DEFAULT_SETTINGS },
        customAnswers: [],
        schemaVersion: 1,
      },
      errors: ['Invalid JSON'],
    }
  }

  if (!raw || typeof raw !== 'object') {
    return {
      store: {
        profile: { ...EMPTY_PROFILE },
        formMappings: [],
        settings: { ...DEFAULT_SETTINGS },
        customAnswers: [],
        schemaVersion: 1,
      },
      errors: ['Backup root must be an object'],
    }
  }

  const obj = raw as Record<string, unknown>
  const profile = parseProfile(obj.profile, errors)
  const settings = parseSettings(obj.settings, errors)
  const formMappings = parseMappings(obj.formMappings, errors)
  const customAnswers = parseCustomAnswers(obj.customAnswers, errors)

  return {
    store: {
      profile,
      settings,
      formMappings,
      customAnswers,
      schemaVersion: 1,
    },
    errors,
  }
}

function truncate(value: string, max = 500): string {
  return value.length > max ? value.slice(0, max) : value
}

function parseProfile(raw: unknown, errors: string[]): Profile {
  const profile = { ...EMPTY_PROFILE }
  if (!raw || typeof raw !== 'object') {
    if (raw !== undefined) errors.push('profile must be an object')
    return profile
  }
  const src = raw as Record<string, unknown>
  for (const key of PROFILE_KEYS) {
    const v = src[key]
    if (v === undefined) continue
    if (typeof v !== 'string') {
      errors.push(`profile.${key} must be a string`)
      continue
    }
    if (key === 'workAuthorized' || key === 'requiresSponsorship') {
      profile[key] = coerceYesNo(v)
    } else {
      ;(profile as Record<string, string>)[key] = truncate(v)
    }
  }
  return profile
}

function coerceYesNo(value: string): YesNo {
  const v = value.trim().toLowerCase()
  if (v === 'yes' || v === 'no') return v
  return ''
}

function parseSettings(raw: unknown, errors: string[]): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') {
    if (raw !== undefined) errors.push('settings must be an object')
    return settings
  }
  const src = raw as Record<string, unknown>
  if (Array.isArray(src.autofillSites)) {
    settings.autofillSites = src.autofillSites
      .filter((x): x is string => typeof x === 'string')
      .map((o) => {
        try {
          return new URL(o).origin
        } catch {
          errors.push(`Invalid autofill origin: ${o}`)
          return ''
        }
      })
      .filter(Boolean)
  } else if (src.autofillOnLoad === true) {
    settings.autofillSites = []
  }
  if (typeof src.highlightFilled === 'boolean') {
    settings.highlightFilled = src.highlightFilled
  }
  return settings
}

function parseMappings(raw: unknown, errors: string[]): FormMapping[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    errors.push('formMappings must be an array')
    return []
  }
  const out: FormMapping[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      errors.push('Skipped invalid mapping entry')
      continue
    }
    const m = item as Record<string, unknown>
    let origin = ''
    if (typeof m.origin === 'string') {
      try {
        origin = new URL(m.origin).origin
        if (!/^https?:$/i.test(new URL(origin).protocol)) {
          errors.push(`Mapping origin must be http(s): ${m.origin}`)
          continue
        }
      } catch {
        errors.push(`Invalid mapping origin: ${String(m.origin)}`)
        continue
      }
    } else {
      errors.push('Mapping missing origin')
      continue
    }

    const id =
      typeof m.id === 'string' && UUID_RE.test(m.id) ? m.id : crypto.randomUUID()
    if (typeof m.id === 'string' && !UUID_RE.test(m.id)) {
      errors.push(`Regenerated non-UUID mapping id`)
    }

    const fields = parseFields(m.fields, errors)
    out.push({
      id,
      name: typeof m.name === 'string' ? truncate(m.name, 200) : 'Imported mapping',
      origin,
      pathPattern:
        typeof m.pathPattern === 'string' && m.pathPattern.trim()
          ? truncate(m.pathPattern, 300)
          : '/',
      fields,
      updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : Date.now(),
    })
  }
  return out
}

function parseFields(raw: unknown, errors: string[]): FieldMapping[] {
  if (!Array.isArray(raw)) return []
  const out: FieldMapping[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    const profileKey = f.profileKey
    if (typeof profileKey !== 'string' || !PROFILE_KEYS.includes(profileKey as ProfileKey)) {
      // customAnswerId allowed in Phase 4; for now skip unknown
      if (
        f.customAnswerId &&
        typeof f.customAnswerId === 'string'
      ) {
        // keep for Phase 4 shape if present in types
      } else {
        errors.push(`Dropped field with unknown profileKey: ${String(profileKey)}`)
        continue
      }
    }
    const id =
      typeof f.id === 'string' && UUID_RE.test(f.id) ? f.id : crypto.randomUUID()
    const match =
      f.match && typeof f.match === 'object'
        ? (f.match as FieldMapping['match'])
        : {}
    const field: FieldMapping = {
      id,
      selector: typeof f.selector === 'string' ? f.selector : undefined,
      match: {
        name: typeof match.name === 'string' ? match.name : undefined,
        id: typeof match.id === 'string' ? match.id : undefined,
        label: typeof match.label === 'string' ? match.label : undefined,
        placeholder:
          typeof match.placeholder === 'string' ? match.placeholder : undefined,
        autocomplete:
          typeof match.autocomplete === 'string' ? match.autocomplete : undefined,
      },
      profileKey: profileKey as ProfileKey,
    }
    out.push(field)
  }
  return out
}

function parseCustomAnswers(raw: unknown, errors: string[]): CustomAnswer[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    errors.push('customAnswers must be an array')
    return []
  }
  const out: CustomAnswer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    if (typeof a.question !== 'string' || typeof a.answer !== 'string') {
      errors.push('Skipped custom answer without question/answer strings')
      continue
    }
    out.push({
      id:
        typeof a.id === 'string' && UUID_RE.test(a.id)
          ? a.id
          : crypto.randomUUID(),
      question: truncate(a.question, 500),
      answer: truncate(a.answer, 500),
      updatedAt: typeof a.updatedAt === 'number' ? a.updatedAt : Date.now(),
    })
  }
  return out
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
