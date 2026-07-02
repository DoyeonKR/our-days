"use client";

import { useEffect, useState } from "react";
import { type ConfirmReq, resolveConfirm, subscribeConfirm } from "@/lib/confirm";

/** 앱 루트에 1회 마운트. confirmDialog() 요청을 테마 모달로 렌더. */
export default function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);

  useEffect(() => subscribeConfirm(setReq), []);

  // 열려 있는 동안 Esc = 취소, Enter = 확인
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveConfirm(false);
      else if (e.key === "Enter") resolveConfirm(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-8 backdrop-blur-sm"
      onClick={() => resolveConfirm(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-pop glass w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-lg)] ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm font-bold text-ink">{req.message}</p>
        {req.detail && (
          <p className="mt-1.5 text-center text-xs text-muted">{req.detail}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => resolveConfirm(false)}
            className="tap flex-1 rounded-2xl bg-glass py-3 text-sm font-bold text-muted ring-1 ring-line"
          >
            {req.cancelText || "취소"}
          </button>
          <button
            autoFocus
            onClick={() => resolveConfirm(true)}
            className={`tap flex-1 rounded-2xl py-3 text-sm font-bold text-white shadow-[var(--shadow-md)] ${
              req.danger ? "bg-rose-deep" : "bg-brand"
            }`}
          >
            {req.confirmText || "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
