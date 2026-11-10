import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('A1 harness', () => {
  test('loads the extension and can seed storage then fill a page', async ({
    page,
    extensionId,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/)
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    await page.waitForSelector('#email')
    const tabId = await tabIdFor(page.url())
    const results = await fillTab(tabId)
    const filled = results.flatMap((r) => {
      if (r && typeof r === 'object' && Array.isArray((r as { filled?: unknown }).filled)) {
        return (r as { filled: unknown[] }).filled
      }
      return []
    })
    expect(filled.length).toBeGreaterThan(0)
    await expect(page.locator('#email')).toHaveValue('ada@example.com')
    await expect(page.locator('#first')).toHaveValue('Ada')
  })
})
