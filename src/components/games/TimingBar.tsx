"use client";

import { useEffect, useRef, useState } from "react";
import { type RoundInfo, TIMING_TARGET, roundSubmitLabel, roundTag, timingScore, timingSpeed } from "@/lib/game";
import Icon from "@/components/Icon";

type Phase = "ready" | "go" | "result";

/** 타이밍 바 — 좌우로 움직이는 바를 정중앙(목표)에 멈춰요. seed 로 두 사람 동일 속도.
 *  점수 = 목표와의 거리(0~1000, 낮을수록 정확). */
export default function TimingBar({
  seed,
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
  const [stopped, setStopped] = useState(0.5);
  const posRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function start() {
    setPhase("go");
    const speed = timingSpeed(seed);
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      const ph = (t * speed) % 1;
      const pos = ph < 0.5 ? ph * 2 : 2 - ph * 2; // 0→1→0 삼각파
      posRef.current = pos;
      if (indicatorRef.current) indicatorRef.current.style.left = `${pos * 100}%`;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function tap() {
    if (phase === "ready") return start();
    if (phase === "go") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStopped(posRef.current);
      setPhase("result");
    }
  }

  const score = timingScore(stopped, TIMING_TARGET);
  const near = score <= 40;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0f0a12]"
      role="dialog"
      aria-modal="true"
      aria-label="타이밍 바 게임"
    >
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          🎯 타이밍 바{roundTag(round)}
        </span>
        <button
          onClick={onCancel}
          aria-label="닫기"
          className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      <button
        onClick={tap}
        className="flex flex-1 select-none flex-col items-center justify-center px-6 text-center"
        aria-label={phase === "go" ? "지금 멈추기" : "탭"}
      >
        {phase === "ready" && (
          <>
            <p className="text-2xl font-extrabold text-white">정중앙에 멈춰!</p>
            <p className="mt-2 text-sm text-white/70">
              움직이는 바가 가운데 올 때 탭
            </p>
          </>
        )}
        {phase === "result" && (
          <>
            <p className="text-sm font-semibold text-white/70">목표와의 거리</p>
            <p
              className={`mt-1 text-6xl font-black tabular-nums ${near ? "text-[#12b981]" : "text-white"}`}
            >
              {score}
            </p>
            <p className="mt-1 text-xs text-white/60">낮을수록 정확 · 0=완벽</p>
          </>
        )}

        {/* 트랙 */}
        <div className="relative mt-8 h-10 w-full max-w-sm overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
          {/* 목표 중앙 존 */}
          <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[#12b981]" />
          <div className="absolute inset-y-0 left-1/2 w-14 -translate-x-1/2 bg-[#12b981]/15" />
          {/* 인디케이터 */}
          <div
            ref={indicatorRef}
            className="absolute inset-y-1 w-2 -translate-x-1/2 rounded-full bg-rose shadow-[0_0_10px_rgba(255,95,151,0.8)]"
            style={{ left: `${(phase === "result" ? stopped : 0) * 100}%` }}
          />
        </div>

        {phase === "ready" && (
          <span className="mt-6 rounded-full bg-white/20 px-5 py-2.5 text-sm font-bold text-white">
            탭해서 시작
          </span>
        )}
        {phase === "go" && (
          <p className="mt-6 text-lg font-extrabold text-rose">지금 멈춰!</p>
        )}
      </button>

      {phase === "result" && (
        <div className="flex px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() => onDone(score)}
            className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink shadow-[var(--shadow-md)]"
          >
            {roundSubmitLabel(round, "이 기록으로 도전 🎯")}
          </button>
        </div>
      )}
    </div>
  );
}
