# @paloma-pf/ui

Palomaシリーズ（PFアプリ）の**共通UIパッケージ**。各アプリにコピーされていた共通部品をここに集約し、
1か所の修正が全アプリへ反映されるようにする。

現在の収録範囲（v1）:

- **`AppShell`** — PCサイドバー／モバイルドロワー／モバイルヘッダ（**常設のホームボタン**付き）。
  利用者が表示モード（自動 / PC / モバイル）を固定できる切替トグル内蔵
- **`UserIdentity`** — サイドバー下部のログインユーザー表示（所属／氏名・権限・扱えるデータの範囲）
- **`useIdleLogout`** — 無操作の自動ログアウト（端末種別で時間を切替・期限前に警告）
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

### 3. Tailwind にクラスを認識させる

パッケージの `src` を Tailwind の走査対象に入れる。これが無いとスタイルが当たらない。

**Tailwind v4**（`src/app/globals.css`）:

```css
@import "tailwindcss";
@source "../../node_modules/@paloma-pf/ui/src";
```

**Tailwind v3**（`tailwind.config.ts` の `content`）:

```ts
content: [
  './app/**/*.{js,ts,jsx,tsx,mdx}',
  './components/**/*.{js,ts,jsx,tsx,mdx}',
  './node_modules/@paloma-pf/ui/src/**/*.{ts,tsx}',
],
```

サイドバーの表示切替に `wide:` バリアントを使っているため、利用側に同名の定義が必要
（既存アプリには既に入っている）。

v4（`globals.css`）:

```css
/* 幅が広く かつ 高さも十分＝タブレット/PC。横向きスマホはドロワーに隠す */
@custom-variant wide (@media (min-width: 768px) and (min-height: 600px));
```

v3（`tailwind.config.ts` の `theme.extend.screens`）:

```ts
wide: { raw: '(min-width: 768px) and (min-height: 600px)' },
```

### 対応バージョン

`next >= 14` / `react >= 18` / `lucide-react >= 1`。Tailwind は v3・v4 どちらでも動く
（使っているのは任意値ユーティリティと `wide:` バリアントだけ）。

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
| `stickyScrollbarX` | `true` | 本文の下端に横スクロールバーを常時出す（v1.11.0〜）。`false` で従来どおり |

## 横スクロールバーを画面の下端に常時出す（v1.11.0〜）

横に広い表を `overflow-x-auto` で包むと、その表の横スクロールバーは**表の一番下**に付く。
表が縦に長いと画面のはるか下になるので、**縦に最後までスクロールしないと横へ動かせない**。
全アプリ共通の不便だったため、`AppShell` が本文の下端に横スクロールバーを出すようにした。

- **アプリ側の変更は不要**。`AppShell` を使っていれば自動で効く
- いま画面に映っている横スクロール領域を見つけて、そこへ繋ぐ。表を替えれば繋ぎ先も替わる
- **二重には出さない** — 対象自身のスクロールバーが既に見えているとき（短い表）や、
  本文そのものが横にはみ出しているとき（表示モード=PC で狭い端末を見ているときなど）は出さない
- 横スクロールする領域が画面に無いときは、バーごと消える（下端を占有しない）

つまみは自前で描いている。macOS・iOS・Android のスクロールバーは**操作中だけ重ねて出る**ため、
ブラウザ任せでは「常に出ている」状態にできないため。見た目は全アプリ共通の中立グレー
（つまみ `#909090` / ホバー `#707070` / トラック `#f7f7f5`）。

止めたい画面があれば `stickyScrollbarX={false}` を渡す。

```tsx
<AppShell nav={NAV} brand={BRAND} stickyScrollbarX={false}>{children}</AppShell>
```

対象の検出は本文の**横中央**を基準にしている。左右に分かれた画面で、横に広い表が
左右どちらかの列にだけ寄っている場合は拾えないことがある。その場合は表を包む
`overflow-x-auto` の高さを画面内に収める（`max-h-[...]`）ほうが確実。

## 表示モード（自動 / PC / モバイル）

サイドバー／ドロワーの下部に「表示モード」トグルが常設される（v1.6.0〜）。

- **自動**（既定） — 従来どおり画面サイズで切替（`wide` バリアント: 幅768px以上かつ高さ600px以上でサイドバー）
- **PC** — 画面サイズに関係なく常にサイドバー表示。狭い端末では最小幅768pxを確保し
  横スクロールで全体を見る（いわゆる「PC版サイト」表示）
- **モバイル** — 常にドロワー＋モバイルヘッダ。PCの大画面でモバイル画面を確認したいときにも使える

選択は `localStorage`（キー `pf-view-mode`）に保存され、次回以降も維持される。
SSR とハイドレーションを一致させるため初回描画は常に「自動」で行い、マウント後に保存値を反映する。

