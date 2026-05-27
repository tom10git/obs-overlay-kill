/**
 * Windows 向け: 配布 exe のビルド・差し替え（実行中プロセスの終了を含む）
 */
import { existsSync, renameSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'

export const OVERLAY_EXE_NAME = 'OBS-Overlay-Kill.exe'
export const OVERLAY_EXE_NEW_NAME = 'OBS-Overlay-Kill.new.exe'
export const OVERLAY_EXE_OLD_NAME = 'OBS-Overlay-Kill.old.exe'

export function sleepMs(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* spin */
  }
}

/** 実行中の配布 exe を終了（ビルド前） */
export function stopRunningOverlayExe() {
  if (process.platform !== 'win32') return false
  try {
    execFileSync('taskkill', ['/F', '/IM', OVERLAY_EXE_NAME], { stdio: 'ignore' })
    console.log('   実行中の OBS-Overlay-Kill.exe を終了しました。')
    sleepMs(500)
    return true
  } catch {
    return false
  }
}

function removeFileWithRetry(filePath, options = {}) {
  const { maxRetries = 20, retryDelay = 250, killBeforeRetry = 3 } = options
  if (!existsSync(filePath)) return true

  for (let i = 0; i < maxRetries; i++) {
    try {
      rmSync(filePath, { force: true, maxRetries: 5, retryDelay: 100 })
      return true
    } catch {
      if (i === killBeforeRetry) stopRunningOverlayExe()
      if (i < maxRetries - 1) sleepMs(retryDelay)
    }
  }

  if (process.platform === 'win32') {
    try {
      execFileSync('cmd', ['/c', 'del', '/f', '/q', filePath], { stdio: 'ignore' })
      return !existsSync(filePath)
    } catch {
      return false
    }
  }
  return false
}

/** pkg 出力 (.new.exe) を本番名に昇格 */
export function promoteBuiltExe(releaseDir) {
  const exeOut = join(releaseDir, OVERLAY_EXE_NAME)
  const exeNew = join(releaseDir, OVERLAY_EXE_NEW_NAME)
  const exeOld = join(releaseDir, OVERLAY_EXE_OLD_NAME)

  if (!existsSync(exeNew)) {
    console.error(`エラー: ${exeNew} がありません。`)
    return false
  }

  stopRunningOverlayExe()
  removeFileWithRetry(exeOld)

  if (existsSync(exeOut)) {
    if (!removeFileWithRetry(exeOut)) {
      try {
        renameSync(exeOut, exeOld)
      } catch {
        stopRunningOverlayExe()
        sleepMs(500)
        if (!removeFileWithRetry(exeOut)) {
          console.error('')
          console.error(`[ERROR] 既存の ${OVERLAY_EXE_NAME} を置き換えられません。`)
          console.error('  ・黒いコンソール（OBS-Overlay-Kill）を閉じる')
          console.error('  ・タスクマネージャーで OBS-Overlay-Kill.exe を終了')
          console.error('  ・ウイルス対策のスキャン待ち')
          console.error(`  ・終了後: ${OVERLAY_EXE_NEW_NAME} を ${OVERLAY_EXE_NAME} にリネーム`)
          console.error('')
          return false
        }
      }
    }
  }

  try {
    renameSync(exeNew, exeOut)
  } catch {
    if (process.platform === 'win32') {
      try {
        execFileSync('cmd', ['/c', 'move', '/Y', exeNew, exeOut], { stdio: 'ignore' })
      } catch {
        console.error(`エラー: ${OVERLAY_EXE_NEW_NAME} → ${OVERLAY_EXE_NAME} のリネームに失敗しました。`)
        return false
      }
    } else {
      return false
    }
  }

  removeFileWithRetry(exeOld)
  removeFileWithRetry(exeNew)
  return existsSync(exeOut)
}

/** 前回ビルドの残骸を削除 */
export function cleanStaleExeArtifacts(releaseDir) {
  for (const name of [OVERLAY_EXE_NEW_NAME, OVERLAY_EXE_OLD_NAME]) {
    removeFileWithRetry(join(releaseDir, name))
  }
}
