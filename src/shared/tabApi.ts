import type { FillResult, ToastSummary } from './messages'

export type JobFillFrameApi = {
  fill: () => Promise<FillResult>
  undo: () => Promise<{ restored: number }>
  countFillable: () => number
  startMap: () => Promise<{ ok: true }>
  stopMap: () => Promise<{ ok: true }>
  toast: (summary: ToastSummary) => void
}

declare global {
  interface Window {
    __jobFill?: JobFillFrameApi
  }
  // Content scripts share the isolated world with executeScript(ISOLATED).
  var __jobFill: JobFillFrameApi | undefined
}

export async function fillTab(tabId: number): Promise<FillResult[]> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: async () => {
      const api = globalThis.__jobFill
      if (!api) return null
      return api.fill()
    },
  })
  return results
    .map((r) => r.result)
    .filter((r): r is FillResult => Boolean(r && Array.isArray(r.filled)))
}

export async function toastTopFrame(
  tabId: number,
  summary: ToastSummary,
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    args: [summary],
    func: (s: ToastSummary) => {
      globalThis.__jobFill?.toast(s)
    },
  })
}

export async function undoTab(tabId: number): Promise<number> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: async () => {
      const api = globalThis.__jobFill
      if (!api) return 0
      const out = await api.undo()
      return out.restored
    },
  })
  return results.reduce((sum, r) => sum + (typeof r.result === 'number' ? r.result : 0), 0)
}

export async function startMapInBestFrame(tabId: number): Promise<boolean> {
  const counted = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const api = globalThis.__jobFill
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
    target: { tabId, frameIds: [bestFrameId] },
    func: async () => {
      const api = globalThis.__jobFill
      if (!api) return false
      await api.startMap()
      return true
    },
  })
  return Boolean(started[0]?.result)
}

export async function pingTab(tabId: number): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => Boolean(globalThis.__jobFill),
    })
    return results.some((r) => r.result === true)
  } catch {
    return false
  }
}
