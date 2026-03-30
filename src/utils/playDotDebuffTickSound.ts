import type { AttackConfig, AttackDebuffKind } from '../types/overlay'

export interface DotDebuffSoundPlayers {
  playBleed: () => void
  playPoison: () => void
  playBurn: () => void
}

/**
 * 攻撃設定と DOT 種別に応じてティック用効果音を1回再生する。
 * 各種別は「有効かつ URL が非空」のときのみ再生（それ以外は無音）。
 */
export function playDotDebuffTickSound(
  attack: AttackConfig,
  kind: AttackDebuffKind,
  players: DotDebuffSoundPlayers
): void {
  switch (kind) {
    case 'poison':
      if (attack.dotPoisonSoundEnabled && attack.dotPoisonSoundUrl?.trim()) {
        players.playPoison()
      }
      break
    case 'burn':
      if (attack.dotBurnSoundEnabled && attack.dotBurnSoundUrl?.trim()) {
        players.playBurn()
      }
      break
    default:
      if (attack.bleedSoundEnabled && attack.bleedSoundUrl?.trim()) {
        players.playBleed()
      }
  }
}
