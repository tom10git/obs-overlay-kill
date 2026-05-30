#!/usr/bin/env node
/**
 * 招待コードを DB に一括登録（Supabase admin-create-invites）
 *
 * 使い方:
 *   .env に BILLING_ADMIN_SECRET と VITE_SUPABASE_URL を設定
 *   scripts\create-invites.bat
 *
 * 出力: created-invites-<timestamp>.json（平文トークンはこのファイルのみ）
 *
 * ※ Supabase Auth からのメール送信は行いません（invite_tokens への DB 登録のみ）。
 *    ユーザーへの通知は token を手渡し。ログイン用メールは配信者が課金タブで「リンクを送信」したときのみ。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadLocalEnv(resolve(projectRoot, '.env'))

function loadLocalEnv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key === 'BILLING_ADMIN_SECRET' && !process.env.BILLING_ADMIN_SECRET) {
      process.env.BILLING_ADMIN_SECRET = val
    }
    if (key === 'SUPABASE_URL' && !process.env.SUPABASE_URL) {
      process.env.SUPABASE_URL = val
    }
    if (key === 'VITE_SUPABASE_URL' && !process.env.VITE_SUPABASE_URL) {
      process.env.VITE_SUPABASE_URL = val
    }
  }
}

async function main() {
  const secret = process.env.BILLING_ADMIN_SECRET?.trim()
  const base =
    process.env.SUPABASE_URL?.trim().replace(/\/$/, '') ||
    process.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '')

  const fileArg = process.argv[2]
  if (!secret || !base || !fileArg) {
    console.error('')
    if (!secret) {
      console.error('BILLING_ADMIN_SECRET がありません。')
      console.error('')
      console.error('1) Supabase に登録（まだなら）:')
      console.error('   Dashboard → Edge Functions → Secrets')
      console.error('   名前 BILLING_ADMIN_SECRET / 値は推測されない長い文字列')
      console.error('')
      console.error('2) プロジェクトの .env に同じ文字列を1行追加:')
      console.error('   BILLING_ADMIN_SECRET=あなたがSupabaseに入れた文字列')
      console.error('')
      console.error('3) scripts\\create-invites.bat を再実行')
    }
    if (!base) {
      console.error('SUPABASE_URL がありません。.env に VITE_SUPABASE_URL=... を入れてください。')
    }
    if (!fileArg) {
      console.error('JSON ファイルを指定してください。例: scripts\\billing-invites.json')
    }
    return 1
  }

  const file = resolve(process.cwd(), fileArg)
  if (!existsSync(file)) {
    console.error(`JSON が見つかりません: ${file}`)
    console.error('今のフォルダ:', process.cwd())
    return 1
  }

  const payload = JSON.parse(readFileSync(file, 'utf8'))
  const url = `${base}/functions/v1/admin-create-invites`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Billing-Admin-Secret': secret,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Failed', res.status, data)
    if (res.status === 404) {
      console.error('')
      console.error('admin-create-invites が Supabase に未デプロイです。')
      console.error('  npx supabase login')
      console.error('  scripts\\deploy-billing-functions.bat')
      console.error('詳細: docs/BILLING.md')
    }
    return 1
  }

  const out = resolve(process.cwd(), `created-invites-${Date.now()}.json`)
  writeFileSync(out, JSON.stringify(data, null, 2), 'utf8')
  const skipped = data.skipped?.length ?? 0
  console.log(
    `OK: ${data.created?.length ?? 0} created, ${skipped} skipped (既存), ${data.errors?.length ?? 0} errors`,
  )
  if (skipped > 0) {
    for (const row of data.skipped ?? []) {
      const email = row.allowedEmail ?? '(no email)'
      const reason = row.reason === 'duplicate_in_batch' ? 'JSON内の重複' : 'DBに既存'
      console.log(`  skip [${reason}] ${email} id=${row.id || '—'}`)
    }
    console.log('  既存ユーザーの token は再発行されません。初回の created-invites-*.json を保管してください。')
  }
  console.log(`Tokens saved to ${out} (keep private)`)
  console.log('（create-invites は Supabase からメールを送りません。token は DM 等で手渡ししてください）')
  return 0
}

const code = await main()
process.exitCode = code
