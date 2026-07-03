"use client";

// 렌더 크래시 시 앱 전체 백지 방지 — 친절한 복구 화면 + debug_logs 기록.
import { useEffect } from "react";
import { logDebug } from "@/lib/debug";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 진단용 기록(실패는 조용히 — 복구 화면을 막지 않음)
    logDebug("app_error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.slice(0, 500),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="animate-floaty text-5xl">💔</div>
      <div>
        <h1 className="text-lg font-extrabold text-ink">잠깐 문제가 생겼어요</h1>
        <p className="mt-1.5 text-sm text-muted">
          다시 시도하거나 앱을 새로고침해 주세요. 기록은 안전하게 보관돼 있어요.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="tap rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-md)]"
        >
          다시 시도
        </button>
        <button
          onClick={() => location.reload()}
          className="tap rounded-2xl bg-glass px-5 py-3 text-sm font-bold text-muted ring-1 ring-line"
        >
          새로고침
        </button>
      </div>
    </main>
  );
}
