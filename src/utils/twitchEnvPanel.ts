/**
 * テストパネル用: .env の Twitch 設定を読み取り専用で表示する
 */

import {
  getTwitchAccessToken,
  getTwitchRefreshToken,
} from '../config/auth'

/** auth.ts の localStorage キーと一致させる */
const LS_OAUTH_ACCESS = 'twitch_oauth_access_token'
const LS_OAUTH_REFRESH = 'twitch_oauth_refresh_token'

export type TwitchEnvPanelRow = {
  envKey: string
  display: string
  configured: boolean
  runtimeNote?: string
}

function envTrim(key: string): string {
  const raw = import.meta.env[key as keyof ImportMetaEnv]
  return typeof raw === 'string' ? raw.trim() : ''
}

/** 秘密値は先頭・末尾のみ表示 */
export function maskTwitchSecret(value: string | undefined, visible = 4): string {
  const v = value?.trim() ?? ''
  if (!v) return '（未設定）'
  if (v.length <= visible * 2) return '••••••••（設定済み）'
  return `${v.slice(0, visible)}…${v.slice(-visible)}`
}

function oauthFromStorage(): { access?: string; refresh?: string } {
  if (typeof localStorage === 'undefined') return {}
  return {
    access: localStorage.getItem(LS_OAUTH_ACCESS)?.trim() || undefined,
    refresh: localStorage.getItem(LS_OAUTH_REFRESH)?.trim() || undefined,
  }
}

function tokenRuntimeNote(
  envValue: string,
  storageValue: string | undefined,
  effectiveValue: string | undefined,
): string | undefined {
  if (storageValue) {
    return '実行時: OAuth（localStorage）'
  }
  if (envValue && effectiveValue === envValue) {
    return '実行時: .env'
  }
  if (effectiveValue && !envValue) {
    return '実行時: トークンあり（.env 未設定）'
  }
  return undefined
}

/** テストパネルに並べる .env 行（表示専用） */
export function buildTwitchEnvPanelRows(): TwitchEnvPanelRow[] {
  const clientId = envTrim('VITE_TWITCH_TOKEN_APP_CLIENT_ID')
  const username = envTrim('VITE_TWITCH_USERNAME')
  const clientSecret = envTrim('VITE_TWITCH_TOKEN_APP_CLIENT_SECRET')
  const accessEnv = envTrim('VITE_TWITCH_ACCESS_TOKEN')
  const refreshEnv = envTrim('VITE_TWITCH_REFRESH_TOKEN')

  const stored = oauthFromStorage()
  const effectiveAccess = getTwitchAccessToken()?.trim()
  const effectiveRefresh = getTwitchRefreshToken()?.trim()

  return [
    {
      envKey: 'VITE_TWITCH_TOKEN_APP_CLIENT_ID',
      display: clientId || '（未設定）',
      configured: Boolean(clientId),
    },
    {
      envKey: 'VITE_TWITCH_USERNAME',
      display: username || '（未設定）',
      configured: Boolean(username),
    },
    {
      envKey: 'VITE_TWITCH_TOKEN_APP_CLIENT_SECRET',
      display: maskTwitchSecret(clientSecret),
      configured: Boolean(clientSecret),
    },
    {
      envKey: 'VITE_TWITCH_ACCESS_TOKEN',
      display: stored.access ? maskTwitchSecret(stored.access) : maskTwitchSecret(accessEnv),
      configured: Boolean(stored.access || accessEnv || effectiveAccess),
      runtimeNote: tokenRuntimeNote(accessEnv, stored.access, effectiveAccess),
    },
    {
      envKey: 'VITE_TWITCH_REFRESH_TOKEN',
      display: stored.refresh ? maskTwitchSecret(stored.refresh) : maskTwitchSecret(refreshEnv),
      configured: Boolean(stored.refresh || refreshEnv || effectiveRefresh),
      runtimeNote: tokenRuntimeNote(refreshEnv, stored.refresh, effectiveRefresh),
    },
  ]
}
