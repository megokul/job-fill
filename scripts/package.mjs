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

/** Bundled open-shadow marker that must never ship in production dist/. */
const OPEN_SHADOW_MARKERS = [
  'mode:"open"',
  "mode:'open'",
  'mode: "open"',
  "mode: 'open'",
  'mode:`open`',
  'mode: `open`',
]

function walkFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(abs))
    else out.push(abs)
  }
  return out
}

export function assertNoOpenShadow(dir) {
  const hits = []
  for (const file of walkFiles(dir)) {
    if (!/\.(js|mjs|cjs|html|css|json)$/i.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const marker of OPEN_SHADOW_MARKERS) {
      if (text.includes(marker)) {
        hits.push(`${path.relative(root, file)} contains ${marker}`)
        break
      }
    }
  }
  if (hits.length) {
    const err = new Error(
      `Open shadow mode leaked into ${path.relative(root, dir)}:\n${hits.join('\n')}`,
    )
    err.hits = hits
    throw err
  }
}

const packaging = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (packaging) {
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
    console.error('dist/manifest.json missing — run npm run build first')
    process.exit(1)
  }

  try {
    assertNoOpenShadow(dist)
  } catch (err) {
    console.error(err.message)
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
}