## `UserIdentity`（ログインユーザー表示）

サイドバー下部（`sidebarFooter`）に置く表示部品（v1.7.0〜）。全アプリで同じ見た目にするために切り出した。

```
第一工場 品質管理 / 山田太郎
[管理者]  第一工場のデータのみ
```

```tsx
<UserIdentity
  affiliation={affiliation}   // 所属。工場所属なら「工場名 職場名」
  name={session.user.name}
  role={role}                 // ポータル由来の 'admin' | 'member' | 'worker'
  scope="第一工場のデータのみ" // このアプリで扱えるデータの範囲
/>
```

| prop | 既定 | 説明 |
|---|---|---|
| `name` | 必須 | 氏名 |
| `affiliation` | — | 所属（部署名。工場所属なら「工場名 職場名」）。`null` なら氏名だけ |
| `department` | `null` | 部署名（工場所属なら工場名）。`affiliation` を渡さないときだけ使う |
| `workplace` | `null` | 職場名。`affiliation` を渡さないときだけ使う |
| `role` | 必須 | ポータルから連携された役割。`'admin'` のときだけ「管理者」と出す |
| `portalAdmin` | `false` | ポータル管理権限（`can_manage`）を持つ人。`true` なら「ポータル管理」と出す |
| `scope` | `null` | このアプリで扱えるデータの範囲。`null` なら出さない |
| `scopeWarning` | `false` | `scope` を赤字の注意書きにする |

権限の文言・色はポータルの表示と揃えてある。ポータルは「一般 ＜ 管理者 ＜ ポータル管理」の3段だが、
**ポータル管理の人は各アプリへ管理者として連携される**ので、たいていのアプリでは上2段の区別が消えて
2段になる（`portalAdmin` を渡さない）。ポータル管理を実際に区別しているアプリ——人事管理は
人事考課・基本給与・設定をポータル管理者だけに限っている——だけが `portalAdmin` を渡す。

`scope` の文言をアプリ側が決めるのは、絞り込みの規則がアプリごとに違うため（工場・部署・担当取引先など）。
ログアウト等は next-auth 依存でアプリごとに異なるため、この部品は表示だけを受け持つ。

### 所属の組み立て（`formatAffiliation`・v1.10.0〜）

所属の行は**全アプリで同じ並び・同じ区切り**にする。規則はひとつだけ:

```
部署名 + 半角スペース + 職場名   （工場所属の人は部署名の位置に工場名が入る）
```

材料はポータルの `/api/provision` が各アプリへ送る `department` / `workplace` で、
各アプリの `users` テーブル（`portal_department` / `portal_workplace` など）に入っている。
**工場かどうかで欄が変わるわけではない** — ポータルの部署マスタは工場も部署も同じ名前欄で
持っていて、工場所属の人は `department` に工場名が入る。だから分岐は要らず、
空でない方を半角スペースで繋ぐだけでよい。

この結合を各アプリで書き写さずに済むよう、パッケージから出している:

```ts
import { formatAffiliation } from "@paloma-pf/ui";

// DBから読んだ値をそのまま渡してよい（null・空白のみは落ちる）
const affiliation = formatAffiliation({
  department: row.portal_department,
  workplace: row.portal_workplace,
});
// → "第一工場 品質管理" / "生産管理部" / 所属が無ければ null
```

サーバー側で組み立てず、`UserIdentity` にそのまま渡してもよい:

```tsx
<UserIdentity department={user.department} workplace={user.workplace} name={name} role={role} />
```

`affiliation` を渡したときはそちらを優先する（`null` を渡せば「所属を出さない」指示として
そのまま効く）ので、既存アプリは変更なしで動く。移行するときは、各アプリの
`getUserAffiliation` にある結合処理を `formatAffiliation` の呼び出しへ置き換える。

## 無操作の自動ログアウト（v1.9.0〜）

共用PCに**ログインしたまま放置される**のを防ぐ。`AppShell` に `idleLogout` を渡すと有効になる。

```tsx
<AppShell
  idleLogout={{
    onTimeout: () => {
      // 自アプリの Cookie を消してから、ポータルの一括ログアウトへ
      void signOut({ redirect: false }).then(() => {
        window.location.href = "https://portal.paloma-pf.com/?logout=1";
      });
    },
  }}
>
```

`onTimeout` をアプリ側に持たせているのは、認証（next-auth）に依存しないため。
**ログアウト先をポータルの `?logout=1` にすると、14か所すべてのログインが落ちる**
（ポータルが各アプリの `/api/logout` を順に叩く既存の仕組みに乗る）。個別に切ると
「ポータルは切れたのに在庫管理は生きている」状態が残るので、必ずここへ渡すこと。

### 端末種別で時間を変える

