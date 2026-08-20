/**
 * ポータルから連携された所属の材料。
 *
 * `department` は種別を問わない部署名で、**工場所属の人は工場名が入る**
 * （ポータルの部署マスタは kind='dept' と kind='factory' の2種を同じ名前欄で持つ）。
 * `workplace` は職場名で、工場所属の人にだけ入るのが普通。
 *
 * 値はポータルの `/api/provision` が各アプリへ送ってくる `department` / `workplace`
 * をそのまま渡してよい（各アプリでは users テーブルの portal_department /
 * portal_workplace 等に保存されている）。
 */
export interface AffiliationParts {
  /** 部署名。工場所属なら工場名（例「第一工場」「生産管理部」） */
  department?: string | null;
  /** 職場名（例「品質管理」）。工場所属でなければ空のことが多い */
  workplace?: string | null;
}

/**
 * サイドバーに出す所属の文字列を組み立てる。
 *
 *   { department: "第一工場", workplace: "品質管理" } → "第一工場 品質管理"
 *   { department: "生産管理部" }                      → "生産管理部"
 *   { }                                               → null（所属の行を出さない）
 *
 * 全アプリで同じ並び・同じ区切りにするための規則をここ1か所に置く。
 * 各アプリが DB から引いた値をそのまま渡せるよう、文字列以外・空白のみの値は
 * 落として扱う（未連携の人は null になり、UserIdentity は氏名だけを出す）。
 */
export function formatAffiliation(parts: AffiliationParts): string | null {
  const joined = [parts.department, parts.workplace]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || null;
}
