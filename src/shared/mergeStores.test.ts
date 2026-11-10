import { describe, expect, it } from 'vitest'
import { mergeStores } from './mergeStores'
import {
  DEFAULT_SETTINGS,
  EMPTY_PROFILE,
  type Store,
} from './types'
import { parseBackup } from './validate'

function baseStore(overrides: Partial<Store> = {}): Store {
  return {
    schemaVersion: 2,
    profile: { ...EMPTY_PROFILE, firstName: 'Ada', email: 'ada@example.com' },
    formMappings: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Current',
        origin: 'https://jobs.example.com',
        pathPattern: '/apply',
        fields: [],
        updatedAt: 1,
      },
    ],
    customAnswers: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question: 'Why?',
        answer: 'Because',
        updatedAt: 1,
      },
    ],
    settings: {
      autofillSites: ['https://jobs.example.com'],
      highlightFilled: true,
    },
    ...overrides,
  }
}

describe('mergeStores', () => {
  it('keeps current profile values when incoming profile fields are blank', () => {
    const current = baseStore()
    const incoming = baseStore({
      profile: { ...EMPTY_PROFILE, firstName: '', email: '' },
    })
    const merged = mergeStores(current, incoming)
    expect(merged.profile.firstName).toBe('Ada')
    expect(merged.profile.email).toBe('ada@example.com')
  })

  it('importing the same export twice leaves counts unchanged', () => {
    const current = baseStore()
    const once = mergeStores(current, current)
    const twice = mergeStores(once, current)
    expect(twice.formMappings).toHaveLength(1)
    expect(twice.customAnswers).toHaveLength(1)
    expect(twice.settings.autofillSites).toEqual(['https://jobs.example.com'])
    expect(twice.settings.highlightFilled).toBe(true)
  })

  it('unions autofillSites and keeps current highlightFilled', () => {
    const current = baseStore({
      settings: {
        autofillSites: ['https://a.example'],
        highlightFilled: false,
      },
    })
    const incoming = baseStore({
      settings: {
        autofillSites: ['https://b.example'],
        highlightFilled: true,
      },
    })
    const merged = mergeStores(current, incoming)
    expect(merged.settings.autofillSites.sort()).toEqual([
      'https://a.example',
      'https://b.example',
    ])
    expect(merged.settings.highlightFilled).toBe(false)
  })
})

describe('parseBackup fatal', () => {
  it('sets fatal for invalid JSON', () => {
    const result = parseBackup('{not json')
    expect(result.fatal).toBe(true)
    expect(result.errors).toContain('Invalid JSON')
  })

  it('sets fatal for non-object root', () => {
    const result = parseBackup('["array"]')
    expect(result.fatal).toBe(true)
    expect(result.errors.some((e) => /object/i.test(e))).toBe(true)
  })

  it('is not fatal for a valid partial backup', () => {
    const result = parseBackup(
      JSON.stringify({ profile: { firstName: 'Ada' } }),
    )
    expect(result.fatal).toBe(false)
    expect(result.store.profile.firstName).toBe('Ada')
    expect(result.store.settings).toEqual(DEFAULT_SETTINGS)
  })
})
