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

function mergeTechniqueNames(
  fixedFirst: readonly string[],
  generated: readonly string[],
  targetCount: number
): readonly string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of fixedFirst) {
    if (seen.has(n)) continue
    out.push(n)
    seen.add(n)
    if (out.length >= targetCount) return out.slice(0, targetCount)
  }
  for (const n of generated) {
    if (seen.has(n)) continue
    out.push(n)
    seen.add(n)
    if (out.length >= targetCount) return out.slice(0, targetCount)
  }
  return out.slice(0, targetCount)
}

// 歴代モンハンで実在した “漢字多め” の技名を、確実にプールへ混ぜる（固定枠）。
const MH_SLASH_SPECIAL_NAMES = [
  '真・溜め斬り',
  '強溜め斬り',
  '兜割り',
  '居合抜刀気刃斬り',
  '桜花鉄蟲気刃斬り',
  '飛翔竜剣',
  '超高出力属性解放斬り',
  '高出力属性解放斬り',
  '零距離属性解放突き',
  '竜杭砲',
  '竜撃砲',
  '流転突き',
  '金剛連斧',
  '鉄蟲糸技',
  '降竜',
  '飛円斬り',
  '剛刃研磨',
] as const

const generatedSlashNames = buildTechniqueNames(
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
    // モンスターハンター系（大技っぽさ）
    '真・溜め',
    '兜',
    '零距離',
    '属性解放',
    '超高出力',
    '気刃',
    '龍撃',
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
    // モンスターハンター系（語尾）
    '斬り',
    '割り',
    '解放突き',
    '属性解放斬り',
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

export const SLASH_TECHNIQUE_NAMES = mergeTechniqueNames(MH_SLASH_SPECIAL_NAMES, generatedSlashNames, 334)

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

const MH_SHOOTING_SPECIAL_NAMES = [
  '竜の一矢',
  '竜の千々矢',
  '剛射',
  '剛連射',
  '曲射',
  '徹甲榴弾',
  '斬裂弾',
  '竜撃弾',
  '竜熱機関竜弾',
] as const

const generatedShootingNames = buildTechniqueNames(
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
    // モンスターハンター系（遠距離の大技っぽさ）
    '竜の一',
    '竜熱',
    '竜撃',
    '龍炎',
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
    // モンスターハンター系（語尾）
    '矢',
    '徹甲',
    '竜撃弾',
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

export const SHOOTING_TECHNIQUE_NAMES = mergeTechniqueNames(MH_SHOOTING_SPECIAL_NAMES, generatedShootingNames, 333)

/** 全1000件・タイプ順で連結（ルーレット／合わせ技で同一プール） */
export const COMBO_TECHNIQUE_NAMES = [
  ...SLASH_TECHNIQUE_NAMES,
  ...MAGIC_TECHNIQUE_NAMES,
  ...SHOOTING_TECHNIQUE_NAMES,
] as const
