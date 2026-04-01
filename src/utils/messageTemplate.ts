function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * チャット向けの効果時間表記。60秒未満は「N秒」、60秒以上は最寄りの「N分」。
 */
export function formatStrengthBuffDurationHumanJa(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds)) || 0)
  if (s < 60) {
    return `${s}秒`
  }
  const minutes = Math.max(1, Math.round(s / 60))
  return `${minutes}分`
}

/**
 * ストレングスバフ系メッセージで、分用プレースホルダの直後に「秒」と書くと
 * （例: {duration_minutes}秒）分への丸め整数が秒として表示されるため、秒用に差し替える。
 */
export function sanitizeStrengthBuffChatTemplates(template: string): string {
  return template
    .replace(/\{duration_minutes\}\s*秒/g, '{duration}秒')
    .replace(/\{remaining_minutes\}\s*秒/g, '{remaining}秒')
}

/**
 * {key} プレースホルダを values で一括置換する。
 * キーは長い順に置換する（{duration} が {duration_minutes} の一部と誤一致しないなど）。
 */
export function fillTemplate(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  let result = template
  const entries = Object.entries(values).filter(([, raw]) => raw !== undefined) as [string, string | number][]
  entries.sort((a, b) => b[0].length - a[0].length)
  for (const [key, raw] of entries) {
    const pattern = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g')
    result = result.replace(pattern, String(raw))
  }
  return result
}
