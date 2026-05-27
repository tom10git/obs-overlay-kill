/**
 * AppData（または開発時のリポジトリ）の customTechniqueNames.ts を読み込み、技名プールへ反映
 */

import { applyCustomTechniqueNameLists } from '../constants/comboTechniqueNames'
import type { CustomTechniqueNameLists } from './parseCustomTechniqueNames'

export type CustomTechniqueNamesLoadResult = {
  success: boolean
  source?: 'userData' | 'repo' | 'bundled'
  path?: string
  names?: CustomTechniqueNameLists
}

export async function loadAndApplyCustomTechniqueNames(): Promise<CustomTechniqueNamesLoadResult> {
  try {
    const res = await fetch('/api/custom-technique-names/load', { cache: 'no-store' })
    if (!res.ok) {
      return { success: false }
    }
    const json = (await res.json()) as CustomTechniqueNamesLoadResult & {
      error?: string
    }
    if (!json.success || !json.names) {
      return { success: false }
    }
    applyCustomTechniqueNameLists(json.names)
    return json
  } catch {
    return { success: false }
  }
}
