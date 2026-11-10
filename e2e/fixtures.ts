import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Store } from '../src/shared/types'
import { makeStore } from './helpers/profile'

const root = path.dirname(fileURLToPath(import.meta.url))
const extensionPath = path.resolve(root, '..', 'dist')

type Fixtures = {
  context: BrowserContext
  extensionId: string
  serviceWorker: Worker
  seedStore: (store?: Partial<Store>) => Promise<Store>
  fillTab: (tabId: number) => Promise<unknown[]>
  undoTab: (tabId: number) => Promise<number>
  tabIdFor: (pageUrl: string) => Promise<number>
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
      throw new Error(
        `Extension build missing at ${extensionPath}. Run npm run build first.`,
      )
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-fill-e2e-'))
    // Docs: use channel chromium for extension headless support; fall back headed if needed.
    // Playwright docs: channel "chromium" supports loading extensions in headless.
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },

  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers()
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 30_000 })
    }
    await use(worker)
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = serviceWorker.url().split('/')[2]
    await use(extensionId)
  },

  seedStore: async ({ serviceWorker }, use) => {
    const seed = async (overrides: Partial<Store> = {}): Promise<Store> => {
      const store = makeStore(overrides)
      await serviceWorker.evaluate(async (payload) => {
        await chrome.storage.local.clear()
        await chrome.storage.local.set(payload)
      }, store)
      // Confirm the seed stuck (first-run Options getStore used to rewrite EMPTY).
      const confirmed = await serviceWorker.evaluate(async () => {
        const raw = await chrome.storage.local.get(['profile'])
        const profile = raw.profile as { firstName?: string; email?: string } | undefined
        return {
          firstName: profile?.firstName ?? '',
          email: profile?.email ?? '',
        }
      })
      if (
        confirmed.firstName !== store.profile.firstName ||
        confirmed.email !== store.profile.email
      ) {
        await serviceWorker.evaluate(async (payload) => {
          await chrome.storage.local.set(payload)
        }, store)
      }
      return store
    }
    await use(seed)
  },

  fillTab: async ({ serviceWorker }, use) => {
    const fill = async (tabId: number): Promise<unknown[]> => {
      return serviceWorker.evaluate(async (id) => {
        const results = await chrome.scripting.executeScript({
          target: { tabId: id, allFrames: true },
          func: async () => {
            const api = (
              globalThis as typeof globalThis & {
                __jobFill?: { fill: () => Promise<unknown> }
              }
            ).__jobFill
            if (!api) return null
            return api.fill()
          },
        })
        return results.map((r) => r.result)
      }, tabId)
    }
    await use(fill)
  },

  undoTab: async ({ serviceWorker }, use) => {
    const undo = async (tabId: number): Promise<number> => {
      return serviceWorker.evaluate(async (id) => {
        const results = await chrome.scripting.executeScript({
          target: { tabId: id, allFrames: true },
          func: async () => {
            const api = (
              globalThis as typeof globalThis & {
                __jobFill?: { undo: () => Promise<{ restored: number }> }
              }
            ).__jobFill
            if (!api) return 0
            const out = await api.undo()
            return out.restored
          },
        })
        return results.reduce(
          (sum, r) => sum + (typeof r.result === 'number' ? r.result : 0),
          0,
        )
      }, tabId)
    }
    await use(undo)
  },

  tabIdFor: async ({ serviceWorker }, use) => {
    const lookup = async (pageUrl: string): Promise<number> => {
      const id = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({})
        const hit = tabs.find((t) => t.url === url || t.url?.startsWith(url))
        return hit?.id ?? null
      }, pageUrl)
      if (id == null) throw new Error(`No tab found for ${pageUrl}`)
      return id
    }
    await use(lookup)
  },
})

export const expect = test.expect

export const ORIGIN_A = 'http://localhost:4173'
export const ORIGIN_B = 'http://127.0.0.1:4174'
