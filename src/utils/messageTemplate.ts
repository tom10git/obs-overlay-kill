function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * {key} プレースホルダを values で一括置換する。
 */
export function fillTemplate(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  let result = template
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined) continue
    const pattern = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g')
    result = result.replace(pattern, String(raw))
  }
  return result
}
