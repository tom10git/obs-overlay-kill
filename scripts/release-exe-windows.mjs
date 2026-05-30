/**
 * Windows 向け: 配布 exe のビルド・差し替え（実行中プロセスの終了を含む）
 */
import { copyFileSync, existsSync, renameSync, rmSync } from 'fs'
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

/** 実行中の配布 exe を終了（ビルド前・差し替え前） */
export function stopRunningOverlayExe() {
  if (process.platform !== 'win32') return false
  let killed = false
  for (const image of [OVERLAY_EXE_NAME, OVERLAY_EXE_OLD_NAME, OVERLAY_EXE_NEW_NAME]) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/IM', image], { stdio: 'ignore' })
      killed = true
    } catch {
      /* 未起動 */
    }
  }
  if (killed) {
    console.log('   実行中の OBS-Overlay-Kill exe を終了しました。')
    sleepMs(900)
  }
  return killed
}

export function removeFileWithRetry(filePath, options = {}) {
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

function tryRenameOrMove(src, dest) {
  try {
    renameSync(src, dest)
    return true
  } catch {
    if (process.platform !== 'win32') return false
    try {
      execFileSync('cmd', ['/c', 'move', '/Y', src, dest], { stdio: 'ignore' })
      return existsSync(dest)
    } catch {
      return false
    }
  }
}

function tryCopyReplace(src, dest) {
  if (existsSync(dest) && !removeFileWithRetry(dest, { killBeforeRetry: 0 })) {
    return false
  }
  try {
    copyFileSync(src, dest)
    return existsSync(dest)
  } catch {
    return false
  }
}

function clearExistingReleaseExe(exeOut, exeOld) {
  removeFileWithRetry(exeOld)
  if (!existsSync(exeOut)) return true

  if (removeFileWithRetry(exeOut, { killBeforeRetry: 1 })) return true

  try {
    renameSync(exeOut, exeOld)
    removeFileWithRetry(exeOld)
    return !existsSync(exeOut)
  } catch {
    stopRunningOverlayExe()
    sleepMs(600)
    if (removeFileWithRetry(exeOut, { killBeforeRetry: 0 })) return true
    return !existsSync(exeOut)
  }
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

  const maxAttempts = 6
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    stopRunningOverlayExe()
    if (attempt > 0) sleepMs(400 + attempt * 250)

    clearExistingReleaseExe(exeOut, exeOld)

    if (tryRenameOrMove(exeNew, exeOut)) {
      removeFileWithRetry(exeOld)
      removeFileWithRetry(exeNew)
      return existsSync(exeOut)
    }

    if (tryCopyReplace(exeNew, exeOut)) {
      removeFileWithRetry(exeNew)
      removeFileWithRetry(exeOld)
      return existsSync(exeOut)
    }
  }

  console.error('')
  console.error(`[ERROR] ${OVERLAY_EXE_NEW_NAME} → ${OVERLAY_EXE_NAME} の差し替えに失敗しました。`)
  console.error('  ・黒いコンソール（OBS-Overlay-Kill）を閉じる')
  console.error('  ・タスクマネージャーで OBS-Overlay-Kill.exe を終了')
  console.error('  ・release フォルダをエクスプローラーで開いていないか確認')
  console.error('  ・ウイルス対策のスキャン待ち')
  if (existsSync(exeNew)) {
    console.error(`  ・手動: ${OVERLAY_EXE_NEW_NAME} を ${OVERLAY_EXE_NAME} にリネーム`)
  }
  console.error('')
  return false
}

/** 前回ビルドの残骸を削除 */
export function cleanStaleExeArtifacts(releaseDir) {
  for (const name of [OVERLAY_EXE_NEW_NAME, OVERLAY_EXE_OLD_NAME]) {
    removeFileWithRetry(join(releaseDir, name))
  }
}