サイドバーに「この端末」の切替が出る。表示モードと同じく端末ごとの設定（`localStorage`）。

| 種別 | 無操作でログアウト | 想定 |
|---|---|---|
| 共用 | **15分** | 現場の共用PC・ハンディ端末 |
| 個人 | **60分** | 自席のPC・自分のスマホ |

**既定は「共用」**（安全側）。置きっぱなしで他人が使えるほうが、早めに切れて再ログインが要るより困るため。

`localStorage` はオリジンごとなので13アプリでは共有できない。ポータルで選んだ値は SSO のときに
`pf_device` cookie で各アプリへ渡り、その端末で明示的に選び直すまで既定値として使われる
（優先順位: この端末の `localStorage` → ポータル由来の cookie → `shared`）。

### 挙動

- 期限の**60秒前**に警告ダイアログ（「使用を続ける」／「ログアウト」）。入力中のデータを失わせない
- 残り時間は**タイマーの積算ではなく最終操作時刻との差**で判定する。バックグラウンドのタブは
  `setInterval` が間引かれるため、積算だと復帰時に期限切れを見逃す
- 同一オリジンの別タブでの操作は `localStorage` 経由で共有する
- ログイン画面など `bareRoutes` では計測しない

### サーバー側の上限も必ず設定すること

このフックはクライアント側の仕組みなので、タブを閉じられたり JS を止められたら効かない。
利用側は next-auth の `session.maxAge` にも上限を入れる（PFシリーズは**12時間**で統一）:

```ts
session: { strategy: "jwt", maxAge: 12 * 60 * 60, updateAge: 15 * 60 },
```

SSO でセッションを発行しているアプリは、`/api/sso` 側の `maxAge` も同じ値に揃えること
（片方だけ直すと SSO 経由のログインが長いまま残る）。

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
  アプリごとに認証構成が違うため、パッケージ側では持たない。`UserIdentity` は表示だけを受け持ち、
  値の取得（DB参照）とログアウト操作はアプリ側に残す。
- **アプリ固有の要素はスロットで** — 承認バッジ・工場ピッカーなどは props で差し込む。
- `next` / `react` / `lucide-react` は **peerDependencies**（利用側のものを使う）。

## リリース手順

1. `src/` を変更してコミット
2. `package.json` の `version` を上げる
3. タグを打つ: `git tag v1.1.0 && git push origin v1.1.0`
4. 各アプリで `npm i "github:PalomaPF-dev/pf-ui#v1.1.0"` に更新してPR

破壊的変更はメジャーを上げ、アプリ側は順次追従する（固定参照なので一斉更新は不要）。

> **補足**: タグを push できない環境から公開しているため、各アプリはタグではなく
> コミットSHAを参照している。v1.6.0（表示モード切替）・v1.7.0（`UserIdentity`）・
> v1.8.0（対応バージョンの拡大）はいずれも全アプリ一斉に更新している
> （各アプリの実際の参照SHAは package.json を参照）。

## 導入済みアプリ

ポータルからアカウントを配る**13アプリすべて**が本パッケージを使う:

`pf-setsubi` / `pf-hinshitsu` / `pf-tenchu` / `pf-kanagata` / `pf-keisoku` / `pf-hoju` /
`pf-zaiko` / `pf-purchasing` / `pf-jinji` / `pf-operation` / `pf-plan`（生産計画 keikaku） /
`pf-load-calc`（生産日報 nippou） / `pf-sekisai`（出荷積載 sekisai）

`pf-sekisai` は Next 14 / React 18 / Tailwind v3 のため長らく AppShell を
`components/pf-ui/` へ直置きコピーしていたが、v1.8.0 で対応バージョンを広げて
パッケージ参照に一本化した（コピーは削除済み。二重管理はもう無い）。

`pf-portal`（静的HTML）・`pf-zumen`（Vite）は Next.js のシェル構成を持たないため対象外。
`pf-load` はポータル外の iOS 向けアプリで対象外。

## 運営

Paloma

## アプリごとのテーマ

アクセント色・ナビ装飾はアプリごとに異なるため props で指定する（既定は設備アプリのオレンジ）。

| アプリ | `accent` | `navIndicator` |
|---|---|---|
| pf-setsubi | `#f27524` | `bar`（既定） |
| pf-zaiko | `#d44fe6` | `pill` |
| pf-hoju | `#65a30d` | `bar` |
| pf-tenchu | `#3a86a6` | `bar` |
| pf-kanagata | `#ea9b15` | `bar` |
| pf-keisoku | `#9162f4` | `bar` |
| pf-hinshitsu | `#1cb481` | `pill` |
| pf-purchasing | `#e11d48` | `pill` |
| pf-jinji | `#2563eb` | `bar` |
| pf-operation | `#9a6c48` | `pill` |

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
