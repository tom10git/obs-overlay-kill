/**
 * フルスクリーン系 Canvas のビットマップ解像度を長辺で上限し、fillRate を抑える。
 * 表示は CSS で 100% 引き伸ばし（軽いスケール vs 毎フレーム全画素描画）。
 */
export function cappedCanvasBitmapSize(
  widthPx: number,
  heightPx: number,
  opts?: { maxLongEdge?: number; minEdge?: number }
): { w: number; h: number } {
  const minE = opts?.minEdge ?? 48
  const maxLong = opts?.maxLongEdge ?? 1280
  const w0 = Math.max(minE, Math.round(widthPx))
  const h0 = Math.max(minE, Math.round(heightPx))
  const long = Math.max(w0, h0)
  if (long <= maxLong) return { w: w0, h: h0 }
  const s = maxLong / long
  return {
    w: Math.max(minE, Math.round(w0 * s)),
    h: Math.max(minE, Math.round(h0 * s)),
  }
}
