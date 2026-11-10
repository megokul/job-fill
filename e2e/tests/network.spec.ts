import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('No network', () => {
  test('extension makes no requests beyond the fixture page during fill', async ({
    context,
    page,
    seedStore,
    fillTab,
    tabIdFor,
    extensionId,
  }) => {
    await seedStore()
    const extensionOrigin = `chrome-extension://${extensionId}`
    const requests: string[] = []
    context.on('request', (req) => {
      const url = req.url()
      if (url.startsWith(extensionOrigin)) requests.push(url)
      if (url.startsWith('http') && !url.startsWith(ORIGIN_A) && !url.startsWith('http://127.0.0.1:4174')) {
        requests.push(url)
      }
    })
    await page.goto(`${ORIGIN_A}/plain.html`)
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    const external = requests.filter(
      (u) =>
        !u.startsWith(ORIGIN_A) &&
        !u.startsWith('http://127.0.0.1:4174') &&
        !u.startsWith(extensionOrigin),
    )
    expect(external).toEqual([])
  })
})
