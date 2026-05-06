/**
 * 体調不良デバフ（仕様整理）
 * - 発動: 最大HP時の連続回復が決まった回数に達したとき（registerHealStreak）。
 * - 落下: 発動時点の現在HPから「その値の1/2」まで演出で落とす。落下中・回復中の攻撃は reduceHP でそのまま反映。
 * - 回復上限 cap: デバフ開始時は maxHp。デバフ中に受けたダメージ分だけ notifyStreamerDamage が cap を減らす（攻撃・出血DOT 等は reduceHPTracked 経由で同じ量が渡る）。
 * - 自然回復: cap まで徐々に回復。回復で cap に達したときだけデバフ終了。
 * - waitRegenAfterHalfMs: 「半分ライン到達後」から自然回復を始めるまでの待ちだけ。攻撃のたびに待ちを足さない（疲労からの再開は即 regen）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { OverlayConfig } from '../types/overlay'
import { sicknessDebuffTiming } from '../constants/sicknessDebuffTiming'

type ConfigPatch = Partial<Omit<OverlayConfig, 'hp'>> & {
  hp?: Partial<OverlayConfig['hp']>
}

type Phase = 'idle' | 'dropping' | 'waiting' | 'regen' | 'regen_exhausted'

export interface UseSicknessDebuffOptions {
  updateConfigLocal: (patch: ConfigPatch) => void
  /** useHPGauge.hpCurrentSyncRef（再レンダー前に更新・演出がダメージを食い消さない） */
  streamerHpSyncRef: MutableRefObject<number>
  currentHP: number
}

export interface UseSicknessDebuffResult {
  dialogueVisible: boolean
  /** 配信者が回復した直前のHPが max なら連続カウント。それ未満ならリセット */
  registerHealStreak: (hpBeforeHeal: number, maxHp: number) => void
  /** 配信者がダメージを受けた量（reduceHP に渡す量）。デバフ中のみ回復上限を下げる */
  notifyStreamerDamageDuringSickness: (amount: number) => void
  cancelSickness: () => void
}

