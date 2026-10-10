"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, X, LayoutGrid } from "lucide-react";
import {
  IDLE_MS,
  readDeviceKind,
  useIdleLogout,
  writeDeviceKind,
  type DeviceKind,
} from "./useIdleLogout";
import StickyScrollbarX from "./StickyScrollbarX";

/** サイドバーのナビ1件。 */
export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** true の場合 isAdmin のときだけ表示（マスタ設定など） */
  adminOnly?: boolean;
}

/** 見出し付きのナビグループ（在庫アプリのように業務カテゴリで区切る場合に使う）。 */
export interface NavGroup {
  /** グループ見出し。省略すると見出しなしの区切りになる */
  title?: string;
  items: NavItem[];
}

/** nav に NavGroup[] が渡されたか（NavItem[] と区別する）。 */
function isGrouped(nav: NavItem[] | NavGroup[]): nav is NavGroup[] {
  return nav.length > 0 && "items" in nav[0];
}

export interface BrandConfig {
  /** アプリ名（例「PF設備管理」） */
  title: string;
  /** 補足（例「設備管理・点検」）。タイトルの下に出る。省略可 */
  subtitle?: string;
  /** タイトルの上に出す小さな文字（例「株式会社パロマ」）。省略可 */
  eyebrow?: string;
  /** アイコン画像のパス。既定 "/icon-192.png" */
  iconSrc?: string;
}

/** アクティブなナビ項目の見せ方。bar=左ボーダー / pill=角丸＋左の丸バー */
export type NavIndicator = "bar" | "pill";

/**
 * 表示モード。auto=画面サイズで自動切替（従来どおり） / pc=常にサイドバー /
 * mobile=常にドロワー＋ヘッダ。タブレットや横向きスマホで自動判定が好みに
 * 合わない場合に、利用者自身が固定できるようにする。
 */
export type ViewMode = "auto" | "pc" | "mobile";

const VIEW_MODE_KEY = "pf-view-mode";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "auto", label: "自動" },
  { value: "pc", label: "PC" },
  { value: "mobile", label: "モバイル" },
];

const DEVICE_KINDS: { value: DeviceKind; label: string }[] = [
  { value: "shared", label: "共用" },
  { value: "personal", label: "個人" },
];

/** 無操作の自動ログアウト設定。期限切れ時の処理はアプリ側（next-auth 依存）で行う。 */
export interface IdleLogoutConfig {
  /** 期限切れ時に呼ぶ。signOut → ポータルの一括ログアウトへ */
  onTimeout: () => void;
  /** false のあいだは計測しない（未ログイン時など）。既定 true */
  enabled?: boolean;
  /**
   * サイドバーに端末種別（共用/個人）の切替を出すか。既定 true。
   * false でも計測は続く（保存済みの端末種別、無ければ「共用」の時間で動く）。
   * 端末種別をポータル側で決める運用のアプリが、切替 UI だけを外すために使う。
   */
  deviceKindSwitch?: boolean;
}

