/**
 * npm run build の出力を release/dist にコピーし、配布用フォルダを更新する。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distSrc = join(root, 'dist')
const distDest = join(root, 'release', 'dist')
const imagesSrc = join(root, 'src', 'images')
const imagesDest = join(distDest, 'src', 'images')
const soundsSrc = join(root, 'src', 'sounds')
const soundsDest = join(distDest, 'src', 'sounds')

console.log('1) npm run build ...')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

if (!existsSync(join(distSrc, 'index.html'))) {
  console.error('エラー: dist/index.html がありません。')
  process.exit(1)
}

console.log('2) release/dist にコピー ...')
if (existsSync(distDest)) {
  rmSync(distDest, { recursive: true })
}
mkdirSync(join(root, 'release'), { recursive: true })
cpSync(distSrc, distDest, { recursive: true })

// 配布 zip に assets（images/sounds）のみ同梱する（src/ の全同梱はしない）
const copyIfExists = (src, dest, label) => {
  if (!existsSync(src)) {
    console.warn(`   ! ${label} が無いためスキップしました: ${src}`)
    return
  }
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true })
  }
  mkdirSync(join(dest, '..'), { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`   + ${label} をコピーしました: ${dest}`)
}
copyIfExists(imagesSrc, imagesDest, 'src/images')
copyIfExists(soundsSrc, soundsDest, 'src/sounds')

console.log('')
console.log('完了: release/dist を更新しました。')
console.log('配布するときは release フォルダごと zip などにまとめてください。')
console.log('起動: release/start-localhost.bat（要 Node.js）')
