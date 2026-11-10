import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from './manifest.config.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, mode }) => ({
  plugins: [crx({ manifest })],
  build: {
    outDir: mode === 'e2e' ? path.join(root, 'dist-e2e') : path.join(root, 'dist'),
    emptyOutDir: true,
    // Keep source maps in `vite`/`npm run dev`; omit them from production so
    // `.map` files are not listed in web_accessible_resources.
    sourcemap: command === 'serve',
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
}))
