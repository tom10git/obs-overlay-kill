import http from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, normalize, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { spawn } from 'node:child_process'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(__dirname, 'dist')

function parsePort() {
  const env = process.env.OVERLAY_PORT
  if (env) {
    const n = Number(env)
    if (Number.isFinite(n) && n >= 1 && n <= 65535) return Math.floor(n)
  }
  const arg = process.argv.find((a) => a.startsWith('--port='))
  if (arg) {
    const n = Number(arg.slice('--port='.length))
    if (Number.isFinite(n) && n >= 1 && n <= 65535) return Math.floor(n)
  }
  return 4173
}

function getLanAddress() {
  const nets = os.networkInterfaces()
  for (const ifName of Object.keys(nets)) {
    for (const net of nets[ifName] || []) {
      if (!net) continue
      if (net.family !== 'IPv4') continue
      if (net.internal) continue
      return net.address
    }
  }
  return null
}

function copyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      const ps = spawn('powershell.exe', ['-NoProfile', '-Command', `Set-Clipboard -Value @'\n${text}\n'@`], {
        stdio: 'ignore',
        windowsHide: true,
      })
      ps.on('error', () => {})
      return true
    }
    // best-effort for mac/linux; ignore if unavailable
    const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip'
    const args = process.platform === 'darwin' ? [] : ['-selection', 'clipboard']
    const p = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] })
    p.on('error', () => {})
    p.stdin?.end(text)
    return true
  } catch {
    return false
  }
}

function supportsAnsi() {
  if (!process.stdout.isTTY) return false
  if (process.env.NO_COLOR) return false
  // Windows Terminal / modern consoles support VT sequences.
  if (process.platform === 'win32') return true
  return true
}

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

function safeFileName(raw) {
  const b = basename(String(raw || 'sound'))
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120)
  return b || 'sound'
}

function extFromDataUrlMeta(meta) {
  const m = String(meta).match(/^data:audio\/([a-z0-9.+-]+);base64$/i)
  const sub = (m?.[1] || '').toLowerCase()
  if (sub.includes('mpeg') || sub === 'mp3') return '.mp3'
  if (sub === 'wav' || sub === 'x-wav') return '.wav'
  if (sub === 'ogg') return '.ogg'
  if (sub === 'mp4' || sub === 'm4a' || sub === 'x-m4a') return '.m4a'
  if (sub === 'aac') return '.aac'
  if (sub === 'flac') return '.flac'
  return ''
}

