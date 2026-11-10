import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Submit trap', () => {
  test('fill, undo and second fill never submit', async ({
    page,
    seedStore,
    fillTab,
    undoTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/submit-trap.html`)
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    await undoTab(tabId)
    await fillTab(tabId)
    const submitted = await page.evaluate(() => (window as { __submitted?: boolean }).__submitted)
    expect(submitted).toBeUndefined()
  })
})
