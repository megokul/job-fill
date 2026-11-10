import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('Comboboxes', () => {
  test('react-select country, delayed location typeahead, and yes/no listbox match React state', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/react-dist/`)
    await page.waitForSelector('[data-testid="email"]')
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    const state = JSON.parse(await page.locator('[data-testid="state"]').innerText())
    expect(state.country).toBe('231')
    expect(state.location).toBe('London, CA')
    expect(state.workAuthorized).toBe('yes')
  })

  test('unmatched combobox option leaves the control unchanged', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore({
      profile: {
        country: 'Fiji',
        city: '',
        state: '',
        workAuthorized: '',
      },
    })
    await page.goto(`${ORIGIN_A}/react-dist/`)
    await page.waitForSelector('[data-testid="country"]')
    const before = await page.locator('[data-testid="state"]').innerText()
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    const after = JSON.parse(await page.locator('[data-testid="state"]').innerText())
    expect(after.country).toBe('')
    expect(after.location).toBe('')
    expect(after.workAuthorized).toBe('')
    // Control display should not keep typed filter text from a failed fill.
    const countryText = await page.locator('[data-testid="country"]').innerText()
    expect(countryText.toLowerCase()).toMatch(/select/)
    expect(before).toContain('"country":""')
  })
})
