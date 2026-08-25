"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

/** バー全体の高さ（px）。本文の下端をこの分だけ譲る。 */
const BAR_H = 14;
/** つまみの最小幅（px）。中身が極端に広くても掴めるようにする。 */
const MIN_THUMB = 28;

/** 横スクロールできる要素か（中身がはみ出していて overflow-x が auto/scroll）。 */
function scrollsX(el: HTMLElement) {
  if (el.scrollWidth - el.clientWidth <= 1) return false;
  const ox = getComputedStyle(el).overflowX;
  return ox === "auto" || ox === "scroll";
}

/**
 * いま画面に映っている横スクロール領域を探す。
 * DOM 全体を舐めると重い（数千行の表が出る画面がある）ため、
 * 表示領域の数点を elementsFromPoint で拾い、その並びだけを見る。
 */
function findTarget(container: HTMLElement, cr: DOMRect): HTMLElement | null {
  const x = cr.left + cr.width / 2;
  for (const ratio of [0.5, 0.75, 0.25]) {
    const y = cr.top + cr.height * ratio;
    if (y < 0 || y > window.innerHeight) continue;
    for (const el of document.elementsFromPoint(x, y)) {
      if (!(el instanceof HTMLElement)) continue;
      // container 自身に届いたら、そこから上は本文の外なので次の点へ。
      // container 自身が横スクロールする場合は、そのスクロールバーが元々
      // 画面下端に出ているので、ここでは拾わない（二重表示の防止）。
      if (el === container) break;
      if (container.contains(el) && scrollsX(el)) return el;
    }
  }
  return null;
}

/** バーの見た目に関わる値。変化したときだけ再描画する。 */
interface Geom {
  /** container の左端からのずれ（対象と横位置を合わせる） */
  left: number;
  /** 対象の見えている幅＝トラックの幅 */
  width: number;
}

export interface StickyScrollbarXProps {
  /** 監視するスクロール領域。AppShell では本文の `<main>`。 */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * 本文の下端に貼り付く横スクロールバー。
 *
 * 縦に長い表を `overflow-x-auto` で包むと、その表自身の横スクロールバーは
 * 表の一番下（＝画面のはるか下）に付くため、縦に最後までスクロールしないと
 * 横へ動かせない。この部品は「いま見えている横スクロール領域」を検出して、
 * 同じ動きをするバーを本文の下端に常時出す。
 *
 * つまみは自前で描く。OS やブラウザによってはスクロールバーが「操作中だけ
 * 重ねて出る」（macOS・iOS・Android）ため、ネイティブのスクロールバーでは
 * 「常に出ている」状態にできないため。
 *
 * 対象自身のスクロールバーが既に見えているとき（短い表など）や、本文そのものが
 * 横にはみ出しているときは、二重にならないよう出さない。
 */
export default function StickyScrollbarX({ containerRef }: StickyScrollbarXProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const keyRef = useRef("");
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const [geom, setGeom] = useState<Geom | null>(null);

  /** つまみの位置と幅を対象のスクロール位置から引き直す（再描画は挟まない）。 */
  const layoutThumb = useCallback(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const target = targetRef.current;
    if (!track || !thumb || !target) return;
    const trackW = track.clientWidth;
    const max = target.scrollWidth - target.clientWidth;
    const thumbW = Math.max(MIN_THUMB, Math.min(trackW, (target.clientWidth / target.scrollWidth) * trackW));
    const left = max > 0 ? (target.scrollLeft / max) * (trackW - thumbW) : 0;
    thumb.style.width = `${thumbW}px`;
    thumb.style.transform = `translateX(${Math.round(left)}px)`;
  }, []);

  const measure = useCallback(() => {
    // 毎フレーム呼ばれるので、レイアウトが変わっていないときは再描画しない
    const apply = (g: Geom | null) => {
      const key = g ? `${Math.round(g.left)}/${Math.round(g.width)}` : "";
      if (key === keyRef.current) return;
      keyRef.current = key;
      setGeom(g);
    };

    const container = containerRef.current;
    if (!container) {
      targetRef.current = null;
      apply(null);
      return;
    }

    const cr = container.getBoundingClientRect();
    // ドラッグ中は対象を切り替えない（掴んだまま別の表に移らないように）
    const target = dragRef.current ? targetRef.current : findTarget(container, cr);
    targetRef.current = target;
    if (!target) {
      apply(null);
      return;
    }

    // 対象自身のスクロールバーが見えているなら重ねて出さない。
    // BAR_H 分の余裕を持たせ、出す／引っ込めるの往復を防ぐ。
    const tr = target.getBoundingClientRect();
    if (tr.bottom <= cr.bottom - BAR_H) {
      apply(null);
      return;
    }

    apply({ left: Math.max(0, tr.left - cr.left), width: target.clientWidth });
    layoutThumb();
  }, [containerRef, layoutThumb]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    schedule();
    // 子要素の scroll は bubble しないので capture で拾う
    container.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    const mo = new MutationObserver(schedule);
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      container.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      mo.disconnect();
    };
  }, [containerRef, measure]);

  // バーが出た直後・幅が変わった直後は、対象の現在位置につまみを合わせる
  useEffect(() => {
    layoutThumb();
  }, [geom, layoutThumb]);

  /** トラック上の x 座標（トラック左端からの距離）へ、つまみの中心を移す。 */
  function scrollToTrackX(x: number) {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const target = targetRef.current;
    if (!track || !thumb || !target) return;
    const trackW = track.clientWidth;
    const thumbW = thumb.getBoundingClientRect().width;
    const max = target.scrollWidth - target.clientWidth;
    const room = trackW - thumbW;
    if (room <= 0 || max <= 0) return;
    const left = Math.min(Math.max(x - thumbW / 2, 0), room);
    target.scrollLeft = (left / room) * max;
  }

  function onThumbPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const target = targetRef.current;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startScroll: target.scrollLeft };
  }

  function onThumbPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const target = targetRef.current;
    if (!drag || !track || !thumb || !target) return;
    const room = track.clientWidth - thumb.getBoundingClientRect().width;
    const max = target.scrollWidth - target.clientWidth;
    if (room <= 0 || max <= 0) return;
    target.scrollLeft = drag.startScroll + ((e.clientX - drag.startX) / room) * max;
    layoutThumb();
  }

  function onThumbPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    scrollToTrackX(e.clientX - track.getBoundingClientRect().left);
    layoutThumb();
  }

  if (!geom) return null;

  return (
    <div
      className="no-print shrink-0 border-t border-[#e5e5e5] bg-white"
      style={{ height: BAR_H }}
    >
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-label="横スクロール"
        className="relative cursor-pointer rounded-full bg-[#f7f7f5]"
        style={{ marginLeft: geom.left, width: geom.width, height: BAR_H - 4, top: 2 }}
      >
        <div
          ref={thumbRef}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          onPointerCancel={onThumbPointerUp}
          className="absolute left-0 top-0 h-full cursor-grab rounded-full bg-[#909090] active:cursor-grabbing hover:bg-[#707070]"
          style={{ width: MIN_THUMB, touchAction: "none" }}
        />
      </div>
    </div>
  );
}
