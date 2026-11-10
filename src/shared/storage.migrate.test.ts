import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, unknown>()

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (keys: string[]) => {
        const out: Record<string, unknown> = {}
        for (const k of keys) {
          if (memory.has(k)) out[k] = memory.get(k)
        }
        return out
      },
      set: async (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) memory.set(k, v)
      },
    },
  },
})

describe('settings migration', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('migrates autofillOnLoad true to mapping origins', async () => {
    memory.set('settings', { autofillOnLoad: true, highlightFilled: true })
    memory.set('formMappings', [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'A',
        origin: 'https://a.example',
        pathPattern: '/',
        fields: [],
        updatedAt: 1,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'B',
        origin: 'https://b.example',
        pathPattern: '/',
        fields: [],
        updatedAt: 1,
      },
    ])

    const { getStore } = await import('./storage')
    const store = await getStore()
    expect(store.settings.autofillSites).toEqual([
      'https://a.example',
      'https://b.example',
    ])
    expect(store.settings.autofillOnLoad).toBeUndefined()
  })
})
