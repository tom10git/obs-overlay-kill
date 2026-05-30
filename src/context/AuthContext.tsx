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
import {
  completeAuthFromUrl,
  formatMagicLinkReturnError,
} from '../lib/completeAuthFromUrl'
import {
  fetchUserProfile,
  isProfileRegistrationComplete,
  saveUserDisplayName,
  validateDisplayName,
  type UserProfile,
} from '../lib/profileClient'
import { billingLog } from '../utils/billingLog'
import { formatAuthOtpError } from '../utils/authErrorMessage'
import {
  formatOtpCooldownWait,
  getOtpCooldownRemainingMs,
  isOtpRateLimitError,
  startOtpCooldownAfterRateLimit,
  startOtpCooldownAfterSuccess,
} from '../utils/otpSendCooldown'
import { setPendingSettingsTab } from '../utils/pendingSettingsTab'

const PENDING_DISPLAY_NAME_KEY = 'obs-overlay-pending-display-name'

type AuthContextValue = {
  configured: boolean
  session: Session | null
  user: User | null
  profile: UserProfile | null
  profileLoading: boolean
  registrationComplete: boolean
  loading: boolean
  signInWithEmail: (
    email: string,
    displayName?: string,
  ) => Promise<{ ok: boolean; message: string }>
  magicLinkError: string | null
  clearMagicLinkError: () => void
  saveDisplayName: (displayName: string) => Promise<{ ok: boolean; message: string }>
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient()
  const configured = isSupabaseConfigured()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [loading, setLoading] = useState(configured)
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session?.user) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    const row = await fetchUserProfile(supabase, session.user.id)
    setProfile(row)
    setProfileLoading(false)
  }, [supabase, session?.user])

  const applyPendingDisplayName = useCallback(
    async (userId: string) => {
      if (!supabase || typeof sessionStorage === 'undefined') return
      const pending = sessionStorage.getItem(PENDING_DISPLAY_NAME_KEY)?.trim()
      if (!pending) return

      const existing = await fetchUserProfile(supabase, userId)
      if (isProfileRegistrationComplete(existing)) {
        sessionStorage.removeItem(PENDING_DISPLAY_NAME_KEY)
        setProfile(existing)
        return
      }

      const saved = await saveUserDisplayName(supabase, userId, pending)
      sessionStorage.removeItem(PENDING_DISPLAY_NAME_KEY)
      if (saved.ok) {
        setProfile(await fetchUserProfile(supabase, userId))
      } else {
        billingLog('warn', 'Failed to apply pending display name', saved.message)
      }
    },
    [supabase],
  )

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    void (async () => {
      const fromUrl = await completeAuthFromUrl(supabase)
      if (fromUrl.handled && !fromUrl.ok && fromUrl.error) {
        setMagicLinkError(formatMagicLinkReturnError(fromUrl.error))
      }
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) setMagicLinkError(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    void (async () => {
      await applyPendingDisplayName(session.user.id)
      await refreshProfile()
    })()
  }, [session?.user?.id, applyPendingDisplayName, refreshProfile])

  const signInWithEmail = useCallback(
    async (email: string, displayName?: string) => {
      if (!supabase) {
        return { ok: false, message: '認証が設定されていません。' }
      }
      const trimmed = email.trim()
      if (!trimmed) {
        return { ok: false, message: 'メールアドレスを入力してください。' }
      }

      const cooldownMs = getOtpCooldownRemainingMs()
      if (cooldownMs > 0) {
        return {
          ok: false,
          message: `送信間隔を空けてください。あと ${formatOtpCooldownWait(cooldownMs)} 待ってから再試行できます。`,
        }
      }

      const nameRaw = displayName?.trim() ?? ''
      if (nameRaw) {
        const nameCheck = validateDisplayName(nameRaw)
        if (!nameCheck.ok) {
          return { ok: false, message: nameCheck.message }
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(PENDING_DISPLAY_NAME_KEY, nameCheck.value)
        }
      }

      setPendingSettingsTab('billing')
      const redirectTo = `${window.location.origin}/overlay`
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed.toLowerCase(),
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      })
      if (error) {
        billingLog('warn', 'Supabase OTP sign-in failed', error.message, error.status)
        if (isOtpRateLimitError(error.message, error.status)) {
          startOtpCooldownAfterRateLimit()
        }
        return {
          ok: false,
          message: formatAuthOtpError(error.message, error.status),
        }
      }
      startOtpCooldownAfterSuccess()
      return {
        ok: true,
        message:
          'メールにリンクを送信しました。届いたリンクを、このブラウザ（exe 起動中の PC）で開いてください。',
      }
    },
    [supabase],
  )

  const saveDisplayName = useCallback(
    async (displayName: string) => {
      if (!supabase || !session?.user) {
        return { ok: false, message: 'ログインしてください。' }
      }
      const result = await saveUserDisplayName(supabase, session.user.id, displayName)
      if (result.ok) {
        await refreshProfile()
        return { ok: true, message: 'ユーザー名を保存しました。' }
      }
      return { ok: false, message: result.message ?? '保存に失敗しました。' }
    },
    [supabase, session?.user, refreshProfile],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setProfile(null)
  }, [supabase])

  const clearMagicLinkError = useCallback(() => setMagicLinkError(null), [])

  const registrationComplete = isProfileRegistrationComplete(profile)

  const value = useMemo(
    () => ({
      configured,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      registrationComplete,
      loading,
      signInWithEmail,
      saveDisplayName,
      refreshProfile,
      signOut,
      magicLinkError,
      clearMagicLinkError,
    }),
    [
      configured,
      session,
      profile,
      profileLoading,
      registrationComplete,
      loading,
      signInWithEmail,
      saveDisplayName,
      refreshProfile,
      signOut,
      magicLinkError,
      clearMagicLinkError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
