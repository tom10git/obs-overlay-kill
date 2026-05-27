export const PREMIUM_FEATURE_IDS = [
  'probabilities',
  'autoReply',
  'viewerSettings',
  'layoutFine',
] as const

export type PremiumFeatureId = (typeof PREMIUM_FEATURE_IDS)[number]

export type BillingTarget = PremiumFeatureId | 'all'

export function isBillingTarget(value: string): value is BillingTarget {
  return (
    value === 'all' ||
    (PREMIUM_FEATURE_IDS as readonly string[]).includes(value)
  )
}

export function expandFeatureEntitlements(
  featureId: BillingTarget,
): PremiumFeatureId[] {
  if (featureId === 'all') return [...PREMIUM_FEATURE_IDS]
  return [featureId]
}
