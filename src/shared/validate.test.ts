import { describe, expect, it } from 'vitest'
import { parseBackup } from './validate'

describe('parseBackup', () => {
  it('rejects invalid JSON', () => {
    const { errors } = parseBackup('{not json')
    expect(errors).toContain('Invalid JSON')
  })

  it('truncates long profile strings and drops unknown keys', () => {
    const long = 'x'.repeat(600)
    const { store } = parseBackup(
      JSON.stringify({
        profile: { firstName: long, evil: 1, email: 'a@b.com' },
      }),
    )
    expect(store.profile.firstName).toHaveLength(500)
    expect(store.profile.email).toBe('a@b.com')
    expect((store.profile as { evil?: unknown }).evil).toBeUndefined()
  })

  it('regenerates non-uuid mapping ids and validates origin', () => {
    const { store, errors } = parseBackup(
      JSON.stringify({
        formMappings: [
          {
            id: 'not-a-uuid',
            name: 'Test',
            origin: 'https://jobs.example.com',
            pathPattern: '/apply',
            fields: [
              {
                id: 'also-bad',
                profileKey: 'email',
                match: { label: 'Email' },
              },
            ],
          },
          {
            id: 'x',
            name: 'Bad',
            origin: 'ftp://nope',
            fields: [],
          },
        ],
      }),
    )
    expect(store.formMappings).toHaveLength(1)
    expect(store.formMappings[0].id).toMatch(
      /^[0-9a-f-]{36}$/i,
    )
    expect(errors.some((e) => /origin/i.test(e) || /Regenerated/i.test(e))).toBe(
      true,
    )
  })
})
