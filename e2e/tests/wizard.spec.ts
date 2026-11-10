import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Wizard', () => {
  test('autofills step 1 and step 2 after pushState; Undo stops further fills', async ({
    page,
    seedStore,
  }) => {
    await seedStore({
      settings: { autofillSites: [ORIGIN_A], highlightFilled: false },
    })
    await page.goto(`${ORIGIN_A}/wizard.html`)
    // Autofill runs from the content script after storage read; wait for the toast
    // (or the filled value) rather than assuming document_idle is enough.
    await expect
      .poll(async () => page.locator('#first').inputValue(), { timeout: 15_000 })
      .toBe('Ada')
    await expect(page.locator('#email')).toHaveValue('ada@example.com')

    await page.locator('#next').click()
    await expect(page).toHaveURL(/step=2/)
    await expect(page.locator('#addr1')).toHaveValue('1 Analytical Engine Rd', {
      timeout: 8_000,
    })
    await expect(page.locator('#city')).toHaveValue('London')

    // Click Undo on the autofill toast — further automatic fills must stop.
    const toast = page.locator('job-fill-root').locator('#toast')
    await expect(toast).toBeVisible({ timeout: 5_000 })
    await toast.getByRole('button', { name: 'Undo' }).click()

    await page.locator('#more').click()
    await expect(page).toHaveURL(/step=3/)
    await page.waitForSelector('#ref-name')
    await page.waitForTimeout(1500)
    // Reference field must stay empty because the watcher stopped after Undo.
    await expect(page.locator('#ref-name')).toHaveValue('')
    // Step 2 fields were restored by Undo.
    await expect(page.locator('#addr1')).toHaveValue('')
    await expect(page.locator('#city')).toHaveValue('')
  })
})
