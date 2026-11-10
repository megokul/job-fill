import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

export default defineConfig(({ command }) => ({
  plugins: [crx({ manifest })],
  build: {
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
