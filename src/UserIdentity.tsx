import type { ReactNode } from "react";
import { formatAffiliation } from "./affiliation";

/**
 * ポータルから連携された役割。
 * ポータル管理権限（can_manage）を持つ人はポータル側で 'admin' に変換して連携されるため、
 * アプリ側で区別するのは「管理者」と「一般」の2つだけになる。
 * 'worker' は旧データに残っている値で、一般として扱う。
 */
export type PortalRole = "admin" | "member" | "worker" | null | undefined;

export interface UserIdentityProps {
  /** 氏名 */
  name: string;
  /**
   * 所属。部署名（工場所属なら「工場名 職場名」）。null なら氏名だけ出す。
   * 組み立て済みの文字列を持っているアプリはこれを渡す。持っていないなら
   * department / workplace を渡せば、こちらで同じ規則で組み立てる。
   */
  affiliation?: string | null;
  /**
   * 部署名。工場所属なら工場名（ポータルの `/api/provision` が送る department）。
   * affiliation を渡さなかったときだけ使う。
   */
  department?: string | null;
  /**
   * 職場名（ポータルの `/api/provision` が送る workplace）。
   * affiliation を渡さなかったときだけ使う。
   */
  workplace?: string | null;
  /** ポータルから連携された役割。'admin' のときだけ「管理者」と出す */
  role: PortalRole;
  /**
   * ポータル管理権限（can_manage）を持つ人か。true なら「ポータル管理」と出す。
   * ほとんどのアプリはこの区別を持たない（ポータル側で管理者として連携されるため）ので省略でよい。
   * 区別が実際にあるアプリ——人事管理は人事考課・基本給与・設定をポータル管理者だけに
   * 限っている——では true を渡し、ポータルと同じ目印を出す。
   */
  portalAdmin?: boolean;
  /**
   * このアプリで扱えるデータの範囲（例「第一工場のデータのみ」「全工場のデータ」）。
   * 絞り込みの規則はアプリごとに違う（工場・部署・担当取引先など）ため、
   * 文言はアプリ側で決めて渡す。null なら範囲の行を出さない。
   */
  scope?: ReactNode;
  /**
   * scope を注意書き（赤字）として出す。
   * 「所属工場が工場マスタに無いので表示できるデータがない」など、
   * 放置すると業務が止まる状態を伝えるときに使う。
   */
  scopeWarning?: boolean;
}

/**
 * サイドバー下部に出すログインユーザーの表示。
 *
 *   第一工場 品質管理 / 山田太郎
 *   [管理者]  第一工場のデータのみ
 *
 * 権限の文言・色はポータル（portal.paloma-pf.com）の表示と揃えてある。
 * ポータルは「一般 ＜ 管理者 ＜ ポータル管理」の3段。ポータル管理の人は各アプリへ
 * 管理者として連携されるので、たいていのアプリでは上2段の区別が消えて2段になる。
 * ポータル管理を実際に区別しているアプリは portalAdmin を渡す。
 *
 * ログアウト等の認証まわりは next-auth 依存でアプリごとに違うため、
 * このコンポーネントは表示だけを受け持つ（ボタン類はアプリ側で並べる）。
 */
export default function UserIdentity({
  name,
  affiliation,
  department = null,
  workplace = null,
  role,
  portalAdmin = false,
  scope = null,
  scopeWarning = false,
}: UserIdentityProps) {
  // affiliation を明示的に渡されたときはそれを優先する（null＝所属を出さない、も指示として尊重）。
  // 渡されていないアプリのために、部署名・職場名から同じ規則で組み立てる。
  const affiliationText =
    affiliation !== undefined ? affiliation : formatAffiliation({ department, workplace });
  const badge = portalAdmin
    ? {
        label: "ポータル管理",
        title: "全工場のデータを扱え、各アプリの承認・マスタ設定と、ポータルの管理画面も使える権限です",
        className: "bg-[#e3f2fd] text-[#0b5ca8]",
      }
    : role === "admin"
      ? {
          label: "管理者",
          title: "このアプリで承認やマスタ設定ができる権限です",
          className: "bg-[#fdecea] text-[#dc000c]",
        }
      : {
          label: "一般",
          title: "このアプリで日常の入力・閲覧ができる権限です",
          className: "bg-[#eeeeee] text-[#555555]",
        };
  return (
    <div className="mb-2">
      <div className="truncate text-xs text-[#707070]">
        {affiliationText && (
          <>
            {affiliationText}
            <span className="mx-1 text-[#cccccc]">/</span>
          </>
        )}
        {name}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          title={badge.title}
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-normal ${badge.className}`}
        >
          {badge.label}
        </span>
        {scope && (
          <span
            className={`text-[10px] leading-snug ${
              scopeWarning ? "text-[#dc000c]" : "text-[#909090]"
            }`}
          >
            {scope}
          </span>
        )}
      </div>
    </div>
  );
}
