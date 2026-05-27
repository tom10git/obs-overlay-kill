/**
 * 有料解放機能の定義（Stripe サブスク / 招待コード）
 */

export type PremiumFeatureId =
  | 'probabilities'
  | 'autoReply'
  | 'viewerSettings'
  | 'layoutFine'

/** 各PRO機能の月額（円）。機能ごとに変える場合は PREMIUM_FEATURES の priceJpy を指定 */
export const PREMIUM_FEATURE_PRICE_JPY = 100

export const PREMIUM_FEATURE_IDS: PremiumFeatureId[] = [
  'probabilities',
  'autoReply',
  'viewerSettings',
  'layoutFine',
]

export type PremiumFeatureMeta = {
  id: PremiumFeatureId
  shortLabel: string
  sectionTitle: string
  tooltip: string
  priceJpy?: number
}

export const PREMIUM_FEATURES: Record<PremiumFeatureId, PremiumFeatureMeta> = {
  probabilities: {
    id: 'probabilities',
    shortLabel: '確率・抽選',
    sectionTitle: '確率・抽選の調整',
    tooltip:
      'ミス・クリティカル・出血・合わせ技・ルーレット・PvP必殺技など、本番の抽選％を細かく調整します（カスタムリワード連携は無料のままです）。',
  },
  autoReply: {
    id: 'autoReply',
    shortLabel: '自動返信',
    sectionTitle: 'チャット自動返信',
    tooltip:
      '攻撃・回復・HP確認・バフなどのタイミングで、テンプレートに沿った返信をチャットへ送ります。',
  },
  viewerSettings: {
    id: 'viewerSettings',
    shortLabel: '対人（視聴者）',
    sectionTitle: '視聴者対人・PvP設定',
    tooltip:
      '視聴者同士の攻撃、配信者へのコマンド、必殺技、バフ、視聴者HPなど対人プレイ用の設定一式です。',
  },
  layoutFine: {
    id: 'layoutFine',
    shortLabel: '表示位置',
    sectionTitle: '表示位置の微調整',
    tooltip:
      'HPゲージ・ルーレット・合わせ技・HP0画像・WebMなどの座標・サイズ・オフセットをピクセル単位で調整します。',
  },
}

export function getPremiumFeaturePriceJpy(id: PremiumFeatureId): number {
  const custom = PREMIUM_FEATURES[id].priceJpy
  return typeof custom === 'number' && custom > 0
    ? custom
    : PREMIUM_FEATURE_PRICE_JPY
}

export function getPremiumBundlePriceJpy(): number {
  return PREMIUM_FEATURE_IDS.reduce(
    (sum, id) => sum + getPremiumFeaturePriceJpy(id),
    0,
  )
}

export function formatPremiumBundlePriceBreakdown(): string {
  const parts = PREMIUM_FEATURE_IDS.map(
    (id) => `${getPremiumFeaturePriceJpy(id)}円`,
  )
  const allSame = parts.every((p) => p === parts[0])
  const total = getPremiumBundlePriceJpy()
  if (allSame && PREMIUM_FEATURE_IDS.length > 0) {
    return `${parts[0]}×${PREMIUM_FEATURE_IDS.length}機能＝${total}円`
  }
  return `${parts.join('＋')}＝${total}円`
}

/** 開発用: 課金なしで全PRO機能を使える */
export function isDevUnlockAllEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_UNLOCK_DEV_ALL === 'true'
}
