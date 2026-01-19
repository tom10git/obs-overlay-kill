/**
 * アニメーション関連のユーティリティ関数
 */

/**
 * イージング関数のタイプ
 */
export type EasingFunction = (t: number) => number

/**
 * イージング関数の定義
 */
export const easingFunctions: Record<string, EasingFunction> = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  'ease-in-out': (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  'cubic-bezier': (t: number) => {
    // cubic-bezier(0.4, 0, 0.2, 1) の近似
    return t * t * (3 - 2 * t)
  },
}

/**
 * CSS easing文字列を取得
 */
export function getCssEasing(easing: string): string {
  if (easing.startsWith('cubic-bezier')) {
    return easing
  }

  const easingMap: Record<string, string> = {
    linear: 'linear',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    'cubic-bezier': 'cubic-bezier(0.4, 0, 0.2, 1)',
  }

  return easingMap[easing] || 'ease-out'
}

/**
 * アニメーション用のスタイルを生成
 */
export function getAnimationStyle(
  duration: number,
  easing: string
): React.CSSProperties {
  return {
    transition: `all ${duration}ms ${getCssEasing(easing)}`,
  }
}
