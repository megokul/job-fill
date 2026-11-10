import { test, expect, ORIGIN_A } from '../fixtures'

const HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Unrelated listbox</title></head>
<body>
  <ul role="listbox" id="lang">
    <li role="option">Yes</li>
    <li role="option">No</li>
  </ul>
  <label for="wa">Are you legally authorized to work in the United States?</label>
  <input id="wa" role="combobox" aria-autocomplete="list" />
  <pre id="out"></pre>
  <script>
    window.__langClicks = []
    document.getElementById('lang').addEventListener('click', (ev) => {
      const opt = ev.target.closest('[role="option"]')
      if (opt) window.__langClicks.push(opt.textContent.trim())
    }, true)
  </script>
</body>
</html>`

test.describe('Unrelated listbox', () => {
  test('fill does not click a pre-existing unrelated listbox', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await page.route('**/unrelated-listbox.html', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: HTML })
    })
    await seedStore()
    await page.goto(`${ORIGIN_A}/unrelated-listbox.html`)
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)

    const clicks = await page.evaluate(
      () => (window as unknown as { __langClicks: string[] }).__langClicks,
    )
    expect(clicks).toEqual([])
    await expect(page.locator('#wa')).toHaveValue('')
  })
})
