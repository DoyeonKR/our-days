"use client";
/** 특별한 것을 낚았다(2026-11-12) — 유리병 편지 · 보물의 그림과 결과 칸. 결과 카드(FishingGame 의 fish-card) 안에서 그린다.
 *  그림은 우리가 그린 SVG — 갈래마다 kind 별로 채운다. */
import type { ReactNode } from "react";
import { ActionButton } from "@/components/AppButtons";
import { RelicIcon } from "@/components/FishRelics";
import type { SpecialCard, SpecialKind } from "@/lib/fishplus";
import { relicOf, treasurePiece } from "@/lib/fishtreasure";

/** id — 특별한 것의 id. 보물 갈래는 id 에 유물 조각이 담겨 있어(fishtreasure.ts) 끌어올리는 순간부터 그 조각을 그린다 */
export function SpecialPic({ kind, id }: { kind: SpecialKind; id?: string }) {
  const piece = kind === "treasure" ? treasurePiece(id) : null;
  if (piece) return <RelicIcon k={piece} className="fish-special-pic is-treasure is-relic" />;
  return (
    <svg viewBox="0 0 100 100" className={`fish-special-pic is-${kind}`} aria-hidden>
      {kind === "bottle" ? (
        <g>
          <rect x="40" y="14" width="20" height="12" rx="3" fill="#b98b52" />
          <path d="M38 26h24v10c10 6 14 14 14 26v18a10 10 0 0 1-10 10H34a10 10 0 0 1-10-10V62c0-12 4-20 14-26z" fill="#9fd6e6" fillOpacity=".55" stroke="#e6fbff" strokeWidth="2.5" />
          <rect x="36" y="52" width="28" height="24" rx="3" fill="#f6ecd2" transform="rotate(-8 50 64)" />
        </g>
      ) : (
        <g>
          <rect x="18" y="44" width="64" height="38" rx="5" fill="#8a5a2b" stroke="#f0c46a" strokeWidth="3" />
          <path d="M18 50c0-14 14-24 32-24s32 10 32 24z" fill="#a46a33" stroke="#f0c46a" strokeWidth="3" />
          <rect x="44" y="50" width="12" height="14" rx="2" fill="#f0c46a" />
        </g>
      )}
    </svg>
  );
}

/** 결과 칸 — card 가 없으면 아직 여는 중. kind · id 는 카드가 오기 전의 꼬리표용(예전엔 카드 전까지 늘 '편지'였다) */
export function SpecialPanel({ title, kind, id, card, onAgain, children }: { title: string; kind?: SpecialKind; id?: string; card: SpecialCard | undefined; onAgain: () => void; children?: ReactNode }) {
  const k = card?.kind ?? kind ?? "bottle";
  // 상자에서 나온 유물 — 위 그림은 상자라 카드 안에 그 조각을 따로 그린다
  const found = k === "treasure" && card?.art && relicOf(card.art) ? card.art : null;
  return (
    <>
      <strong className="fish-name">{card?.title ?? title}</strong>
      <span className="aqua-grade fish-special-tag">{k === "bottle" ? "편지" : treasurePiece(id) || found ? "유물" : "보물"}</span>
      {card ? (
        <>
          {found && <RelicIcon k={found} className="fish-special-relic" />}
          <p className="fish-special-body">{card.body}</p>
          {card.from && <p className="fish-special-from">{card.from}</p>}
          {card.note && <p className="aqua-note">{card.note}</p>}
          {children}
          <ActionButton main wide onClick={onAgain}>다시 던지기</ActionButton>
        </>
      ) : <p className="aqua-note">열어 보는 중…</p>}
    </>
  );
}
