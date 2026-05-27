/**
 * 配布用ローカル HTTP サーバー。
 * - pkg exe: build/pkg-dist をスナップショットから配信（release に dist は出さない）
 * - 書き込み: 効果音・ユーザー設定は %LOCALAPPDATA%\OBS-Overlay-Kill\data
 */
import http from 'node:http'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, homedir, join, normalize, extname, basename, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { normalizeOverlayConfigObject } from './overlay-config-paths.mjs'
import {
  readCustomTechniqueNamesFile,
  resolveCustomTechniqueNamesPath,
} from './custom-technique-names.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..')

function getBundledDistDir() {
  if (process.env.OVERLAY_DIST) {
    return process.env.OVERLAY_DIST
  }
  const root = join(scriptDir, '..')
  // pkg 実行時: package.json の assets（build/pkg-dist/**）がスナップショットに載る
  const pkgDist = join(root, 'build', 'pkg-dist')
  const viteDist = join(root, 'dist')
  if (process.pkg && existsSync(join(pkgDist, 'index.html'))) return pkgDist
  if (existsSync(join(pkgDist, 'index.html'))) return pkgDist
  if (existsSync(join(viteDist, 'index.html'))) return viteDist
  return pkgDist
}

function getUserDataDir() {
  if (process.env.OVERLAY_USER_DATA) {
    return process.env.OVERLAY_USER_DATA
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    return join(local, 'OBS-Overlay-Kill', 'data')
  }
  return join(homedir(), '.obs-overlay-kill', 'data')
}

const bundledDistDir = getBundledDistDir()
const userDataDir = getUserDataDir()

