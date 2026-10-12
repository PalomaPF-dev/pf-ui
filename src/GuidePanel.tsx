"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  FileDown,
  Maximize2,
  Minus,
  X,
} from "lucide-react";

/**
 * 作業しながら見るガイド（使い方）の枠。PFシリーズ共通（PF作業改善・品質管理・設備管理・
 * スクラップ・単価申請などが各自に持っていた同じ作りを、ここにまとめたもの）。
 *
 * どの画面でも「ガイド」で開け、**開いたままその画面を操作できる**（モーダルにしない:
 * 下敷きの暗幕もスクロール止めもない）。シェルの中に置くので、画面を移っても閉じない。
 * - PC（横幅が広い）: 右に縦長の枠を出し、本文の列をその分だけ狭める（枠が本文に重ならない）。
 *   幅は「標準 / 広い」の2段
 * - スマホ・タブレット: 下から出るシート。「たたむ（帯だけ）/ 半分 / 全体」を切り替え、
 *   読むときは広げ、操作するときはたたむ。たたむ・半分のときは本文の列をシートの分だけ縮めるので、
 *   本文の下端に貼り付くボタンの帯（sticky）もシートのすぐ上に来て隠れない。
 *   全体に広げたときは読み終えるまでの一時的な状態なので、本文は半分のときと同じだけ縮めたままにする
 *   （戻したときに入力欄の位置が飛ばないように）。全体でも上の帯（メニュー・ホーム）と上部の帯
 *   （閲覧専用など）は隠さない（本文の上端を測る）。サイドバーが出るタブレットではサイドバーを隠さない
 *
 * 中身はアプリが渡す（GuideConfig.Content。使い方ページと同じ本文を1節ずつ出す）。
 * 開いたときは、いまの画面に当たる節（GuideConfig.sectionFor）を出す。画面を移ったときは:
 * - 利用者が節を選んでいない（画面に合わせて出している）間は、移った先の画面の節に切り替える
 * - 利用者が自分で別の節を選んでいたら、読んでいる所（スクロール位置）を崩さないよう切り替えず、
 *   「この画面の説明は…［切り替える］」を出すだけにする（いまの画面の節を選び直すと、また自動で切り替わる）
 * - 説明の節がない画面では、最後に出していた画面の節をそのまま出しておく
 *
 * 開閉と大きさ（PCの幅・スマホのシートの高さ）は端末に覚える（localStorage。使えなくても動く）。
 * 外部の値（localStorage・画面幅）は useSyncExternalStore で読む（サーバーの描画とそろえるため）。
 * 使い方ページそのもの・印刷用ページ（GuideConfig.hidden）と、ログイン画面（シェルのない画面）・印刷では出さない。
 *
 * AppShell を使わない画面（現場モードの端末など）は GuideHost で同じ枠を出せる。
 *
 * 開いている間は `<html data-pf-guide="side|sheet">` と CSS 変数
 * `--pf-guide-w`（PCの枠の幅）・`--pf-guide-sheet-h`（シートの高さ）・`--pf-guide-avoid-h`
 * （本文を縮めている高さ）を出す。画面に固定（position: fixed）で下端に出しているボタンなどを
 * シートの上へ逃がしたいアプリは、これを使って位置を変える。
 */

/** ガイドの節（使い方ページの見出し・スライド1枚分） */
export interface GuideSection {
  /** 節の識別子。使い方ページのアンカー（/guide#id）を兼ねることが多い */
  id: string;
  /** 見出し */
  title: string;
  /** 枠の選択肢・たたんだ帯に出す名前（「3. 補充計画」のように番号を付けるなど）。省略時は title */
  short?: string;
  /** 読む人の区分（GuideConfig.groups の id。「現場向け」「管理者向け」など）。区分を分けないアプリは省略 */
  group?: string;
}

/** 読む人の区分（「現場向け / 管理者向け」のように、同じ画面の説明を読む人で分けるアプリ向け） */
export interface GuideGroup {
  id: string;
  label: string;
}

/** 節の本文を描く部品に渡すもの */
export interface GuideContentProps {
  /** 出す節 */
  id: string;
  /** 本文の中のリンクから別の節へ移る（「次の説明」「→ 3. 承認する を見る」など） */
  select: (id: string) => void;
  /**
   * いま開いている画面の説明がある節（なければ null。候補が複数あるときは、いまの区分で優先するもの）。
   * 「この画面を開く」のような、その画面へ移るリンクをいまの画面の節では出さない、などに使う
   */
  routeId: string | null;
  /** いま開いている画面の説明がある節のすべて（sectionFor が複数返したとき） */
  routeIds: string[];
}