function mimeFromExt(p) {
  const e = extname(p).toLowerCase()
  if (e === '.html') return 'text/html; charset=utf-8'
  if (e === '.js') return 'text/javascript; charset=utf-8'
  if (e === '.css') return 'text/css; charset=utf-8'
  if (e === '.json') return 'application/json; charset=utf-8'
  if (e === '.svg') return 'image/svg+xml'
  if (e === '.png') return 'image/png'
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg'
  if (e === '.webm') return 'video/webm'
  if (e === '.mp3') return 'audio/mpeg'
  if (e === '.wav') return 'audio/wav'
  if (e === '.ogg') return 'audio/ogg'
  if (e === '.m4a') return 'audio/mp4'
  if (e === '.aac') return 'audio/aac'
  if (e === '.flac') return 'audio/flac'
  return 'application/octet-stream'
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
      if (body.length > 50_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    // Save picked sound into dist/src/sounds/<originalName> and return relative URL.
    if (url.pathname === '/api/sounds/save') {
      if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method Not Allowed' })
      const raw = await readBody(req)
      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        return sendJson(res, 400, { success: false, error: 'invalid json' })
      }

      const fileNameRaw = typeof payload?.fileName === 'string' ? payload.fileName : 'sound'
      const dataUrl = typeof payload?.dataUrl === 'string' ? payload.dataUrl : ''
      if (!dataUrl.startsWith('data:audio/')) return sendJson(res, 400, { success: false, error: 'dataUrl must be data:audio/*' })
      const comma = dataUrl.indexOf(',')
      if (comma < 0) return sendJson(res, 400, { success: false, error: 'invalid dataUrl' })

      const meta = dataUrl.slice(0, comma)
      const base64 = dataUrl.slice(comma + 1)
      if (!/;base64$/i.test(meta)) return sendJson(res, 400, { success: false, error: 'dataUrl must be base64' })
      const buf = Buffer.from(base64, 'base64')
      if (!buf?.length) return sendJson(res, 400, { success: false, error: 'empty file' })

      const soundsDir = join(distDir, 'src', 'sounds')
      if (!existsSync(soundsDir)) mkdirSync(soundsDir, { recursive: true })

      const extGuess = extFromDataUrlMeta(meta)
      let fileName = safeFileName(fileNameRaw)
      if (!/\.[a-zA-Z0-9]{1,8}$/.test(fileName)) fileName = fileName + (extGuess || '.mp3')

      // Overwrite if exists.
      writeFileSync(join(soundsDir, fileName), buf)
      return sendJson(res, 200, { success: true, relativeUrl: `src/sounds/${fileName}` })
    }

    // Static files (SPA fallback)
    let pathName = decodeURIComponent(url.pathname)
    if (pathName === '/' || pathName === '') pathName = '/index.html'

    const abs = normalize(join(distDir, pathName.replace(/^\//, '')))
    if (!abs.startsWith(distDir)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    const servedPath = (() => {
      if (existsSync(abs) && statSync(abs).isFile()) return abs
      const index = join(distDir, 'index.html')
      if (existsSync(index)) return index
      return null
    })()

    if (!servedPath) {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', mimeFromExt(servedPath))
    res.end(readFileSync(servedPath))
  } catch {
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})

const port = parsePort()
if (!existsSync(join(distDir, 'index.html'))) {
  console.error('[ERROR] release/dist/index.html not found. Run: npm run package:release')
  process.exit(1)
}

console.log('========================================')
console.log('OBS Overlay Kill - ローカル表示')
console.log('========================================')
console.log('')
console.log(`静的ファイルを次のポートで配信します: ${port}`)
console.log('終了するときはこのウィンドウで Ctrl+C を押してください。')
console.log('')
console.log('OBS ブラウザソースの URL 例:')
console.log(`  http://localhost:${port}/overlay`)
console.log('')
console.log('ブラウザで開く場合は、起動後に上記を開いてください。')
console.log('========================================')
console.log('')

server.on('error', (err) => {
  const code = err?.code
  if (code === 'EADDRINUSE') {
    console.error('')
    console.error(`[ERROR] Port ${port} is already in use.`)
    console.error('Close the other server window, or run with a different port.')
    console.error('')
    if (process.platform === 'win32') {
      console.error('Example:')
      console.error('  set OVERLAY_PORT=4174')
      console.error('  release\\start-localhost.bat')
    } else {
      console.error('Example:')
      console.error('  OVERLAY_PORT=4174 ./release/start-localhost.bat')
    }
    console.error('')
    process.exit(1)
  }

  console.error('')
  console.error('[ERROR] Failed to start server.')
  console.error(String(err?.message || err))
  console.error('')
  process.exit(1)
})

server.listen(port, '0.0.0.0', () => {
  const local = `http://localhost:${port}`
  const lanIp = getLanAddress()
  const network = lanIp ? `http://${lanIp}:${port}` : null
  const copied = copyToClipboard(local)

  const lines = [
    'Serving!',
    '',
    `- Local:    ${local}`,
    ...(network ? [`- Network:  ${network}`] : []),
    '',
    ...(copied ? ['Copied local address to clipboard!'] : []),
  ]

  if (!supportsAnsi()) {
    console.log('')
    for (const l of lines) console.log(l)
    console.log('')
    return
  }

  const green = '\x1b[32m'
  const reset = '\x1b[0m'
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length))
  const width = Math.max(...lines.map((l) => l.length), 10) + 2
  const top = `${green}┌${'─'.repeat(width)}┐${reset}`
  const bottom = `${green}└${'─'.repeat(width)}┘${reset}`

  console.log('')
  console.log(top)
  for (const l of lines) {
    console.log(`${green}│${reset} ${pad(l, width - 1)}${green}│${reset}`)
  }
  console.log(bottom)
  console.log('')
})

