/**
 * セキュリティ関連のユーティリティ関数
 */

/**
 * HTMLエスケープ（XSS対策）
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * URLが安全か検証（javascript:やdata:スキームを防ぐ）
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return true // 空文字列は許可

  try {
    const urlObj = new URL(url, window.location.origin)
    const scheme = urlObj.protocol.toLowerCase()

    // 許可するスキームのみ
    const allowedSchemes = ['http:', 'https:', 'data:image/']
    const isAllowed = allowedSchemes.some((allowed) => scheme.startsWith(allowed))

    if (!isAllowed) {
      return false
    }

    // javascript:やvbscript:などの危険なスキームを明示的に拒否
    const dangerousSchemes = ['javascript:', 'vbscript:', 'data:text/html', 'data:application/']
    const isDangerous = dangerousSchemes.some((dangerous) => scheme.startsWith(dangerous))

    return !isDangerous
  } catch {
    // 相対パスの場合は検証をスキップ（開発環境で使用される可能性がある）
    // ただし、javascript:などの危険な文字列が含まれていないかチェック
    const dangerousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      /on\w+\s*=/i, // onclick=, onerror= など
    ]

    return !dangerousPatterns.some((pattern) => pattern.test(url))
  }
}

/**
 * チャンネル名を検証（Twitchチャンネル名の形式）
 */
export function isValidChannelName(channel: string): boolean {
  if (!channel || channel.trim().length === 0) return false

  // #を削除
  const cleanChannel = channel.replace(/^#/, '').trim()

  // Twitchチャンネル名の規則: 4-25文字、英数字とアンダースコアのみ
  const channelPattern = /^[a-zA-Z0-9_]{4,25}$/
  return channelPattern.test(cleanChannel)
}

/**
 * 数値が指定範囲内か検証
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max
}

/**
 * 文字列の長さが指定範囲内か検証
 */
export function isValidLength(value: string, min: number, max: number): boolean {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

/**
 * 設定オブジェクトの検証（型チェックと値の検証）
 */
export function validateConfigStructure(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false

  // 基本的な構造チェック（詳細な検証は各設定項目で行う）
  return true
}
