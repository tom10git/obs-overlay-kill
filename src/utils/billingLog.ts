import { logger } from '../lib/logger'

const PREFIX = '[billing]'

/** 課金の詳細（設定・検証・ブロック理由など）。UIには出さない。 */
export function billingLog(
  level: 'debug' | 'warn' | 'error',
  message: string,
  detail?: unknown,
): void {
  const line = `${PREFIX} ${message}`
  if (detail !== undefined) {
    logger[level](line, detail)
  } else {
    logger[level](line)
  }
}

/** ユーザー向けの固定メッセージ（詳細なし） */
export const BILLING_USER_ERROR = '処理できませんでした。'
export const BILLING_USER_OK = '反映しました。'
