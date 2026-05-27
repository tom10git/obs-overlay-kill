/**
 * overlay-config.json 内パス正規化（Node ビルド・サーバー用。src/utils/overlayConfigPaths.ts と同等）
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const DEV_PATH_RE = /(?:^|[/\\])(src[/\\](?:sounds|images)[/\\].+)$/i
/** %LOCALAPPDATA%\OBS-Overlay-Kill\data\...（ユーザー名・ドライブ非依存） */
const USER_DATA_DIR_RE = /obs-overlay-kill[/\\]data[/\\](src[/\\](?:sounds|images)[/\\].+)$/i
const BUNDLED_ASSET_RE = /^src\/(sounds|images)\/.+/i

function extractDevRelativePath(normalized) {
  const m = normalized.match(DEV_PATH_RE)
  if (!m?.[1]) return null
  return m[1].replace(/\\/g, '/')
}

function extractUserDataRelativePath(normalized) {
  const m = normalized.match(USER_DATA_DIR_RE)
  if (!m?.[1]) return null
  return m[1].replace(/\\/g, '/')
}

export function normalizeOverlayAssetPath(url) {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('data:')) return trimmed

  let norm = trimmed.replace(/\\/g, '/')

  const fromDev = extractDevRelativePath(norm)
  if (fromDev) return fromDev

  norm = norm.replace(/^file:\/\/\/[a-z]:\//i, '')
  norm = norm.replace(/^file:\/\//i, '')
  norm = norm.replace(/^\/+/, '')

  const fromUserData = extractUserDataRelativePath(norm)
  if (fromUserData) return fromUserData

  const lower = norm.toLowerCase()
  if (lower.startsWith('public/sounds/')) {
    return `src/sounds/${norm.slice('public/sounds/'.length)}`
  }
  if (lower.startsWith('public/images/')) {
    return `src/images/${norm.slice('public/images/'.length)}`
  }

  return norm
}

/**
 * AppData の overlay-config.json を相対パス（src/sounds|images/...）に揃えて保存する。
 */
export function persistAppDataOverlayConfigPaths(userDataDir, rawConfig = null) {
  if (!userDataDir) return { ok: false, reason: 'no-user-data-dir' }
  const userConfig = join(userDataDir, 'config', 'overlay-config.json')
  if (!existsSync(userConfig)) return { ok: false, reason: 'no-config-file', path: userConfig }

  const raw = rawConfig ?? JSON.parse(readFileSync(userConfig, 'utf-8'))
  const normalized = normalizeOverlayConfigObject(raw)
  const next = `${JSON.stringify(normalized, null, 2)}\n`
  const prev = readFileSync(userConfig, 'utf-8')
  const changed = prev !== next
  if (changed) writeFileSync(userConfig, next, 'utf-8')
  return { ok: true, changed, path: userConfig }
}

export function normalizeOverlayConfigObject(config) {
  if (config === null || config === undefined) return config
  if (typeof config === 'string') return normalizeOverlayAssetPath(config)
  if (Array.isArray(config)) return config.map((item) => normalizeOverlayConfigObject(item))
  if (typeof config === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(config)) {
      out[key] = normalizeOverlayConfigObject(value)
    }
    return out
  }
  return config
}

export function isBundledOverlayAssetPath(path) {
  const n = normalizeOverlayAssetPath(path)
  return Boolean(n && BUNDLED_ASSET_RE.test(n))
}

function collectConfigStrings(config) {
  const out = []
  const walk = (value) => {
    if (typeof value === 'string') {
      const t = value.trim()
      if (t) out.push(t)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) walk(child)
    }
  }
  walk(config)
  return out
}

/** 同梱対象の相対パス（src/sounds|images/...）を設定から収集 */
export function collectOverlayAssetRelPaths(config) {
  const paths = new Set()
  for (const raw of collectConfigStrings(config)) {
    const rel = normalizeOverlayAssetPath(raw)
    if (rel && BUNDLED_ASSET_RE.test(rel)) paths.add(rel)
  }
  return [...paths]
}

function isExistingFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile()
  } catch {
    return false
  }
}

/** AppData → リポジトリ src → public の順で実ファイルを探す */
export function resolveOverlayAssetSource(relPath, ctx) {
  const { root, userDataDir } = ctx
  const candidates = []
  if (userDataDir) candidates.push(join(userDataDir, relPath))
  if (root) candidates.push(join(root, relPath))
  if (root && relPath.startsWith('src/sounds/')) {
    const sub = relPath.slice('src/sounds/'.length)
    candidates.push(join(root, 'public', 'sounds', sub))
  }
  if (root && relPath.startsWith('src/images/')) {
    const sub = relPath.slice('src/images/'.length)
    candidates.push(join(root, 'public', 'images', sub))
  }
  for (const p of candidates) {
    if (isExistingFile(p)) return p
  }
  return null
}

