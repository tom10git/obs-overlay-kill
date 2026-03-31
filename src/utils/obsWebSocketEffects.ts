/**
 * OBS WebSocket v5: ソース（scene item）の transform を一時的に変更して戻す
 *
 * - ブラウザ（/overlay）から OBS の WebSocket に接続する
 * - 接続エラー等が起きても UI を落とさない（呼び出し側は握り潰してOK）
 */
import OBSWebSocket from 'obs-websocket-js'
import { logger } from '../lib/logger'
import type { ObsWebSocketConfig } from '../types/overlay'

type ClientKey = string

type SceneItemKey = string

type SceneItemRef = {
  sceneName: string
  sceneItemId: number
}

type Transform = Record<string, unknown>

type ConnectedClient = {
  ws: OBSWebSocket
  key: ClientKey
  /** sceneName|sourceName -> sceneItemId */
  sceneItemCache: Map<SceneItemKey, SceneItemRef>
  /** sceneName|sceneItemId -> originalTransform */
  originalTransformCache: Map<string, Transform>
  /** sceneName|sceneItemId -> last restore timer */
  restoreTimers: Map<string, number>
}

let client: ConnectedClient | null = null

function makeClientKey(cfg: ObsWebSocketConfig): ClientKey {
  return `${cfg.host.trim()}:${cfg.port}:${cfg.password ? 'pw' : 'nopw'}`
}

function normalizeHost(raw: string): string {
  const host = raw.trim()
  if (!host) return '127.0.0.1'
  return host
}

