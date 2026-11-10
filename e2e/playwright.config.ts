import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(root, '..')
const fixturesRoot = path.join(root, 'fixtures')
const serveScript = path.join(root, 'serve.mjs')

export default defineConfig({
  testDir: path.join(root, 'tests'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(projectRoot, 'e2e-report') }],
  ],
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `node "${serveScript}" "${fixturesRoot}" 4173 localhost`,
      url: 'http://localhost:4173/plain.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: projectRoot,
    },
    {
      command: `node "${serveScript}" "${fixturesRoot}" 4174 127.0.0.1`,
      url: 'http://127.0.0.1:4174/plain.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: projectRoot,
    },
  ],
})
