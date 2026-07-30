# @paloma-pf/ui

Palomaシリーズ（PFアプリ）の**共通UIパッケージ**。各アプリにコピーされていた共通部品をここに集約し、
1か所の修正が全アプリへ反映されるようにする。

現在の収録範囲（v1）:

- **`AppShell`** — PCサイドバー／モバイルドロワー／モバイルヘッダ（**常設のホームボタン**付き）
- **`useScanWedge`** — ハンディターミナルのハードウェアスキャナ入力を受け取るフック

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

## `useScanWedge`（ハンディターミナル対応）

Zebra MC2200/MC2700 等のハンディターミナルは、トリガーで読み取ったコードを
**キーボード入力として送出する**（DataWedge のキーストローク出力）。
このフックはその入力を拾い、カメラ読み取りと同じ処理へ流す。

```tsx
"use client";

import { useScanWedge } from "@paloma-pf/ui";

export default function ScanScreen() {
  useScanWedge({ onScan: (code) => handleDecoded(code) });
  // カメラ読み取りの onDecoded も同じ handleDecoded を呼ぶ
}
```

| オプション | 既定 | 説明 |
|---|---|---|
| `onScan` | （必須） | 読み取り確定時に呼ばれる。引数はスキャン文字列 |
| `enabled` | `true` | `false` の間は待ち受けを止める |
| `minLength` | `3` | これ未満の長さは読み取りとみなさない |
| `maxInterKeyMs` | `60` | 1文字ごとの許容間隔。超えたら人の手入力とみなす |
| `flushMs` | `120` | Enter が来ない設定向け。無入力がこの時間続いたら確定 |

挙動の要点:

- **入力欄にフォーカスがあるときは何もしない**。スキャン文字列はその欄に直接入るため、
  欄側で処理させる（二重処理の防止）。フォーム充填はこの経路を使う
- 人の手入力と区別するため、**打鍵間隔が `maxInterKeyMs` 以内で連続した文字**だけを1回の読み取りとして扱う
- 確定は Enter（DataWedge の既定サフィックス）。Enter を付けない設定でも `flushMs` で確定する

端末側は DataWedge のプロファイルで、対象アプリ＝ブラウザ（Chrome）／出力＝キーストローク／
サフィックス＝Enter を設定しておく。

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

> **補足**: タグを push できない環境から公開しているため、各アプリはタグではなく
> コミットSHAを参照している。現在は全アプリが v1.4.0
> （`68e3ef668db99903204c2fccf3824cc0270b36f8`）に統一済み。

## 導入済みアプリ

`pf-setsubi` / `pf-hinshitsu` / `pf-tenchu` / `pf-kanagata` / `pf-keisoku` / `pf-hoju` / `pf-zaiko`
（7アプリ）

`pf-plan` は対象外。AppShell の役割が認証ゲート＋デモ制御で、ナビは別コンポーネント
（`Sidebar` + `uiStore`）が持つ構造のため、共通化の利得よりも挙動リスクが上回る。
ホームボタンのみ同アプリに直接追加している。

`pf-portal`（静的HTML）・`pf-zumen`（Vite）・`pf-sekisai` / `pf-load` / `pf-load-calc`
（別構成）は AppShell を持たないため対象外。

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

## アプリ間で統一している表記・アイコン

シェル以外にアプリ側へコピーして置いている部品（UserFooter・承認バッジ等）も、
以下の規約で全アプリ統一とする。新規アプリ・改修時はこれに合わせる。

- **ブランド表記** — `brand.eyebrow` に「株式会社パロマ」を全アプリで指定。
  サブタイトルはアプリごとの説明文として任意
- **お問い合わせリンク** — アイコンは lucide の `Mail`
  （リンク先はポータルの問い合わせフォーム `?contact=<app>`）
- **承認バッジ** — アイコンは lucide の `Stamp`、赤ピル
  （`bg-[#dc2626]` / hover `#b91c1c` 相当）
- **サイドバー下部（UserFooter）** — 表示は「会社名 / 氏名」のみ（役割バッジなし）。
  グレーはパッケージと同じ中立系 hex（文字 `#333333`・`#555555`・`#707070`・`#909090`、
  枠 `#e5e5e5`、ホバー背景 `#f7f7f5`）を使い、slate 系クラスは使わない
