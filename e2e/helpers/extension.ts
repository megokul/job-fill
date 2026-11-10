import type { Page, Worker } from '@playwright/test'

export async function openPopup(
  page: Page,
  extensionId: string,
  tabId: number,
): Promise<void> {
  await page.goto(
    `chrome-extension://${extensionId}/src/popup/index.html?tabId=${tabId}`,
  )
}

export async function openOptions(
  page: Page,
  extensionId: string,
  hash = 'profile',
): Promise<void> {
  await page.goto(
    `chrome-extension://${extensionId}/src/options/index.html#${hash}`,
  )
}

export async function startMap(
  serviceWorker: Worker,
  tabId: number,
): Promise<boolean> {
  return serviceWorker.evaluate(async (id) => {
    const counted = await chrome.scripting.executeScript({
      target: { tabId: id, allFrames: true },
      func: () => {
        const api = (
          globalThis as typeof globalThis & {
            __jobFill?: { countFillable: () => number }
          }
        ).__jobFill
        return api ? api.countFillable() : 0
      },
    })
    let bestFrameId = 0
    let bestCount = -1
    for (const row of counted) {
      const count = typeof row.result === 'number' ? row.result : 0
      if (count > bestCount) {
        bestCount = count
        bestFrameId = row.frameId
      }
    }
    const started = await chrome.scripting.executeScript({
      target: { tabId: id, frameIds: [bestFrameId] },
      func: async () => {
        const api = (
          globalThis as typeof globalThis & {
            __jobFill?: { startMap: () => Promise<{ ok: true }> }
          }
        ).__jobFill
        if (!api) return false
        await api.startMap()
        return true
      },
    })
    return Boolean(started[0]?.result)
  }, tabId)
}

export function filledCount(results: unknown[]): number {
  return results.reduce<number>((sum, r) => {
    if (r && typeof r === 'object' && Array.isArray((r as { filled?: unknown }).filled)) {
      return sum + (r as { filled: unknown[] }).filled.length
    }
    return sum
  }, 0)
}