export interface AppShellProps {
  children: ReactNode;
  /**
   * サイドバーのナビ項目（アプリごとに異なる）。
   * フラットな `NavItem[]`、または見出し付きの `NavGroup[]` のどちらでも渡せる。
   */
  nav: NavItem[] | NavGroup[];
  brand: BrandConfig;
  /** adminOnly のナビを表示するか */
  isAdmin?: boolean;
  /**
   * シェル（サイドバー）を出さないパス。ログイン等の認証ページ用。
   * 既定 ["/login", "/register", "/password-reset", "/password-reset/confirm"]
   */
  bareRoutes?: string[];
  /** ホームのパス。既定 "/" */
  homeHref?: string;
  /**
   * アプリのアクセントカラー（6桁HEX）。ブランドライン・アクティブなナビに使う。
   * 既定はパロマオレンジ #f27524。
   */
  accent?: string;
  /** アクティブなナビの見せ方。既定 "bar" */
  navIndicator?: NavIndicator;
  /** コンテンツ背景色。既定 "#f8fafc"（slate-50） */
  background?: string;
  /** ポータルへのリンク。null を渡すと非表示。既定 "https://portal.paloma-pf.com" */
  portalUrl?: string | null;
  /** サイドバー上部のスロット（承認バッジ・工場ピッカーなど） */
  sidebarTop?: ReactNode;
  /** サイドバー下部のスロット（ログインユーザー情報・ログアウト） */
  sidebarFooter?: ReactNode;
  /** モバイルヘッダ右側のスロット（承認バッジなど。ホームボタンの左に入る） */
  headerRight?: ReactNode;
  /**
   * 本文の直前（ヘッダの下・スクロール領域の外）に出すスロット。
   * 「閲覧専用です」等の常時表示バナー向け。PC・モバイルどちらでも出る。
   */
  contentTop?: ReactNode;
  /**
   * ブランドラインの直下・サイドバーより上に、画面全幅で出すスロット。
   * 「所属工場のデータのみ表示しています」等の全画面共通バナー向け。
   */
  topBanner?: ReactNode;
  /**
   * 無操作の自動ログアウト。渡すと有効になり、サイドバーに端末種別の切替が出る。
   * 省略すると計測しない（従来どおり）。
   */
  idleLogout?: IdleLogoutConfig;
  /**
   * サイドバーに表示モード（自動/PC/モバイル）の切替を出すか。既定 true。
   * false のときは保存済みの表示モードも無視して常に自動判定にする
   * （切替 UI が無いのに固定モードへ閉じ込められるのを防ぐため）。
   */
  viewModeSwitch?: boolean;
  /**
   * 本文の下端に横スクロールバーを常時出すか。既定 true。
   * 縦に長い表を `overflow-x-auto` で包むと横スクロールバーが表の一番下に付き、
   * 縦に最後までスクロールしないと横へ動かせない。これを防ぐための仕組みで、
   * 画面に映っている横スクロール領域を検出して同じ動きのバーを下端に出す。
   * 対象自身のスクロールバーが既に見えているときは出さない（二重表示の防止）。
   */
  stickyScrollbarX?: boolean;
}

