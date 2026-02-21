/** コマンド一致判定（完全一致 / 先頭一致 + 区切り） */
export function isCommandMatch(messageLower: string, command: string): boolean {
  const normalized = command.toLowerCase().trim()
  if (!normalized) return false
  return (
    messageLower === normalized ||
    messageLower.startsWith(normalized + ' ') ||
    messageLower.startsWith(normalized + '\n') ||
    messageLower.startsWith(normalized + '\t')
  )
}
