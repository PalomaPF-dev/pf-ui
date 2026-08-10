"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 端末の種別。無操作で自動ログアウトするまでの時間を決める。
 * - shared   … 現場の共用PC・ハンディ。短くする
 * - personal … 自席PC・個人のスマホ。長くする
 *
 * **既定は shared**（安全側）。「置きっぱなしで他人が使える」ほうが、
 * 「早めに切れて再ログインが要る」より困るため。
 */
export type DeviceKind = "shared" | "personal";

/** 端末種別の保存キー（localStorage）。表示モード(pf-view-mode)と同じく端末ごとの設定。 */
export const DEVICE_KIND_KEY = "pf-device-kind";

/**
 * ポータルが SSO のときに渡してくる端末種別の cookie。
 * localStorage はオリジンごとに分かれていて13アプリで共有できないため、
 * 「ポータルで1回選べば各アプリへ行き渡る」ようにこれで運ぶ（HttpOnly ではない）。
 */
const DEVICE_COOKIE = "pf_device";

/** 無操作でログアウトするまでの時間。 */
export const IDLE_MS: Record<DeviceKind, number> = {
  shared: 15 * 60 * 1000,
  personal: 60 * 60 * 1000,
};

/** 同一オリジンの別タブでの操作を拾うための保存キー。 */
const LAST_ACTIVITY_KEY = "pf-last-activity";

/** localStorage への書き込み間隔（毎イベント書くと重いので間引く）。 */
const WRITE_THROTTLE_MS = 5000;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function isDeviceKind(v: unknown): v is DeviceKind {
  return v === "shared" || v === "personal";
}

/**
 * この端末の種別を読む。localStorage（この端末で明示的に選んだ値）を最優先し、
 * 無ければポータルから届いた cookie、それも無ければ shared。
 * SSR とハイドレーションを一致させるため、呼ぶのはマウント後に限る。
 */
export function readDeviceKind(): DeviceKind {
  try {
    const v = localStorage.getItem(DEVICE_KIND_KEY);
    if (isDeviceKind(v)) return v;
  } catch {
    /* プライベートモード等で読めなければ次へ */
  }
  const c = readCookie(DEVICE_COOKIE);
  return isDeviceKind(c) ? c : "shared";
}

/** この端末の種別を保存する。保存できなくても選択自体は呼び出し側で効かせる。 */
export function writeDeviceKind(kind: DeviceKind): void {
  try {
    localStorage.setItem(DEVICE_KIND_KEY, kind);
  } catch {
    /* 保存できなくても今のセッションでは効かせる */
  }
}

/** 操作とみなすイベント。スクロールは passive で拾う（描画を妨げない）。 */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export interface UseIdleLogoutOptions {
  /** false のあいだは計測しない（未ログイン・認証ページなど） */
  enabled?: boolean;
  /** 無操作でログアウトするまで(ms) */
  idleMs: number;
  /** 期限の何秒前から警告を出すか。既定 60 */
  warnSec?: number;
  /** 期限切れ時に呼ぶ。実際のログアウト処理はアプリ側が行う */
  onTimeout: () => void;
}

export interface IdleLogoutState {
  /** 警告中の残り秒数。警告していないときは null */
  warningSec: number | null;
  /** 「継続する」。計測をやり直す */
  extend: () => void;
}

/**
 * 無操作の自動ログアウト。
 *
 * 残り時間は**タイマーの積算ではなく最終操作時刻との差**で判定する。
 * バックグラウンドのタブは setInterval が間引かれるため、積算だと復帰時に
 * 期限切れを見逃す（＝ログインが残る）。
 *
 * 同一オリジンの別タブでの操作は localStorage 経由で共有する。別オリジンの
 * 他アプリまでは共有できないので、そこはサーバー側のセッション上限で受ける。
 *
 * このフックは認証に依存しない。期限が来たら onTimeout を呼ぶだけで、
 * ログアウトの実処理（next-auth の signOut → ポータルの一括ログアウト）は
 * アプリ側に委ねる。
 */
export function useIdleLogout({
  enabled = true,
  idleMs,
  warnSec = 60,
  onTimeout,
}: UseIdleLogoutOptions): IdleLogoutState {
  const [warningSec, setWarningSec] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(0);
  const lastWriteRef = useRef<number>(0);
  const firedRef = useRef(false);
  // onTimeout は毎描画で作り直される想定なので、ref 経由で最新を呼ぶ
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const markActive = useCallback((persist: boolean) => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (persist && now - lastWriteRef.current >= WRITE_THROTTLE_MS) {
      lastWriteRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        /* 保存できなくてもこのタブ内の計測は続く */
      }
    }
  }, []);

  const extend = useCallback(() => {
    markActive(true);
    setWarningSec(null);
  }, [markActive]);

  useEffect(() => {
    if (!enabled || idleMs <= 0) {
      setWarningSec(null);
      return;
    }
    firedRef.current = false;
    markActive(true);

    const onActivity = () => markActive(true);
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    // 別タブに切り替えて戻ってきただけでは操作とみなさない。
    // 表示に戻った時点で期限切れなら、次の tick でそのままログアウトさせる。
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LAST_ACTIVITY_KEY || !e.newValue) return;
      const t = Number(e.newValue);
      if (Number.isFinite(t) && t > lastActivityRef.current) lastActivityRef.current = t;
    };
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(() => {
      if (firedRef.current) return;
      // 他タブが後から書いた最終操作時刻も見る（storage イベントを取り逃した場合の保険）
      try {
        const t = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
        if (Number.isFinite(t) && t > lastActivityRef.current) lastActivityRef.current = t;
      } catch {
        /* 読めなければこのタブの値だけで判定する */
      }
      const left = idleMs - (Date.now() - lastActivityRef.current);
      if (left <= 0) {
        firedRef.current = true;
        setWarningSec(null);
        onTimeoutRef.current();
        return;
      }
      setWarningSec(left <= warnSec * 1000 ? Math.ceil(left / 1000) : null);
    }, 1000);

    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [enabled, idleMs, warnSec, markActive]);

  return { warningSec, extend };
}
