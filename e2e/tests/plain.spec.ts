import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Plain', () => {
  test('every expected field has the right value; free-text empty; pre-typed untouched', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    await page.locator('#about').fill('I typed this myself')
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await expect(page.locator('#first')).toHaveValue('Ada')
    await expect(page.locator('#last')).toHaveValue('Lovelace')
    await expect(page.locator('#email')).toHaveValue('ada@example.com')
    await expect(page.locator('#phone')).toHaveValue('555-0100')
    await expect(page.locator('#linkedin')).toHaveValue(
      'https://linkedin.com/in/ada',
    )
    await expect(page.locator('#city')).toHaveValue('London')
    await expect(page.locator('#country')).toHaveValue('231')
    await expect(page.locator('#state')).toHaveValue('6')
    await expect(
      page.locator('input[name="work_auth"][value="yes"]'),
    ).toBeChecked()
    await expect(
      page.locator('input[name="sponsor"][value="no"]'),
    ).toBeChecked()
    await expect(page.locator('#hear')).toHaveValue('')
    await expect(page.locator('#about')).toHaveValue('I typed this myself')
  })
})
