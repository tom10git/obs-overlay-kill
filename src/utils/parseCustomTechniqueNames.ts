/**
 * AppData の customTechniqueNames.ts 本文をブラウザ側で解析（API が raw を返す場合のフォールバック）
 */

export type CustomTechniqueNameLists = {
  slash: string[]
  magic: string[]
  shooting: string[]
}

const ARRAY_EXPORTS: [string, keyof CustomTechniqueNameLists][] = [
  ['CUSTOM_SLASH_TECHNIQUE_NAMES', 'slash'],
  ['CUSTOM_MAGIC_TECHNIQUE_NAMES', 'magic'],
  ['CUSTOM_SHOOTING_TECHNIQUE_NAMES', 'shooting'],
]

export function parseCustomTechniqueNamesTs(content: string): CustomTechniqueNameLists {
  const names: CustomTechniqueNameLists = { slash: [], magic: [], shooting: [] }
  for (const [exportName, key] of ARRAY_EXPORTS) {
    const re = new RegExp(
      `export\\s+const\\s+${exportName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`,
      'm',
    )
    const m = content.match(re)
    if (!m?.[1]) continue
    const body = m[1]
    const seen = new Set<string>()
    for (const sm of body.matchAll(/['"]([^'"]+)['"]/g)) {
      const s = sm[1].trim()
      if (!s || seen.has(s)) continue
      seen.add(s)
      names[key].push(s)
    }
  }
  return names
}
