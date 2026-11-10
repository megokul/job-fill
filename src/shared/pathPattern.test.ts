import { describe, expect, it } from 'vitest'
import { defaultPathPattern } from './pathPattern'

describe('defaultPathPattern', () => {
  it('replaces numeric and uuid-like segments', () => {
    expect(defaultPathPattern('/jobs/123/apply')).toBe('/jobs/*/apply')
    expect(
      defaultPathPattern('/jobs/550e8400-e29b-41d4-a716-446655440000/apply'),
    ).toBe('/jobs/*/apply')
  })

  it('keeps normal segments', () => {
    expect(defaultPathPattern('/careers/apply')).toBe('/careers/apply')
  })
})