function ensureUserDataDirs() {
  for (const sub of ['src/sounds', 'src/images', 'config']) {
    const dir = join(userDataDir, sub)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

/** 同梱 dist → ユーザーデータ（初回・不足ファイルの補完） */
function copyDirMerge(srcDir, destDir) {
  if (!existsSync(srcDir)) return 0
  mkdirSync(destDir, { recursive: true })
  let copied = 0
  let names
  try {
    names = readdirSync(srcDir)
  } catch {
    return 0
  }
  for (const name of names) {
    const src = join(srcDir, name)
    const dest = join(destDir, name)
    try {
      if (!existsSync(src)) continue
      if (statSync(src).isDirectory()) {
        copied += copyDirMerge(src, dest)
        continue
      }
      if (!existsSync(dest)) {
        cpSync(src, dest)
        copied += 1
      }
    } catch {
      // pkg スナップショット上の Unicode ファイル名などで失敗することがある
    }
  }
  return copied
}

function readOverlayConfigNormalized() {
  const userConfig = join(userDataDir, 'config', 'overlay-config.json')
  const bundledConfig = join(bundledDistDir, 'config', 'overlay-config.json')
  let configPath = bundledConfig
  if (existsSync(userConfig)) configPath = userConfig
  else if (!existsSync(bundledConfig)) return null
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  return { config: normalizeOverlayConfigObject(raw), path: configPath }
}

function seedUserDataFromBundled() {
  const bundledConfig = join(bundledDistDir, 'config', 'overlay-config.json')
  const userConfig = join(userDataDir, 'config', 'overlay-config.json')
  let didSeed = false

  if (!existsSync(userConfig) && existsSync(bundledConfig)) {
    mkdirSync(join(userDataDir, 'config'), { recursive: true })
    const raw = JSON.parse(readFileSync(bundledConfig, 'utf-8'))
    writeFileSync(userConfig, JSON.stringify(normalizeOverlayConfigObject(raw), null, 2), 'utf-8')
    console.log('   初回: 設定をユーザーデータへコピーしました（パス正規化済み）')
    didSeed = true
  }

  function userAssetDirEmpty(sub) {
    const dir = join(userDataDir, 'src', sub)
    if (!existsSync(dir)) return true
    try {
      return readdirSync(dir).length === 0
    } catch {
      return true
    }
  }

  // dev: 設定未作成時のみ。exe: 設定はあっても sounds/images が空なら同梱から補完。
  const seedSounds = process.pkg
    ? userAssetDirEmpty('sounds')
    : !existsSync(userConfig)
  const seedImages = process.pkg
    ? userAssetDirEmpty('images')
    : !existsSync(userConfig)

  if (seedSounds || seedImages) {
    const soundsCopied = seedSounds
      ? copyDirMerge(
          join(bundledDistDir, 'src', 'sounds'),
          join(userDataDir, 'src', 'sounds'),
        )
      : 0
    const imagesCopied = seedImages
      ? copyDirMerge(
          join(bundledDistDir, 'src', 'images'),
          join(userDataDir, 'src', 'images'),
        )
      : 0
    if (soundsCopied > 0 || imagesCopied > 0) {
      console.log(
        `   ユーザーデータへ素材をコピー: 効果音 ${soundsCopied} 件, 画像 ${imagesCopied} 件`,
      )
      didSeed = true
    }
  }

  return didSeed
}

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
      if (body.length > 200_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/** ユーザーデータ → 同梱 dist の順で静的ファイルを解決 */
function resolveStaticFile(pathName) {
  let rel = pathName.replace(/^\//, '')
  if (!rel) rel = 'index.html'

  const candidates = [
    join(userDataDir, rel),
    join(bundledDistDir, rel),
  ]

  for (const abs of candidates) {
    const norm = normalize(abs)
    const root = norm.startsWith(userDataDir) ? userDataDir : bundledDistDir
    if (!norm.startsWith(root)) continue
    if (existsSync(norm) && statSync(norm).isFile()) return norm
  }

  for (const root of [userDataDir, bundledDistDir]) {
    const index = join(root, 'index.html')
    if (existsSync(index)) return index
  }
  return null
}

function isPathInside(child, parent) {
  const normChild = normalize(child)
  const normParent = normalize(parent)
  return normChild === normParent || normChild.startsWith(normParent + sep)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (url.pathname === '/api/config/load') {
      if (req.method !== 'GET') return sendJson(res, 405, { success: false, error: 'Method Not Allowed' })
      const userConfig = join(userDataDir, 'config', 'overlay-config.json')
      const loaded = readOverlayConfigNormalized()
      if (!loaded) {
        return sendJson(res, 404, { success: false, error: 'overlay-config.json not found' })
      }
      return sendJson(res, 200, {
        success: true,
        source: existsSync(userConfig) ? 'userData' : 'bundled',
        path: loaded.path,
        config: loaded.config,
      })
    }

    if (url.pathname === '/api/custom-technique-names/load') {
      if (req.method !== 'GET') return sendJson(res, 405, { success: false, error: 'Method Not Allowed' })
      const hit = resolveCustomTechniqueNamesPath({
        root: repoRoot,
        userDataDir,
        bundledDistDir,
      })
      if (!hit) {
        return sendJson(res, 404, { success: false, error: 'customTechniqueNames.ts not found' })
      }
      const names = readCustomTechniqueNamesFile(hit.path)
      if (!names) {
        return sendJson(res, 500, { success: false, error: 'failed to parse customTechniqueNames.ts' })
      }
      return sendJson(res, 200, {
        success: true,
        source: hit.source,
        path: hit.path,
        names,
      })
    }

    if (url.pathname === '/api/config/save') {
      if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method Not Allowed' })
      const raw = await readBody(req)
      let config
      try {
        config = JSON.parse(raw)
      } catch {
        return sendJson(res, 400, { success: false, error: 'invalid json' })
      }
      const normalized = normalizeOverlayConfigObject(config)
      const configDir = join(userDataDir, 'config')
      if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
      const configPath = join(configDir, 'overlay-config.json')
      writeFileSync(configPath, JSON.stringify(normalized, null, 2), 'utf-8')
      return sendJson(res, 200, { success: true, path: configPath })
    }

    if (url.pathname === '/api/images/save') {
      if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method Not Allowed' })
      const raw = await readBody(req)
      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        return sendJson(res, 400, { success: false, error: 'invalid json' })
      }

      const fileNameRaw = typeof payload?.fileName === 'string' ? payload.fileName : 'image'
      const dataUrl = typeof payload?.dataUrl === 'string' ? payload.dataUrl : ''
      if (!/^data:(image|video)\//.test(dataUrl)) {
        return sendJson(res, 400, { success: false, error: 'dataUrl must be data:image/* or data:video/*' })
      }
      const comma = dataUrl.indexOf(',')
      if (comma < 0) return sendJson(res, 400, { success: false, error: 'invalid dataUrl' })

      const meta = dataUrl.slice(0, comma)
      const base64 = dataUrl.slice(comma + 1)
      if (!/;base64$/i.test(meta)) return sendJson(res, 400, { success: false, error: 'dataUrl must be base64' })
      const buf = Buffer.from(base64, 'base64')
      if (!buf?.length) return sendJson(res, 400, { success: false, error: 'empty file' })

      const imagesDir = join(userDataDir, 'src', 'images')
      if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

      const extGuess = (() => {
        const m = meta.match(/^data:(image|video)\/([a-z0-9.+-]+);base64$/i)
        const sub = m?.[2]?.toLowerCase() ?? ''
        if (sub === 'webm' || sub.includes('webm')) return '.webm'
        if (sub.includes('png')) return '.png'
        if (sub.includes('jpeg') || sub === 'jpg') return '.jpg'
        if (sub.includes('gif')) return '.gif'
        if (sub.includes('webp')) return '.webp'
        if (sub.includes('mp4') || sub === 'x-m4a') return '.mp4'
        return ''
      })()

      let fileName = safeFileName(fileNameRaw)
      if (!/\.[a-zA-Z0-9]{1,8}$/.test(fileName)) fileName = fileName + (extGuess || '.png')

      const outPath = join(imagesDir, fileName)
      if (!isPathInside(outPath, imagesDir)) {
        return sendJson(res, 403, { success: false, error: 'Forbidden' })
      }
      writeFileSync(outPath, buf)
      return sendJson(res, 200, { success: true, relativeUrl: `src/images/${fileName}` })
    }

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
      if (!dataUrl.startsWith('data:audio/')) {
        return sendJson(res, 400, { success: false, error: 'dataUrl must be data:audio/*' })
      }
      const comma = dataUrl.indexOf(',')
      if (comma < 0) return sendJson(res, 400, { success: false, error: 'invalid dataUrl' })

      const meta = dataUrl.slice(0, comma)
      const base64 = dataUrl.slice(comma + 1)
      if (!/;base64$/i.test(meta)) return sendJson(res, 400, { success: false, error: 'dataUrl must be base64' })
      const buf = Buffer.from(base64, 'base64')
      if (!buf?.length) return sendJson(res, 400, { success: false, error: 'empty file' })

      const soundsDir = join(userDataDir, 'src', 'sounds')
      if (!existsSync(soundsDir)) mkdirSync(soundsDir, { recursive: true })

      const extGuess = extFromDataUrlMeta(meta)
      let fileName = safeFileName(fileNameRaw)
      if (!/\.[a-zA-Z0-9]{1,8}$/.test(fileName)) fileName = fileName + (extGuess || '.mp3')

      const outPath = join(soundsDir, fileName)
      if (!isPathInside(outPath, soundsDir)) {
        return sendJson(res, 403, { success: false, error: 'Forbidden' })
      }
      writeFileSync(outPath, buf)
      return sendJson(res, 200, { success: true, relativeUrl: `src/sounds/${fileName}` })
    }

    let pathName = decodeURIComponent(url.pathname)
    if (pathName === '/' || pathName === '') pathName = '/index.html'

    if (pathName === '/config/overlay-config.json') {
      const loaded = readOverlayConfigNormalized()
      if (!loaded) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(loaded.config, null, 2))
      return
    }

    const servedPath = resolveStaticFile(pathName)
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

ensureUserDataDirs()
seedUserDataFromBundled()

const port = parsePort()
if (!existsSync(join(bundledDistDir, 'index.html'))) {
  console.error('[ERROR] 同梱 dist が見つかりません:', bundledDistDir)
  if (process.pkg) {
    console.error('exe のビルドが壊れている可能性があります。開発者に連絡してください。')
  } else {
    console.error('先に npm run package:release を実行してください。')
  }
  process.exit(1)
}

console.log('========================================')
console.log('OBS Overlay Kill - ローカル表示')
console.log('========================================')
console.log('')
if (process.pkg) {
  console.log('配布モード: 単一 exe（アプリ本体は exe 内に同梱）')
}
console.log(`ユーザーデータ: ${userDataDir}`)
console.log(`  効果音: ${join(userDataDir, 'src', 'sounds')}`)
console.log(`  画像:   ${join(userDataDir, 'src', 'images')}`)
console.log(`  設定:   ${join(userDataDir, 'config', 'overlay-config.json')}（設定画面の保存で更新）`)
console.log('')
console.log(`静的ファイルを次のポートで配信します: ${port}`)
console.log('終了するときはこのウィンドウで Ctrl+C を押してください。')
console.log('')
console.log('OBS ブラウザソースの URL 例:')
console.log(`  http://localhost:${port}/overlay`)
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
      console.error('  OBS-Overlay-Kill.exe')
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
