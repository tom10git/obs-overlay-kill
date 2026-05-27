/**
 * customTechniqueNames.ts の解析・AppData 同期（Node ビルド・ローカルサーバー用）
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'

export const CUSTOM_TECHNIQUE_NAMES_FILENAME = 'customTechniqueNames.ts'

const ARRAY_EXPORTS = [
  ['CUSTOM_SLASH_TECHNIQUE_NAMES', 'slash'],
  ['CUSTOM_MAGIC_TECHNIQUE_NAMES', 'magic'],
  ['CUSTOM_SHOOTING_TECHNIQUE_NAMES', 'shooting'],
]

/** @param {string} content */
export function parseCustomTechniqueNamesTs(content) {
  const names = { slash: [], magic: [], shooting: [] }
  for (const [exportName, key] of ARRAY_EXPORTS) {
    const re = new RegExp(
      `export\\s+const\\s+${exportName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`,
      'm',
    )
    const m = content.match(re)
    if (!m?.[1]) continue
    const body = m[1]
    const seen = new Set()
    for (const sm of body.matchAll(/['"]([^'"]+)['"]/g)) {
      const s = sm[1].trim()
      if (!s || seen.has(s)) continue
      seen.add(s)
      names[key].push(s)
    }
  }
  return names
}

export function readCustomTechniqueNamesFile(filePath) {
  if (!filePath || !existsSync(filePath)) return null
  try {
    const content = readFileSync(filePath, 'utf-8')
    return parseCustomTechniqueNamesTs(content)
  } catch {
    return null
  }
}

/**
 * 読み込み優先: AppData config → リポジトリ src/constants → pkg 同梱 config
 * @param {{ root?: string, userDataDir?: string, bundledDistDir?: string }} ctx
 */
export function resolveCustomTechniqueNamesPath(ctx = {}) {
  const { root, userDataDir, bundledDistDir } = ctx
  const candidates = []
  if (userDataDir) {
    candidates.push({
      path: join(userDataDir, 'config', CUSTOM_TECHNIQUE_NAMES_FILENAME),
      source: 'userData',
    })
  }
  if (root) {
    candidates.push({
      path: join(root, 'src', 'constants', CUSTOM_TECHNIQUE_NAMES_FILENAME),
      source: 'repo',
    })
  }
  if (bundledDistDir) {
    candidates.push({
      path: join(bundledDistDir, 'config', CUSTOM_TECHNIQUE_NAMES_FILENAME),
      source: 'bundled',
    })
  }
  for (const c of candidates) {
    if (existsSync(c.path)) return c
  }
  return null
}

/**
 * package-release: リポジトリの customTechniqueNames.ts のみ AppData config へコピー
 */
export function syncCustomTechniqueNamesToUserData(root, userDataDir) {
  if (!root || !userDataDir) {
    return { ok: false, reason: 'missing-dirs' }
  }
  const src = join(root, 'src', 'constants', CUSTOM_TECHNIQUE_NAMES_FILENAME)
  if (!existsSync(src)) {
    return { ok: false, reason: 'missing-source', path: src }
  }
  const dest = join(userDataDir, 'config', CUSTOM_TECHNIQUE_NAMES_FILENAME)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  const names = readCustomTechniqueNamesFile(dest)
  return {
    ok: true,
    path: dest,
    slash: names?.slash?.length ?? 0,
    magic: names?.magic?.length ?? 0,
    shooting: names?.shooting?.length ?? 0,
  }
}
