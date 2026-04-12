/** 通常攻撃後のルーレット追加攻撃（合わせ技とは別ロジック・技名リストのみ共有） */

import { HP_GAUGE_TOP_BAND_GAP_PX } from './hpGaugeOverlay'

/** 通常攻撃ヒット後にルーレット演出を出す確率 */
export const ROULETTE_BONUS_TRIGGER_PROBABILITY = 0.4

/** ルーレットが成功扱いになる確率（演出終了時の判定） */
export const ROULETTE_BONUS_SUCCESS_PROBABILITY = 0.5

/** スピンアニメーション時間（ms）— イージングは CSS cubic-bezier で指定 */
export const ROULETTE_BONUS_SPIN_MS = 2100

/** 成功／失敗テキスト表示の滞留時間（ms） */
export const ROULETTE_BONUS_RESULT_HOLD_MS = 1900

/** 1行の高さ（px）— ストリップの刻み。CSS と一致させる */
export const ROULETTE_BONUS_ROW_HEIGHT_PX = 22

/**
 * ルーレット窓の高さ（px）— おおよそ 1.5 行分で上下に隣行がわずかに見える
 * （ROW_HEIGHT の 1.5 倍に合わせること）
 */
export const ROULETTE_BONUS_VIEWPORT_HEIGHT_PX = 33

/** ストリップ上の失敗マス表示文言（技名リストと重複しないこと） */
export const ROULETTE_STRIP_FAIL_LABEL = '失敗'

/** HPゲージフレーム上端とルーレット下端のあいだ（px）。config.hp の位置に追従 */
export const ROULETTE_BONUS_GAP_ABOVE_GAUGE_PX = HP_GAUGE_TOP_BAND_GAP_PX
