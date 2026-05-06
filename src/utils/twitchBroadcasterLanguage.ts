/**
 * Helix の broadcaster_language（ISO 639-1 等）を日本語表示用に整形。
 * Twitch は国・地域コードを返さないため、言語名のみ表示する。
 */
export function formatBroadcasterLanguage(code: string | undefined | null): string {
  const raw = (code || '').trim()
  if (!raw) return '—'

  const primary = raw.split(/[-_]/)[0]?.toLowerCase() || raw.toLowerCase()

  try {
    const dn = new Intl.DisplayNames(['ja'], { type: 'language' })
    let name = dn.of(raw.toLowerCase())
    if (!name || name.toLowerCase() === raw.toLowerCase()) {
      name = dn.of(primary)
    }
    if (name && name.toLowerCase() !== primary) {
      return raw.toLowerCase() === primary ? `${name}（${primary}）` : `${name}（${raw}）`
    }
  } catch {
    /* Intl が無効なコードのときは下へ */
  }

  return raw
}
