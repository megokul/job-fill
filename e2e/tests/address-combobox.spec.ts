import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Address combobox inputs', () => {
  test('street and city role=combobox inputs receive profile text', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/address-combobox.html`)
    await page.waitForSelector('#email')
    const tabId = await tabIdFor(page.url())
    const results = await fillTab(tabId)
    expect(
      results.some(
        (r) =>
          r &&
          typeof r === 'object' &&
          Array.isArray((r as { filled?: unknown[] }).filled) &&
          ((r as { filled: unknown[] }).filled.length > 0),
      ),
    ).toBe(true)

    await expect(page.locator('#email')).toHaveValue('ada@example.com')
    await expect(page.locator('#street')).toHaveValue('1 Analytical Engine Rd')
    await expect(page.locator('#city')).toHaveValue('London')
  })

  test('closed-set input combobox with no matching option stays empty', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/closed-combo-nomatch.html`)
    await page.waitForSelector('#country')
    const before = await page.locator('#country').inputValue()
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    await expect(page.locator('#country')).toHaveValue(before)
    await expect(page.locator('#country')).toHaveValue('')
  })
})