function tryResolveFromRawString(raw, ctx) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return null

  const rel = normalizeOverlayAssetPath(trimmed)
  if (rel && BUNDLED_ASSET_RE.test(rel)) {
    const fromRel = resolveOverlayAssetSource(rel, ctx)
    if (fromRel) return { rel, src: fromRel }
  }

  let fsPath = trimmed.replace(/^file:\/\//i, '').replace(/\\/g, '/')
  if (/^\/[a-z]:\//i.test(fsPath)) fsPath = fsPath.slice(1)
  fsPath = fsPath.replace(/\//g, '\\')
  if (isExistingFile(fsPath)) {
    const relFromFs = normalizeOverlayAssetPath(trimmed)
    if (relFromFs && BUNDLED_ASSET_RE.test(relFromFs)) return { rel: relFromFs, src: fsPath }
  }
  return null
}

function sleepMs(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* spin */
  }
}

function overlayAssetAlreadyCopied(src, dest) {
  if (!isExistingFile(dest)) return false
  try {
    const ss = statSync(src)
    const ds = statSync(dest)
    return ss.isFile() && ds.isFile() && ss.size === ds.size
  } catch {
    return false
  }
}

function copyFileSafe(src, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  if (overlayAssetAlreadyCopied(src, dest)) return

  const maxRetries = process.platform === 'win32' ? 20 : 5
  const retryDelay = process.platform === 'win32' ? 200 : 50

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      copyFileSync(src, dest)
      return
    } catch (err) {
      const retriable =
        err &&
        (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')
      if (!retriable || attempt >= maxRetries - 1) throw err
      sleepMs(retryDelay)
    }
  }
}

function countTreeFiles(dir) {
  if (!existsSync(dir)) return 0
  let n = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    try {
      if (statSync(p).isDirectory()) n += countTreeFiles(p)
      else n += 1
    } catch {
      /* skip */
    }
  }
  return n
}

/** cpSync は Windows + 日本語名で chmod EPERM になりやすいためファイル単位でコピー */
function mergeTreeInto(srcDir, destDir) {
  if (!existsSync(srcDir)) return 0
  mkdirSync(destDir, { recursive: true })
  for (const name of readdirSync(srcDir)) {
    const src = join(srcDir, name)
    const dest = join(destDir, name)
    let st
    try {
      st = statSync(src)
    } catch {
      continue
    }
    if (st.isDirectory()) mergeTreeInto(src, dest)
    else copyFileSafe(src, dest)
  }
  return 1
}

/**
 * package-release 用: 同梱した pkg-dist/src → AppData data/src へ反映（設定は既にあるが素材フォルダが空のとき用）
 */
export function syncOverlayAssetsToUserData(pkgDistDir, userDataDir) {
  if (!pkgDistDir || !userDataDir) {
    return { ok: false, sounds: 0, images: 0 }
  }
  const pkgSrc = join(pkgDistDir, 'src')
  if (!existsSync(pkgSrc)) {
    return { ok: false, sounds: 0, images: 0 }
  }
  const out = { ok: true, sounds: 0, images: 0 }
  for (const sub of ['sounds', 'images']) {
    const from = join(pkgSrc, sub)
    const to = join(userDataDir, 'src', sub)
    if (!existsSync(from)) continue
    mergeTreeInto(from, to)
    out[sub] = countTreeFiles(to)
  }
  return out
}

/**
 * package-release 用: AppData src をマージし、設定で参照される素材を各所から pkg-dist に集める。
 */
export function copyOverlayBundledAssets(config, pkgDistDir, ctx) {
  const { root, userDataDir } = ctx
  const copied = []
  const missing = []
  let mergedAppData = false

  const appSrc = userDataDir ? join(userDataDir, 'src') : null
  if (appSrc && existsSync(appSrc)) {
    mergeTreeInto(appSrc, join(pkgDistDir, 'src'))
    mergedAppData = true
  }

  const relPaths = collectOverlayAssetRelPaths(config)
  const seenDest = new Set()

  const copyOne = (rel, src) => {
    if (!rel || !src || seenDest.has(rel)) return
    const dest = join(pkgDistDir, rel)
    if (isExistingFile(dest)) {
      seenDest.add(rel)
      return
    }
    copyFileSafe(src, dest)
    seenDest.add(rel)
    copied.push(rel)
  }

  for (const rel of relPaths) {
    const src = resolveOverlayAssetSource(rel, ctx)
    if (src) copyOne(rel, src)
    else missing.push(rel)
  }

  for (const raw of collectConfigStrings(config)) {
    const hit = tryResolveFromRawString(raw, ctx)
    if (hit) copyOne(hit.rel, hit.src)
  }

  const remaining = missing.filter((rel) => !isExistingFile(join(pkgDistDir, rel)))
  for (const rel of remaining) {
    const src = resolveOverlayAssetSource(rel, ctx)
    if (src) {
      copyOne(rel, src)
      const idx = missing.indexOf(rel)
      if (idx >= 0) missing.splice(idx, 1)
    }
  }

  if (root) {
    for (const sub of ['sounds', 'images']) {
      const repoDir = join(root, 'src', sub)
      const destDir = join(pkgDistDir, 'src', sub)
      if (existsSync(repoDir)) mergeTreeInto(repoDir, destDir)
    }
  }

  return { copied, missing, mergedAppData, referenced: relPaths.length }
}
