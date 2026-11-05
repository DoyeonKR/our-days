"use client";

// 렌더 크래시 시 앱 전체 백지 방지 — 친절한 복구 화면 + debug_logs 기록.
import { useEffect } from "react";
import { logDebug } from "@/lib/debug";

/* 버전마다 따로 센다(2026-11-05) — 예전 키는 버전이 없어서, 한 번 새로고침한 탭은 다음 배포의 옛 조각 오류에선
   저절로 못 풀고 복구 화면에 멈췄다. 이 버전 표시만 남기고 다른 버전 표시는 지운다. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const CHUNK_PREFIX = "ourdays:chunk-reload:";
const CHUNK_KEY = `${CHUNK_PREFIX}${APP_VERSION}`;
const isStaleChunk = (e: Error) => e.name === "ChunkLoadError" || /Failed to load chunk|Loading chunk .* failed/.test(e.message);
/** 이 버전으로 이번 탭에서 이미 새로고침해 봤나 — 그래도 안 되면 복구 화면을 보여 준다(무한 새로고침 금지) */
function chunkReloaded(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_KEY)) return true;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && (k === "ourdays:chunk-reload" || (k.startsWith(CHUNK_PREFIX) && k !== CHUNK_KEY))) sessionStorage.removeItem(k);
    }
    sessionStorage.setItem(CHUNK_KEY, "1");
    return false;
  } catch {
    return true;
  }
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 새 버전이 배포되면 옛 화면이 부르려던 조각 파일이 사라진다 — 앱 고장이 아니라 새로고침이면 풀린다. 한 번만 저절로 한다(운영 기록: 2026-11-01 ChunkLoadError).
    if (isStaleChunk(error) && !chunkReloaded()) {
      location.reload();
      return;
    }
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
