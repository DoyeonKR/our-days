"use client";

import { useEffect, useState } from "react";
import {
  enablePush,
  isIOS,
  isPushConfigured,
  isPushSubscribed,
  isStandalone,
  sendTestPush,
} from "@/lib/push";
import { logDebug } from "@/lib/debug";

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

  async function test() {
    setMsg("보내는 중…");
    setMsg(await sendTestPush());
  }

  return (
    <div className="space-y-2 rounded-xl bg-white/50 p-3 ring-1 ring-line">
      <p className="text-xs font-bold text-ink">🔔 푸시 알림 (모바일)</p>
      {iosWarn && (
        <div className="rounded-lg bg-amber-100/70 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-300/50">
          📱 <b>아이폰은 홈 화면에 추가한 앱에서만</b> 알림이 와요. 사파리 공유(⬆️) →
          <b> 홈 화면에 추가</b> → 그 아이콘으로 열고 아래를 눌러주세요.
        </div>
      )}
      {denied && (
        <div className="rounded-lg bg-rose/10 px-3 py-2.5 text-xs leading-relaxed text-rose-deep ring-1 ring-rose/30">
          🚫 이 사이트 알림이 <b>차단</b>돼 있어요. 브라우저 보안상 앱이 강제로 켤 수 없어,
          한 번만 직접 허용해 주세요:
          <br />
          <b>삼성 인터넷</b>: 주소창 왼쪽 <b>자물쇠/사이트 아이콘 탭 → 권한 → 알림 → 허용</b>
          <br />
          (또는 삼성인터넷 ≡ 메뉴 → 설정 → 사이트 및 다운로드 → 사이트 권한 → 알림 →
          doyeonkr.github.io → 허용) → <b>새로고침 후</b> 아래 버튼.
          <br />
          <b>크롬</b>: 주소창 자물쇠 → 권한 → 알림 → 허용.
        </div>
      )}
      {!on ? (
        <>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full rounded-lg bg-rose-deep py-2.5 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "켜는 중…" : "이 기기에서 푸시 켜기"}
          </button>
          <p className="text-[11px] text-muted">
            폰·PC 각 기기에서 한 번씩 켜야 그 기기로 알림이 와요. (테스트는 켠 뒤 나타나요)
          </p>
        </>
      ) : (
        <>
          <p className="text-center text-[11px] text-emerald-600">이 기기 푸시 켜짐 ✓</p>
          <button
            onClick={test}
            className="w-full rounded-lg bg-rose-deep py-2.5 text-xs font-bold text-white active:scale-[0.98]"
          >
            내 폰으로 테스트 알림
          </button>
        </>
      )}
      {msg && (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-center text-xs text-ink">
          {msg}
        </p>
      )}
    </div>
  );
}
