import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

const lockPath = resolve(process.cwd(), 'package-lock.json')
let lockText = ''
try {
  lockText = readFileSync(lockPath, 'utf8')
} catch (e) {
  fail(`[supply-chain] package-lock.json が読めません: ${lockPath}`)
}

// "Mini Shai-Hulud" 系のような Git URL / optionalDependencies 経由の侵入を早期検知するため、
// lockfile に Git 参照が入った時点で CI を落とす。
const bannedSubstrings = [
  // Git URL / VCS references
  'github:',
  'git+https://',
  'git+ssh://',
  'git://',
  'ssh://git@',
  'git@github.com:',
  '"resolved": "git+',
  '"resolved":"git+',
  // Known IOCs mentioned in the incident writeups
  'router_init.js',
  '@tanstack/setup',
  'tanstack/router#',
]

const hits = []
for (const s of bannedSubstrings) {
  if (lockText.includes(s)) hits.push(s)
}

if (hits.length) {
  fail(
    `[supply-chain] package-lock.json に禁止パターンが含まれています: ${hits.join(
      ', ',
    )}\n` +
      `- Git URL 依存や侵害指標が混入している可能性があります。\n` +
      `- 対応: 依存更新を見直し、Git URL 参照を除去してから lockfile を更新してください。`,
  )
}

console.log('[supply-chain] OK: package-lock.json に禁止パターンは見つかりませんでした。')

