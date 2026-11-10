import { test, expect, ORIGIN_A } from '../fixtures'

async function expectPlainFilled(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('#first')).toHaveValue('Ada')
  await expect(page.locator('#last')).toHaveValue('Lovelace')
  await expect(page.locator('#email')).toHaveValue('ada@example.com')
  await expect(page.locator('#phone')).toHaveValue('555-0100')
  await expect(page.locator('#city')).toHaveValue('London')
  await expect(page.locator('#country')).toHaveValue('231')
  await expect(page.locator('#state')).toHaveValue('6')
}

test.describe('Scrolled', () => {
  test.use({ viewport: { width: 800, height: 250 } })

  test('fills plain.html fields scrolled above the viewport (top)', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    await page.evaluate(() => {
      document.body.style.paddingBottom = '4000px'
      window.scrollTo(0, 2500)
    })
    const bottom = await page.locator('#first').evaluate((el) => el.getBoundingClientRect().bottom)
    expect(bottom).toBeLessThan(0)

    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    await expectPlainFilled(page)
  })

  test('fills plain.html when scrolled to the bottom', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    await page.evaluate(() => {
      document.body.style.paddingBottom = '4000px'
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    await expectPlainFilled(page)
  })

  test('fills plain.html when scrolled to the middle', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    await page.evaluate(() => {
      document.body.style.paddingBottom = '4000px'
      window.scrollTo(0, 1200)
    })
    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    await expectPlainFilled(page)
  })

  test('fills a field scrolled out of an overflow:auto container', async ({
    page,
    seedStore,
    fillTab,
    tabIdFor,
  }) => {
    await seedStore()
    await page.goto(`${ORIGIN_A}/plain.html`)
    await page.evaluate(() => {
      const wrap = document.createElement('div')
      wrap.id = 'scroll-box'
      wrap.style.cssText = 'height:80px;overflow:auto;border:1px solid #ccc'
      const spacer = document.createElement('div')
      spacer.style.height = '200px'
      const label = document.createElement('label')
      label.htmlFor = 'nested-city'
      label.textContent = 'City'
      const input = document.createElement('input')
      input.id = 'nested-city'
      input.name = 'nested_city'
      input.autocomplete = 'address-level2'
      wrap.append(spacer, label, input)
      document.body.prepend(wrap)
      wrap.scrollTop = 0
    })
    // Nested city is below the spacer inside the box — scroll it out of the box view.
    await page.evaluate(() => {
      const wrap = document.getElementById('scroll-box')!
      wrap.scrollTop = 0
    })
    const inView = await page.locator('#nested-city').evaluate((el) => {
      const box = document.getElementById('scroll-box')!
      const r = el.getBoundingClientRect()
      const b = box.getBoundingClientRect()
      return r.top >= b.top && r.bottom <= b.bottom
    })
    expect(inView).toBe(false)

    const tabId = await tabIdFor(page.url())
    await fillTab(tabId)
    await expect(page.locator('#nested-city')).toHaveValue('London')
  })
})
