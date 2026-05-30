/**
 * 配布用ビルド → release/ には OBS-Overlay-Kill.exe のみを置く。
 * 同梱データ: %LOCALAPPDATA%\OBS-Overlay-Kill\data を優先して build/pkg-dist に取り込む。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { execFileSync, execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  OVERLAY_EXE_NAME,
  OVERLAY_EXE_NEW_NAME,
  OVERLAY_EXE_OLD_NAME,
  stopRunningOverlayExe,
  sleepMs,
} from './release-exe-windows.mjs'
import {
  copyOverlayBundledAssets,
  normalizeOverlayConfigObject,
  persistAppDataOverlayConfigPaths,
  syncOverlayAssetsToUserData,
} from './overlay-config-paths.mjs'
import { syncCustomTechniqueNamesToUserData } from './custom-technique-names.mjs'
import { resolveWindowsUserDataDir } from './user-data-dir.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')
const pkgDistDir = join(root, 'build', 'pkg-dist')
const exeName = OVERLAY_EXE_NAME
const exePath = join(releaseDir, exeName)

/** Windows でフォルダが掴まれていると EPERM になりがちなのでリトライし、最後に cmd の rmdir にフォールバックする */
function rmDirRecursiveSync(dirPath) {
  if (!existsSync(dirPath)) return
  try {
    rmSync(dirPath, { recursive: true, maxRetries: 15, retryDelay: 200 })
  } catch (err) {
    const retriable = err && (err.code === 'EPERM' || err.code === 'EBUSY')
    if (process.platform === 'win32' && retriable) {
      try {
        execFileSync('cmd', ['/c', 'rmdir', '/s', '/q', dirPath], { stdio: 'inherit' })
      } catch {
        console.error(
          'ヒント: フォルダを他プロセス（エクスプローラー・OBS・ウイルス対策・同期ツール）が開いていると削除できません。該当を閉じてから再実行してください。',
        )
        throw err
      }
      return
    }
    throw err
  }
}

/** release/ から exe 以外を削除（exe は package-exe が上書き） */
function cleanReleaseDirExceptExe() {
  if (!existsSync(releaseDir)) {
    mkdirSync(releaseDir, { recursive: true })
    return
  }
  const keep = new Set([exeName])
  for (const name of readdirSync(releaseDir)) {
    if (keep.has(name)) continue
    rmDirRecursiveSync(join(releaseDir, name))
  }
  for (const stale of [OVERLAY_EXE_NEW_NAME, OVERLAY_EXE_OLD_NAME]) {
    rmDirRecursiveSync(join(releaseDir, stale))
  }
}

const distSrc = join(root, 'dist')
const pkgConfig = join(pkgDistDir, 'config', 'overlay-config.json')
const publicConfig = join(root, 'public', 'config', 'overlay-config.json')

function loadBundledConfigSource(userDataDir) {
  const userConfig =
    userDataDir && existsSync(join(userDataDir, 'config', 'overlay-config.json'))
      ? join(userDataDir, 'config', 'overlay-config.json')
      : null
  if (userConfig) {
    return {
      raw: JSON.parse(readFileSync(userConfig, 'utf-8')),
      label: 'AppData overlay-config.json',
      path: userConfig,
    }
  }
  if (existsSync(publicConfig)) {
    return {
      raw: JSON.parse(readFileSync(publicConfig, 'utf-8')),
      label: 'public/config/overlay-config.json',
      path: publicConfig,
    }
  }
  if (existsSync(pkgConfig)) {
    return {
      raw: JSON.parse(readFileSync(pkgConfig, 'utf-8')),
      label: 'dist/config/overlay-config.json',
      path: pkgConfig,
    }
  }
  return null
}

console.log('1) npm run build:release（難読化・ソースマップなし）...')
execSync('npm run build:release', { cwd: root, stdio: 'inherit' })

if (!existsSync(join(distSrc, 'index.html'))) {
  console.error('エラー: dist/index.html がありません。')
  process.exit(1)
}

console.log('2) build/pkg-dist にステージ（exe 同梱用）...')
if (process.platform === 'win32') stopRunningOverlayExe()
rmDirRecursiveSync(pkgDistDir)
mkdirSync(join(root, 'build'), { recursive: true })
cpSync(distSrc, pkgDistDir, { recursive: true })

const userDataDir = resolveWindowsUserDataDir()
const configSource = loadBundledConfigSource(userDataDir)

if (userDataDir && existsSync(userDataDir)) {
  console.log(`2b) AppData / 設定参照から素材を同梱: ${userDataDir}`)
  if (process.platform === 'win32') {
    stopRunningOverlayExe()
    sleepMs(400)
  }
} else if (process.platform === 'win32') {
  console.warn(
    '   ! %LOCALAPPDATA%\\OBS-Overlay-Kill\\data が見つかりません。public/config とリポジトリ src/ から同梱します。',
  )
}