/** 作業しながら見るガイドの設定（AppShell・GuideHost の guide に渡す） */
export interface GuideConfig {
  /**
   * 節の一覧（枠の選択肢の順）。権限で見せる節を絞るときは、絞ったものを渡す。
   * 見出しが本文と同じ重いファイルにあるときは、代わりに loadSections で開いたときに読み込む
   */
  sections?: GuideSection[];
  /**
   * 節の一覧を、枠を開いたときに読み込む（sections を渡さないとき）。
   * 例: `() => import("@/lib/guideSlides").then((m) => m.GUIDE_SLIDES.map((s) => ({ id: s.id, title: s.title })))`。
   * 読み込むまでは選択欄を出さず、本文だけを出す
   */
  loadSections?: () => Promise<GuideSection[]>;
  /** 説明の節がない画面で最初に開いたときに出す節（節の一覧を読み込む前に使う）。既定は一覧の先頭 */
  defaultSection?: string;
  /**
   * 画面（URL のパスと検索条件）→ その画面の説明がある節の id。なければ null。
   * 説明が複数の節にまたがる画面は、優先する順に並べた配列で返す（いま出している節がその中にあれば切り替えない）。
   * 検索条件（`?approval=pending` など）で見分けるときは watchSearch を true にする（search は先頭の ? を含まない）
   */
  sectionFor: (pathname: string, search: string) => string | string[] | null;
  /** sectionFor に URL の検索条件を渡す（既定 false。true のときだけ useSearchParams で見る） */
  watchSearch?: boolean;
  /**
   * 読む人の区分（「現場向け / 管理者向け」など）。2つ以上あれば枠の上に切り替えを出し、
   * 選択欄はいまの区分の節だけにする。画面に合わせて切り替えるときも、いまの区分の節を優先する
   */
  groups?: GuideGroup[];
  /**
   * 節の本文を描く部品。全画面のシェルに使い方の本文と写真まで抱えさせないよう、
   * アプリ側で next/dynamic（ssr: false）にして渡す。読み込めなかったときの表示もアプリ側で決める。
   */
  Content: ComponentType<GuideContentProps>;
  /** false のあいだは出さない（未ログインなど）。既定 true */
  enabled?: boolean;
  /**
   * 枠を出さない画面。既定は使い方ページ（/guide 以下）と、パスが /print で終わる画面（帳票の印刷）。
   * ログイン画面などシェルのない画面（bareRoutes）では、これと関係なく出さない
   */
  hidden?: (pathname: string) => boolean;
  /** 「使い方を全部見る」のリンク先。既定 `/guide#${id}`。null で出さない */
  pageHref?: ((id: string) => string) | null;
  /** 「PDFで保存」のリンク先（印刷用ページ）。節ごとに変えるときは関数。省略・null で出さない */
  pdfHref?: string | ((id: string) => string) | null;
  /**
   * PDF の保存のしかたの案内（例「印刷画面で『PDFに保存』を選んでください」）。
   * 「PDFで保存」のツールチップと、枠の下の注記に出す
   */
  pdfHint?: string;
  /** 枠の下の帯に足すもの（アプリ固有のリンクなど）。節ごとに変えるときは関数 */
  footer?: ReactNode | ((id: string) => ReactNode);
  /** 選択欄の左右に「前へ・次へ」のボタンを出す（既定 false） */
  pager?: boolean;
  /**
   * 本文を先に読み込んでおく（圏外になってから開いても出せるように）。出せる画面に来て4秒後に1度だけ呼ぶ。
   * 端末が「データ節約」にしているときは呼ばない
   */
  preload?: () => Promise<unknown>;
  /** ボタンと見出しの名前。既定「ガイド」 */
  label?: string;
  /** PC の枠の幅（px）。既定 { narrow: 420, wide: 540 } */
  widths?: { narrow: number; wide: number };
  /** スマホのシートを「半分」にしたときの高さ（CSS の長さ）。既定 "50dvh" */
  halfHeight?: string;
  /**
   * 開閉と大きさを覚える localStorage のキー。既定 "pf-guide-panel"。
   * アプリごとに別のドメインなので、ふつうは既定のままでよい
   */
  storageKey?: string;
}

/** 右に並べる（PC）か、下から出す（スマホ・タブレット）かの境目。サイドバー（256px）＋枠＋本文が収まる幅 */
const SIDE_QUERY = "(min-width: 1100px) and (min-height: 600px)";
/** サイドバーが出る画面（AppShell の wide と同じ条件） */
const WIDE_QUERY = "(min-width: 768px) and (min-height: 600px)";
const DEFAULT_WIDTHS = { narrow: 420, wide: 540 };
const DEFAULT_HALF = "50dvh";
const DEFAULT_STORAGE_KEY = "pf-guide-panel";
/** たたんだときの帯（見出しと、いまの節の名前） */
const SHEET_MIN = "calc(3.25rem + env(safe-area-inset-bottom))";
/** 全体に広げたとき（本文の上端を測れないとき）: 上のヘッダ（メニュー・ホーム）は隠さない */
const SHEET_FULL_PHONE = "calc(100dvh - 3.75rem - env(safe-area-inset-top))";
/** 全体に広げたとき（同。サイドバーが出る画面）: 上のヘッダがないので画面の上端まで */
const SHEET_FULL_WIDE = "calc(100dvh - 4px - env(safe-area-inset-top))";
/** 枠の id。アプリが自前で「ガイド」ボタンを置くときは aria-controls にこれを入れる */
export const GUIDE_PANEL_ID = "pf-guide-panel";
const PANEL_TITLE_ID = "pf-guide-panel-title";

type PanelWidth = "narrow" | "wide";
type SheetSize = "min" | "half" | "full";

interface Saved {
  open: boolean;
  width: PanelWidth | null;
  sheet: SheetSize;
}

export function defaultGuideHidden(pathname: string): boolean {
  return pathname === "/guide" || pathname.startsWith("/guide/") || /\/print$/.test(pathname);
}

