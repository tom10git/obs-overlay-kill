/**
 * Howler.js を使った簡易サウンドフック
 */

import { useCallback, useEffect, useRef } from 'react'
import { Howl } from 'howler'

interface UseSoundOptions {
  src: string
  enabled?: boolean
  volume?: number
}

interface UseSoundResult {
  play: () => void
  stop: () => void
}

export function useSound({ src, enabled = true, volume = 1 }: UseSoundOptions): UseSoundResult {
  const howlRef = useRef<Howl | null>(null)
  const srcRef = useRef<string>('')

  useEffect(() => {
    const nextSrc = src?.trim() || ''
    // enabled の ON/OFF で Howl を作り直すと、再生中に unload が走って「音が途切れる」原因になる。
    // src が変わったときだけ作り直す。
    if (!nextSrc) {
      if (howlRef.current) {
        howlRef.current.unload()
        howlRef.current = null
        srcRef.current = ''
      }
      return
    }

    if (howlRef.current && srcRef.current === nextSrc) {
      return
    }

    if (howlRef.current) {
      howlRef.current.unload()
      howlRef.current = null
    }

    const howl = new Howl({
      src: [nextSrc],
      volume,
      preload: true,
      // 同一SEが短時間に連続するケース（連打/複合成功）でも途切れにくくする
      pool: 8,
    })

    howlRef.current = howl
    srcRef.current = nextSrc

    return () => {
      howl.unload()
      if (howlRef.current === howl) {
        howlRef.current = null
        srcRef.current = ''
      }
    }
  }, [src])

  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume)
    }
  }, [volume])

  const play = useCallback(() => {
    if (!enabled) return
    const h = howlRef.current
    if (!h) return
    h.play()
  }, [enabled, src])

  const stop = useCallback(() => {
    if (!howlRef.current) return
    howlRef.current.stop()
  }, [])

  return { play, stop }
}
