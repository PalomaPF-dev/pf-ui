"use client";

import { useEffect, useRef } from "react";

/**
 * ハンディターミナル（Zebra MC2200/MC2700 等）のハードウェアスキャナ入力を受け取るフック。
 *
 * これらの端末はトリガーで読み取ったコードを「キーボード入力」として送出する
 * （Zebra なら DataWedge のキーストローク出力）。カメラを使わないため、
 * 現場では片手・高速に読み取れる。カメラ読み取りと併用でき、どちらで読んでも
 * 同じ onScan が呼ばれるようにするのが基本の使い方。
 *
 * 判定は「打鍵が速いこと」で行う。人の手入力は1文字ごとの間隔が広く、
 * スキャナは数ミリ秒で送り切るため、`maxInterKeyMs` 以内に連続した文字だけを
 * 1回の読み取りとして扱う。確定は Enter（DataWedge の既定サフィックス）だが、
 * Enter を付けない設定でも拾えるよう、無入力が `flushMs` 続いた時点でも確定する。
 *
 * 入力欄（input/textarea/select/contenteditable）にフォーカスがあるときは何もしない。
 * その場合はスキャン文字列がその欄に直接入るため、欄側で処理させる（二重処理の防止）。
 */
export interface ScanWedgeOptions {
  /** 読み取り確定時に呼ばれる。引数はスキャンされた文字列。 */
  onScan: (code: string) => void;
  /** false の間は待ち受けを止める。既定 true */
  enabled?: boolean;
  /** これ未満の長さは読み取りとみなさない。既定 3 */
  minLength?: number;
  /** 1文字ごとの許容間隔(ms)。これを超えたら人の手入力とみなす。既定 60 */
  maxInterKeyMs?: number;
  /** Enter が来ないときに確定するまでの無入力時間(ms)。既定 120 */
  flushMs?: number;
}

export function useScanWedge(options: ScanWedgeOptions): void {
  const { onScan, enabled = true, minLength = 3, maxInterKeyMs = 60, flushMs = 120 } = options;

  // onScan は毎レンダー変わりうるので、待ち受けを張り直さずに済むよう ref 経由で参照する
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let buffer = "";
    let lastAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const reset = () => {
      buffer = "";
      clearTimer();
    };
    const emit = () => {
      const code = buffer;
      reset();
      if (code.length >= minLength) onScanRef.current(code);
    };

    /** 入力欄にフォーカスがあるか（そこへスキャン文字列が直接入るので手を出さない） */
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) {
        reset();
        return;
      }

      const now = Date.now();

      if (e.key === "Enter") {
        // 直前の文字から間が空いていれば、人が押した Enter とみなして捨てる
        if (buffer.length >= minLength && now - lastAt <= maxInterKeyMs) {
          e.preventDefault();
          emit();
        } else {
          reset();
        }
        return;
      }

      // Shift 等の修飾キー単独は無視（バッファは保つ）
      if (e.key.length !== 1) return;

      // 間隔が空いたら、前の読み取りとは別物として引き継がない
      if (now - lastAt > maxInterKeyMs) buffer = "";
      buffer += e.key;
      lastAt = now;

      clearTimer();
      timer = setTimeout(emit, flushMs);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimer();
    };
  }, [enabled, minLength, maxInterKeyMs, flushMs]);
}
