import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, unknown>()
const setMock = vi.fn(async (obj: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(obj)) memory.set(k, v)
})

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
      set: setMock,
    },
  },
})

describe('settings migration', () => {
  beforeEach(() => {
    memory.clear()
    setMock.mockClear()
    vi.resetModules()
  })

  it('getStore never writes in any state', async () => {
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
    ])

    const { getStore } = await import('./storage')
    const store = await getStore()
    expect(store.settings.autofillSites).toEqual(['https://a.example'])
    expect(setMock).not.toHaveBeenCalled()

    memory.clear()
    const empty = await getStore()
    expect(empty.settings.autofillSites).toEqual([])
    expect(setMock).not.toHaveBeenCalled()

    memory.set('schemaVersion', 1)
    memory.set('settings', { autofillSites: ['https://x.example'], highlightFilled: false })
    await getStore()
    expect(setMock).not.toHaveBeenCalled()
  })

  it('migrateStore on empty storage writes schemaVersion alone', async () => {
    const { migrateStore } = await import('./storage')
    await migrateStore()
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(setMock.mock.calls[0][0]).toEqual({ schemaVersion: 2 })
    expect(memory.get('schemaVersion')).toBe(2)
    expect(memory.has('settings')).toBe(false)
  })

  it('migrateStore on legacy autofillOnLoad persists migrated settings', async () => {
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

    const { migrateStore, getStore } = await import('./storage')
    await migrateStore()
    expect(setMock).toHaveBeenCalled()
    const stored = memory.get('settings') as {
      autofillSites: string[]
      highlightFilled: boolean
      autofillOnLoad?: boolean
    }
    expect(stored.autofillSites).toEqual(['https://a.example', 'https://b.example'])
    expect(stored.autofillOnLoad).toBeUndefined()
    const view = await getStore()
    expect(view.settings.autofillSites).toEqual([
      'https://a.example',
      'https://b.example',
    ])
  })

  it('migrateStore on current storage is a no-op write', async () => {
    memory.set('schemaVersion', 2)
    memory.set('settings', {
      autofillSites: ['https://keep.example'],
      highlightFilled: false,
    })
    const { migrateStore } = await import('./storage')
    await migrateStore()
    expect(setMock).not.toHaveBeenCalled()
    expect(memory.get('settings')).toEqual({
      autofillSites: ['https://keep.example'],
      highlightFilled: false,
    })
  })

  it('getStore still returns migrated view for legacy autofillOnLoad', async () => {
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
    ])

    const { getStore } = await import('./storage')
    const store = await getStore()
    expect(store.settings.autofillSites).toEqual(['https://a.example'])
    expect(store.settings.autofillOnLoad).toBeUndefined()
  })
})
