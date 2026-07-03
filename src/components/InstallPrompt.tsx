"use client";

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/lib/platform";
import Icon from "@/components/Icon";

// '홈 화면에 추가' 유도 배너. Android=네이티브 설치 프롬프트, iOS=공유메뉴 안내.
// 이미 설치(standalone)면 숨김. 닫으면 2주 쿨다운(localStorage). 하단 탭 위 배너.
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const KEY = "ourdays:installnudge";
const COOLDOWN = 14 * 24 * 60 * 60 * 1000;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // 이미 앱으로 설치됨
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY) || 0);
    } catch {
      /* noop */
    }
    if (Date.now() - last < COOLDOWN) return; // 최근에 닫음 → 조용히

    const onBIP = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 프롬프트 보류 → 우리 버튼으로 트리거
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    // iOS 는 beforeinstallprompt 미지원 → 공유메뉴 안내 힌트
    let t: ReturnType<typeof setTimeout> | null = null;
    if (isIOS()) t = setTimeout(() => setIos(true), 3000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      if (t) clearTimeout(t);
    };
  }, []);

  const close = () => {
    setDeferred(null);
    setIos(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  async function install() {
    const d = deferred;
    close();
    if (!d) return;
    try {
      await d.prompt();
    } catch {
      /* noop */
    }
  }

  if (!deferred && !ios) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 mx-auto max-w-md px-4">
      <div className="animate-sheet glass flex items-center gap-3 rounded-2xl bg-surface p-3 pl-4 shadow-[var(--shadow-lg)] ring-1 ring-line-strong">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose/12 text-rose-deep">
          <Icon name="heart" size={18} filled />
        </span>
        <p className="min-w-0 flex-1 text-xs leading-snug text-ink">
          {deferred ? (
            "홈 화면에 추가하면 앱처럼 빠르게 열려요"
          ) : (
            <>
              공유 <Icon name="send" size={11} className="inline align-[-1px]" /> →
              &lsquo;홈 화면에 추가&rsquo;로 앱처럼 써요
            </>
          )}
        </p>
        {deferred && (
          <button
            onClick={install}
            className="tap shrink-0 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-[var(--shadow-sm)]"
          >
            추가
          </button>
        )}
        <button
          onClick={close}
          aria-label="닫기"
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}
