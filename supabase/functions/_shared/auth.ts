import { createClient } from 'npm:@supabase/supabase-js@2'
import type { User } from 'npm:@supabase/supabase-js@2'

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return null

  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
