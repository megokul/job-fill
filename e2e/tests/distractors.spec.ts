import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Distractors', () => {
  test('reference, emergency, free-text and newsletter stay empty', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/distractors.html`)
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await expect(page.locator('#email')).toHaveValue('ada@example.com')
    await expect(page.locator('#phone')).toHaveValue('555-0100')
    await expect(page.locator('#ref-first')).toHaveValue('')
    await expect(page.locator('#ref-last')).toHaveValue('')
    await expect(page.locator('#ref-email')).toHaveValue('')
    await expect(page.locator('#em-phone')).toHaveValue('')
    await expect(page.locator('#em-name')).toHaveValue('')
    await expect(page.locator('#hear')).toHaveValue('')
    await expect(page.locator('#about')).toHaveValue('')
    await expect(page.locator('#newsletter')).not.toBeChecked()
  })
})
