/**
 * 合わせ技・ルーレット共通の技名プール。
 * 演出 kind ごとに分類し、各ブロック内は日本語ロケール順（localeCompare 'ja'）。
 * 結合順: inferno → meteor → void → tempest → glacier → plasma → radiance → tremor → phantom → nova
 *
 * 語感とエフェクト kind の対応メモ:
 * - inferno: 炎・爆発・赤系／竜ブレス・ドラグブレ（竜の破断イメージ）。
 * - meteor: 星・彗星・落下軌道のみ。
 * - void: 闇・深淵・裂け目・影の「間」。影縫は闇に沈む縫い目として void。
 * - tempest: 雷・風・嵐。熱雷光・砂嵐拳・スパイラルフラッシュ（帯電螺旋）。
 * - plasma: イオン・量子・磁気・分光（プリズム）。極光は発光現象のため radiance。
 * - radiance: 極光・聖光・月・クレスト（光の峰）。
 * - tremor: 大地・岩・鉄の質量。真打／極意は「地に足の奥義」として tremor。
 * - phantom: 精神・夢・桜・クオリア・ミラー・幽玄の歩法。
 * - nova: 大収束・カルマ渦・竜の決壊・裂空・終幕のヴェール。
 */

export const INFERNO_TECHNIQUE_NAMES = [
  'クリムゾンレッグ',
  'グレネイドヒート',
  'スコーチヒート',
  'ドラグブレ',
  'フレア',
  'ブレイズ',
  'フレイムリング',
  'ヘルフレア',
  '炎レイ',
  '炎幕',
  '焔牙',
  '業火斬',
  '紅フレア',
  '紅煌刃',
  '竜ブレス',
] as const

export const METEOR_TECHNIQUE_NAMES = [
  'コズモパルス',
  'コメット',
  'メテオ',
  '銀コメット',
  '銀メテオ',
  '銀流星',
  '空ダイブ',
  '星火',
  '星堕',
  '蒼スター',
  '夜空閃',
  '流星刃',
  '彗星脚',
] as const

export const VOID_TECHNIQUE_NAMES = [
  'アビスドロップ',
  'イクリプス',
  'ヴォイド',
  'ヴォイドショット',
  'ヴォイドリフト',
  'シャドウ',
  'ダークスラッシュ',
  'ディープナイト',
  'ブラックブレード',
  'ヘルゲート',
  'ルナウェッジ',
  '闇ゲート',
  '闇刃',
  '影縫',
  '夜ニト',
] as const

export const TEMPEST_TECHNIQUE_NAMES = [
  'ゲイル',
  'ゲイルフラッシュ',
  'サンダー',
  'ショック',
  'ストームキ',
  'スパーク',
  'スパイラルフラッシュ',
  'パープルボルト',
  'レイヴン',
  '轟雷',
  '砂嵐拳',
  '疾雷',
  '迅風',
  '熱雷光',
  '風切',
  '雷ボルト',
  '雷神',
  '雷陣',
  '雷鳴斬',
  '嵐ゲイル',
  '烈風脚',
] as const

export const GLACIER_TECHNIQUE_NAMES = [
  'アイスエッジ',
  'アクアフロウ',
  'ブリザ',
  'フロスト',
  'フロストラ',
  '雪嵐',
  '絶零',
  '蒼ブレイド',
  '蒼潮',
  '蒼氷',
  '蒼落',
  '凍結波',
  '氷ジェイル',
  '氷刃陣',
  '氷壁',
] as const

export const PLASMA_TECHNIQUE_NAMES = [
  'アストラ',
  'イオン裂',
  'チェイン',
  'プラズマ',
  'プリズム',
  '閃磁',
  '陽子砲',
  '量子閃',
] as const

export const RADIANCE_TECHNIQUE_NAMES = [
  'アルカナ',
  'オーラ',
  'クレスト',
  'ヘイロー',
  'ルミナ',
  'ルミナオーラ',
  '極光',
  '月光',
  '光明刃',
  '光理',
  '瞬光',
  '曙光',
  '聖フォース',
  '聖裁',
  '天光',
  '白ヴェール',
] as const

export const TREMOR_TECHNIQUE_NAMES = [
  'ヴォルブレイク',
  'グランド',
  'ストーンショット',
  'タイガースラ',
  'マウンテンクラ',
  'ランス',
  '岩砕',
  '金バレット',
  '鋼シールド',
  '震撃',
  '大地割',
  '地クラック',
  '地嶺',
  '鉄ウィップ',
  '鉄拳',
  '鉄崩',
] as const

export const PHANTOM_TECHNIQUE_NAMES = [
  'カワイソウニ',
  'クオリア',
  'スワロウフラッシュ',
  'ソウル',
  'ドレイン',
  'ナイトメア',
  'ファントム',
  'ファントムステップ',
  'ブレイド',
  'ホーククロー',
  'マジックミラー',
  'ミスト',
  'ミラージュス',
  '影舞',
  '桜吹雪',
  '神楽ステップ',
  '霧幻',
  '幽歩',
  '朧剣',
  '朧歩',
] as const

export const NOVA_TECHNIQUE_NAMES = [
  'ヴェール',
  'カルマヴォルテ',
  'ドラゴンスト',
  'ノヴァ',
  '界崩',
  '核熱',
  '極意',
  '終焉閃',
  '真打',
  '星爆',
  '超新星',
  '裂空',
] as const

/** 全151件・上記 kind 順で連結（ルーレット／合わせ技で同一プール） */
export const COMBO_TECHNIQUE_NAMES = [
  ...INFERNO_TECHNIQUE_NAMES,
  ...METEOR_TECHNIQUE_NAMES,
  ...VOID_TECHNIQUE_NAMES,
  ...TEMPEST_TECHNIQUE_NAMES,
  ...GLACIER_TECHNIQUE_NAMES,
  ...PLASMA_TECHNIQUE_NAMES,
  ...RADIANCE_TECHNIQUE_NAMES,
  ...TREMOR_TECHNIQUE_NAMES,
  ...PHANTOM_TECHNIQUE_NAMES,
  ...NOVA_TECHNIQUE_NAMES,
] as const
