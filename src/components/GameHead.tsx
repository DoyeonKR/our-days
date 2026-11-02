"use client";

/* 게임 창 공통 부품 — 머리글(제목 · 지갑 · 소리 · 닫기)과 첫 판 안내. 낚시 · 수조 · 합치기가 같은 틀을 쓴다. */
import { useState, type ReactNode } from "react";
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { Coin } from "@/components/island/UiIcon";
import { setSoundOn, soundOn } from "@/lib/gamesound";

export function SoundToggle() {
  const [on, setOn] = useState(soundOn);
  return (
    <button
      type="button"
      className="tap app-close game-sound"
      aria-pressed={on}
      aria-label={on ? "효과음 끄기" : "효과음 켜기"}
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" />
        {on ? <><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18.3 6.6a8 8 0 0 1 0 10.8" /></> : <path d="m16 9.5 5 5m0-5-5 5" />}
      </svg>
    </button>
  );
}

export function GameHead({ title, icon, coins, onClose, className = "aqua-head" }: { title: string; icon?: ReactNode; coins?: number | null; onClose: () => void; className?: string }) {
  return (
    <div className={`${className} game-head sticky top-0 z-[500] flex items-center gap-2 px-4 py-3`}>
      <p className="flex min-w-0 items-center gap-1.5 text-base font-extrabold">{icon}{title}</p>
      {coins != null && <p className="aqua-wallet"><Coin /> {coins.toLocaleString()}</p>}
      <span className={coins != null ? "" : "ml-auto"}><SoundToggle /></span>
      <CloseButton onClose={onClose} />
    </div>
  );
}

const coachKey = (id: string) => `ourdays:coach:${id}`;
export function coachSeen(id: string): boolean {
  try {
    return localStorage.getItem(coachKey(id)) === "1";
  } catch {
    return true; // 저장소가 막힌 기기에선 판마다 뜨면 안 된다
  }
}

/** 처음 한 번만 뜨는 짧은 안내 — 판을 막지 않게 '시작' 한 번으로 닫힌다 */
export function GameCoach({ id, title, steps, fixed, onDone }: { id: string; title: string; steps: readonly string[]; fixed?: boolean; onDone: () => void }) {
  return (
    <div className={`game-coach ${fixed ? "is-fixed" : ""}`} role="dialog" aria-label={`${title} 안내`} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="game-coach-card">
        <strong>{title}</strong>
        <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <ActionButton
          main
          wide
          onClick={() => {
            try {
              localStorage.setItem(coachKey(id), "1");
            } catch {
              /* 다음에 또 떠도 괜찮다 */
            }
            onDone();
          }}
        >
          시작
        </ActionButton>
      </div>
    </div>
  );
}
