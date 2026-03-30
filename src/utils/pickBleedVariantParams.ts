import type { AttackBleedVariant, AttackConfig, AttackDebuffKind } from '../types/overlay'

export interface ResolvedBleedParams {
  damage: number
  durationSec: number
  intervalSec: number
  damageColor?: string
  debuffKind: AttackDebuffKind
}

const HEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

/**
 * 攻撃設定から持続ダメージ（DOT）1回分のパラメータを決定する。
 * bleedVariants に有効な行があればウェイト抽選、なければ bleedDamage / duration / interval を使用（種別は bleed）。
 */
export function pickBleedVariantParams(attack: AttackConfig): ResolvedBleedParams {
  const raw = attack.bleedVariants
  const variants = Array.isArray(raw)
    ? raw.filter(
        (v): v is AttackBleedVariant =>
          !!v &&
          typeof v.weight === 'number' &&
          v.weight > 0 &&
          typeof v.damage === 'number' &&
          v.damage >= 1 &&
          typeof v.duration === 'number' &&
          v.duration >= 1 &&
          typeof v.interval === 'number' &&
          v.interval >= 0.1
      )
    : []

  if (variants.length === 0) {
    return {
      damage: attack.bleedDamage,
      durationSec: attack.bleedDuration,
      intervalSec: attack.bleedInterval,
      debuffKind: 'bleed',
    }
  }

  const total = variants.reduce((s, v) => s + v.weight, 0)
  if (total <= 0) {
    return {
      damage: attack.bleedDamage,
      durationSec: attack.bleedDuration,
      intervalSec: attack.bleedInterval,
      debuffKind: 'bleed',
    }
  }

  let r = Math.random() * total
  for (const v of variants) {
    r -= v.weight
    if (r <= 0) {
      const c = v.damageColor?.trim()
      return {
        damage: v.damage,
        durationSec: v.duration,
        intervalSec: v.interval,
        damageColor: c && HEX.test(c) ? c : undefined,
        debuffKind: v.debuffKind ?? 'bleed',
      }
    }
  }
  const last = variants[variants.length - 1]!
  const c = last.damageColor?.trim()
  return {
    damage: last.damage,
    durationSec: last.duration,
    intervalSec: last.interval,
    damageColor: c && HEX.test(c) ? c : undefined,
    debuffKind: last.debuffKind ?? 'bleed',
  }
}
