"use client";

import { useEffect, useState } from "react";
import { type ConfirmReq, resolveConfirm, subscribeConfirm } from "@/lib/confirm";

/** 앱 루트에 1회 마운트. confirmDialog() 요청을 테마 모달로 렌더. */
export default function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);

  useEffect(() => subscribeConfirm(setReq), []);

  // 열려 있는 동안 Esc = 취소. Enter 는 **전역으로 가로채지 않는다** — 확인 버튼에
  // autoFocus 가 있어 기본 Enter=확인 UX 는 유지되고, 전역으로 잡으면 Tab 으로 취소
  // 버튼에 간 사용자의 Enter 까지 확인으로 실행된다(danger 삭제류에서 포커스와 반대
  // 결과 — 리뷰 2026-08-25). 버튼 위 Enter 는 브라우저 기본 click 이 처리한다.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-8"
      onClick={() => resolveConfirm(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-message"
      aria-describedby={req.detail ? "confirm-detail" : undefined}
    >
      <div
        className="animate-pop glass w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-lg)] ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-message" className="text-center text-sm font-bold text-ink">{req.message}</p>
        {req.detail && (
          <p id="confirm-detail" className="mt-1.5 text-center text-xs text-muted">{req.detail}</p>
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
