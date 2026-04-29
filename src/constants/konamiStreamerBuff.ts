/**
 * チャットで「コナミコード」相当の文字列を送ると配信者に一時バフが付与される仕様。
 * 数値の復元は配信者 HP が 0 になったタイミングで行う。
 */

/** Twitch チャットで一致させる文字列（絵文字除去後の本文トリムと一致） */
export const KONAMI_STREAMER_BUFF_CHAT_CODE = '↑↑↓↓←→→→BA'

/** 配信者 HP 最大・現在、および配信者→視聴者ダメージ設定に掛ける倍率 */
export const KONAMI_STREAMER_BUFF_STAT_MULTIPLIER = 7.5

/**
 * 視聴者必殺が配信者に与えるダメージ: 通常は現 HP の 50%。
 * バフ中は「削り後に約 70% の HP が残る」＝現 HP の 30% 相当のダメージに変更（50% 刻みを 70% 生存へ緩和）。
 */
export const KONAMI_STREAMER_FINISHING_REMAIN_HP_FRACTION = 0.3

/** カワイソウニ HP ドットの間隔（バフ中のみ 1 秒。通常は kawaiiSouniTechnique の定数） */
export const KONAMI_STREAMER_BUFF_KAWAI_SOUNI_DRAIN_INTERVAL_MS = 1_000

export function isKonamiStreamerBuffChatMessage(text: string): boolean {
  const t = text.trim().normalize('NFKC')
  const code = KONAMI_STREAMER_BUFF_CHAT_CODE
  if (t === code) return true
  if (t.length === code.length && t.slice(0, -2) === code.slice(0, -2) && t.slice(-2).toUpperCase() === 'BA') {
    return true
  }
  return false
}

export function scaleKonamiBuffedStat(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value * KONAMI_STREAMER_BUFF_STAT_MULTIPLIER))
}

/** 必殺: 現 HP に対するダメージ割合（最低 1） */
export function streamerFinishingMoveDamageFraction(konamiBuffActive: boolean): number {
  if (konamiBuffActive) return 1 - KONAMI_STREAMER_FINISHING_REMAIN_HP_FRACTION
  return 0.5
}
