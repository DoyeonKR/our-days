"use client";

import { useEffect, useState } from "react";
import {
  disablePushOnThisDevice,
  enablePush,
  isIOS,
  isPushConfigured,
  isPushSubscribed,
  isStandalone,
  sendTestPush,
} from "@/lib/push";
import { logDebug } from "@/lib/debug";
import Icon from "@/components/Icon";
import { blockedPushBrowser } from "@/lib/pushhelp";
import { isAndroidApp } from "@/lib/nativepush";

/** 모바일 푸시 켜기 + 내 폰 테스트 (설정/커플카드 공용). */
export default function PushSettings() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<string>("default");

  useEffect(() => {
    setMounted(true);
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    isPushSubscribed()
      .then(setOn)
      .catch(() => {});
  }, []);

  if (!isPushConfigured) return null;
  const iosWarn = mounted && isIOS() && !isStandalone();
  const denied = mounted && perm === "denied";
  // 차단 안내는 쓰는 브라우저에 맞춰 한 가지만 — 예전엔 크롬·PC 사용자에게도 삼성 인터넷 메뉴 경로가 길게 떴다(2026-10-30)
  const browser = mounted ? blockedPushBrowser(navigator.userAgent) : "other";

  async function enable() {
    setBusy(true);
    setMsg(null);
    logDebug("push_enable_try");
    try {
      const ok = await enablePush();
      setOn(ok);
      if (ok) setMsg("이 기기에서 푸시를 켰어요. 아래 '테스트 알림'으로 확인해보세요.");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m);
      logDebug("push_enable_error", m); // 삼성 등 실패 사유 기록
    } finally {
      if (typeof Notification !== "undefined") setPerm(Notification.permission);
      setBusy(false);
    }
  }

  // 이 기기만 끈다(다른 기기 · 알림 종류 설정은 그대로). 로그아웃도 같은 함수를 부른다.
  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      await disablePushOnThisDevice();
      setOn(await isPushSubscribed().catch(() => false));
      setMsg("이 기기에서 푸시를 껐어요. 다른 기기의 알림은 그대로예요.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setMsg("보내는 중…");
    setMsg(await sendTestPush());
  }

  // 안드로이드 앱 — 웹 푸시 대신 FCM 으로 받는다. 권한은 앱을 열 때 이미 물었고, 끄는 곳은 휴대폰 설정이다.
  if (mounted && isAndroidApp()) {
    return (
      <div className="space-y-2 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Icon name="bell" size={15} />
          앱 알림
        </p>
        <p className="text-xs leading-relaxed text-muted">앱 알림을 쓰고 있어요. 끄려면 휴대폰 설정 → 앱 → 하루 → 알림에서 바꿔 주세요.</p>
        <button type="button" onClick={test} className="tap w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white">테스트 알림 보내기</button>
        {msg && <p role="status" className="text-xs text-muted">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
      <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
        <Icon name="bell" size={15} />
        푸시 알림 (모바일)
      </p>
      {iosWarn && (
        <div className="rounded-lg bg-anniv-bg px-3 py-2 text-xs leading-relaxed text-anniv ring-1 ring-anniv">
          <b>아이폰은 홈 화면에 추가한 앱에서만</b> 알림이 와요. 사파리 공유(⬆️) →
          <b> 홈 화면에 추가</b> → 그 아이콘으로 열고 아래를 눌러주세요.
        </div>
      )}
      {denied && (
        <div className="rounded-lg bg-rose/10 px-3 py-2.5 text-xs leading-relaxed text-rose-deep ring-1 ring-rose/30">
          알림이 <b>차단</b>돼 있어요. 앱이 대신 풀 수 없어서 브라우저에서 직접 풀어야 해요.
          <br />
          {browser === "samsung" ? (
            <>
              <b>삼성 인터넷</b>: ≡ → 설정 → 사이트 및 다운로드 → 사이트 권한 → 알림 →{" "}
              <b>doyeonkr.github.io 삭제(초기화)</b> → 새로고침 → 다시 “푸시 켜기” → <b>허용</b>
              <br />
              잘 안 되면 <b>안드로이드 크롬</b>으로 열어 켜는 걸 추천해요.
            </>
          ) : browser === "ios" ? (
            <>
              <b>아이폰</b>: 설정 앱 → 알림 → <b>하루</b> → 알림 허용을 켜 주세요.
            </>
          ) : (
            <>
              주소창 왼쪽 <b>자물쇠(사이트 정보)</b> → 권한 → 알림 → <b>초기화</b> 또는 <b>허용</b> → 새로고침 → 다시 “푸시 켜기”.
            </>
          )}
        </div>
      )}
      {!on ? (
        <>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            {busy ? "켜는 중…" : "이 기기에서 푸시 켜기"}
          </button>
          <p className="text-sm text-muted">
            폰·PC 각 기기에서 한 번씩 켜야 그 기기로 알림이 와요. (테스트는 켠 뒤 나타나요)
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-emerald-600">이 기기 푸시 켜짐 ✓</p>
            <button
              role="switch"
              aria-checked={on}
              aria-label="이 기기 푸시 끄기"
              disabled={busy}
              onClick={() => void disable()}
              className="tap relative h-6 w-11 shrink-0 rounded-full bg-rose-deep transition-colors disabled:opacity-50"
            >
              <span className="absolute left-[1.4rem] top-0.5 h-5 w-5 rounded-full bg-white shadow" />
            </button>
          </div>
          <button
            onClick={test}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-bold text-white tap shadow-[var(--shadow-md)]"
          >
            내 폰으로 테스트 알림
          </button>
        </>
      )}
      {msg && (
        <p className="rounded-lg bg-glass px-3 py-2 text-center text-xs text-ink">
          {msg}
        </p>
      )}
    </div>
  );
}
