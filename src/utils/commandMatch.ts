/** コマンド一致判定（完全一致 / 先頭一致 + 区切り） */
export function isCommandMatch(messageLower: string, command: string): boolean {
  const normalized = command.toLowerCase().trim()
  if (!normalized) return false
  if (messageLower === normalized) return true
  if (!messageLower.startsWith(normalized)) return false

  // コマンドのあとに何か続く場合は「空白文字」で区切られているときだけ一致扱いにする。
  // 例: "!attack Bob" / "攻撃 Bob"（全角スペース等）など、Unicode whitespace を許可する。
  const nextChar = messageLower.slice(normalized.length, normalized.length + 1)
  return nextChar.length > 0 && /\s/u.test(nextChar)
}
