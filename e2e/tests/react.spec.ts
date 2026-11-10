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
    expect(state.workAuthorized).toBe('yes')

    for (const testId of ['firstName', 'lastName', 'email', 'phone', 'country']) {
      await page.locator(`[data-testid="${testId}"]`).blur()
    }
    const afterBlur = JSON.parse(
      await page.locator('[data-testid="state"]').innerText(),
    )
    expect(afterBlur).toEqual(state)

    await undoTab(tabId)
    const afterUndo = JSON.parse(
      await page.locator('[data-testid="state"]').innerText(),
    )
    expect(afterUndo.firstName).toBe('')
    expect(afterUndo.email).toBe('')
    expect(afterUndo.country).toBe('')
    expect(afterUndo.workAuthorized).toBe('')
  })
})
