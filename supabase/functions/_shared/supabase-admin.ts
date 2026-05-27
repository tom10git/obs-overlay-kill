import { createClient } from 'npm:@supabase/supabase-js@2'

export function createSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase admin env missing')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
