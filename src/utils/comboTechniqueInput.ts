/**
 * 合わせ技入力: 1メッセージ内を先頭から順に照合し、不一致文字があってもマッチ済み位置は維持する。
 */

/**
 * 合わせ技入力の揺れを吸収するための簡易正規化。
 * - 「：」(全角) と「:」(半角) を同一扱いにする
 *
 * ※長さが変わる変換は `matchedLength` と表示がズレるので避ける。
 */
export function normalizeComboTechniqueText(s: string): string {
  // 文字長を維持したまま置換する
  return s.replace(/：/g, ':')
}

export function advanceComboTechniqueInput(
  targetFull: string,
  matchedLength: number,
  input: string
): { newMatchedLength: number; completed: boolean } {
  let i = matchedLength
  for (const ch of input) {
    if (i >= targetFull.length) break
    if (ch === targetFull[i]) {
      i += 1
    }
  }
  return {
    newMatchedLength: i,
    completed: i >= targetFull.length,
  }
}