const defaultPageHref = (id: string) => `/guide#${encodeURIComponent(id)}`;

/* ---------- 端末に覚える値（localStorage）と画面幅。useSyncExternalStore で読む ---------- */

function readSaved(key: string): Saved {
  const def: Saved = { open: false, width: null, sheet: "half" };
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return def;
    return {
      open: v.open === true,
      // 各アプリのコピーだった頃の保存値（"normal"）も読めるようにする
      width: v.width === "wide" ? "wide" : v.width === "narrow" || v.width === "normal" ? "narrow" : null,
      sheet: v.sheet === "min" || v.sheet === "half" || v.sheet === "full" ? v.sheet : "half",
    };
  } catch {
    return def;
  }
}

/** 保存値の入れ物（キーごと。サーバーの描画では使わない） */
function createSavedStore(key: string) {
  let cache: Saved | null = null;
  const listeners = new Set<() => void>();
  const get = (): Saved => {
    if (!cache) {
      const s = readSaved(key);
      // 幅を決めていない端末は、画面が十分に広ければ「広い」から始める
      cache = { ...s, width: s.width ?? (window.innerWidth >= 1600 ? "wide" : "narrow") };
    }
    return cache;
  };
  return {
    get,
    update(patch: Partial<Saved>) {
      cache = { ...get(), ...patch };
      try {
        localStorage.setItem(key, JSON.stringify(cache));
      } catch {
        /* プライベートモード等で保存できなくても、開閉自体は効かせる */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

const stores = new Map<string, ReturnType<typeof createSavedStore>>();
function savedStore(key: string) {
  let s = stores.get(key);
  if (!s) {
    s = createSavedStore(key);
    stores.set(key, s);
  }
  return s;
}

/**
 * 入力中の欄が、本文（main）の上下に貼り付いた帯（sticky）やシートに隠れていたら、見える所までスクロールする。
 * 枠の中の欄は対象にしない。
 */
function revealActiveField() {
  const a = document.activeElement;
  if (!(a instanceof HTMLElement) || a === document.body || a.closest(`#${GUIDE_PANEL_ID}`)) return;
  const main = a.closest("main");
  if (!main) return;
  const m = main.getBoundingClientRect();
  let top = m.top;
  let bottom = m.bottom;
  for (const el of Array.from(main.querySelectorAll<HTMLElement>(".sticky"))) {
    if (el.contains(a)) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    if (r.top <= m.top + 24 && r.bottom < m.bottom) top = Math.max(top, r.bottom);
    else if (r.bottom >= m.bottom - 1 && r.top > m.top) bottom = Math.min(bottom, r.top);
  }
  const ar = a.getBoundingClientRect();
  if (ar.top < top) main.scrollBy({ top: ar.top - top - 8 });
  else if (ar.bottom > bottom) main.scrollBy({ top: ar.bottom - bottom + 8 });
}

/** URL の検索条件を見て渡す（GuideConfig.watchSearch のときだけ。useSearchParams は Suspense の中で使う） */
function SearchWatcher({ onChange }: { onChange: (search: string) => void }) {
  const params = useSearchParams();
  const search = params?.toString() ?? "";
  useEffect(() => {
    onChange(search);
  }, [search, onChange]);
  return null;
}

/** AppShell・GuideHost が置く。watchSearch でないアプリでは何も描かない */
export function GuideSearchWatcher({ state }: { state: GuideState }) {
  if (!state.config?.watchSearch) return null;
  return (
    <Suspense fallback={null}>
      <SearchWatcher onChange={state.setSearch} />
    </Suspense>
  );
}

function useMedia(query: string): boolean | null {
  const subscribe = useCallback(
    (l: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => null
  );
}

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

/* ---------- 状態 ---------- */

/** AppShell・GuideHost が持つガイドの状態。枠・ボタン・本文の列の余白がこれを見る */
export interface GuideState {
  config: GuideConfig | null;
  /** この画面でガイドを出せるか */
  available: boolean;
  open: boolean;
  /** 枠が画面に出ているか（保存値・画面幅を読み終えて、開いていて、出せる画面のとき） */
  shown: boolean;
  /** true = PC の右の枠 / false = 下から出るシート */
  side: boolean;
  /** PC の枠の幅（px） */
  widthPx: number;
  width: PanelWidth;
  setWidth: (w: PanelWidth) => void;
  sheet: SheetSize;
  setSheet: (s: SheetSize) => void;
  /** シートの高さ（CSS の長さ） */
  sheetHeight: string;
  /** 本文の列を縮める高さ（全体に広げている間は半分のときの高さ） */
  avoidHeight: string;
  /** 節の一覧（loadSections のときは、読み込むまで空） */
  sections: GuideSection[];
  /** 読む人の区分（節が2つ以上の区分にまたがるときだけ。それ以外は空） */
  groups: GuideGroup[];
  /** シートの左端（サイドバーが出ている画面ではサイドバーを隠さない） */
  sheetLeft: string;
  section: string;
  /** いまの画面の説明がある節のうち、いま出している節（の区分）で優先するもの。なければ null */
  routeSection: string | null;
  /** いまの画面の説明がある節のすべて */
  routeIds: string[];
  /** 自分で別の節を選んでいる間に出す「この画面の説明は…［切り替える］」の行き先 */
  offer: string | null;
  follow: boolean;
  /** URL の検索条件を受け取る（watchSearch のとき GuideSearchWatcher から） */
  setSearch: (search: string) => void;
  select: (id: string) => void;
  toggle: () => void;
  /** 節を指定して開く（ホームの「ガイドを見ながら作業」など） */
  openAt: (id: string) => void;
  close: () => void;
  /** ボタンで開いたときだけ枠の見出しへ移る印（React 18 の型でも書き換えられるよう、素の入れ物の型にする） */
  focusOnOpenRef: { current: boolean };
}

/**
 * AppShell・GuideHost の中で呼ぶ。
 * - viewMode: AppShell の表示モード（サイドバーが出ているかの判定に使う。サイドバーのない画面は "mobile"）
 * - topRef: 本文（main）。シートを全体に広げたとき、その上端（上の帯・上部の帯の下）から下いっぱいにする
 */
export function useGuideState(
  config: GuideConfig | undefined,
  pathname: string,
  bare: boolean,
  viewMode: "auto" | "pc" | "mobile",
  topRef?: RefObject<HTMLElement | null>
): GuideState {
  const key = config?.storageKey ?? DEFAULT_STORAGE_KEY;
  const store = config ? savedStore(key) : null;
  const hidden = config?.hidden ?? defaultGuideHidden;
  const available = Boolean(config) && (config?.enabled ?? true) && !bare && !hidden(pathname);
  // URL の検索条件（watchSearch のアプリだけ。GuideSearchWatcher が入れる）
  const [search, setSearch] = useState("");
  const rawRoute = config ? config.sectionFor(pathname, config.watchSearch ? search : "") : null;
  const routeKey = rawRoute == null ? "" : Array.isArray(rawRoute) ? rawRoute.join("\n") : rawRoute;
  // 中身（routeKey）が同じなら同じ配列を使う
  const routeIds = useMemo(() => (routeKey ? routeKey.split("\n") : []), [routeKey]);

  // 保存値と画面幅は、サーバーの描画では null（初回描画をサーバーとそろえる）
  const saved = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.get : nullSnapshot,
    nullSnapshot
  );
  const sideMq = useMedia(SIDE_QUERY);
  const wideMq = useMedia(WIDE_QUERY);
  const loaded = saved !== null && sideMq !== null;
  const open = saved?.open ?? false;
  const width: PanelWidth = saved?.width ?? "narrow";
  const sheet: SheetSize = saved?.sheet ?? "half";
  const widths = config?.widths ?? DEFAULT_WIDTHS;
  const half = config?.halfHeight ?? DEFAULT_HALF;
  // サイドバーが出ているか（表示モードで固定していればそれに従う）
  const sidebarShown = viewMode === "pc" ? true : viewMode === "mobile" ? false : Boolean(wideMq);
  const side = Boolean(sideMq);

  // 節の一覧を後から読み込むアプリは、枠を開いたときに読み込む（全画面のシェルに見出しまで抱えさせない）
  const loader = config?.sections ? undefined : config?.loadSections;
  const [loadedSections, setLoadedSections] = useState<GuideSection[] | null>(null);
  const needLoad = Boolean(loader) && available && open && loadedSections === null;
  useEffect(() => {
    if (!needLoad || !loader) return;
    let cancelled = false;
    loader()
      .then((list) => {
        if (!cancelled) setLoadedSections(list);
      })
      .catch(() => {
        /* 読み込めなくても本文（Content）は出す。本文の側が読み込めない旨を出す */
      });
    return () => {
      cancelled = true;
    };
  }, [needLoad, loader]);
  const sections = useMemo(() => config?.sections ?? loadedSections ?? [], [config?.sections, loadedSections]);
  const firstSection = sections[0]?.id ?? config?.defaultSection ?? "";

  const update = store?.update;
  const setOpen = useCallback((v: boolean) => update?.({ open: v }), [update]);
  const setWidth = useCallback((w: PanelWidth) => update?.({ width: w }), [update]);
  const setSheet = useCallback((s: SheetSize) => update?.({ sheet: s }), [update]);

  // 読む人の区分（節が2つ以上の区分にまたがるときだけ切り替えを出す）
  const groupOf = (id: string | null) => (id ? sections.find((x) => x.id === id)?.group : undefined);
  const usedGroups = new Set(sections.map((x) => x.group).filter(Boolean));
  const groups = (config?.groups ?? []).filter((g) => usedGroups.has(g.id));
  /** この画面の説明のうち、prefer を優先して1つ選ぶ（prefer そのもの → 同じ区分 → 先頭） */
  const pick = (prefer: string | null): string | null => {
    if (routeIds.length === 0) return null;
    if (prefer && routeIds.includes(prefer)) return prefer;
    const g = groupOf(prefer);
    return (g && routeIds.find((id) => groupOf(id) === g)) || routeIds[0];
  };

  /** 利用者が選んだ節（画面に合わせている間は使わない） */
  const [chosen, setChosen] = useState<string>(routeIds[0] ?? firstSection);
  /** true = 画面に合わせて節を出している（利用者がまだ自分で選んでいない） */
  const [follow, setFollow] = useState(true);
  /**
   * 画面に合わせて出している節。説明の節がない画面へ移ったときは、これを出したままにする。
   * 移った先の画面の説明にいま出している節も入っていれば、切り替えない（読んでいる所を崩さない）
   */
  const [lastRoute, setLastRoute] = useState<string>(routeIds[0] ?? firstSection);
  // 自分で選んだ節が、移った先の画面の説明だったら、また画面に合わせて切り替える
  // （本文の「画面を開く」・節を指定して開く openAt でその節の画面へ移ったときなど）
  const [seenRoute, setSeenRoute] = useState(routeKey);
  if (seenRoute !== routeKey) {
    setSeenRoute(routeKey);
    if (!follow && routeIds.includes(chosen)) {
      setFollow(true);
      setLastRoute(chosen);
    }
  }
  const followTarget = pick(lastRoute) ?? lastRoute;
  if (followTarget !== lastRoute) setLastRoute(followTarget);
  // 一覧を読み込む前は、どの id も出せるものとして扱う
  const known = (id: string) => id !== "" && (sections.length === 0 || sections.some((x) => x.id === id));
  const section = follow
    ? known(followTarget)
      ? followTarget
      : firstSection
    : known(chosen)
      ? chosen
      : (pick(chosen) ?? firstSection);
  const routeSection = pick(section);
  const offer = !follow && routeSection && !routeIds.includes(section) ? routeSection : null;
  /** ボタンで開いたときだけ枠へ移る（読み込み時に開いた状態を戻すときは、操作中の欄から奪わない） */
  const focusOnOpenRef = useRef(false);

  const select = useCallback(
    (id: string) => {
      setChosen(id);
      // いまの画面の説明を選び直したら、また画面に合わせて切り替える
      const keepFollow = routeIds.includes(id);
      setFollow(keepFollow);
      if (keepFollow) setLastRoute(id);
    },
    [routeIds]
  );

  const openAt = useCallback(
    (id: string) => {
      select(id);
      focusOnOpenRef.current = true;
      setOpen(true);
    },
    [select, setOpen]
  );

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    // 開くときは、いまの画面の節から見せる
    setFollow(true);
    focusOnOpenRef.current = true;
    setOpen(true);
  }, [open, setOpen]);

  const close = useCallback(() => {
    setOpen(false);
    // 閉じたら、開いたボタンへ戻す（キーボード操作で迷子にしない）
    requestAnimationFrame(focusVisibleToggle);
  }, [setOpen]);

  const shown = available && open && loaded;

  // 本文を先に読み込んでおく（圏外になってから開いても出せるように）。データ節約の設定なら読まない
  const preload = config?.preload;
  useEffect(() => {
    if (!available || !preload) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const t = window.setTimeout(() => void preload().catch(() => {}), 4000);
    return () => window.clearTimeout(t);
  }, [available, preload]);

  // 全体に広げたシートの上端＝本文の上端（上の帯・上部の帯は、役割や画面で出たり出なかったりするので測る）
  const [fullTop, setFullTop] = useState<number | null>(null);
  const sheetFull = shown && !side && sheet === "full";
  useEffect(() => {
    if (!sheetFull) return;
    const measure = () => {
      const el = topRef?.current;
      setFullTop(el ? Math.max(0, Math.round(el.getBoundingClientRect().top)) : null);
    };
    // 描画が終わってから測る（画面を移った直後は上部の帯がまだ入れ替わっていないことがある）
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [sheetFull, topRef, pathname]);

  const sheetHeight =
    sheet === "min"
      ? SHEET_MIN
      : sheet === "half"
        ? half
        : fullTop != null
          ? `calc(100dvh - ${fullTop}px)`
          : sidebarShown
            ? SHEET_FULL_WIDE
            : SHEET_FULL_PHONE;
  const avoidHeight = sheet === "min" ? SHEET_MIN : half;

  // 画面に固定で出している部品をアプリ側で逃がせるよう、開いている間は html に印を付ける
  useEffect(() => {
    const root = document.documentElement;
    if (!shown) {
      delete root.dataset.pfGuide;
      return;
    }
    root.dataset.pfGuide = side ? "side" : "sheet";
    root.style.setProperty("--pf-guide-w", side ? `${widths[width]}px` : "0px");
    root.style.setProperty("--pf-guide-sheet-h", side ? "0px" : sheetHeight);
    root.style.setProperty("--pf-guide-avoid-h", side ? "0px" : avoidHeight);
    // 画面に残る高さ（図面などを画面の高さの割合で出すアプリ向け。var(--pf-guide-avail-h, 100dvh) で使う）
    if (side) root.style.removeProperty("--pf-guide-avail-h");
    else root.style.setProperty("--pf-guide-avail-h", `calc(100dvh - ${avoidHeight})`);
    // シートの分だけ本文を縮めたので、入力中の欄が隠れないよう見える所までスクロールし直す（縮んだあとの配置で測る）
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(revealActiveField);
    });
    // シートを出している間は、入力欄へ移ったときも同じようにする（スマホの「次へ」で下の欄へ移ったとき、
    // ブラウザは本文の上下に貼り付いた帯を気にせずにスクロールするので、その下に隠れることがある）
    const onFocus = () => {
      if (!side) requestAnimationFrame(revealActiveField);
    };
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("focusin", onFocus);
      delete root.dataset.pfGuide;
      root.style.removeProperty("--pf-guide-avail-h");
    };
  }, [shown, side, widths, width, sheetHeight, avoidHeight]);

  return {
    config: config ?? null,
    available,
    open,
    shown,
    side,
    widthPx: widths[width],
    width,
    setWidth,
    sheet,
    setSheet,
    sheetHeight,
    avoidHeight,
    sections,
    groups,
    sheetLeft: sidebarShown ? "16rem" : "0px",
    section,
    routeSection,
    routeIds,
    offer,
    follow,
    setSearch,
    select,
    toggle,
    openAt,
    close,
    focusOnOpenRef,
  };
}

