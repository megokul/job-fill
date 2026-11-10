import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Late', () => {
  test('with origin in autofillSites, form fills within 5s of appearing', async ({
    page,
    seedStore,
  }) => {
    await seedStore({
      settings: { autofillSites: [ORIGIN_A], highlightFilled: false },
    })
    await page.goto(`${ORIGIN_A}/late.html`)
    await expect(page.locator('#email')).toHaveValue('ada@example.com', {
      timeout: 8_000,
    })
    await expect(page.locator('#first')).toHaveValue('Ada')
  })

  test('with origin not listed, nothing is filled', async ({ page, seedStore }) => {
    await seedStore({
      settings: { autofillSites: [], highlightFilled: false },
    })
    await page.goto(`${ORIGIN_A}/late.html`)
    await page.waitForSelector('#email', { timeout: 5_000 })
    await page.waitForTimeout(1500)
    await expect(page.locator('#email')).toHaveValue('')
    await expect(page.locator('#first')).toHaveValue('')
  })
})
