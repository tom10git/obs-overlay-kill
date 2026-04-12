/**
 * 合わせ技入力: 1メッセージ内を先頭から順に照合し、不一致文字があってもマッチ済み位置は維持する。
 */

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
