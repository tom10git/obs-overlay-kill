/** 合わせ技チャレンジの targetFull から技名部分だけを取り出す（開始時の接頭辞に一致する分を除去） */
export function techniqueNameFromComboTarget(targetFull: string, inputPrefix: string): string {
  // 「：」/「:」ゆらぎを吸収（長さは同一のため slice のインデックスは保持される）
  const normTarget = targetFull.replace(/：/g, ':')
  const normPrefix = inputPrefix.replace(/：/g, ':')
  if (normPrefix && normTarget.startsWith(normPrefix)) {
    return targetFull.slice(inputPrefix.length)
  }
  return targetFull
}
