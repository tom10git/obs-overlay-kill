/**
 * OBS WebSocket v5: シーン名・シーン内ソース名の一覧取得（設定UI用）
 */
import OBSWebSocket from 'obs-websocket-js'
import { logger } from '../lib/logger'

export type ObsListFetchParams = {
  host: string
  port: number
  password: string
}

export type ObsScenesAndSourcesResult = {
  /** GetSceneList の scenes から抽出したシーン名（重複なし） */
  sceneNames: string[]
  /** 現在のプログラムシーン名（シーン未指定で使う対象の目安） */
  currentProgramSceneName: string
  /** シーンごとのソース名（レイヤー） */
  sourcesByScene: Record<string, string[]>
}

function sceneNameFromEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null
  const o = entry as Record<string, unknown>
  if (typeof o.sceneName === 'string' && o.sceneName.trim()) return o.sceneName.trim()
  return null
}

function sourceNameFromItem(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  if (typeof o.sourceName === 'string' && o.sourceName.trim()) return o.sourceName.trim()
  return null
}

/**
 * 一時接続してシーン一覧と各シーンのアイテム（ソース名）を取得する。
 * 失敗時は例外（メッセージは OBSWebSocket 依存）。
 */
export async function fetchObsScenesAndSources(params: ObsListFetchParams): Promise<ObsScenesAndSourcesResult> {
  const obs = new OBSWebSocket()
  const host = params.host.trim() || '127.0.0.1'
  const port = params.port > 0 && params.port <= 65535 ? params.port : 4455
  const password = params.password.trim() ? params.password : undefined

  try {
    const candidates =
      host.toLowerCase() === 'localhost'
        ? ['127.0.0.1', 'localhost']
        : host === '127.0.0.1'
          ? ['127.0.0.1', 'localhost']
          : [host]
    let lastErr: unknown = null
    let connected = false
    for (const h of candidates) {
      const url = `ws://${h}:${port}`
      try {
        await obs.connect(url, password)
        connected = true
        break
      } catch (e) {
        lastErr = e
      }
    }
    if (!connected) {
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? '接続失敗')
      throw new Error(`OBS WebSocket に接続できませんでした（host=${host}, port=${port}）: ${msg}`)
    }
    const list = await obs.call('GetSceneList')
    const sceneNames: string[] = []
    const seen = new Set<string>()
    const rawScenes = (list as { scenes?: unknown }).scenes
    if (Array.isArray(rawScenes)) {
      for (const s of rawScenes) {
        const name = sceneNameFromEntry(s)
        if (name && !seen.has(name)) {
          seen.add(name)
          sceneNames.push(name)
        }
      }
    }

    const currentProgramSceneName = String(
      (list as { currentProgramSceneName?: string }).currentProgramSceneName ?? ''
    ).trim()

    const sourcesByScene: Record<string, string[]> = {}
    for (const sceneName of sceneNames) {
      try {
        const itemsResp = await obs.call('GetSceneItemList', { sceneName })
        const items = (itemsResp as { sceneItems?: unknown }).sceneItems
        const names: string[] = []
        const srcSeen = new Set<string>()
        if (Array.isArray(items)) {
          for (const it of items) {
            const sn = sourceNameFromItem(it)
            if (sn && !srcSeen.has(sn)) {
              srcSeen.add(sn)
              names.push(sn)
            }
          }
        }
        sourcesByScene[sceneName] = names
      } catch (e) {
        logger.warn(`[OBS] GetSceneItemList 失敗 scene="${sceneName}"`, e)
        sourcesByScene[sceneName] = []
      }
    }

    return {
      sceneNames,
      currentProgramSceneName,
      sourcesByScene,
    }
  } finally {
    try {
      await obs.disconnect()
    } catch {
      /* noop */
    }
  }
}