/* ---------- アプリの画面から使う ---------- */

interface GuideApi {
  /** この画面でガイドを出せるか（ガイドを渡していないアプリ・使い方ページでは false） */
  available: boolean;
  open: boolean;
  toggle: () => void;
  /** 節を指定して開く */
  openAt: (id: string) => void;
}

export const GuideContext = createContext<GuideApi>({
  available: false,
  open: false,
  toggle: () => {},
  openAt: () => {},
});

/**
 * 画面の中から作業しながら見るガイドを開く（例: ホームの手順カードに「ガイドを見ながら作業」、
 * サイドバーのない現場モードの画面に置く「ガイド」ボタン）。
 * 自前のボタンには `aria-controls={GUIDE_PANEL_ID}` と `data-pf-guide-toggle` を付ける
 * （閉じたときにそのボタンへ戻るため）。
 * AppShell・GuideHost に guide を渡していないときは available が false で、何もしない。
 */
export function useGuide(): GuideApi {
  return useContext(GuideContext);
}

export function useGuideApi(state: GuideState): GuideApi {
  const { available, open, toggle, openAt } = state;
  return useMemo(() => ({ available, open, toggle, openAt }), [available, open, toggle, openAt]);
}

/* ---------- 部品 ---------- */

/** 見えている「ガイド」ボタン（サイドバーとスマホのヘッダの2か所にあり、片方は隠れている） */
function focusVisibleToggle() {
  const btns = Array.from(document.querySelectorAll<HTMLElement>("[data-pf-guide-toggle]"));
  btns.find((b) => b.offsetParent !== null)?.focus();
}

