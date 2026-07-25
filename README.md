# @paloma-pf/ui

Palomaシリーズ（PFアプリ）の**共通UIパッケージ**。各アプリにコピーされていた共通部品をここに集約し、
1か所の修正が全アプリへ反映されるようにする。

現在の収録範囲（v1）:

- **`AppShell`** — PCサイドバー／モバイルドロワー／モバイルヘッダ（**常設のホームボタン**付き）

> ソース（TypeScript/TSX）をそのまま配布し、利用側の Next.js が `transpilePackages` で
> トランスパイルする。ビルド成果物を持たないため、リリース＝タグを打つだけ。

## 導入

### 1. 依存に追加

```bash
npm i "github:PalomaPF-dev/pf-ui#<タグ または コミットSHA>"
```

`package.json` には次のように入る。**必ずタグかコミットSHAで固定**する
（`main` を指すと不意の破壊的変更を拾うため）:

```json
"@paloma-pf/ui": "github:PalomaPF-dev/pf-ui#52be09237792868800ce0fc48df3ad5c11cd712e"
```

タグを打てる環境なら `#v1.0.0` のようにタグ参照でよい。

### 2. `next.config.ts` でトランスパイル対象にする

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@paloma-pf/ui"],
};
```

### 3. Tailwind にクラスを認識させる（Tailwind v4）

`src/app/globals.css` に `@source` を追加する。これが無いとスタイルが当たらない。

```css
@import "tailwindcss";
@source "../../node_modules/@paloma-pf/ui/src";
```

サイドバーの表示切替に `wide:` バリアントを使っているため、利用側に同名の定義が必要
（既存アプリには既に入っている）:

```css
/* 幅が広く かつ 高さも十分＝タブレット/PC。横向きスマホはドロワーに隠す */
@custom-variant wide (@media (min-width: 768px) and (min-height: 600px));
```

## 使い方

```tsx
"use client";

import { AppShell, type NavItem } from "@paloma-pf/ui";
import { LayoutDashboard, Factory, Settings } from "lucide-react";

const NAV: NavItem[] = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/equipment", label: "設備台帳", icon: Factory },
  { href: "/settings", label: "設定", icon: Settings, adminOnly: true },
];

export default function Shell({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  return (
    <AppShell
      nav={NAV}
      brand={{ title: "PF設備管理", subtitle: "設備管理・点検" }}
      isAdmin={isAdmin}
      sidebarTop={<ApprovalNoticeBadge />}       {/* 任意スロット */}
      headerRight={<ApprovalNoticeBadge compact />}
      sidebarFooter={<UserFooter />}             {/* next-auth 依存はアプリ側に置く */}
    >
      {children}
    </AppShell>
  );
}
```

### props

| prop | 既定 | 説明 |
|---|---|---|
| `nav` | （必須） | ナビ項目。`adminOnly: true` は `isAdmin` のときだけ表示。フラットな `NavItem[]` のほか、見出し付きの `NavGroup[]`（`{ title?, items }`）も渡せる |
| `brand` | （必須） | `{ title, subtitle?, iconSrc? }`。ロゴはホームへのリンクを兼ねる |
| `isAdmin` | `false` | `adminOnly` ナビの表示可否 |
| `accent` | `"#f27524"` | アプリのアクセント色（6桁HEX）。ブランドライン・アクティブなナビに使う |
| `navIndicator` | `"bar"` | アクティブなナビの見せ方。`"bar"`=左ボーダー / `"pill"`=角丸＋左の丸バー |
| `background` | `"#f8fafc"` | コンテンツ背景色 |
| `bareRoutes` | ログイン系4パス | シェルを出さないパス |
| `homeHref` | `"/"` | ホームのパス |
| `portalUrl` | ポータルURL | `null` で非表示 |
| `sidebarTop` | — | サイドバー上部スロット（承認バッジ・工場ピッカー等） |
| `sidebarFooter` | — | サイドバー下部スロット（ユーザー情報・ログアウト） |
| `headerRight` | — | モバイルヘッダ右スロット（ホームボタンの左に入る） |
| `contentTop` | — | 本文の直前に出すスロット（「閲覧専用」バナー等。PC・モバイル共通） |
| `topBanner` | — | ブランドライン直下・サイドバーより上に全幅で出すスロット（全画面共通バナー） |

## 設計方針

- **認証に依存しない** — `next-auth` を使う UserFooter 等はアプリ側が `sidebarFooter` に注入する。
  アプリごとに認証構成が違うため、パッケージ側では持たない。
- **アプリ固有の要素はスロットで** — 承認バッジ・工場ピッカーなどは props で差し込む。
- `next` / `react` / `lucide-react` は **peerDependencies**（利用側のものを使う）。

## リリース手順

1. `src/` を変更してコミット
2. `package.json` の `version` を上げる
3. タグを打つ: `git tag v1.1.0 && git push origin v1.1.0`
4. 各アプリで `npm i "github:PalomaPF-dev/pf-ui#v1.1.0"` に更新してPR

破壊的変更はメジャーを上げ、アプリ側は順次追従する（固定参照なので一斉更新は不要）。

> **補足**: v1.0.0 時点ではタグを push できない環境から公開したため、各アプリは
> コミットSHA `52be09237792868800ce0fc48df3ad5c11cd712e` を参照している。
> あとから `v1.0.0` タグを同じコミットに打っておくと参照が読みやすくなる。

## 対象アプリ

AppShell を持つPFアプリ: `pf-setsubi` / `pf-zaiko` / `pf-hoju` / `pf-tenchu` / `pf-kanagata` /
`pf-keisoku` / `pf-hinshitsu` / `pf-plan`

## 運営

Paloma

## アプリごとのテーマ

アクセント色・ナビ装飾はアプリごとに異なるため props で指定する（既定は設備アプリのオレンジ）。

| アプリ | `accent` | `navIndicator` |
|---|---|---|
| pf-setsubi | `#f27524` | `bar`（既定） |
| pf-zaiko | `#d44fe6` | `pill` |
| pf-hoju | `#65a30d` | `bar` |
| pf-tenchu | `#ea9b15` | `bar` |
| pf-kanagata | `#ea9b15` | `bar` |
| pf-keisoku | `#9162f4` | `bar` |
| pf-hinshitsu | `#1cb481` | `pill` |

アクセント色は Tailwind の動的クラスでは解決できない（ビルド時にクラス名を検出できない）ため、
inline style で適用している。
