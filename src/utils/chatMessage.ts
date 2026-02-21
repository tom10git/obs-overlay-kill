/**
 * チャットメッセージの正規化（コマンド判定用）
 * Twitch のスタンプ（emote）を除去した文字列を返し、スタンプ付きメッセージでもコマンドが実行されるようにする。
 */

import type { TwitchChatMessage } from '../types/twitch'

/** 1つの emote の位置情報 */
export type EmotePosition = { start: number; end: number }

/**
 * メッセージから Twitch スタンプの範囲を除去し、その部分をスペースに置き換えた文字列を返す。
 * コマンド判定ではこの正規化済み文字列を使うことで、「!attack Kappa」のようにスタンプが含まれていても実行される。
 */
export function stripEmotesFromMessage(
  message: string,
  emotes?: TwitchChatMessage['emotes']
): string {
  if (!emotes || emotes.length === 0) return message

  const ranges: EmotePosition[] = []
  for (const emote of emotes) {
    for (const pos of emote.positions) {
      ranges.push({ start: pos.start, end: pos.end })
    }
  }
  ranges.sort((a, b) => a.start - b.start)

  let result = ''
  let lastEnd = -1
  for (const r of ranges) {
    if (r.start > lastEnd + 1) {
      result += message.slice(lastEnd + 1, r.start)
    }
    result += ' '
    lastEnd = r.end
  }
  if (lastEnd < message.length - 1) {
    result += message.slice(lastEnd + 1)
  }
  return result
}
