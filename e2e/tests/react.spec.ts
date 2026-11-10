import { test, expect, ORIGIN_A } from '../fixtures'

test.describe('React', () => {
  test('JSON state matches profile after fill; survives blur; undo clears', async ({
    page,
    seedStore,
    fillTab,
    undoTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/react-dist/`)
    await page.waitForSelector('[data-testid="email"]')
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    const state = JSON.parse(await page.locator('[data-testid="state"]').innerText())
    expect(state.firstName).toBe('Ada')
    expect(state.lastName).toBe('Lovelace')
    expect(state.email).toBe('ada@example.com')
    expect(state.phone).toBe('555-0100')
    expect(state.country).toBe('231')
    expect(state.location).toBe('London, CA')
    expect(state.workAuthorized).toBe('yes')

    for (const testId of ['firstName', 'lastName', 'email', 'phone']) {
      await page.locator(`[data-testid="${testId}"]`).blur()
    }
    const afterBlur = JSON.parse(
      await page.locator('[data-testid="state"]').innerText(),
    )
    expect(afterBlur.firstName).toBe(state.firstName)
    expect(afterBlur.email).toBe(state.email)
    expect(afterBlur.country).toBe(state.country)
    expect(afterBlur.location).toBe(state.location)
    expect(afterBlur.workAuthorized).toBe(state.workAuthorized)

    await undoTab(tabId)
    const afterUndo = JSON.parse(
      await page.locator('[data-testid="state"]').innerText(),
    )
    expect(afterUndo.firstName).toBe('')
    expect(afterUndo.email).toBe('')
    expect(afterUndo.phone).toBe('')
  })

  test('undo restores location and workAuthorized display; country display and all three React states cannot be undone', async ({
    page,
    seedStore,
    fillTab,
    undoTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/react-dist/`)
    await page.waitForSelector('[data-testid="email"]')
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await expect(page.locator('[data-testid="location"]')).toHaveValue('London, CA')
    await expect(page.locator('[data-testid="workAuthorized"]')).toHaveText(/Yes/i)
    await expect(page.locator('[data-testid="country"]')).toContainText(
      /United States of America/i,
    )

    await undoTab(tabId)

    // Location input value and workAuthorized button label are restored.
    await expect(page.locator('[data-testid="location"]')).toHaveValue('')
    await expect(page.locator('[data-testid="workAuthorized"]')).toHaveText(/Select/i)
    // Country (react-select) keeps its visible selection — cannot undo.
    await expect(page.locator('[data-testid="country"]')).toContainText(
      /United States of America/i,
    )
    // React form state for all three stays filled; undo never calls widget onChange.
    const afterUndo = JSON.parse(
      await page.locator('[data-testid="state"]').innerText(),
    )
    expect(afterUndo.location).toBe('London, CA')
    expect(afterUndo.country).toBe('231')
    expect(afterUndo.workAuthorized).toBe('yes')
  })
})
