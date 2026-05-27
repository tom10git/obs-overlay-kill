import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { billingLog } from '../utils/billingLog'

type AuthContextValue = {
  configured: boolean
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ ok: boolean; message: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient()
  const configured = isSupabaseConfigured()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) {
        return { ok: false, message: '認証が設定されていません。' }
      }
      const trimmed = email.trim()
      if (!trimmed) {
        return { ok: false, message: 'メールアドレスを入力してください。' }
      }
      const redirectTo = `${window.location.origin}/overlay?settingsTab=billing`
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) {
        billingLog('warn', 'Supabase OTP sign-in failed', error.message)
        return { ok: false, message: 'ログインリンクを送信できませんでした。' }
      }
      return {
        ok: true,
        message: 'メールにログインリンクを送信しました。',
      }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [supabase])

  const value = useMemo(
    () => ({
      configured,
      session,
      user: session?.user ?? null,
      loading,
      signInWithEmail,
      signOut,
    }),
    [configured, session, loading, signInWithEmail, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
