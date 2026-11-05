"use client";

/* 게임 창 공통 부품 — 머리글(제목 · 지갑 · 닫기)과 첫 판 안내. 낚시 · 수조 · 합치기가 같은 틀을 쓴다. */
import type { ReactNode } from "react";
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { Coin } from "@/components/island/UiIcon";
import { useDialogFocus } from "@/lib/useDialogFocus";

export function GameHead({ title, icon, coins, onClose, className = "aqua-head" }: { title: string; icon?: ReactNode; coins?: number | null; onClose: () => void; className?: string }) {
  return (
    <div className={`${className} game-head sticky top-0 z-[500] flex items-center gap-2 px-4 py-3`}>
      <p className="flex min-w-0 items-center gap-1.5 text-base font-extrabold">{icon}{title}</p>
      {coins != null && <p className="aqua-wallet"><Coin /> {coins.toLocaleString()}</p>}
      <span className={coins != null ? "" : "ml-auto"}><CloseButton onClose={onClose} /></span>
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
  const finish = () => {
    try {
      localStorage.setItem(coachKey(id), "1");
    } catch {
      /* 다음에 또 떠도 괜찮다 */
    }
    onDone();
  };
  // 포커스를 가두고 Esc 로 닫는다(Esc 도 '시작'과 같다 — 안내는 한 번만)
  const ref = useDialogFocus(true, finish);
  return (
    <div ref={ref} tabIndex={-1} className={`game-coach ${fixed ? "is-fixed" : ""}`} role="dialog" aria-modal={fixed ? true : undefined} aria-label={`${title} 안내`} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="game-coach-card">
        <strong>{title}</strong>
        <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <ActionButton
          main
          wide
          onClick={finish}
        >
          시작
        </ActionButton>
      </div>
    </div>
  );
}