const DEFAULT_BARE_ROUTES = [
  "/login",
  "/register",
  "/password-reset",
  "/password-reset/confirm",
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * いまの画面に当たるナビ項目の href（無ければ null）。
 * 当てはまる項目が複数あるときは、いちばん具体的な（長い）href の1つだけにする。
 * 例: 「登録状況（/requests）」と「単価申請（/requests/new）」が並ぶとき、/requests/new では
 * 単価申請だけを選択中にする（前方一致だけだと両方が選択中になっていた）。
 * /requests/123 のように、より具体的な項目が無い画面では /requests が選択中になる。
 */
function activeHrefOf(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isActive(pathname, href) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/**
 * アクセント色はアプリごとに異なるため、Tailwind の動的クラス
 * （ビルド時に検出できない）ではなく inline style で当てる。
 */
function navItemStyle(
  active: boolean,
  accent: string,
  indicator: NavIndicator
): React.CSSProperties {
  if (!active) return {};
  // 末尾 "0D" = 約5% の不透明度（アクティブ行のごく薄い下地）
  const tint = /^#[0-9a-fA-F]{6}$/.test(accent) ? `${accent}0D` : undefined;
  return {
    color: accent,
    backgroundColor: tint,
    ...(indicator === "bar" ? { borderLeftColor: accent } : {}),
  };
}

function NavLinks({
  nav,
  isAdmin,
  portalUrl,
  accent,
  indicator,
  onNavigate,
}: {
  nav: NavItem[] | NavGroup[];
  isAdmin: boolean;
  portalUrl: string | null;
  accent: string;
  indicator: NavIndicator;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // フラットな配列も「見出しなしの1グループ」として同じ描画経路に載せる
  const groups: NavGroup[] = isGrouped(nav) ? nav : [{ items: nav }];
  // 選択中にする項目は、見えている項目の中でいちばん具体的に当たる1つだけ
  // （管理者向けで隠れている項目は数えない＝その画面では親の項目が選択中になる）
  const activeHref = activeHrefOf(
    pathname,
    groups.flatMap((g) => g.items.filter((n) => !n.adminOnly || isAdmin).map((n) => n.href))
  );

  const base =
    indicator === "bar"
      ? "flex items-center gap-3 rounded-r-lg border-l-[3px] border-transparent px-3 py-2.5 text-sm font-medium transition-colors"
      : "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
  const inactive = "text-[#555555] hover:bg-[#f7f7f5] hover:text-[#333333]";

  return (
    <nav className="flex flex-col gap-1 px-3">
      {groups.map((group, gi) => {
        const items = group.items.filter((n) => !n.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <div key={group.title ?? `g${gi}`} className="flex flex-col gap-1">
            {group.title && (
              <div className="mt-3 px-3 pb-0.5 text-[10px] font-bold tracking-wide text-[#909090]">
                {group.title}
              </div>
            )}
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  style={navItemStyle(active, accent, indicator)}
                  className={`${base} ${active ? "" : inactive}`}
                >
                  {active && indicator === "pill" && (
                    <span
                      aria-hidden
                      style={{ backgroundColor: accent }}
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                    />
                  )}
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        );
      })}
      {portalUrl && (
        <>
          {/* PFアプリポータルへ（外部リンクなので通常の a タグ） */}
          <div className="my-1 border-t border-[#eeeeee]" />
          <a
            href={portalUrl}
            onClick={onNavigate}
            className={`${base} ${inactive}`}
          >
            <LayoutGrid className="h-5 w-5 shrink-0" />
            ポータル
          </a>
        </>
      )}
    </nav>
  );
}

/** 表示モードの切替。サイドバー／ドロワーの下部に置き、選択は localStorage に保存する。 */
function ViewModeSwitch({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="border-t border-[#eeeeee] px-4 py-3">
      <div className="mb-1.5 px-1 text-[10px] font-bold tracking-wide text-[#909090]">表示モード</div>
      <div className="flex overflow-hidden rounded-lg border border-[#e5e5e5]">
        {VIEW_MODES.map(({ value, label }, i) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`flex-1 px-1 py-1.5 text-[11px] transition-colors ${
              mode === value
                ? "bg-[#f7f7f5] font-bold text-[#333333]"
                : "bg-white text-[#707070] hover:bg-[#f7f7f5]"
            } ${i > 0 ? "border-l border-[#e5e5e5]" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 端末種別の切替。共用端末（現場PC・ハンディ）は短く、個人端末は長く自動ログアウトする。
 * 表示モードと同じく端末ごとの設定なので localStorage に保存する。
 */
function DeviceKindSwitch({
  kind,
  onChange,
}: {
  kind: DeviceKind;
  onChange: (k: DeviceKind) => void;
}) {
  return (
    <div className="border-t border-[#eeeeee] px-4 py-3">
      <div className="mb-1.5 px-1 text-[10px] font-bold tracking-wide text-[#909090]">
        この端末（自動ログアウト {Math.round(IDLE_MS[kind] / 60000)}分）
      </div>
      <div className="flex overflow-hidden rounded-lg border border-[#e5e5e5]">
        {DEVICE_KINDS.map(({ value, label }, i) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            title={
              value === "shared"
                ? "現場の共用PC・ハンディ端末。短い時間で自動ログアウトします"
                : "自席のPC・自分のスマホ。長めに使えます"
            }
            className={`flex-1 px-1 py-1.5 text-[11px] transition-colors ${
              kind === value
                ? "bg-[#f7f7f5] font-bold text-[#333333]"
                : "bg-white text-[#707070] hover:bg-[#f7f7f5]"
            } ${i > 0 ? "border-l border-[#e5e5e5]" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 自動ログアウト直前の警告。入力中のデータを失わせないため、続けるかを聞く。 */
function IdleWarningDialog({
  seconds,
  onExtend,
  onLogout,
}: {
  seconds: number;
  onExtend: () => void;
  onLogout: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pf-idle-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div id="pf-idle-title" className="text-sm font-bold text-[#333333]">
          まもなく自動ログアウトします
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#555555]">
          操作がないため、<b className="text-[#dc000c]">{seconds}秒後</b>にログアウトします。
          入力中の内容がある場合は「使用を続ける」を押してください。
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onExtend}
            autoFocus
            className="flex-1 rounded-lg bg-[#333333] px-3 py-2 text-xs font-bold text-white hover:bg-[#111111]"
          >
            使用を続ける
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-[#e5e5e5] px-3 py-2 text-xs font-medium text-[#555555] hover:bg-[#f7f7f5]"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}

/** ロゴ。どこからでもホームへ戻れる導線を兼ねる。 */
function Brand({
  brand,
  homeHref,
  onNavigate,
}: {
  brand: BrandConfig;
  homeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <Link href={homeHref} onClick={onNavigate} className="flex items-center gap-2.5 px-5 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.iconSrc ?? "/icon-192.png"} alt="" className="h-9 w-9 shrink-0 rounded-[9px]" />
      <div className="leading-tight">
        {brand.eyebrow && (
          <div className="text-[10px] tracking-[0.08em] text-[#707070]">{brand.eyebrow}</div>
        )}
        <div className="whitespace-nowrap text-sm font-bold text-[#333333]">{brand.title}</div>
        {brand.subtitle && <div className="text-[10px] text-[#707070]">{brand.subtitle}</div>}
      </div>
    </Link>
  );
}

/**
 * PFシリーズ共通のアプリシェル。
 * - PC: 左サイドバー（ロゴ・ナビ・ポータル・ユーザー情報）
 * - モバイル: ハンバーガー＋ドロワー、ヘッダに常設のホームボタン
 *
 * アプリ固有の要素（認証・承認バッジ・工場ピッカー等）は props のスロットで注入する。
 * このパッケージは next-auth に依存しない。
 */
export default function AppShell({
  children,
  nav,
  brand,
  isAdmin = false,
  bareRoutes = DEFAULT_BARE_ROUTES,
  homeHref = "/",
  accent = "#f27524",
  navIndicator = "bar",
  background = "#f8fafc",
  portalUrl = "https://portal.paloma-pf.com",
  sidebarTop,
  sidebarFooter,
  headerRight,
  contentTop,
  topBanner,
  idleLogout,
  viewModeSwitch = true,
  stickyScrollbarX = true,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("auto");
  const [deviceKind, setDeviceKind] = useState<DeviceKind>("shared");
  const mainRef = useRef<HTMLElement>(null);
  const bare = bareRoutes.includes(pathname);

  // 保存済みの表示モード・端末種別を復元する。SSR とクライアントの初回描画を一致させる
  // （ハイドレーション不一致を避ける）ため、マウント後に読む。
  useEffect(() => {
    // 切替 UI を出さないアプリでは保存値も無視する（固定モードへの閉じ込め防止）
    if (viewModeSwitch) {
      const v = localStorage.getItem(VIEW_MODE_KEY);
      if (v === "pc" || v === "mobile") setViewMode(v);
    }
    setDeviceKind(readDeviceKind());
  }, [viewModeSwitch]);

  // 無操作の自動ログアウト。ログイン画面等（bare）では計測しない。
  // フックは早期 return より前で必ず呼ぶ（呼び出し順を変えないため）。
  const { warningSec, extend } = useIdleLogout({
    enabled: Boolean(idleLogout) && (idleLogout?.enabled ?? true) && !bare,
    idleMs: IDLE_MS[deviceKind],
    onTimeout: idleLogout?.onTimeout ?? (() => {}),
  });

  function changeViewMode(m: ViewMode) {
    setViewMode(m);
    try {
      localStorage.setItem(VIEW_MODE_KEY, m);
    } catch {
      /* プライベートモード等で保存できなくても切替自体は効かせる */
    }
  }

  function changeDeviceKind(k: DeviceKind) {
    setDeviceKind(k);
    writeDeviceKind(k);
  }

  if (bare) {
    return <>{children}</>;
  }

  const navProps = {
    nav,
    isAdmin,
    portalUrl,
    accent,
    indicator: navIndicator,
  };

  // 表示モードごとのシェル切替。auto は従来どおり CSS（wide バリアント）に任せ、
  // pc / mobile は画面サイズに関係なくレイアウトを固定する。
  const asideVis =
    viewMode === "pc" ? "flex" : viewMode === "mobile" ? "hidden" : "hidden wide:flex";
  const headerVis =
    viewMode === "pc" ? "hidden" : viewMode === "mobile" ? "flex" : "flex wide:hidden";
  const drawerVis = viewMode === "auto" ? " wide:hidden" : "";
  // PC固定時は最小幅を確保し、狭い端末では横スクロールで全体を見られるようにする
  const rootMinW = viewMode === "pc" ? " min-w-[768px]" : "";

  return (
    <div
      // paddingTop はノッチ／Dynamic Island の分。ホーム画面に追加した iOS の
      // スタンドアロン表示でブランドラインが隠れないようにする。
      // 対応外の端末やブラウザ表示では env() が 0px になるので影響しない。
      style={{ backgroundColor: background, paddingTop: "env(safe-area-inset-top)" }}
      className={`print-root flex h-screen flex-col overflow-hidden${rootMinW}`}
    >
      {/* アプリのブランドライン */}
      <div style={{ backgroundColor: accent }} className="no-print h-1 shrink-0" />
      {topBanner}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* PC サイドバー */}
        <aside
          className={`no-print w-64 shrink-0 flex-col border-r border-[#e5e5e5] bg-white ${asideVis}`}
        >
          <Brand brand={brand} homeHref={homeHref} />
          {sidebarTop && <div className="px-5 pb-2 empty:hidden">{sidebarTop}</div>}
          <div className="flex-1 overflow-y-auto py-2">
            <NavLinks {...navProps} />
          </div>
          {viewModeSwitch && <ViewModeSwitch mode={viewMode} onChange={changeViewMode} />}
          {idleLogout && (idleLogout.deviceKindSwitch ?? true) && (
            <DeviceKindSwitch kind={deviceKind} onChange={changeDeviceKind} />
          )}
          {sidebarFooter}
        </aside>

        {/* モバイルドロワー */}
        {drawerOpen && viewMode !== "pc" && (
          <div className={`fixed inset-0 z-40${drawerVis}`}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside
              className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex items-center justify-between pr-2">
                <Brand
                  brand={brand}
                  homeHref={homeHref}
                  onNavigate={() => setDrawerOpen(false)}
                />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="メニューを閉じる"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarTop && <div className="px-5 pb-2 empty:hidden">{sidebarTop}</div>}
              <div className="flex-1 overflow-y-auto py-2">
                <NavLinks {...navProps} onNavigate={() => setDrawerOpen(false)} />
              </div>
              {viewModeSwitch && <ViewModeSwitch mode={viewMode} onChange={changeViewMode} />}
              {idleLogout && (idleLogout.deviceKindSwitch ?? true) && (
                <DeviceKindSwitch kind={deviceKind} onChange={changeDeviceKind} />
              )}
              {sidebarFooter}
            </aside>
          </div>
        )}

        {/* メイン */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={`h-14 items-center gap-3 border-b border-[#e5e5e5] bg-white px-3 no-print ${headerVis}`}
          >
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded p-2 text-[#555555] hover:bg-[#f7f7f5]"
              aria-label="メニューを開く"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link href={homeHref} className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.iconSrc ?? "/icon-192.png"} alt="" className="h-7 w-7 rounded-md" />
              <span className="truncate whitespace-nowrap text-sm font-bold text-[#333333]">
                {brand.title}
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {headerRight}
              {/* どの画面からでもワンタップでホームへ戻れる常設ボタン */}
              <Link
                href={homeHref}
                aria-label="ホームへ戻る"
                className="rounded p-2 text-[#555555] hover:bg-[#f7f7f5]"
              >
                <Home className="h-6 w-6" />
              </Link>
            </div>
          </header>
          {contentTop}
          <main ref={mainRef} className="print-main min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
          {stickyScrollbarX && <StickyScrollbarX containerRef={mainRef} />}
        </div>
      </div>
      {idleLogout && warningSec != null && (
        <IdleWarningDialog
          seconds={warningSec}
          onExtend={extend}
          onLogout={idleLogout.onTimeout}
        />
      )}
    </div>
  );
}
