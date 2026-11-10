/**
 * Tiny static file server for E2E fixtures (Node builtins only).
 * Usage: node e2e/serve.mjs <rootDir> <port> [host]
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(process.argv[2] || 'e2e/fixtures')
const port = Number(process.argv[3] || 4173)
const host = process.argv[4] || '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath)
  if (!filePath.startsWith(root)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`)
})