if (configSource) {
  const assetResult = copyOverlayBundledAssets(configSource.raw, pkgDistDir, {
    root,
    userDataDir: userDataDir && existsSync(userDataDir) ? userDataDir : null,
  })
  console.log(`   + 設定元: ${configSource.label}`)
  console.log(
    `   + 設定で参照される素材: ${assetResult.referenced} 件（新規コピー ${assetResult.copied.length} 件）`,
  )
  if (assetResult.mergedAppData) {
    console.log('   + AppData data/src/ を build/pkg-dist にマージしました')
  }
  if (assetResult.copied.length > 0 && assetResult.copied.length <= 8) {
    for (const rel of assetResult.copied) console.log(`      · ${rel}`)
  }
  if (assetResult.missing.length > 0) {
    console.warn(`   ! 見つからなかった素材 (${assetResult.missing.length} 件):`)
    for (const rel of assetResult.missing.slice(0, 15)) console.warn(`      - ${rel}`)
    if (assetResult.missing.length > 15) {
      console.warn(`      … 他 ${assetResult.missing.length - 15} 件`)
    }
    console.warn(
      '     AppData の data/src/ にファイルを置くか、リポジトリの src/sounds・src/images に置いてから再ビルドしてください。',
    )
  }
} else {
  console.warn('   ! overlay-config.json が無いため、リポジトリ src/ のみマージします')
  copyOverlayBundledAssets({}, pkgDistDir, {
    root,
    userDataDir: userDataDir && existsSync(userDataDir) ? userDataDir : null,
  })
}

mkdirSync(join(pkgDistDir, 'config'), { recursive: true })
if (configSource) {
  writeFileSync(
    pkgConfig,
    JSON.stringify(normalizeOverlayConfigObject(configSource.raw), null, 2),
    'utf-8',
  )
  console.log('   + 同梱用 overlay-config.json を書き出し（パス正規化済み）')
} else {
  console.warn('   ! overlay-config.json が無いため、デフォルト設定のみ同梱されます')
}

if (userDataDir && existsSync(userDataDir)) {
  const sync = syncOverlayAssetsToUserData(pkgDistDir, userDataDir)
  if (sync.ok && (sync.sounds > 0 || sync.images > 0)) {
    console.log(
      `2c) AppData に素材を同期: 効果音 ${sync.sounds} 件, 画像 ${sync.images} 件 → ${join(userDataDir, 'src')}`,
    )
  } else if (sync.ok) {
    console.warn(
      '   ! 同梱素材が無いため AppData の src/sounds・src/images は空のままです（リポジトリ src/ または設定の参照先を確認）',
    )
  }

  const customNames = syncCustomTechniqueNamesToUserData(root, userDataDir)
  if (customNames.ok) {
    console.log(
      `2d) AppData に customTechniqueNames.ts をコピー（斬撃 ${customNames.slash} / 魔法 ${customNames.magic} / 射撃 ${customNames.shooting} 件）`,
    )
    console.log(`     ${customNames.path}`)
  } else if (customNames.reason === 'missing-source') {
    console.warn(
      '   ! src/constants/customTechniqueNames.ts が無いため AppData へコピーしませんでした（.example をコピーして編集してください）',
    )
  }
}

const userConfig = configSource?.path ?? null

if (process.platform === 'win32') {
  console.log('3) release/ を整理して exe をビルド ...')
  stopRunningOverlayExe()
  cleanReleaseDirExceptExe()
  execSync('node scripts/package-exe.mjs', { cwd: root, stdio: 'inherit' })
  if (!existsSync(exePath)) {
    console.error(`エラー: ${exePath} が生成されませんでした。`)
    process.exit(1)
  }
  console.log('4) 中間 build/pkg-dist を削除 ...')
  rmDirRecursiveSync(pkgDistDir)

  if (userDataDir) {
    console.log('5) AppData overlay-config.json のパスを正規化 ...')
    const persist = persistAppDataOverlayConfigPaths(
      userDataDir,
      configSource?.raw ?? null,
    )
    if (persist.ok && persist.changed) {
      console.log(
        '   + 効果音・画像・WebM のパスを src/sounds|images/... に更新しました（ユーザー名を含む絶対パスを除去）',
      )
      console.log(`     ${persist.path}`)
    } else if (persist.ok) {
      console.log('   + AppData の overlay-config.json は既に AppData 向けパスです')
    } else if (persist.reason === 'no-config-file') {
      console.warn('   ! AppData に overlay-config.json が無いためパス更新をスキップしました')
    }
  }
} else {
  console.log('3) exe ビルドは Windows のみ（スキップ）')
}

console.log('')
if (process.platform === 'win32') {
  console.log(`完了: release/${exeName} のみ`)
  if (userDataDir && existsSync(userConfig)) {
    console.log('同梱内容: 直前の AppData（設定・効果音・画像/WebM）を exe に埋め込み済み')
  }
  console.log('配布: release フォルダを zip にするか、exe だけ渡してください。')
} else {
  console.log('完了: build/pkg-dist を生成しました（Windows で package:release を再実行すると exe ができます）')
}
