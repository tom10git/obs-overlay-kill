/**
 * overlay-config.json 内の素材 URL を配布向け相対パス（src/sounds, src/images）に揃える
 */

const DEV_PATH_RE = /(?:^|[/\\])(src[/\\](?:sounds|images)[/\\].+)$/i
/** %LOCALAPPDATA%\OBS-Overlay-Kill\data\...（ユーザー名・ドライブ非依存） */
const USER_DATA_DIR_RE = /obs-overlay-kill[/\\]data[/\\](src[/\\](?:sounds|images)[/\\].+)$/i

function extractDevRelativePath(normalized: string): string | null {
  const m = normalized.match(DEV_PATH_RE)
  if (!m?.[1]) return null
  return m[1].replace(/\\/g, '/')
}

function extractUserDataRelativePath(normalized: string): string | null {
  const m = normalized.match(USER_DATA_DIR_RE)
  if (!m?.[1]) return null
  return m[1].replace(/\\/g, '/')
}

/** 1 つの URL / パス文字列を正規化 */
export function normalizeOverlayAssetPath(url: string): string {
  const trimmed = url.trim()
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

  if (norm.toLowerCase().startsWith('public/sounds/')) {
    return `src/sounds/${norm.slice('public/sounds/'.length)}`
  }
  if (norm.toLowerCase().startsWith('public/images/')) {
    return `src/images/${norm.slice('public/images/'.length)}`
  }

  return norm
}

/** 設定オブジェクト内の文字列を再帰的に正規化 */
export function normalizeOverlayAssetPathsDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeOverlayAssetPath(value) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeOverlayAssetPathsDeep(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      out[key] = normalizeOverlayAssetPathsDeep(child)
    }
    return out as T
  }
  return value
}
