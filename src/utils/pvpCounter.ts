import type { OverlayConfig } from '../types/overlay'

/**
 * 視聴者が配信者を攻撃し、自動カウンターが発動する攻撃かどうか。
 * このとき合わせ技・追加攻撃ルーレットは配信者向けオーバーレイ攻撃用のため抽選しない。
 */
export function isViewerAttackWithPvpAutoCounter(
  config: OverlayConfig | null | undefined,
  attackerUserId: string | undefined,
  broadcasterId: string | undefined
): boolean {
  if (!config?.pvp?.enabled || !attackerUserId) return false
  if (!config.pvp.counterOnAttackTargetAttacker && !config.pvp.counterOnAttackTargetRandom) {
    return false
  }
  if (attackerUserId === 'test-user') return false
  if (broadcasterId && attackerUserId === broadcasterId) return false
  return true
}
