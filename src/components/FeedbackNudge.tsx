"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

// 주 1회, 개선 아이디어를 메일로 보내달라는 가벼운 팝업. localStorage 로 마지막 표시 시각을
// 기록해 7일에 한 번만 노출. 백엔드 불필요(표시 게이트 + mailto 링크).
const KEY = "ourdays:feedbacknudge";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL = "kdy7854@naver.com";

export default function FeedbackNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY) || 0);
    } catch {
      /* noop */
    }
    if (Date.now() - last < WEEK_MS) return; // 아직 일주일 안 지남 → 표시 안 함
    // 로드 직후 바로 띄우면 거슬려서 약간 지연 후 노출 + 표시 시각 기록(=주 1회)
    const t = setTimeout(() => {
      setShow(true);
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* noop */
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  if (!show) return null;

  const close = () => setShow(false);
  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(
    "우리의 하루 개선 아이디어",
  )}&body=${encodeURIComponent("개선하거나 추가하고 싶은 점:\n\n")}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fb-title"
      aria-describedby="fb-desc"
    >
      <div
        className="animate-sheet glass w-full max-w-md rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-lg)] ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose/12 text-rose-deep">
            <Icon name="mail" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p id="fb-title" className="text-sm font-extrabold text-ink">
              이번 주 우리 앱, 어때요? 💌
            </p>
            <p id="fb-desc" className="mt-1 text-xs leading-relaxed text-muted">
              개선하거나 추가하고 싶은 게 있으면 메일로 살짝 알려주세요. 반영해서 더 좋게
              만들게요. ({EMAIL})
            </p>
          </div>
          <button
            onClick={close}
            aria-label="닫기"
            className="tap -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={close}
            className="tap flex-1 rounded-2xl bg-glass py-3 text-sm font-bold text-muted ring-1 ring-line"
          >
            다음에
          </button>
          <a
            href={mailto}
            onClick={close}
            className="tap flex-1 rounded-2xl bg-brand py-3 text-center text-sm font-bold text-white shadow-[var(--shadow-md)]"
          >
            메일 보내기
          </a>
        </div>
      </div>
    </div>
  );
}
