import { test, expect, ORIGIN_A } from '../fixtures'

const STATIC_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Static combobox</title></head>
<body>
  <label for="country">Country</label>
  <input id="country" role="combobox" aria-controls="country-list" aria-expanded="false" value="" />
  <div id="country-list" role="listbox">
    <div role="option" data-value="us">United States</div>
    <div role="option" data-value="ca">Canada</div>
    <div role="option" data-value="au">Australia</div>
  </div>
  <script>
    const input = document.getElementById('country')
    input.addEventListener('focus', () => input.setAttribute('aria-expanded', 'true'))
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') input.setAttribute('aria-expanded', 'false')
    })
    document.getElementById('country-list').addEventListener('click', (ev) => {
      const opt = ev.target.closest('[role="option"]')
      if (!opt) return
      input.value = opt.getAttribute('data-value') || opt.textContent
      input.setAttribute('aria-expanded', 'false')
    })
  </script>
</body>
</html>`

test.describe('Combobox DOM integrity', () => {
  test('failed fill on react dropdowns leaves option counts intact when reopened', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))

    await seedStore({
      profile: {
        country: 'Fiji',
        city: 'Atlantis',
        state: 'ZZ',
        workAuthorized: 'maybe',
      },
    })
    await page.goto(`${ORIGIN_A}/react-dist/`)
    await page.waitForSelector('[data-testid="country"]')
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    await page.locator('#country-select').click()
    await page.waitForSelector('.country-select__option')
    expect(await page.locator('.country-select__option').count()).toBe(2)
    await page.keyboard.press('Escape')
    await page.locator('body').click({ position: { x: 2, y: 2 } })

    await page.locator('[data-testid="location"]').click()
    await page.waitForSelector('#location-list [role="option"]')
    expect(await page.locator('#location-list [role="option"]').count()).toBe(4)
    const locationListStyle = await page.locator('#location-list').evaluate((el) => ({
      display: (el as HTMLElement).style.display,
    }))
    expect(locationListStyle.display).not.toBe('none')
    await page.keyboard.press('Escape')

    await page.locator('[data-testid="workAuthorized"]').click()
    await page.waitForSelector('#wa-list [role="option"]')
    expect(await page.locator('#wa-list [role="option"]').count()).toBe(2)

    expect(errors).toEqual([])
  })

  test('failed fill on static combobox does not hide or remove option nodes', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await page.route('**/static-combobox.html', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: STATIC_HTML,
      })
    })
    await seedStore({
      profile: {
        country: 'Fiji',
      },
    })
    await page.goto(`${ORIGIN_A}/static-combobox.html`)
    await page.waitForSelector('#country')
    expect(await page.locator('#country-list [role="option"]').count()).toBe(3)

    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    const after = await page.evaluate(() => {
      const list = document.getElementById('country-list')!
      const opts = Array.from(list.querySelectorAll('[role="option"]'))
      return {
        count: opts.length,
        listHidden: list.hasAttribute('hidden'),
        listDisplay: (list as HTMLElement).style.display,
        opts: opts.map((opt) => ({
          text: (opt.textContent ?? '').trim(),
          hidden: (opt as HTMLElement).hidden || opt.hasAttribute('hidden'),
          display: (opt as HTMLElement).style.display,
        })),
      }
    })
    expect(after.count).toBe(3)
    expect(after.listHidden).toBe(false)
    expect(after.listDisplay).toBe('')
    for (const row of after.opts) {
      expect(row.hidden).toBe(false)
      expect(row.display).toBe('')
    }
    await expect(page.locator('#country')).toHaveValue('')
  })
})
