/**
 * 配布 exe（ローカルサーバー）向け: 設定・効果音・画像をユーザーデータへ保存
 */

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('ファイルの読み込みに失敗しました'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
  }
  return json
}

/** 配布ビルド（本番）ではローカル API でユーザーデータへ保存する */
export function shouldUseLocalDataApi(): boolean {
  return import.meta.env.PROD
}

export async function saveOverlayConfigToLocalApi(config: unknown): Promise<boolean> {
  try {
    const result = await postJson<{ success?: boolean }>('/api/config/save', config)
    return result.success === true
  } catch {
    return false
  }
}

export type LocalConfigLoadResult = {
  success: boolean
  config?: unknown
  source?: 'userData' | 'bundled'
  path?: string
}

/** 配布 exe: ユーザーデータの overlay-config.json を優先して読み込む */
export async function loadOverlayConfigFromLocalApi(): Promise<LocalConfigLoadResult | null> {
  try {
    const res = await fetch('/api/config/load', { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as LocalConfigLoadResult
  } catch {
    return null
  }
}

export async function uploadSoundToLocalData(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file)
  const result = await postJson<{ success?: boolean; relativeUrl?: string }>('/api/sounds/save', {
    fileName: file.name,
    dataUrl,
  })
  if (!result.success || !result.relativeUrl) {
    throw new Error('効果音の保存に失敗しました')
  }
  return result.relativeUrl
}

/** 画像・透過 WebM など（保存先: ユーザーデータの src/images/） */
export async function uploadImageToLocalData(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file)
  const result = await postJson<{ success?: boolean; relativeUrl?: string }>('/api/images/save', {
    fileName: file.name,
    dataUrl,
  })
  if (!result.success || !result.relativeUrl) {
    throw new Error('画像・動画ファイルの保存に失敗しました')
  }
  return result.relativeUrl
}

/** uploadImageToLocalData の別名（WebM 用） */
export const uploadMediaToLocalData = uploadImageToLocalData
