"use client";

// 테트리스 점수 대결(울트라) 라운드 — 기존 게임 컴포넌트 계약(seed/round/onDone/onCancel).
// 2분(ULTRA_SECONDS) 동안 최고 점수. 같은 seed = 두 사람이 같은 블록 순서(공정).
// 하루 1판 · 3라운드 평균은 GameArcade 의 공통 매치 플로우가 처리한다.

import { useEffect, useState } from "react";
import { type RoundInfo, roundSubmitLabel, roundTag } from "@/lib/game";
import { ULTRA_SECONDS } from "@/lib/tetris";
import TetrisPlayfield, { type PlayfieldEnd } from "@/components/games/TetrisPlayfield";
import Icon from "@/components/Icon";

export default function TetrisBattle({
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
  // 마운트 시각 기준 3초 카운트다운 → 2분 울트라 (라운드마다 remount 로 초기화됨).
  // Date.now() 는 렌더 불순이라 effect 에서 1회 확정(react-hooks/purity·refs 준수).
  const [times, setTimes] = useState<{ startAt: number; endAt: number } | null>(null);
  useEffect(() => {
    const startAt = Date.now() + 3200;
    setTimes({ startAt, endAt: startAt + ULTRA_SECONDS * 1000 });
  }, []);
  const [result, setResult] = useState<PlayfieldEnd | null>(null);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0f0a12]"
      role="dialog"
      aria-modal="true"
      aria-label="테트리스 게임"
    >
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          🧱 테트리스 · 2분{roundTag(round)}
        </span>
        <button
          onClick={onCancel}
          aria-label="닫기"
          className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {times !== null && result === null ? (
        <TetrisPlayfield
          seed={seed}
          startAt={times.startAt}
          endAt={times.endAt}
          onEnd={setResult}
        />
      ) : result !== null ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-semibold text-white/70">
            {result.toppedOut ? "블록이 가득 찼어요 💥" : "2분 종료! ⏰"}
          </p>
          <p className="mt-2 text-6xl font-black tabular-nums text-white">
            {result.score.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-white/60">{result.lines}줄 클리어</p>
          <div className="mt-10 flex w-full max-w-sm">
            <button
              onClick={() => onDone(result.score)}
              className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink shadow-[var(--shadow-md)]"
            >
              {roundSubmitLabel(round, "이 기록으로 도전 🧱")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
