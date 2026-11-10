import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: dir,
  base: './',
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: path.resolve(dir, '..', 'react-dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: { port: 5179 },
})
