import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Hidden', () => {
  test('only visible email is filled; styled radio group still answered', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/hidden.html`)
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await expect(page.locator('#email')).toHaveValue('ada@example.com')
    await expect(page.locator('#phone-display-none')).toHaveValue('')
    await expect(page.locator('#phone-tiny')).toHaveValue('')
    await expect(page.locator('#addr-off')).toHaveValue('')
    await expect(page.locator('#addr-clip')).toHaveValue('')
    await expect(page.locator('#city-clip')).toHaveValue('')
    await expect(page.locator('#phone-faint')).toHaveValue('')
    await expect(page.locator('#phone-aria')).toHaveValue('')
    await expect(page.locator('#phone-inert')).toHaveValue('')
    await expect(
      page.locator('input[name="work_auth"][value="yes"]'),
    ).toBeChecked()
  })

  test('hidden fields stay empty when the page is scrolled before filling', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/hidden.html`)
    await page.evaluate(() => {
      document.body.style.paddingBottom = '3000px'
      window.scrollTo(0, 800)
    })
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await expect(page.locator('#email')).toHaveValue('ada@example.com')
    await expect(page.locator('#phone-display-none')).toHaveValue('')
    await expect(page.locator('#phone-tiny')).toHaveValue('')
    await expect(page.locator('#addr-off')).toHaveValue('')
    await expect(page.locator('#addr-clip')).toHaveValue('')
    await expect(page.locator('#city-clip')).toHaveValue('')
    await expect(page.locator('#phone-faint')).toHaveValue('')
    await expect(page.locator('#phone-aria')).toHaveValue('')
    await expect(page.locator('#phone-inert')).toHaveValue('')
    await expect(
      page.locator('input[name="work_auth"][value="yes"]'),
    ).toBeChecked()
  })
})
