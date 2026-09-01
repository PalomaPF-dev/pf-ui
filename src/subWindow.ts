"use client";

/**
 * 別ウィンドウ（サブウィンドウ）を開く。
 *
 * 業務アプリでは「使い方ガイドを見ながら操作する」「作業を中断せずに問い合わせを書く」
 * ように、**アプリの画面を閉じずに別の画面を同時に開いておきたい**場面がある。
 * 画面遷移だと入力中の内容が消えるため、別ウィンドウで開く。
 *
 * 同じ `name` のウィンドウを既に開いている場合は**読み込み直さずに前面へ出すだけ**にする。
 * 問い合わせフォームに書きかけの内容がある状態でもう一度押しても消えないようにするため。
 */

/** 開いたウィンドウ。name ごとに1つ持つ（このタブが生きているあいだ有効） */
const opened = new Map<string, Window>();

export interface SubWindowOptions {
  /** ウィンドウ名。同じ名前なら同じウィンドウを使い回す。既定は href */
  name?: string;
  /** 幅(px)。既定 520 */
  width?: number;
  /** 高さ(px)。既定 760 */
  height?: number;
  /**
   * ウィンドウの大きさを指定せず、ブラウザ任せ（多くは新しいタブ）で開くか。
   * 別アプリを丸ごと開くときなど、小窓が向かない場合に true にする。既定 false
   */
  tab?: boolean;
}

/** 画面内に収まる位置・大きさに整える（マルチディスプレイでも開いた画面側に出す）。 */
function features(width: number, height: number): string {
  const availW = typeof screen !== "undefined" && screen.availWidth ? screen.availWidth : 1280;
  const availH = typeof screen !== "undefined" && screen.availHeight ? screen.availHeight : 800;
  const w = Math.min(width, availW - 40);
  const h = Math.min(height, availH - 80);
  // 親ウィンドウの右隣に出す。はみ出す場合は画面内へ寄せる
  const baseX = typeof window.screenX === "number" ? window.screenX : 0;
  const baseY = typeof window.screenY === "number" ? window.screenY : 0;
  const left = Math.max(baseX + 40, Math.min(baseX + window.outerWidth - w - 40, baseX + availW - w - 20));
  const top = Math.max(baseY + 40, baseY + 60);
  return `popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
}

/**
 * 別ウィンドウで開く。開けたら true、ポップアップがブロックされたら false。
 * false のときは呼び出し側で従来どおりのリンク遷移（新しいタブ）に任せる。
 */
export function openSubWindow(href: string, options: SubWindowOptions = {}): boolean {
  if (typeof window === "undefined") return false;
  const { name, width = 520, height = 760, tab = false } = options;
  const key = name ?? href;

  const prev = opened.get(key);
  if (prev && !prev.closed) {
    // 既に開いている画面は読み込み直さない（書きかけの内容を消さないため）
    try {
      prev.focus();
      return true;
    } catch {
      /* 参照できなくなっていれば開き直す */
    }
  }

  let w: Window | null = null;
  try {
    w = window.open(href, key, tab ? undefined : features(width, height));
  } catch {
    return false;
  }
  if (!w) return false;
  opened.set(key, w);
  try {
    w.focus();
  } catch {
    /* 前面に出せなくても開いてはいる */
  }
  return true;
}
