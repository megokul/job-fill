import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('No network', () => {
  test('page, frame, and service-worker requests stay on the fixture origins during fill', async ({
    context,
    page,
    seedStore,
    fillTab,
    tabIdFor,
    extensionId,
  }) => {
    await seedStore()
    const extensionOrigin = `chrome-extension://${extensionId}`
    const allowedPrefixes = [ORIGIN_A, 'http://127.0.0.1:4174', extensionOrigin]
    const external: { url: string; fromServiceWorker: boolean }[] = []

    // Playwright reports service-worker requests on the BrowserContext
    // (request.serviceWorker() is set). See https://playwright.dev/docs/service-workers
    context.on('request', (req) => {
      const url = req.url()
      if (allowedPrefixes.some((p) => url.startsWith(p))) return
      if (!(url.startsWith('http://') || url.startsWith('https://'))) return
      external.push({
        url,
        fromServiceWorker: Boolean(req.serviceWorker()),
      })
    })

    await page.goto(`${ORIGIN_A}/plain.html`)
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    expect(external).toEqual([])
  })
})