async function ensureClient(cfg: ObsWebSocketConfig): Promise<ConnectedClient> {
  const key = makeClientKey(cfg)
  if (client && client.key === key) return client

  // 既存クライアントが別設定なら切断して作り直す
  if (client) {
    try {
      await client.ws.disconnect()
    } catch {
      /* noop */
    }
    client = null
  }

  const ws = new OBSWebSocket()
  const host = normalizeHost(cfg.host)
  const port = cfg.port > 0 && cfg.port <= 65535 ? cfg.port : 4455
  const password = cfg.password.trim() ? cfg.password : undefined

  const candidates =
    host.toLowerCase() === 'localhost'
      ? ['127.0.0.1', 'localhost']
      : host === '127.0.0.1'
        ? ['127.0.0.1', 'localhost']
        : [host]

  let lastErr: unknown = null
  for (const h of candidates) {
    const url = `ws://${h}:${port}`
    try {
      await ws.connect(url, password)
      client = {
        ws,
        key,
        sceneItemCache: new Map(),
        originalTransformCache: new Map(),
        restoreTimers: new Map(),
      }
      return client
    } catch (e) {
      lastErr = e
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? '接続失敗')
  throw new Error(`OBS WebSocket に接続できませんでした（host=${host}, port=${port}）: ${msg}`)
}

async function resolveTargetSceneName(c: ConnectedClient, cfg: ObsWebSocketConfig): Promise<string> {
  const explicit = cfg.sceneName.trim()
  if (explicit) return explicit
  const resp = await c.ws.call('GetCurrentProgramScene')
  const name = String((resp as { sceneName?: string }).sceneName ?? '').trim()
  if (!name) throw new Error('現在のプログラムシーン名を取得できませんでした')
  return name
}

function sceneItemKey(sceneName: string, sourceName: string): SceneItemKey {
  return `${sceneName}\n${sourceName}`
}

function transformCacheKey(sceneName: string, sceneItemId: number): string {
  return `${sceneName}\n${sceneItemId}`
}

async function resolveSceneItemId(c: ConnectedClient, sceneName: string, sourceName: string): Promise<number> {
  const src = sourceName.trim()
  if (!src) throw new Error('ソース名が未指定です')

  const k = sceneItemKey(sceneName, src)
  const cached = c.sceneItemCache.get(k)
  if (cached?.sceneItemId != null) return cached.sceneItemId

  // まずは GetSceneItemId で直接解決（同名がある場合は OBS 側仕様）
  try {
    const resp = await c.ws.call('GetSceneItemId', { sceneName, sourceName: src })
    const id = Number((resp as { sceneItemId?: unknown }).sceneItemId)
    if (Number.isFinite(id)) {
      c.sceneItemCache.set(k, { sceneName, sceneItemId: id })
      return id
    }
  } catch {
    // fallthrough
  }

  // フォールバック: シーンのアイテム一覧から探索（グループ内も辿る）
  type SceneItem = {
    sceneItemId?: unknown
    sourceName?: unknown
    isGroup?: unknown
  }

  async function findInGroup(groupName: string): Promise<number | null> {
    try {
      // obs-websocket-js の型定義が追従していない場合があるため、必要パラメータはキャストで渡す
      const resp = await c.ws.call('GetGroupSceneItemList', { sceneName, groupName } as any)
      const items = (resp as { sceneItems?: unknown }).sceneItems
      if (!Array.isArray(items)) return null
      for (const it of items as SceneItem[]) {
        const name = typeof it.sourceName === 'string' ? it.sourceName.trim() : ''
        if (name && name === src) {
          const id = Number(it.sceneItemId)
          return Number.isFinite(id) ? id : null
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  const listResp = await c.ws.call('GetSceneItemList', { sceneName })
  const sceneItems = (listResp as { sceneItems?: unknown }).sceneItems
  if (Array.isArray(sceneItems)) {
    for (const it of sceneItems as SceneItem[]) {
      const name = typeof it.sourceName === 'string' ? it.sourceName.trim() : ''
      if (name && name === src) {
        const id = Number(it.sceneItemId)
        if (Number.isFinite(id)) {
          c.sceneItemCache.set(k, { sceneName, sceneItemId: id })
          return id
        }
      }

      const isGroup = Boolean((it as { isGroup?: unknown }).isGroup)
      if (isGroup && typeof it.sourceName === 'string' && it.sourceName.trim()) {
        const maybe = await findInGroup(it.sourceName.trim())
        if (maybe != null) {
          c.sceneItemCache.set(k, { sceneName, sceneItemId: maybe })
          return maybe
        }
      }
    }
  }

  throw new Error(`sceneItemId を取得できませんでした（scene=${sceneName}, source=${src}）`)
}

async function getOriginalTransform(c: ConnectedClient, sceneName: string, sceneItemId: number): Promise<Transform> {
  const k = transformCacheKey(sceneName, sceneItemId)
  const cached = c.originalTransformCache.get(k)
  if (cached) return cached
  const resp = await c.ws.call('GetSceneItemTransform', { sceneName, sceneItemId })
  const t = (resp as { sceneItemTransform?: unknown }).sceneItemTransform
  const transform = (t && typeof t === 'object') ? (t as Record<string, unknown>) : {}
  c.originalTransformCache.set(k, transform)
  return transform
}

async function setTransform(c: ConnectedClient, sceneName: string, sceneItemId: number, next: Transform): Promise<void> {
  await c.ws.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId,
    // obs-websocket-js の型は JsonObject（JsonValue）だが、ここでは数値フィールドのみ上書きするためキャストする
    sceneItemTransform: next as any,
  })
}

async function restoreLater(c: ConnectedClient, sceneName: string, sceneItemId: number, delayMs: number): Promise<void> {
  const key = transformCacheKey(sceneName, sceneItemId)
  const prevTimer = c.restoreTimers.get(key)
  if (prevTimer != null) window.clearTimeout(prevTimer)
  const timer = window.setTimeout(async () => {
    try {
      const orig = await getOriginalTransform(c, sceneName, sceneItemId)
      await setTransform(c, sceneName, sceneItemId, orig)
    } catch (e) {
      logger.warn('[OBS] transform restore failed', e)
    } finally {
      c.restoreTimers.delete(key)
    }
  }, Math.max(0, delayMs))
  c.restoreTimers.set(key, timer)
}

export async function obsShakeSource(cfg: ObsWebSocketConfig, strengthPx: number, durationMs: number): Promise<void> {
  const c = await ensureClient(cfg)
  const sceneName = await resolveTargetSceneName(c, cfg)
  const sceneItemId = await resolveSceneItemId(c, sceneName, cfg.sourceName)
  const orig = await getOriginalTransform(c, sceneName, sceneItemId)

  const posX = Number((orig as { positionX?: unknown }).positionX ?? 0)
  const posY = Number((orig as { positionY?: unknown }).positionY ?? 0)
  const s = Math.max(0, strengthPx)
  const dx = (Math.random() * 2 - 1) * s
  const dy = (Math.random() * 2 - 1) * s

  await setTransform(c, sceneName, sceneItemId, {
    ...orig,
    positionX: posX + dx,
    positionY: posY + dy,
  })
  await restoreLater(c, sceneName, sceneItemId, durationMs)
}

export async function obsMoveSource(cfg: ObsWebSocketConfig, distancePx: number, durationMs: number): Promise<void> {
  const c = await ensureClient(cfg)
  const sceneName = await resolveTargetSceneName(c, cfg)
  const sceneItemId = await resolveSceneItemId(c, sceneName, cfg.sourceName)
  const orig = await getOriginalTransform(c, sceneName, sceneItemId)

  const posX = Number((orig as { positionX?: unknown }).positionX ?? 0)
  const d = Math.max(0, distancePx)
  const dir = Math.random() < 0.5 ? -1 : 1

  await setTransform(c, sceneName, sceneItemId, {
    ...orig,
    positionX: posX + dir * d,
  })
  await restoreLater(c, sceneName, sceneItemId, durationMs)
}

export async function obsGlowSource(cfg: ObsWebSocketConfig, scale: number, durationMs: number): Promise<void> {
  const c = await ensureClient(cfg)
  const sceneName = await resolveTargetSceneName(c, cfg)
  const sceneItemId = await resolveSceneItemId(c, sceneName, cfg.sourceName)
  const orig = await getOriginalTransform(c, sceneName, sceneItemId)

  const baseScaleX = Number((orig as { scaleX?: unknown }).scaleX ?? 1)
  const baseScaleY = Number((orig as { scaleY?: unknown }).scaleY ?? 1)
  const s = Math.max(1, scale)

  await setTransform(c, sceneName, sceneItemId, {
    ...orig,
    scaleX: baseScaleX * s,
    scaleY: baseScaleY * s,
  })
  await restoreLater(c, sceneName, sceneItemId, durationMs)
}

