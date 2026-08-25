"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { APP_NOTICE_EVENT, type AppNotice } from "@/lib/notice";

export default function GlobalStatusHost() {
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);

  useEffect(() => {
    const applyNetwork = () => {
      const next = navigator.onLine;
      setOnline(next);
      if (!next) wasOffline.current = true;
      else if (wasOffline.current) {
        wasOffline.current = false;
        window.dispatchEvent(
          new CustomEvent<AppNotice>(APP_NOTICE_EVENT, {
            detail: {
              id: `online-${Date.now()}`,
              kind: "success",
              message: "다시 온라인이에요. 서버 저장을 이어갈 수 있어요.",
              durationMs: 3_500,
            },
          }),
        );
      }
    };
    const onNotice = (event: Event) => {
      const next = (event as CustomEvent<AppNotice>).detail;
      if (!next?.message) return;
      if (timer.current) clearTimeout(timer.current);
      setNotice(next);
      timer.current = setTimeout(() => setNotice(null), next.durationMs ?? 3_500);
    };
    applyNetwork();
    window.addEventListener("online", applyNetwork);
    window.addEventListener("offline", applyNetwork);
    window.addEventListener(APP_NOTICE_EVENT, onNotice);
    return () => {
      window.removeEventListener("online", applyNetwork);
      window.removeEventListener("offline", applyNetwork);
      window.removeEventListener(APP_NOTICE_EVENT, onNotice);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[120] mx-auto flex max-w-md flex-col items-center gap-2 px-4 reading">
      {!online && (
        <div role="status" className="pointer-events-auto flex w-full items-start gap-2 rounded-xl bg-card px-3 py-2.5 text-sm text-ink shadow-[var(--shadow-md)] ring-2 ring-anniv">
          <Icon name="cloudsun" size={18} className="mt-0.5 shrink-0 text-anniv" />
          <p className="leading-relaxed">
            <strong>오프라인이에요.</strong> 작성 중인 초안은 이 기기에 남지만 서버 저장은 연결 후 다시 시도해 주세요.
          </p>
        </div>
      )}
      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live={notice.kind === "error" ? "assertive" : "polite"}
          className={`pointer-events-auto flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold shadow-[var(--shadow-md)] ring-2 ${
            notice.kind === "error"
              ? "bg-card text-rose-deep ring-rose-deep"
              : notice.kind === "success"
                ? "bg-card text-emerald-700 ring-emerald-600"
                : "bg-card text-ink ring-line-strong"
          }`}
        >
          <Icon
            name={notice.kind === "error" ? "circleX" : notice.kind === "success" ? "circleCheck" : "bell"}
            size={18}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1 leading-relaxed">{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="tap pointer-events-auto grid h-8 w-8 shrink-0 place-items-center text-muted"
            aria-label="알림 닫기"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
