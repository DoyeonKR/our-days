"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ORDER_N, nowMs, orderLayout, orderScore } from "@/lib/game";
import Icon from "@/components/Icon";

/** 숫자 순서 — 1부터 16까지 순서대로 빠르게 탭. seed 로 두 사람 동일 배치.
 *  점수 = 경과ms + 오탭*2000 (낮을수록 좋음). */
export default function NumberOrder({
  seed,
  onDone,
  onCancel,
}: {
  seed: number;
  onDone: (score: number) => void;
  onCancel: () => void;
}) {
  const layout = useMemo(() => orderLayout(seed, ORDER_N), [seed]); // 칸별 숫자
  const [started, setStarted] = useState(false);
  const [next, setNext] = useState(1); // 다음에 눌러야 할 숫자
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null); // 오탭 깜빡임
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!started || done) return;
    startRef.current = nowMs();
  }, [started, done]);

  function tapCell(i: number) {
    if (!started || done) return;
    const num = layout[i];
    if (num < next) return; // 이미 누른 것
    if (num === next) {
      if (next === ORDER_N) {
        setElapsed(Math.round(nowMs() - startRef.current));
        setDone(true);
      }
      setNext((n) => n + 1);
    } else {
      setMistakes((m) => m + 1);
      setWrong(i);
      setTimeout(() => setWrong((w) => (w === i ? null : w)), 250);
    }
  }

  const score = orderScore(elapsed, mistakes);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0f0a12]"
      role="dialog"
      aria-modal="true"
      aria-label="숫자 순서 게임"
    >
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          🔢 숫자 순서 {started && !done && `· 다음 ${next} · 실수 ${mistakes}`}
        </span>
        <button
          onClick={onCancel}
          aria-label="닫기"
          className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {!started ? (
        <button
          onClick={() => setStarted(true)}
          className="flex flex-1 select-none flex-col items-center justify-center px-8 text-center"
        >
          <p className="text-2xl font-extrabold text-white">1부터 순서대로!</p>
          <p className="mt-2 text-sm text-white/70">
            1 → 2 → 3 … {ORDER_N}까지 빠르게 탭
          </p>
          <span className="mt-6 rounded-full bg-white/20 px-5 py-2.5 text-sm font-bold text-white">
            탭해서 시작
          </span>
        </button>
      ) : !done ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="grid w-full max-w-xs grid-cols-4 gap-2">
            {layout.map((num, i) => {
              const cleared = num < next;
              return (
                <button
                  key={i}
                  onClick={() => tapCell(i)}
                  disabled={cleared}
                  className={`grid aspect-square place-items-center rounded-xl text-xl font-extrabold tabular-nums ring-1 transition-colors ${
                    cleared
                      ? "bg-rose/25 text-rose/40 ring-transparent"
                      : wrong === i
                        ? "bg-[#7c1d3a] text-white ring-white/30"
                        : "tap bg-white/90 text-ink ring-white active:scale-95"
                  }`}
                >
                  {cleared ? "" : num}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-semibold text-white/70">완료! 내 점수</p>
          <p className="mt-1 text-6xl font-black tabular-nums text-white">{score}</p>
          <p className="mt-2 text-xs text-white/60">
            {(elapsed / 1000).toFixed(1)}초 · 실수 {mistakes} (낮을수록 좋아요)
          </p>
        </div>
      )}

      {done && (
        <div className="flex gap-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onCancel}
            className="tap rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white"
          >
            그만
          </button>
          <button
            onClick={() => onDone(score)}
            className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink shadow-[var(--shadow-md)]"
          >
            이 점수로 도전 🔢
          </button>
        </div>
      )}
    </div>
  );
}
