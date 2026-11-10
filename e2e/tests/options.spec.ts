import { test, expect } from '../fixtures'
import { openOptions } from '../helpers/extension'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

test.describe('Options', () => {
  test('typing keeps focus and shows Saved; merge import; invalid disables actions', async ({
    page,
    seedStore,
    extensionId,
  }) => {
    await seedStore()
    await openOptions(page, extensionId, 'profile')
    const first = page.locator('#f-firstName')
    await first.click()
    await first.fill('')
    await first.type('Augusta', { delay: 80 })
    await expect(first).toBeFocused()
    await expect(page.locator('#profile-saved')).toContainText('Saved ✓', {
      timeout: 5_000,
    })
    await expect(first).toHaveValue('Augusta')

    await openOptions(page, extensionId, 'backup')
    const exportBtn = page.getByRole('button', { name: 'Export JSON' })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ])
    const tmp = path.join(os.tmpdir(), `job-fill-export-${Date.now()}.json`)
    await download.saveAs(tmp)

    const merge = page.getByRole('button', { name: 'Merge' })
    const replace = page.getByRole('button', { name: 'Replace' })
    await expect(merge).toBeDisabled()
    await expect(replace).toBeDisabled()

    await page.locator('input[type="file"]').setInputFiles(tmp)
    await expect(page.locator('#import-preview')).toContainText(/Preview/)
    await expect(merge).toBeEnabled()
    await merge.click()
    await page.waitForTimeout(400)

    // Import again — counts should stay stable (no duplicates by id).
    await openOptions(page, extensionId, 'backup')
    await page.locator('input[type="file"]').setInputFiles(tmp)
    await merge.click()
    await page.waitForTimeout(400)

    const bad = path.join(os.tmpdir(), `job-fill-bad-${Date.now()}.json`)
    fs.writeFileSync(bad, '{not json')
    await openOptions(page, extensionId, 'backup')
    await page.locator('input[type="file"]').setInputFiles(bad)
    await expect(page.locator('#import-preview')).toContainText(/Error/i)
    await expect(page.getByRole('button', { name: 'Merge' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Replace' })).toBeDisabled()

    fs.unlinkSync(tmp)
    fs.unlinkSync(bad)
  })
})
