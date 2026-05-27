/**
 * Windows 配布用ユーザーデータディレクトリ（%LOCALAPPDATA%\OBS-Overlay-Kill\data）
 */
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export function resolveWindowsUserDataDir() {
  if (process.env.OVERLAY_USER_DATA) {
    return process.env.OVERLAY_USER_DATA
  }
  if (process.platform !== 'win32') {
    return null
  }
  const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  return join(local, 'OBS-Overlay-Kill', 'data')
}

export function hasWindowsUserData() {
  const dir = resolveWindowsUserDataDir()
  if (!dir || !existsSync(dir)) return false
  return existsSync(join(dir, 'config', 'overlay-config.json'))
}
