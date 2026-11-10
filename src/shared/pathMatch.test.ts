import { describe, expect, it } from 'vitest'
import { mappingsForUrl, normalizePath, pathMatches } from './pathMatch'

describe('normalizePath', () => {
  it('ensures leading slash and strips trailing slash', () => {
    expect(normalizePath('jobs/apply')).toBe('/jobs/apply')
    expect(normalizePath('/jobs/apply/')).toBe('/jobs/apply')
    expect(normalizePath('')).toBe('/')
  })
})

describe('pathMatches', () => {
  it('matches exact paths', () => {
    expect(pathMatches('/jobs/apply', '/jobs/apply')).toBe(true)
    expect(pathMatches('/jobs/apply', '/jobs/other')).toBe(false)
  })

  it('matches single-segment wildcards', () => {
    expect(pathMatches('/jobs/123/apply', '/jobs/*/apply')).toBe(true)
    expect(pathMatches('/jobs/123/456/apply', '/jobs/*/apply')).toBe(false)
  })

  it('matches multi-segment wildcards', () => {
    expect(pathMatches('/careers/team/eng/apply', '/careers/**/apply')).toBe(true)
    expect(pathMatches('/anything', '*')).toBe(true)
  })
})

describe('mappingsForUrl', () => {
  it('filters by origin and path pattern', () => {
    const mappings = [
      { origin: 'https://jobs.example.com', pathPattern: '/apply' },
      { origin: 'https://jobs.example.com', pathPattern: '/jobs/*/apply' },
      { origin: 'https://other.com', pathPattern: '/apply' },
    ]
    const hit = mappingsForUrl(
      mappings,
      'https://jobs.example.com/jobs/42/apply?x=1',
    )
    expect(hit).toHaveLength(1)
    expect(hit[0].pathPattern).toBe('/jobs/*/apply')
  })
})
