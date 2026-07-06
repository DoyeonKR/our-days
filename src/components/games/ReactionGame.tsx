"use client";

import { useEffect, useRef, useState } from "react";
import { type RoundInfo, reactionScore, reactionWaitMs, roundSubmitLabel, roundTag } from "@/lib/game";
import Icon from "@/components/Icon";

type Phase = "ready" | "waiting" | "go" | "result" | "foul";

/** 반응속도 — 초록으로 바뀌면 빠르게 탭. 대기시간은 매 시도 랜덤(외우기·사전공유 치팅 방지).
 *  점수는 반응 ms(낮을수록 좋음). 폴스스타트는 재시도(제출 전이라 안전). */
export default function ReactionGame({
  round,
  onDone,
  onCancel,
}: {
  seed: number; // 균일 props 계약 유지용(대기시간은 seed 무관 랜덤이라 사용 안 함)
  round?: RoundInfo;
  onDone: (score: number) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [ms, setMs] = useState(0);
  const goAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => () => clearTimer(), []);

  function start() {
    setPhase("waiting");
    const wait = reactionWaitMs(); // 매 시도 랜덤 대기(1.2~3.7s) — 외우기/사전공유 방지
    clearTimer();
    timerRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase("go");
    }, wait);
  }

  function tap() {
    if (phase === "ready" || phase === "foul") return start();
    if (phase === "waiting") {
      clearTimer();
      setPhase("foul"); // 폴스스타트 — 초록 전에 탭
      return;
    }
    if (phase === "go") {
      setMs(Math.round(performance.now() - goAtRef.current));
      setPhase("result");
    }
  }

  const bg =
    phase === "go"
      ? "bg-[#12b981]"
      : phase === "waiting"
        ? "bg-[#c0356a]"
        : phase === "foul"
          ? "bg-[#7c1d3a]"
          : "bg-[#0f0a12]";

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col ${bg} transition-colors`}
      role="dialog"
      aria-modal="true"
      aria-label="반응속도 게임"
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          ⚡ 반응속도{roundTag(round)}
        </span>
        {phase !== "go" && (
          <button
            onClick={onCancel}
            aria-label="닫기"
            className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
          >
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      {/* 탭 영역(전체) */}
      <button
        onClick={tap}
        className="flex flex-1 select-none flex-col items-center justify-center px-8 text-center"
        aria-label={phase === "go" ? "지금 탭" : "탭"}
      >
        {phase === "ready" && (
          <>
            <p className="text-2xl font-extrabold text-white">준비됐어?</p>
            <p className="mt-2 text-sm text-white/70">
              초록으로 바뀌면 최대한 빠르게 탭!
            </p>
            <span className="mt-6 rounded-full bg-white/20 px-5 py-2.5 text-sm font-bold text-white">
              탭해서 시작
            </span>
          </>
        )}
        {phase === "waiting" && (
          <>
            <p className="text-3xl font-extrabold text-white">기다려…</p>
            <p className="mt-2 text-sm text-white/80">초록이 되면 탭</p>
          </>
        )}
        {phase === "go" && (
          <p className="animate-pop text-5xl font-black text-white">탭!</p>
        )}
        {phase === "foul" && (
          <>
            <p className="text-2xl font-extrabold text-white">너무 빨랐어요 😅</p>
            <p className="mt-2 text-sm text-white/80">초록이 된 뒤에 탭해요</p>
            <span className="mt-6 rounded-full bg-white/20 px-5 py-2.5 text-sm font-bold text-white">
              다시 시작
            </span>
          </>
        )}
        {phase === "result" && (
          <>
            <p className="text-sm font-semibold text-white/70">내 반응속도</p>
            <p className="mt-1 text-6xl font-black tabular-nums text-white">
              {ms}
              <span className="text-2xl font-bold">ms</span>
            </p>
          </>
        )}
      </button>

      {phase === "result" && (
        <div className="flex px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() => onDone(reactionScore(ms))}
            className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink shadow-[var(--shadow-md)]"
          >
            {roundSubmitLabel(round, "이 기록으로 도전 ⚡")}
          </button>
        </div>
      )}
    </div>
  );
}
