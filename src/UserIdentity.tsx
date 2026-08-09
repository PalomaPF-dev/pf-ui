import type { ReactNode } from "react";

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
  /** 所属。部署名（工場所属なら「工場名 職場名」）。null なら氏名だけ出す */
  affiliation?: string | null;
  /** ポータルから連携された役割。'admin' のときだけ「管理者」と出す */
  role: PortalRole;
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
 * ポータルは「一般 ＜ 管理者 ＜ ポータル管理」の3段だが、ポータル管理の人は
 * 各アプリへ管理者として連携されるので、アプリ側では2段になる。
 *
 * ログアウト等の認証まわりは next-auth 依存でアプリごとに違うため、
 * このコンポーネントは表示だけを受け持つ（ボタン類はアプリ側で並べる）。
 */
export default function UserIdentity({
  name,
  affiliation = null,
  role,
  scope = null,
  scopeWarning = false,
}: UserIdentityProps) {
  const isAdmin = role === "admin";
  return (
    <div className="mb-2">
      <div className="truncate text-xs text-[#707070]">
        {affiliation && (
          <>
            {affiliation}
            <span className="mx-1 text-[#cccccc]">/</span>
          </>
        )}
        {name}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          title={
            isAdmin
              ? "このアプリで承認やマスタ設定ができる権限です"
              : "このアプリで日常の入力・閲覧ができる権限です"
          }
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-normal ${
            isAdmin ? "bg-[#fdecea] text-[#dc000c]" : "bg-[#eeeeee] text-[#555555]"
          }`}
        >
          {isAdmin ? "管理者" : "一般"}
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
