const COOLDOWN_KEY = 'obs-overlay-otp-cooldown-until'
const SUCCESS_COOLDOWN_MS = 60_000
const RATE_LIMIT_COOLDOWN_MS = 15 * 60_000

export function getOtpCooldownRemainingMs(): number {
  if (typeof sessionStorage === 'undefined') return 0
  const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0)
  return Math.max(0, until - Date.now())
}

export function startOtpCooldownAfterSuccess(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + SUCCESS_COOLDOWN_MS))
}

export function startOtpCooldownAfterRateLimit(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + RATE_LIMIT_COOLDOWN_MS))
}

export function isOtpRateLimitError(message: string, status?: number): boolean {
  return status === 429 || message.toLowerCase().includes('rate limit')
}

export function formatOtpCooldownWait(ms: number): string {
  const sec = Math.ceil(ms / 1000)
  if (sec >= 60) {
    const min = Math.ceil(sec / 60)
    return `約 ${min} 分`
  }
  return `${sec} 秒`
}
