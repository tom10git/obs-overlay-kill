/**
 * scripts/overlay-local-server.mjs + build/pkg-dist を 1 つの exe にパッケージ。
 */
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  OVERLAY_EXE_NAME,
  OVERLAY_EXE_NEW_NAME,
  cleanStaleExeArtifacts,
  promoteBuiltExe,
  stopRunningOverlayExe,
} from './release-exe-windows.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')
const serverScript = join(root, 'scripts', 'overlay-local-server.mjs')
const distIndex = join(root, 'build', 'pkg-dist', 'index.html')
const exeOut = join(releaseDir, OVERLAY_EXE_NAME)
const exeNew = join(releaseDir, OVERLAY_EXE_NEW_NAME)
const pkgBin = join(root, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js')
const pkgConfig = join(root, 'package.json')

function readAppVersion() {
  const pkgPath = join(root, 'package.json')
  if (!existsSync(pkgPath)) return '0.0.0'
  const raw = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return typeof raw.version === 'string' ? raw.version : '0.0.0'
}

if (process.platform !== 'win32') {
  console.log('package-exe: Windows 以外のためスキップします。')
  process.exit(0)
}

if (!existsSync(distIndex)) {
  console.error('エラー: build/pkg-dist/index.html がありません。先に npm run package:release を実行してください。')
  process.exit(1)
}

if (!existsSync(serverScript)) {
  console.error('エラー: scripts/overlay-local-server.mjs がありません。')
  process.exit(1)
}

if (!existsSync(pkgBin)) {
  console.error('エラー: @yao-pkg/pkg が未インストールです。npm install を実行してください。')
  process.exit(1)
}

mkdirSync(releaseDir, { recursive: true })

const version = readAppVersion()
console.log(`OBS Overlay Kill v${version} — 単一 exe（アプリ同梱）をビルドします ...`)

stopRunningOverlayExe()
cleanStaleExeArtifacts(releaseDir)

execFileSync(
  process.execPath,
  [
    pkgBin,
    serverScript,
    '--config',
    pkgConfig,
    '--targets',
    'node20-win-x64',
    '--output',
    exeNew,
    '--compress',
    'GZip',
  ],
  { cwd: root, stdio: 'inherit' },
)

if (!existsSync(exeNew)) {
  console.error('エラー: exe の生成に失敗しました。')
  process.exit(1)
}

if (!promoteBuiltExe(releaseDir)) {
  process.exit(1)
}

console.log('')
console.log(`完了: ${exeOut}`)