/** 6桁HEXに不透明度を足す（"#rrggbb" + "1A" など）。形が違えば undefined */
function tint(accent: string, alpha: string): string | undefined {
  return /^#[0-9a-fA-F]{6}$/.test(accent) ? `${accent}${alpha}` : undefined;
}

/** 「ガイド」ボタン。sidebar = PCのサイドバー（とスマホのメニュー）、header = スマホの上の帯 */
export function GuideToggle({
  state,
  variant,
  accent,
  onClick,
}: {
  state: GuideState;
  variant: "sidebar" | "header";
  accent: string;
  /** 押したあとに呼ぶ（メニューを閉じるなど） */
  onClick?: () => void;
}) {
  if (!state.available) return null;
  const { open, toggle } = state;
  const label = state.config?.label ?? "ガイド";
  const common = {
    type: "button" as const,
    onClick: () => {
      toggle();
      onClick?.();
    },
    "aria-expanded": open,
    "aria-controls": GUIDE_PANEL_ID,
    "data-pf-guide-toggle": "",
  };
  if (variant === "header") {
    return (
      <button
        {...common}
        aria-label={open ? `${label}を閉じる` : `${label}を開く（画面の説明を見ながら作業）`}
        style={open ? { backgroundColor: accent, color: "#fff" } : { color: accent }}
        className="no-print flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold hover:opacity-90"
      >
        <BookOpen className="h-5 w-5" />
        {label}
      </button>
    );
  }
  return (
    <button
      {...common}
      style={
        open
          ? { backgroundColor: accent, borderColor: accent, color: "#fff" }
          : { backgroundColor: tint(accent, "12"), borderColor: tint(accent, "66") ?? accent, color: accent }
      }
      className="no-print flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-opacity hover:opacity-90"
    >
      <BookOpen className="h-4 w-4 shrink-0" />
      <span className="grow text-left">{open ? `${label}を閉じる` : `${label}を見ながら作業`}</span>
    </button>
  );
}

