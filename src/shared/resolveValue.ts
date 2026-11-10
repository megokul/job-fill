import type { FillKey, Profile } from './types'

export function resolveValue(profile: Profile, key: FillKey): string {
  if (key === 'fullName') {
    return [profile.firstName, profile.lastName].map((s) => s.trim()).filter(Boolean).join(' ')
  }
  if (key === 'location') {
    return [profile.city, profile.state].map((s) => s.trim()).filter(Boolean).join(', ')
  }
  return String(profile[key] ?? '')
}
