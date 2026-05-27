import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url?.trim() || !anon?.trim()) return null
  if (!client) {
    client = createClient(url.trim(), anon.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null
}
