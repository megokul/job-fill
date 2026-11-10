import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Embedded', () => {
  test('cross-origin iframe fields are filled and undo clears them', async ({
    page,
    seedStore,
    fillTab,
    undoTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/embedded.html`)
    const frame = page.frameLocator('#app-frame')
    await frame.locator('#email').waitFor()
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await expect(frame.locator('#email')).toHaveValue('ada@example.com')
    await expect(frame.locator('#first')).toHaveValue('Ada')

    await undoTab(tabId)
    await expect(frame.locator('#email')).toHaveValue('')
    await expect(frame.locator('#first')).toHaveValue('')
  })
})
