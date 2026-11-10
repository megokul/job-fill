import { test, expect, ORIGIN_A } from '../fixtures'
import { startMap } from '../helpers/extension'

async function clickInContentWorld(
  serviceWorker: import('@playwright/test').Worker,
  tabId: number,
  selector: string,
): Promise<void> {
  await serviceWorker.evaluate(
    async ({ id, sel }) => {
      await chrome.scripting.executeScript({
        target: { tabId: id },
        args: [sel],
        func: (s) => {
          const el = document.querySelector(s) as HTMLElement | null
          if (!el) throw new Error(`Missing ${s}`)
          el.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
          )
        },
      })
    },
    { id: tabId, sel: selector },
  )
}

test.describe('Map mode', () => {
  test('bind profile field and custom answer, save, reload, fill from mapping', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
    serviceWorker,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)

    const tabId = await tabIdFor(page.url())
    expect(await startMap(serviceWorker, tabId)).toBe(true)
    await expect(page.locator('#job-fill-map-banner')).toBeVisible({ timeout: 5_000 })

    await clickInContentWorld(serviceWorker, tabId, '#linkedin')
    await expect(page.locator('#jf-map-key')).toBeVisible({ timeout: 5_000 })
    await page.locator('#jf-map-key').selectOption('linkedinUrl')
    await page.locator('#jf-map-add').click()
    await expect(page.locator('#job-fill-map-banner')).toContainText('1 mapped')

    await clickInContentWorld(serviceWorker, tabId, '#hear')
    await expect(page.locator('#jf-map-answer')).toBeVisible()
    await page.locator('input[name="jf-map-mode"][value="custom"]').check()
    await page.locator('#jf-map-answer').selectOption('__new__')
    await page.locator('#jf-map-q').fill('How did you hear about this opportunity?')
    await page.locator('#jf-map-a').fill('A friend referred me')
    await page.locator('#jf-map-add').click()
    await expect(page.locator('#job-fill-map-banner')).toContainText('2 mapped')

    await page.locator('#jf-map-save').click()
    await expect(page.locator('#job-fill-map-banner')).toHaveCount(0, { timeout: 5_000 })

    await page.reload()
    await page.waitForSelector('#linkedin')
    // Clear values so fill is visible
    await page.locator('#linkedin').fill('')
    await page.locator('#hear').fill('')
    const tabId2 = await tabIdFor(page.url())
    const results = await fillTab(tabId2)
    const filled = results.flatMap((r) => {
      if (r && typeof r === 'object' && Array.isArray((r as { filled?: unknown[] }).filled)) {
        return (r as { filled: { source: string }[] }).filled
      }
      return []
    })

    expect(filled.some((f) => f.source === 'mapping')).toBe(true)
    expect(filled.some((f) => f.source === 'custom')).toBe(true)
    await expect(page.locator('#linkedin')).toHaveValue('https://linkedin.com/in/ada')
    await expect(page.locator('#hear')).toHaveValue('A friend referred me')
  })
})
