import type { Profile, ProfileKey } from './types'
import { PROFILE_LABELS } from './types'

export type FieldError = { key: ProfileKey; message: string }

export function validateProfileField(
  key: ProfileKey,
  value: string,
): string | null {
  const v = value.trim()
  if (!v) return null
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return 'Enter a valid email address.'
  }
  if (
    (key === 'linkedinUrl' ||
      key === 'portfolioUrl' ||
      key === 'githubUrl') &&
    !/^https?:\/\//i.test(v)
  ) {
    return `${PROFILE_LABELS[key]} should start with http(s)://`
  }
  return null
}

export function suggestHttps(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return null
  if (/^[\w.-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`
  return null
}

export function validateProfile(profile: Profile): FieldError[] {
  const errors: FieldError[] = []
  for (const key of Object.keys(profile) as ProfileKey[]) {
    const message = validateProfileField(key, String(profile[key] ?? ''))
    if (message) errors.push({ key, message })
  }
  return errors
}
