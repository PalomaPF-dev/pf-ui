"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, X, LayoutGrid } from "lucide-react";

/** サイドバーのナビ1件。 */
export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** true の場合 isAdmin のときだけ表示（マスタ設定など） */
  adminOnly?: boolean;
}

export interface BrandConfig {
  /** アプリ名（例「PF設備管理」） */
  title: string;
  /** 補足（例「設備管理・点検」）。省略可 */
  subtitle?: string;
  /** アイコン画像のパス。既定 "/icon-192.png" */
  iconSrc?: string;
}

export interface AppShellProps {
  children: ReactNode;
  /** サイドバーのナビ項目（アプリごとに異なる） */
  nav: NavItem[];
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
  /** ポータルへのリンク。null を渡すと非表示。既定 "https://portal.paloma-pf.com" */
  portalUrl?: string | null;
  /** サイドバー上部のスロット（承認バッジ・工場ピッカーなど） */
  sidebarTop?: ReactNode;
  /** サイドバー下部のスロット（ログインユーザー情報・ログアウト） */
  sidebarFooter?: ReactNode;
  /** モバイルヘッダ右側のスロット（承認バッジなど。ホームボタンの左に入る） */
  headerRight?: ReactNode;
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

function NavLinks({
  nav,
  isAdmin,
  portalUrl,
  onNavigate,
}: {
  nav: NavItem[];
  isAdmin: boolean;
  portalUrl: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {nav
        .filter((n) => !n.adminOnly || isAdmin)
        .map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-r-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-[#f27524] bg-[#f27524]/5 text-[#f27524]"
                  : "border-transparent text-[#555555] hover:bg-[#f7f7f5] hover:text-[#333333]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      {portalUrl && (
        <>
          {/* PFアプリポータルへ（外部リンクなので通常の a タグ） */}
          <div className="my-1 border-t border-[#eeeeee]" />
          <a
            href={portalUrl}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-r-lg border-l-[3px] border-transparent px-3 py-2.5 text-sm font-medium text-[#555555] transition-colors hover:bg-[#f7f7f5] hover:text-[#333333]"
          >
            <LayoutGrid className="h-5 w-5 shrink-0" />
            ポータル
          </a>
        </>
      )}
    </nav>
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
      <img src={brand.iconSrc ?? "/icon-192.png"} alt="" className="h-9 w-9 rounded-[9px]" />
      <div className="leading-tight">
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
  portalUrl = "https://portal.paloma-pf.com",
  sidebarTop,
  sidebarFooter,
  headerRight,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (bareRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="print-root flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* パロマ・ブランドライン */}
      <div className="no-print h-1 shrink-0 bg-[#f27524]" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* PC サイドバー */}
        <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-[#e5e5e5] bg-white wide:flex">
          <Brand brand={brand} homeHref={homeHref} />
          {sidebarTop && <div className="px-5 pb-2 empty:hidden">{sidebarTop}</div>}
          <div className="flex-1 overflow-y-auto py-2">
            <NavLinks nav={nav} isAdmin={isAdmin} portalUrl={portalUrl} />
          </div>
          {sidebarFooter}
        </aside>

        {/* モバイルドロワー */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 wide:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
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
                <NavLinks
                  nav={nav}
                  isAdmin={isAdmin}
                  portalUrl={portalUrl}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </div>
              {sidebarFooter}
            </aside>
          </div>
        )}

        {/* メイン */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-[#e5e5e5] bg-white px-3 wide:hidden no-print">
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
          <main className="print-main flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
