#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
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
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

const url = process.env.VITE_SUPABASE_URL?.trim()
const anon = process.env.VITE_SUPABASE_ANON_KEY?.trim()
const testEmail = process.argv[2]?.trim() || 'otp-diagnostic@example.com'

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(2)
}

const supabase = createClient(url, anon)
console.log('Supabase URL:', url.replace(/^(https:\/\/)[^.]+/, '$1***'))
console.log('Test email:', testEmail)
console.log('')

for (const origin of [
  'http://localhost:4173/overlay',
  'http://localhost:5173/overlay',
  'http://127.0.0.1:4173/overlay',
]) {
  const { error } = await supabase.auth.signInWithOtp({
    email: testEmail,
    options: { emailRedirectTo: origin },
  })
  console.log(
    origin,
    '→',
    error ? `ERROR: ${error.message} (${error.status ?? '?'})` : 'OK',
  )
}
