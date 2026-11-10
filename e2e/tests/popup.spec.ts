import { test, expect, ORIGIN_A } from '../fixtures'
import { openPopup } from '../helpers/extension'

test.describe('Popup', () => {
  test('ready state, fill result list, undo, and embedded form-host note', async ({
    context,
    page,
    seedStore,
    extensionId,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    const tabId = await tabIdFor(page.url())

    const popup = await context.newPage()
    await openPopup(popup, extensionId, tabId)
    await expect(popup.locator('.pill')).toContainText('Ready')
    await expect(popup.locator('.meta')).toContainText('localhost')

    await popup.getByRole('button', { name: /Fill this page/i }).click()
    await expect(popup.locator('summary').filter({ hasText: /Filled/ })).toBeVisible()
    await expect(popup.locator('summary').filter({ hasText: /Left empty/ })).toBeVisible()

    await popup.getByRole('button', { name: 'Undo' }).click()
    await expect(popup.locator('.pill')).toContainText('Ready')
    await expect(page.locator('#email')).toHaveValue('')

    await page.goto(`${ORIGIN_A}/embedded.html`)
    await page.frameLocator('#app-frame').locator('#email').waitFor()
    const embeddedTabId = await tabIdFor(page.url())
    const popup2 = await context.newPage()
    await openPopup(popup2, extensionId, embeddedTabId)
    await expect(popup2.locator('.meta')).toContainText(/Form hosted on/i)
  })
})
