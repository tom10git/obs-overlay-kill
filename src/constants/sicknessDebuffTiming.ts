/**
 * 体調不良デバフのタイミング（ここを編集して挙動を調整）
 */

export const sicknessDebuffTiming = {
  /** 最大HP → 1/2 まで落ちる所要時間（ms・線形） */
  dropMs: 170_000,

  /** 1/2 到達後、自然回復が始まるまでの待ち（「再開」までの時間の中心になる） */
  waitRegenAfterHalfMs: 5_000,

  /** デバフ中の連続被ダメージで自然回復が止まったあと、再開するまでの待ち（ms） */
  waitRegenAfterDamageMs: 1_200,

  /** デバフ落下（継続ダメージ）中に被ダメを受けたとき、落下を再開するまでの待ち（ms） */
  waitDropResumeAfterDamageMs: 5_000,

  /** 落下（継続減少）を一時停止する被ダメ量の下限（DOTの小刻みtickで止まり続けるのを防ぐ） */
  dropPauseMinDamage: 1_000,

  /** true: 被ダメのたびに落下停止を延長（最後の被ダメ基準で再開）。false: 最初の被ダメから一定時間で再開（延長しない） */
  dropPauseExtendOnEachDamage: false,

  /** 落下（継続減少）を被ダメで一時停止するか */
  dropPauseEnabled: true,

  /** 自然回復フェーズ：1秒あたりの HP 回復量 */
  regenHpPerSecond: 90.35,
}

export type SicknessDebuffTiming = typeof sicknessDebuffTiming
