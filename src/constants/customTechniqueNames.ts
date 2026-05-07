/**
 * オリジナル技名の追加用ファイル。
 *
 * - このファイルの配列に文字列を追加するだけで、合わせ技／ルーレットの技名プールへ混ざります。
 * - 斬撃/魔法/射撃の「どの演出に寄せたいか」で配列を選んでください。
 * - ここに入れた名前は、カテゴリ内で「固定枠（優先的に採用）」として先頭側に入ります（重複は自動で除去）。
 */

/** 斬撃扱いにしたいオリジナル技名 */
export const CUSTOM_SLASH_TECHNIQUE_NAMES: readonly string[] = [
  // 例: '殲滅よ！',
  '殲滅よ！',
]

/** 魔法扱いにしたいオリジナル技名 */
export const CUSTOM_MAGIC_TECHNIQUE_NAMES: readonly string[] = []

/** 射撃扱いにしたいオリジナル技名 */
export const CUSTOM_SHOOTING_TECHNIQUE_NAMES: readonly string[] = []

