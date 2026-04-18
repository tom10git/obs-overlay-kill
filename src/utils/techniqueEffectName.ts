/** 合わせ技チャレンジの targetFull から技名部分だけを取り出す（開始時の接頭辞に一致する分を除去） */
export function techniqueNameFromComboTarget(targetFull: string, inputPrefix: string): string {
  if (inputPrefix && targetFull.startsWith(inputPrefix)) {
    return targetFull.slice(inputPrefix.length)
  }
  return targetFull
}
