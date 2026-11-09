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
import {
  NATIVE_PUSH_EVENT,
  isAndroidApp,
  nativePlatform,
  nativePushStatus,
  nativePushToken,
  requestNativePush,
  type NativePushStatus,
} from "@/lib/nativepush";
import { nativePushView } from "@/lib/nativepushstate";

/** 모바일 푸시 켜기 + 내 폰 테스트 (설정/커플카드 공용). */
export default function PushSettings() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<string>("default");

  const [native, setNative] = useState<NativePushStatus | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    isPushSubscribed()
      .then(setOn)
      .catch(() => {});
  }, []);

  // 안드로이드 앱 — 실제 권한 · 토큰 · 서버 등록을 읽는다. 휴대폰 설정에서 바꾸고 돌아오면 다시 읽는다.
  useEffect(() => {
    if (!isAndroidApp()) return;
    let alive = true;
    const read = () => {
      void nativePushStatus().then((s) => {
        if (alive) setNative(s);
      });
    };
    read();
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    window.addEventListener(NATIVE_PUSH_EVENT, read);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener(NATIVE_PUSH_EVENT, read);
      document.removeEventListener("visibilitychange", onVisible);
    };
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

  // 보내는 동안 막는다 [2026-11-09] — 예전엔 여러 번 누르면 테스트가 겹쳐 나가고, 다시 등록하는 길과도 겹쳤다.
  async function test() {
    if (busy) return;
    setBusy(true);
    setMsg("보내는 중…");
    try {
      setMsg(await sendTestPush());
      // 구독이 없어 다시 등록했을 수 있다 — 스위치 상태를 다시 읽는다
      setOn(await isPushSubscribed().catch(() => on));
    } finally {
      setBusy(false);
    }
  }

  // 앱 — 이 기기 토큰으로만 보낸다. 서버에 없다고 하면 다시 등록한다.
  async function testNative() {
    setBusy(true);
    setMsg("보내는 중…");
    try {
      const m = await sendTestPush({ nativeToken: nativePushToken() });
      setMsg(m);
      if (/등록돼 있지 않아요|다시 등록하고 있어요/.test(m)) setNative(await requestNativePush());
    } finally {
      setBusy(false);
    }
  }

  async function nativeAction(kind: "request" | "register" | "recheck") {
    setBusy(true);
    setMsg(null);
    try {
      setNative(kind === "recheck" ? await nativePushStatus() : await requestNativePush());
    } finally {
      setBusy(false);
    }
  }

  // 아이폰 앱 — WKWebView 엔 웹 푸시가 없고 APNs 는 유료 개발자 계정이 필요하다
  if (mounted && nativePlatform() === "ios") {
    return (
      <div className="space-y-2 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Icon name="bell" size={15} />
          앱 알림
        </p>
        <p className="text-xs leading-relaxed text-muted">아이폰 앱에서는 푸시 알림을 받을 수 없어요. 알림이 필요하면 사파리에서 하루를 열고 공유 → 홈 화면에 추가로 설치해 주세요.</p>
      </div>
    );
  }
  // 안드로이드 앱 — 웹 푸시 대신 FCM 으로 받는다. 예전엔 상태와 무관하게 '쓰고 있어요'였고, 거절한 사람은 되돌릴 길이 없었다.
  // 지금은 실제 권한 · 이 기기 등록을 보여 주고, 거절이면 휴대폰 설정에서 켜는 길 + 다시 확인, 아직이면 묻기 버튼.
  if (mounted && isAndroidApp()) {
    const view = native ? nativePushView(native) : null;
    return (
      <div className="space-y-2 rounded-[var(--radius-card)] bg-card glass p-3 ring-1 ring-line shadow-[var(--shadow-md)]">
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Icon name="bell" size={15} />
          앱 알림
        </p>
        {!view ? (
          <p className="text-xs text-muted">알림 상태를 확인하는 중…</p>
        ) : (
          <>
            <p
              className={
                view.tone === "ok"
                  ? "text-xs leading-relaxed text-emerald-600"
                  : view.tone === "warn"
                    ? "text-xs leading-relaxed text-ink"
                    : "text-xs leading-relaxed text-rose-deep"
              }
            >
              {view.text}
            </p>
            {view.howTo && (
              <p className="rounded-lg bg-rose/10 px-3 py-2 text-xs leading-relaxed text-rose-deep ring-1 ring-rose/30">{view.howTo}</p>
            )}
            {view.action && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void nativeAction(view.action!)}
                className="tap w-full rounded-xl bg-glass py-2.5 text-sm font-bold text-ink ring-1 ring-line disabled:opacity-50"
              >
                {view.actionLabel}
              </button>
            )}
            {view.canTest && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void testNative()}
                className="tap w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                이 휴대폰으로 테스트 알림
              </button>
            )}
          </>
        )}
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
            onClick={() => void test()}
            disabled={busy}
            aria-busy={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-bold text-white tap shadow-[var(--shadow-md)] disabled:opacity-50"
          >
            내 폰으로 테스트 알림
          </button>
        </>
      )}
      {msg && (
        <p role="status" className="rounded-lg bg-glass px-3 py-2 text-center text-xs text-ink">
          {msg}
        </p>
      )}
    </div>
  );
}
