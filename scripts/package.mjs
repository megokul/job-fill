import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const releaseDir = path.join(root, 'release')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const outFile = path.join(releaseDir, `job-fill-${version}.zip`)

if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
  console.error('dist/manifest.json missing — run npm run build first')
  process.exit(1)
}

function addDir(zip, dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) addDir(zip, abs, rel)
    else zip.file(rel, fs.readFileSync(abs))
  }
}

const zip = new JSZip()
addDir(zip, dist)
fs.mkdirSync(releaseDir, { recursive: true })
const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
})
fs.writeFileSync(outFile, buffer)
console.log(`Wrote ${path.relative(root, outFile)} (${buffer.length} bytes)`)