/**
 * ガイドの枠。スマホは画面の下に固定したシート。
 * PC は placement="flow" なら置かれた場所（AppShell が本文の列の右に並べる）、
 * "fixed" なら画面の右端に固定（GuideHost。本文の右の余白は GuideHost が空ける）。
 */
export function GuidePanel({
  state,
  accent,
  placement = "flow",
}: {
  state: GuideState;
  accent: string;
  placement?: "flow" | "fixed";
}) {
  const {
    config,
    side,
    width,
    setWidth,
    widthPx,
    sheet,
    setSheet,
    sheetHeight,
    sheetLeft,
    sections,
    groups,
    section,
    select,
    routeSection,
    routeIds,
    offer,
    close,
    focusOnOpenRef,
  } = state;
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const minimized = !side && sheet === "min";

  // 節を替えたら先頭から（同じ節のまま画面を移ったときは、読んでいた所を保つ）
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [section]);

  // ボタンで開いたときは、枠の見出しへ移る（読み上げで「ガイド」の枠に入ったことが分かる）
  useEffect(() => {
    if (focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      titleRef.current?.focus();
    }
  });

  if (!config) return null;
  const { Content } = config;
  const label = config.label ?? "ガイド";
  const byId = (id: string | null) => (id ? sections.find((s) => s.id === id) : undefined);
  const shortOf = (id: string | null) => {
    const s = byId(id);
    return s ? (s.short ?? s.title) : "";
  };
  const pageHref = config.pageHref === null ? null : (config.pageHref ?? defaultPageHref)(section);
  const pdfHref = typeof config.pdfHref === "function" ? config.pdfHref(section) : (config.pdfHref ?? null);
  const footer = typeof config.footer === "function" ? config.footer(section) : config.footer;
  // 区分を分けるアプリは、選択欄にいまの区分の節だけを出す
  const group = groups.length > 1 ? byId(section)?.group : undefined;
  const list = group ? sections.filter((x) => x.group === group) : sections;
  const at = list.findIndex((x) => x.id === section);
  const prev = at > 0 ? list[at - 1] : null;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;
  const groupLabel = group ? groups.find((g) => g.id === group)?.label : undefined;
  /** 区分を切り替える: 切り替えた区分にこの画面の説明があればそれを、なければ先頭を出す */
  const switchGroup = (g: string) => {
    if (g === group) return;
    const here = routeIds.find((id) => byId(id)?.group === g);
    const first = sections.find((x) => x.group === g);
    const to = here ?? first?.id;
    if (to) select(to);
  };
  const linkStyle: CSSProperties = { color: accent };
  const fixedSide = side && placement === "fixed";

  const style: CSSProperties = side
    ? { width: widthPx, ...(fixedSide ? { top: "env(safe-area-inset-top)" } : {}) }
    : { height: sheetHeight, left: sheetLeft, paddingBottom: "env(safe-area-inset-bottom)" };

  return (
    <section
      id={GUIDE_PANEL_ID}
      aria-labelledby={PANEL_TITLE_ID}
      onKeyDown={(e) => {
        // 枠の中で Esc を押したら閉じる（本文側で押した Esc は各画面のものなので奪わない。
        // 写真の拡大表示などの Esc は、そちらが先に受けて止める）
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.stopPropagation();
          close();
        }
      }}
      style={style}
      className={`no-print flex flex-col bg-white ${
        side
          ? `border-l border-[#e5e5e5] shadow-[-4px_0_12px_rgba(15,23,42,0.06)] ${
              fixedSide ? "fixed bottom-0 right-0 z-30" : "shrink-0"
            }`
          : "fixed bottom-0 right-0 z-30 rounded-t-2xl border-t border-slate-300 shadow-[0_-6px_16px_rgba(15,23,42,0.12)]"
      }`}
    >
      {/* 見出しと操作 */}
      <div className={`shrink-0 ${minimized ? "" : "border-b border-[#e5e5e5]"}`}>
        {!side && (
          // シートのつまみ（押すと 帯 → 半分 → 全体 → 帯 の順に変わる）
          <button
            type="button"
            onClick={() => setSheet(sheet === "min" ? "half" : sheet === "half" ? "full" : "min")}
            className="flex w-full justify-center pb-0.5 pt-1.5"
            aria-label={sheet === "full" ? `${label}をたたむ` : `${label}を広げる`}
          >
            <span className="h-1 w-10 rounded-full bg-slate-300" />
          </button>
        )}
        <div className={`flex items-center gap-1 px-3 ${side ? "py-2" : "pb-1.5"}`}>
          <BookOpen className="h-4 w-4 shrink-0" style={{ color: accent }} />
          <h2
            id={PANEL_TITLE_ID}
            ref={titleRef}
            tabIndex={-1}
            className="min-w-0 grow truncate text-sm font-bold text-[#333333] outline-none"
          >
            {minimized ? (
              // 帯だけのときは、見出しを押すと半分に広げる
              <button
                type="button"
                onClick={() => setSheet("half")}
                className="flex w-full min-w-0 items-center text-left"
                aria-label={`${label}を広げる（いまの説明: ${shortOf(section)}）`}
              >
                <span className="shrink-0">{label}</span>
                <span className="ml-2 min-w-0 truncate font-normal text-[#707070]">{shortOf(section)}</span>
              </button>
            ) : (
              <>
                {label}
                {groupLabel && <span className="ml-2 text-xs font-normal text-[#707070]">{groupLabel}</span>}
              </>
            )}
          </h2>
          {side ? (
            <IconButton
              onClick={() => setWidth(width === "wide" ? "narrow" : "wide")}
              label={width === "wide" ? "幅を狭くする" : "幅を広くする"}
            >
              {width === "wide" ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </IconButton>
          ) : (
            <>
              {sheet !== "min" && (
                <IconButton onClick={() => setSheet("min")} label="たたむ（帯だけにする）">
                  <Minus className="h-4 w-4" />
                </IconButton>
              )}
              {sheet !== "half" && (
                <IconButton onClick={() => setSheet("half")} label="半分の高さにする">
                  {sheet === "min" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </IconButton>
              )}
              {sheet !== "full" && (
                <IconButton onClick={() => setSheet("full")} label="全体に広げる">
                  <Maximize2 className="h-4 w-4" />
                </IconButton>
              )}
            </>
          )}
          <IconButton onClick={close} label={`${label}を閉じる`}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        {!minimized && (
          <div className="space-y-1.5 px-3 pb-2">
            {groups.length > 1 && (
              // 読む人の区分の切り替え（現場向け / 管理者向け など）
              <div role="group" aria-label="対象者" className="flex overflow-hidden rounded-lg border border-slate-300">
                {groups.map((g, i) => {
                  const on = g.id === group;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => switchGroup(g.id)}
                      style={on ? { backgroundColor: accent, color: "#fff" } : undefined}
                      className={`min-h-9 flex-1 px-2 text-xs ${i > 0 ? "border-l border-slate-300" : ""} ${
                        on ? "font-bold" : "bg-white text-[#333333] hover:bg-[#f7f7f5]"
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            )}
            {list.length > 1 && (
              <div className="flex items-center gap-1.5">
                {config.pager && (
                  <PagerButton onClick={() => prev && select(prev.id)} disabled={!prev} label="前の説明">
                    <ChevronLeft className="h-4 w-4" />
                  </PagerButton>
                )}
                <label className="flex min-w-0 grow items-center gap-2">
                  <span className={`shrink-0 text-[11px] text-[#707070] ${config.pager ? "sr-only" : ""}`}>表示する説明</span>
                  <select
                    value={section}
                    onChange={(e) => select(e.target.value)}
                    className="min-w-0 grow rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-[#333333]"
                  >
                    {list.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.short ?? x.title}
                        {routeIds.includes(x.id) ? "（この画面）" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {config.pager && (
                  <PagerButton onClick={() => next && select(next.id)} disabled={!next} label="次の説明">
                    <ChevronRight className="h-4 w-4" />
                  </PagerButton>
                )}
              </div>
            )}
            {offer && (
              <p
                role="status"
                style={{ backgroundColor: tint(accent, "14") }}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1.5 text-xs text-[#333333]"
              >
                <span className="grow">この画面の説明は「{shortOf(offer)}」です</span>
                <button
                  type="button"
                  onClick={() => select(offer)}
                  style={{ borderColor: accent, color: accent }}
                  className="rounded border bg-white px-2.5 py-1 font-bold hover:opacity-80"
                >
                  切り替える
                </button>
              </p>
            )}
            {routeIds.length === 0 && sections.length > 1 && (
              <p className="text-[11px] leading-4 text-[#707070]">
                この画面だけの説明はありません。上の選択で、ほかの説明を見られます。
              </p>
            )}
          </div>
        )}
      </div>

      {/* 本文（たたんでいる間も消さず、読んでいた所を保つ） */}
      <div
        ref={bodyRef}
        hidden={minimized}
        className="min-h-0 grow overflow-y-auto overscroll-contain bg-[#f7f7f5] p-3"
      >
        {section && <Content id={section} select={select} routeId={routeSection} routeIds={routeIds} />}
      </div>

      {!minimized && (pageHref || pdfHref || footer) && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e5e5e5] px-3 py-2 text-xs">
          {/* 別のタブで開く（この画面の入力中の内容を失わないため） */}
          {pageHref && (
            <a
              href={pageHref}
              target="_blank"
              rel="noopener"
              style={linkStyle}
              className="flex items-center gap-1 font-medium hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              使い方を全部見る
            </a>
          )}
          {pdfHref && (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener"
              title={config.pdfHint}
              style={linkStyle}
              className="flex items-center gap-1 font-medium hover:underline"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDFで保存
            </a>
          )}
          {footer}
          {(pageHref || pdfHref) &&
            (pdfHref && config.pdfHint ? (
              <span className="basis-full text-[11px] leading-4 text-[#909090]">
                {pageHref ? "どちらも" : ""}別のタブで開きます。PDFは、{config.pdfHint}。
              </span>
            ) : (
              <span className="ml-auto text-[11px] text-[#909090]">別のタブで開きます</span>
            ))}
        </div>
      )}
    </section>
  );
}

function PagerButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-[#555555] hover:bg-[#f7f7f5] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md p-2 text-[#707070] hover:bg-[#f7f7f5] hover:text-[#333333]"
    >
      {children}
    </button>
  );
}

/**
 * AppShell を使わない画面（現場モードの端末のように、サイドバーを出さず画面いっぱいに1画面だけ出すもの）で、
 * 同じ作業しながら見るガイドの枠を出す。「ガイド」ボタンは画面側に置く（useGuide）。
 * PC は画面の右端に固定して、その分だけ中身の右に余白を空ける。スマホは下のシートの分だけ下に余白を足す。
 */
export function GuideHost({
  guide,
  accent = "#f27524",
  children,
}: {
  guide: GuideConfig;
  /** アプリのアクセントカラー（6桁HEX）。AppShell の accent と同じ値 */
  accent?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const state = useGuideState(guide, pathname, false, "mobile");
  const api = useGuideApi(state);
  const pad: CSSProperties = state.shown
    ? state.side
      ? { marginRight: state.widthPx }
      : { paddingBottom: state.avoidHeight }
    : {};
  return (
    <GuideContext.Provider value={api}>
      <GuideSearchWatcher state={state} />
      <div style={pad}>{children}</div>
      {state.shown && <GuidePanel state={state} accent={accent} placement="fixed" />}
    </GuideContext.Provider>
  );
}