export function useSicknessDebuff({
  updateConfigLocal,
  streamerHpSyncRef,
  currentHP,
}: UseSicknessDebuffOptions): UseSicknessDebuffResult {
  const phaseRef = useRef<Phase>('idle')
  const streakRef = useRef(0)
  const regenCapRef = useRef(0)
  const generationRef = useRef(0)
  const dropRafRef = useRef<number | null>(null)
  const regenRafRef = useRef<number | null>(null)
  const waitTimerRef = useRef<number | null>(null)
  const dropStartHpRef = useRef(0)
  const dropTargetHpRef = useRef(0)
  /** 落下（継続減少）の経過時間（停止を除外した累積） */
  const dropElapsedMsRef = useRef(0)
  const dropLastNowRef = useRef<number | null>(null)
  /** 落下（継続ダメージ）を被ダメで一時停止するための時刻管理 */
  const dropPauseUntilRef = useRef<number | null>(null)
  const dropPausedAtRef = useRef<number | null>(null)
  /** pause解除後に「落下が進んだ最初のフレーム」を1回だけログする */
  const dropJustResumedRef = useRef(false)
  /** pause解除後に「見た目としてHPが減り始めた瞬間」を1回だけログする */
  const dropVisibleResumePendingRef = useRef(false)
  const dropLastClampedRef = useRef<number | null>(null)
  /** HP が debuff 目標（最大の1/2）以下に到達してからの待機→回復を既に開始したか */
  const halfCrossScheduleDoneRef = useRef(false)
  /** この体調不良（generation）で「半分後の待機→回復」タイマーを既に積んだか（再呼び出しで待ち時間が延びないようにする） */
  const waitRegenScheduledGenRef = useRef<number | null>(null)
  /** regen_exhausted（被ダメで停止）からの「再開待ち」タイマーが張られている generation（連続被ダメで再武装する） */
  const waitRegenAfterDamageScheduledGenRef = useRef<number | null>(null)
  const regenLastNowRef = useRef<number | null>(null)
  const regenCarryRef = useRef(0)

  const [dialogueVisible, setDialogueVisible] = useState(false)

  const clearAnim = useCallback(() => {
    if (dropRafRef.current != null) {
      cancelAnimationFrame(dropRafRef.current)
      dropRafRef.current = null
    }
    if (regenRafRef.current != null) {
      cancelAnimationFrame(regenRafRef.current)
      regenRafRef.current = null
    }
    if (waitTimerRef.current != null) {
      window.clearTimeout(waitTimerRef.current)
      waitTimerRef.current = null
    }
    regenLastNowRef.current = null
    regenCarryRef.current = 0
    dropElapsedMsRef.current = 0
    dropLastNowRef.current = null
    dropPauseUntilRef.current = null
    dropPausedAtRef.current = null
    dropJustResumedRef.current = false
    dropVisibleResumePendingRef.current = false
    dropLastClampedRef.current = null
    halfCrossScheduleDoneRef.current = false
    waitRegenScheduledGenRef.current = null
  }, [])

  const endDebuff = useCallback(() => {
    generationRef.current += 1
    clearAnim()
    phaseRef.current = 'idle'
    streakRef.current = 0
    setDialogueVisible(false)
  }, [clearAnim])

  const startRegenLoop = useCallback(
    (gen: number) => {
      if (generationRef.current !== gen) return
      if (regenRafRef.current != null) return
      phaseRef.current = 'regen'
      regenLastNowRef.current = null
      regenCarryRef.current = 0
      const tick = (now: number) => {
        if (generationRef.current !== gen) return
        if (phaseRef.current !== 'regen') return
        const cur = streamerHpSyncRef.current
        const cap = regenCapRef.current
        if (cur <= 0) {
          endDebuff()
          return
        }
        // cap が 0 以下でも HP が残っているのは「回復上限切れ」。全体験終了にしない（cur>=cap 誤判定も防ぐ）
        if (cap <= 0) {
          phaseRef.current = 'regen_exhausted'
          regenRafRef.current = null
          return
        }
        // ここで cur >= cap のとき「終了」にしない。攻撃で cap が下がり cur===cap になっただけだと誤ってデバフが消える。
        // 上限張り付き・外からの回復で cur>cap は cap に揃え、自然回復だけ止めて台詞は継続。
        if (cur >= cap) {
          if (cur > cap) {
            updateConfigLocal({ hp: { current: cap } })
          }
          phaseRef.current = 'regen_exhausted'
          regenRafRef.current = null
          return
        }
        if (regenLastNowRef.current === null) {
          regenLastNowRef.current = now
        }
        const dt = Math.min(64, Math.max(0, now - regenLastNowRef.current))
        regenLastNowRef.current = now
        regenCarryRef.current += sicknessDebuffTiming.regenHpPerSecond * (dt / 1000)
        let add = Math.floor(regenCarryRef.current)
        regenCarryRef.current -= add
        if (add < 1) {
          regenRafRef.current = requestAnimationFrame(tick)
          return
        }
        const clamped = Math.min(cap, cur + add)
        // 自然回復で上限に到達したときだけデバフ終了（攻撃起因の cur>=cap は上で処理済み）
        if (clamped >= cap) {
          updateConfigLocal({ hp: { current: cap } })
          endDebuff()
          return
        }
        updateConfigLocal({ hp: { current: clamped } })
        regenRafRef.current = requestAnimationFrame(tick)
      }
      regenRafRef.current = requestAnimationFrame(tick)
    },
    [endDebuff, updateConfigLocal]
  )

  const scheduleWaitThenRegen = useCallback(
    (gen: number) => {
      const skipDup = waitRegenScheduledGenRef.current === gen
      if (skipDup) {
        return
      }
      waitRegenScheduledGenRef.current = gen
      if (waitTimerRef.current != null) {
        window.clearTimeout(waitTimerRef.current)
        waitTimerRef.current = null
      }
      phaseRef.current = 'waiting'
      waitTimerRef.current = window.setTimeout(() => {
        waitTimerRef.current = null
        // 半分後待機が完了したら、同一 generation で再度 schedule Wait できるようにする（疲労→再開など）
        waitRegenScheduledGenRef.current = null
        if (generationRef.current !== gen) return
        if (streamerHpSyncRef.current <= 0) {
          endDebuff()
          return
        }
        startRegenLoop(gen)
      }, sicknessDebuffTiming.waitRegenAfterHalfMs)
    },
    [endDebuff, startRegenLoop]
  )

  const scheduleWaitAfterDamageThenRegen = useCallback(
    (gen: number) => {
      // 「直近の被ダメ」から waitRegenAfterDamageMs 後に再開したいので、呼ばれるたびに張り直す
      waitRegenAfterDamageScheduledGenRef.current = gen
      if (waitTimerRef.current != null) {
        window.clearTimeout(waitTimerRef.current)
        waitTimerRef.current = null
      }
      phaseRef.current = 'waiting'
      waitTimerRef.current = window.setTimeout(() => {
        waitTimerRef.current = null
        if (generationRef.current !== gen) return
        if (streamerHpSyncRef.current <= 0) {
          endDebuff()
          return
        }
        startRegenLoop(gen)
      }, sicknessDebuffTiming.waitRegenAfterDamageMs)
    },
    [endDebuff, startRegenLoop]
  )

  const runDropAnimation = useCallback(
    (gen: number) => {
      const start = dropStartHpRef.current
      const targetHalf = dropTargetHpRef.current
      dropElapsedMsRef.current = 0
      dropLastNowRef.current = null

      const step = (now: number) => {
        if (generationRef.current !== gen) return
        if (phaseRef.current !== 'dropping') return

        // 被ダメ中は落下（継続ダメージ）を一時停止し、最後の被ダメから waitDropResumeAfterDamageMs 経過後に再開する
        const pauseUntil = dropPauseUntilRef.current
        if (sicknessDebuffTiming.dropPauseEnabled && pauseUntil != null && now < pauseUntil) {
          if (dropPausedAtRef.current == null) dropPausedAtRef.current = now
          dropRafRef.current = requestAnimationFrame(step)
          return
        }
        if (sicknessDebuffTiming.dropPauseEnabled && dropPausedAtRef.current != null) {
          // 停止していた時間は dropElapsedMsRef に加算しない（時間軸は別変数で管理）
          dropPausedAtRef.current = null
          dropPauseUntilRef.current = null
          dropJustResumedRef.current = true
          dropVisibleResumePendingRef.current = true
        }

        if (dropLastNowRef.current == null) {
          dropLastNowRef.current = now
        }
        const dt = Math.max(0, now - dropLastNowRef.current)
        dropLastNowRef.current = now
        // 停止中でなければ、落下の“進行”だけ進める（攻撃ダメージ反映は別系統で常に入る）
        if (!(sicknessDebuffTiming.dropPauseEnabled && pauseUntil != null && now < pauseUntil)) {
          dropElapsedMsRef.current += dt
        }
        let t = Math.min(1, dropElapsedMsRef.current / sicknessDebuffTiming.dropMs)
        let lerped = Math.round(start + (targetHalf - start) * t)
        const damagedFloor = streamerHpSyncRef.current
        // 攻撃などで HP が落下演出より先に下がった場合、落下を「停止」させずに時間軸を前に進める（1/2 到達まで継続減少を続行するため）
        // こうしないと damagedFloor に張り付いて、lerped が追いつくまで見た目の継続減少が止まってしまう。
        if (damagedFloor < lerped && start !== targetHalf) {
          const denom = targetHalf - start
          const p = denom === 0 ? 1 : (damagedFloor - start) / denom
          const fastForwardT = Math.max(0, Math.min(1, p))
          const fastForwardElapsed = fastForwardT * sicknessDebuffTiming.dropMs
          if (fastForwardElapsed > dropElapsedMsRef.current) {
            dropElapsedMsRef.current = fastForwardElapsed
            t = fastForwardT
            lerped = Math.round(start + (targetHalf - start) * t)
          }
        }
        const blended = Math.min(lerped, damagedFloor)
        const clamped = Math.max(0, Math.min(start, blended))
        updateConfigLocal({ hp: { current: clamped } })

        const prevClamped = dropLastClampedRef.current
        dropLastClampedRef.current = clamped
        if (dropVisibleResumePendingRef.current && prevClamped != null && clamped < prevClamped) {
          dropVisibleResumePendingRef.current = false
        }

        if (dropJustResumedRef.current) {
          dropJustResumedRef.current = false
        }

        // 待機タイマーは「1/2ライン以下に到達した時点」から。攻撃で先に下げた場合もここで開始する（再攻撃でリセットしない）
        if (!halfCrossScheduleDoneRef.current && clamped <= targetHalf) {
          halfCrossScheduleDoneRef.current = true
          if (dropRafRef.current != null) {
            cancelAnimationFrame(dropRafRef.current)
            dropRafRef.current = null
          }
          scheduleWaitThenRegen(gen)
          return
        }

        if (t < 1) {
          dropRafRef.current = requestAnimationFrame(step)
        } else {
          dropRafRef.current = null
          if (!halfCrossScheduleDoneRef.current) {
            halfCrossScheduleDoneRef.current = true
            const finalHp = Math.max(0, Math.min(targetHalf, streamerHpSyncRef.current))
            updateConfigLocal({ hp: { current: finalHp } })
            scheduleWaitThenRegen(gen)
          }
        }
      }
      dropRafRef.current = requestAnimationFrame(step)
    },
    [streamerHpSyncRef, scheduleWaitThenRegen, updateConfigLocal]
  )

  const beginSicknessSequence = useCallback(
    (hpAtTrigger: number, maxHp: number) => {
      generationRef.current += 1
      const gen = generationRef.current
      clearAnim()
      // 最大HPの1/2ではなく「デバフ付与時の現在HP」の1/2まで落とす（ゲージ表示どおりの数値ベース）
      const targetHp = Math.max(0, Math.floor(hpAtTrigger / 2))
      regenCapRef.current = maxHp
      phaseRef.current = 'dropping'
      streakRef.current = 0
      setDialogueVisible(true)
      dropStartHpRef.current = hpAtTrigger
      dropTargetHpRef.current = targetHp
      runDropAnimation(gen)
    },
    [clearAnim, runDropAnimation]
  )

  const registerHealStreak = useCallback(
    (hpBeforeHeal: number, maxHp: number) => {
      if (phaseRef.current !== 'idle') return
      if (hpBeforeHeal >= maxHp) {
        streakRef.current += 1
        if (streakRef.current >= 3) {
          beginSicknessSequence(hpBeforeHeal, maxHp)
        }
      } else {
        streakRef.current = 0
      }
    },
    [beginSicknessSequence]
  )

  const notifyStreamerDamageDuringSickness = useCallback((amount: number) => {
    if (amount <= 0) return
    if (phaseRef.current === 'idle') return
    regenCapRef.current = Math.max(0, regenCapRef.current - amount)
    if (phaseRef.current === 'dropping' && sicknessDebuffTiming.dropPauseEnabled) {
      // 落下（継続ダメージ）中の被ダメは「HPへの反映」は reduceHP 側で行いつつ、
      // 落下演出だけ一時停止して、最後の被ダメから一定時間後に再開させる（連打で延長）
      const shouldPauseDrop = amount >= sicknessDebuffTiming.dropPauseMinDamage
      const now = performance.now()
      const existing = dropPauseUntilRef.current
      const isPausedNow = existing != null && now < existing
      const applied = shouldPauseDrop
        ? (!isPausedNow || sicknessDebuffTiming.dropPauseExtendOnEachDamage)
        : false
      if (shouldPauseDrop) {
        if (applied) {
          dropPauseUntilRef.current = now + sicknessDebuffTiming.waitDropResumeAfterDamageMs
        }
      }
    }
  }, [])

  const cancelSickness = useCallback(() => {
    endDebuff()
  }, [endDebuff])

  useEffect(() => {
    if (currentHP <= 0 && phaseRef.current !== 'idle') {
      endDebuff()
      return
    }
    // 1/2 ライン到達「以降」に「回復できる余地（cap-current）」が無いなら、自然回復を待たずにデバフを終了する
    // - 例: 被ダメで cap が current 以下まで下がり、回復量が0になったケース
    // - 重要: 1/2 未到達（dropping 中など）で誤って解除しないよう、halfCrossScheduleDone を必須にする
    if (phaseRef.current !== 'idle' && halfCrossScheduleDoneRef.current) {
      const half = dropTargetHpRef.current
      const cap = regenCapRef.current
      if (currentHP <= half && cap <= currentHP) {
        endDebuff()
        return
      }
    }
    // notifyStreamerDamage は reduceHP より先に呼ばれるため、ここ（HP 確定後）で regen 再開を判定する
    if (phaseRef.current !== 'regen_exhausted') return
    const cap = regenCapRef.current
    if (cap <= 0) return
    if (currentHP > cap) {
      updateConfigLocal({ hp: { current: cap } })
      return
    }
    if (currentHP < cap && regenRafRef.current == null) {
      // 被ダメで止まった後の再開は、専用の待機時間を挟む（連続被ダメなら張り直し）
      scheduleWaitAfterDamageThenRegen(generationRef.current)
    }
  }, [currentHP, endDebuff, scheduleWaitAfterDamageThenRegen, updateConfigLocal])

  return {
    dialogueVisible,
    registerHealStreak,
    notifyStreamerDamageDuringSickness,
    cancelSickness,
  }
}
