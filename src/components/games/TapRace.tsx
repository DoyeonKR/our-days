"use client";

import { useEffect, useRef, useState } from "react";
import { type RoundInfo, TAP_SECONDS, roundSubmitLabel, roundTag, tapScore } from "@/lib/game";
import Icon from "@/components/Icon";

type Phase = "ready" | "count" | "go" | "result";

/** 연타 대결 — 5초 동안 최대한 많이 탭. 많을수록 승. (seed 불필요 — 순수 순발력) */
export default function TapRace({
  round,
  onDone,
  onCancel,
}: {
  seed: number;
  round?: RoundInfo;
  onDone: (score: number) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(0);
  const [remain, setRemain] = useState(TAP_SECONDS);
  const [cd, setCd] = useState(3);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  function begin() {
    setPhase("count");
    setCount(0);
    [3, 2, 1].forEach((n, i) => {
      timers.current.push(setTimeout(() => setCd(n), i * 700));
    });
    timers.current.push(
      setTimeout(() => {
        setPhase("go");
        const start = performance.now();
        const tick = () => {
          const left = TAP_SECONDS - (performance.now() - start) / 1000;
          if (left <= 0) {
            setRemain(0);
            setPhase("result");
            return;
          }
          setRemain(left);
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }, 3 * 700),
    );
  }

  function tap() {
    if (phase === "ready") return begin();
    if (phase === "go") setCount((c) => c + 1);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0f0a12]"
      role="dialog"
      aria-modal="true"
      aria-label="연타 대결 게임"
    >
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          👏 연타{roundTag(round)}
          {phase === "go" ? ` · ${remain.toFixed(1)}s` : ""}
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

      <button
        onClick={tap}
        className="flex flex-1 select-none flex-col items-center justify-center px-8 text-center"
        aria-label="탭"
      >
        {phase === "ready" && (
          <>
            <p className="text-2xl font-extrabold text-white">준비됐어?</p>
            <p className="mt-2 text-sm text-white/70">
              5초 동안 최대한 빠르게 연타!
            </p>
            <span className="mt-6 rounded-full bg-white/20 px-5 py-2.5 text-sm font-bold text-white">
              탭해서 시작
            </span>
          </>
        )}
        {phase === "count" && (
          <p className="animate-pop text-7xl font-black text-white">{cd}</p>
        )}
        {phase === "go" && (
          <>
            <p className="text-8xl font-black tabular-nums text-white">{count}</p>
            <p className="mt-3 text-lg font-extrabold text-rose">계속 탭!</p>
          </>
        )}
        {phase === "result" && (
          <>
            <p className="text-sm font-semibold text-white/70">5초 동안</p>
            <p className="mt-1 text-7xl font-black tabular-nums text-white">
              {count}
              <span className="text-2xl font-bold">회</span>
            </p>
          </>
        )}
      </button>

      {phase === "result" && (
        <div className="flex px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() => onDone(tapScore(count))}
            className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink shadow-[var(--shadow-md)]"
          >
            {roundSubmitLabel(round, "이 기록으로 도전 👏")}
          </button>
        </div>
      )}
    </div>
  );
}
