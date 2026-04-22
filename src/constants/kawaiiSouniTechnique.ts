/**
 * 合わせ技／ルーレットの技名「カワイソウニ」専用の HP ドット効果。
 * 成功後、一定間隔で 1 ずつ減らし、配信者 HP がこの値になったらそれ以上は減らさない。
 * 解除: 配信者がヒールを CONSECUTIVE_HEALS_TO_CLEAR 回連続で成功（間にダメージが入るとカウントリセット）。
 */
export const KAWAI_SOUNI_TECHNIQUE_NAME = 'カワイソウニ'

/** ドット間隔（ミリ秒） */
export const KAWAI_SOUNI_DRAIN_INTERVAL_MS = 10_000

/** この HP 以下になったらドットを打たない（この値のまま維持） */
export const KAWAI_SOUNI_DRAIN_STOP_AT_HP = 2

/** デバフ解除に必要な配信者ヒールの連続回数（この間にダメージを受けるとカウントリセット） */
export const KAWAI_SOUNI_CONSECUTIVE_HEALS_TO_CLEAR = 3

export function isKawaiiSouniTechniqueName(name: string): boolean {
  return name.trim() === KAWAI_SOUNI_TECHNIQUE_NAME
}
