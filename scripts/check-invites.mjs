#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
    if (!process.env[key]) process.env[key] = val
  }
}

const secret = process.env.BILLING_ADMIN_SECRET?.trim()
const base = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/$/, '')

if (!secret || !base) {
  console.error('Need BILLING_ADMIN_SECRET and VITE_SUPABASE_URL in .env')
  process.exit(2)
}

const res = await fetch(`${base}/functions/v1/admin-list-invites`, {
  headers: { 'X-Billing-Admin-Secret': secret },
})
const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Failed', res.status, data)
  process.exit(1)
}

const want = new Set(['Adelaide', '星奈みーにゃ様'])
const hits = (data.invites ?? []).filter((i) => want.has(i.label))
console.log(`DB上の招待総数: ${data.count ?? 0}`)
console.log(`billing-invites.json の2件（ラベル一致）: ${hits.length}/2`)
for (const i of hits) {
  console.log(
    `- ${i.label}: id=${i.id} feature=${i.featureId} emailBound=${Boolean(i.emailBound)} revoked=${Boolean(i.revokedAt)} used=${i.redemptionCount ?? 0}`,
  )
}
