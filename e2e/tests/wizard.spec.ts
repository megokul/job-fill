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
    // Reload once so the content script bootstraps against already-seeded storage
    // (first-install Options open can race the initial document_idle pass).
    await page.reload()
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

  test('typing on step 1 does not stop step 2 autofill; typed text is kept', async ({
    page,
    seedStore,
  }) => {
    await seedStore({
      settings: { autofillSites: [ORIGIN_A], highlightFilled: false },
    })
    await page.goto(`${ORIGIN_A}/wizard.html`)
    await page.reload()
    await expect
      .poll(async () => page.locator('#first').inputValue(), { timeout: 15_000 })
      .toBe('Ada')

    await page.locator('#first').click()
    await page.locator('#first').pressSequentially('X')
    await expect(page.locator('#first')).toHaveValue('AdaX')

    await page.locator('#next').click()
    await expect(page).toHaveURL(/step=2/)
    await expect(page.locator('#addr1')).toHaveValue('1 Analytical Engine Rd', {
      timeout: 8_000,
    })
    await expect(page.locator('#city')).toHaveValue('London')
  })

  test('cleared step-2 field is not refilled after a later DOM change', async ({
    page,
    seedStore,
  }) => {
    await seedStore({
      settings: { autofillSites: [ORIGIN_A], highlightFilled: false },
    })
    await page.goto(`${ORIGIN_A}/wizard.html`)
    await page.reload()
    await expect
      .poll(async () => page.locator('#first').inputValue(), { timeout: 15_000 })
      .toBe('Ada')
    await page.locator('#next').click()
    await expect(page.locator('#city')).toHaveValue('London', { timeout: 8_000 })

    await page.locator('#city').fill('')
    await expect(page.locator('#city')).toHaveValue('')

    await page.evaluate(() => {
      const el = document.createElement('div')
      el.id = 'harmless'
      el.textContent = 'noop'
      document.body.appendChild(el)
    })
    await page.waitForTimeout(1500)
    await expect(page.locator('#city')).toHaveValue('')
  })
})
