/**
 * 合わせ技・ルーレット共通の技名プール（1000件固定）。
 * 構成: 斬撃 334 / 魔法 333（カワイソウニ含む）/ 射撃 333
 */

function buildTechniqueNames(
  heads: readonly string[],
  tails: readonly string[],
  targetCount: number
): readonly string[] {
  // 際限なく偏らないよう、全組み合わせ生成→決定論的シャッフル→先頭 targetCount で切り出す。
  const allNames: string[] = []
  const separators = ['', '・']
  for (const h of heads) {
    for (const t of tails) {
      for (const sep of separators) {
        // 区切りなしで「月詠」 + 「詠」みたいな語のダブりが起きるのを回避する
        // （sep='' のときだけ判定）
        if (sep === '' && h.endsWith(t)) continue
        allNames.push(`${h}${sep}${t}`)
      }
    }
  }

  // Deterministic PRNG（FNV-1a + mulberry32）
  let seed = 2166136261
  const str = `${heads.join('|')}>${tails.join('|')}>${targetCount}`
  for (let i = 0; i < str.length; i += 1) {
    seed ^= str.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }
  const rand = (() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let a = seed >>> 0
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  })()

  // Fisher–Yates shuffle
  for (let i = allNames.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[allNames[i]!, allNames[j]!] = [allNames[j]!, allNames[i]!]
  }

  // 体感で「漢字だらけ」に見えやすいので、漢字あり/なしをある程度均す。
  // ※判定は「漢字を1文字でも含むか」。記号やカタカナ/ひらがなだけなら nonKanji 扱い。
  const han = /\p{Script=Han}/u
  const nonKanji: string[] = []
  const withKanji: string[] = []
  for (const n of allNames) {
    if (han.test(n)) withKanji.push(n)
    else nonKanji.push(n)
  }

  const out: string[] = []
  const desiredNonKanjiRatio = 0.6
  while (out.length < targetCount && (nonKanji.length > 0 || withKanji.length > 0)) {
    const wantNon =
      out.length === 0 ? true : out.filter((s) => !han.test(s)).length / out.length < desiredNonKanjiRatio
    if (wantNon) out.push(nonKanji.shift() ?? withKanji.shift()!)
    else out.push(withKanji.shift() ?? nonKanji.shift()!)
  }

  return out.slice(0, targetCount)
}

export const SLASH_TECHNIQUE_NAMES = buildTechniqueNames(
  [
    '紅刃',
    '蒼刃',
    '雷刃',
    '影刃',
    '白刃',
    '黒刃',
    '月刃',
    '虎刃',
    '龍刃',
    '風刃',
    'ブレイド',
    'シャドウ',
    // 追加 head（漢字密度を下げて、見た目の圧を軽くする）
    'クリムゾン',
    'アズール',
    'ライジン',
    'ムーンライト',
    'ウィンド',
    'ホワイト',
    'ブラック',
    'ファントム',
    'ノヴァ',
    'フロスト',
    'インフェルノ',
    'テンペスト',
    'アーク',
    'ヴォイド',
  ],
  [
    '斬',
    '断',
    '裂',
    '閃',
    '牙',
    'ラッシュ',
    'ブレイク',
    'クロス',
    // 追加 tail（漢字寄りになりすぎないよう、音感/英語風を混ぜる）
    'スラッシュ',
    'ストライク',
    'エッジ',
    'フィニッシュ',
    'スプリット',
    'ダブル',
    'トリプル',
  ],
  334
)

const generatedMagicNames = buildTechniqueNames(
  [
    '星詠',
    '深淵',
    '聖光',
    '虚無',
    '氷華',
    '雷帝',
    '焔王',
    '霊峰',
    '月詠',
    '秘儀',
    'ルーン',
    'アストラ',
    // 追加 head（カタカナ寄りでギラつき・魔法感）
    'ネビュラ',
    'エーテル',
    'アーケイン',
    'セレスティア',
    'オラクル',
    'ルミナ',
    'ミラージュ',
    'エクリプス',
    'カオス',
    'ゼロ',
    'スピリット',
    'シンフォニア',
    'プリズム',
    'グリモア',
    'ソラリス',
    'ノクターン',
    'アストラル',
    'マナ',
  ],
  [
    '術',
    '詠',
    '陣',
    '符',
    '唱',
    'スペル',
    'ミスト',
    'オーラ',
    // 追加 tail（漢字を減らして語感でバリエーション）
    'キャスト',
    'チャント',
    'チャーム',
    'ブレッシング',
    'カース',
    'ゲート',
    'ブースト',
  ],
  333
)

// 専用デバフ連携に使う名称は維持する。
export const MAGIC_TECHNIQUE_NAMES = ['カワイソウニ', ...generatedMagicNames.slice(1, 333)] as const

export const SHOOTING_TECHNIQUE_NAMES = buildTechniqueNames(
  [
    '流星',
    '閃光',
    '雷鳴',
    '彗星',
    '黒翼',
    '蒼穹',
    '金剛',
    '白夜',
    '烈火',
    '銀河',
    'バレット',
    'キャノン',
    // 追加 head（ミリタリー/サイバー寄りを増やす）
    'ストライカー',
    'レイザー',
    'プラズマ',
    'フォトン',
    'バスター',
    'ハンター',
    'スカイ',
    'ブラックアウト',
    'ホワイトノイズ',
    'オーバードライブ',
    'マグナム',
    'ヘイル',
    'ブリッツ',
    'メテオ',
    'ノヴァ',
    'スティール',
    'アイアン',
    'スモーク',
  ],
  [
    '弾',
    '砲',
    '射',
    '撃',
    '閃',
    'ショット',
    'バースト',
    'スナイプ',
    // 追加 tail（カタカナ寄りで弾丸/爆発感を維持）
    'ラピッド',
    'フルオート',
    'スプレッド',
    'エクスプロード',
    'ロックオン',
    'チェイン',
    'スタンピード',
  ],
  333
)

/** 全1000件・タイプ順で連結（ルーレット／合わせ技で同一プール） */
export const COMBO_TECHNIQUE_NAMES = [
  ...SLASH_TECHNIQUE_NAMES,
  ...MAGIC_TECHNIQUE_NAMES,
  ...SHOOTING_TECHNIQUE_NAMES,
] as const
