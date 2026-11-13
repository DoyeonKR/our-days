"use client";
/** 장비 탭 '미끼 만들기'(2026-11-12) — 남는 쓰레기 · 섬 작물 · 작은 물고기 · 하트로 특수 미끼를 만든다. 판정 · 차감은 전부 lib/fishcraft(화면은 그리기만).
 *  만든 미끼는 낚시 준비 시트의 미끼 칸에서 고른다(FishingGame). 그림은 이모지 대신 벡터(README §10.8 — 픽셀 서체에 없는 글자가 네모로 나온다). */
import type { ReactNode } from "react";
import { asset } from "@/lib/base";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import { CRAFT_BAITS, CRAFT_RECIPES, craftBait, craftBaitOf, craftNeeds, craftStock, craftTier, craftWhy, spareFry, type CraftKey } from "@/lib/fishcraft";
import { GRADES, fishName, syncAqua } from "@/lib/aquarium";
import { ActionButton } from "@/components/AppButtons";
import { Coin } from "@/components/island/UiIcon";
import type { FishTabProps } from "@/components/FishCollect";

const L = "#0f172a";
const line = { stroke: L, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;
/** 만든 미끼 그림 — 둥근 경단(재료를 뭉친 것)에 덤을 뜻하는 표시 하나 */
const CRAFT_ART: Record<CraftKey, ReactNode> = {
  craft_scent: <><path {...line} fill="#f9a8d4" d="M8 30c0-10 7-17 16-17s16 7 16 17c0 7-7 11-16 11S8 37 8 30z" /><path {...line} fill="none" stroke="#be185d" d="M17 10c-3-3 3-5 0-8M24 9c-3-3 3-5 0-8M31 10c-3-3 3-5 0-8" /><circle cx="19" cy="27" r="2.2" fill="#fdf2f8" /></>,
  craft_glow: <><circle cx="24" cy="27" r="19" fill="#facc15" opacity=".25" /><path {...line} fill="#fde047" d="M8 30c0-10 7-17 16-17s16 7 16 17c0 7-7 11-16 11S8 37 8 30z" /><path fill="#fffbeb" d="M18 22l2 5 5 1-5 2-2 5-2-5-5-2 5-1z" /></>,
  craft_shine: <><path {...line} fill="#a5f3fc" d="M8 30c0-10 7-17 16-17s16 7 16 17c0 7-7 11-16 11S8 37 8 30z" /><path {...line} fill="#fef9c3" d="M36 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><circle cx="18" cy="26" r="2" fill="#fff" /><circle cx="28" cy="32" r="1.5" fill="#fff" /></>,
  craft_sticky: <><path {...line} fill="#86efac" d="M8 28c0-9 7-15 16-15s16 6 16 15c0 6-5 9-9 9l-1 7-3-6-3 5-1-6c-9 0-15-3-15-9z" /><circle cx="19" cy="25" r="2.2" fill="#f0fdf4" /></>,
};
export function CraftBaitIcon({ k, label }: { k: string; label?: string }) {
  // 그림이 오면 그림을 먼저(scripts/fishing-art.mjs 의 CRAFT_ART), 없으면 아래 벡터
  if (FISHING_IMAGE_KEYS.has(k)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/fishing/${k}.webp`)} alt={label ?? ""} aria-hidden={label ? undefined : true} className="aqua-img fish-gear-img" draggable={false} decoding="async" />;
  }
  const art = CRAFT_ART[k as CraftKey];
  return <svg viewBox="0 0 48 48" className="fish-icon-svg" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{art}</svg>;
}

export default function FishCraft({ st, busy, now, couple, act }: FishTabProps) {
  const stock = craftStock(st);
  // 치어는 되돌릴 수 없는 재료다 — 누르기 전에 어느 물고기가 떠나는지 보인다
  const fry = spareFry(syncAqua(st, now).a.fish)[0];
  const owned = CRAFT_BAITS.filter((b) => (stock[b.key] ?? 0) > 0);
  return (
    <section className="aqua-card">
      <header><strong>미끼 만들기</strong><small>{owned.length ? owned.map((b) => `${b.name} ${stock[b.key]}회`).join(" · ") : "만든 미끼 없음"}</small></header>
      <p className="aqua-note mt-2">같은 쓰레기를 두 번 넘게 건지면 남는 것을 쓰고(처음 하나는 수집함에 남아요), 섬 창고의 작물 · 수조의 치어를 섞어요. 물고기는 같은 단계 미끼와 똑같이 물고, 미끼마다 덤이 하나 붙어요. 낚시 준비의 미끼 칸에서 골라 써요.</p>
      <ul className="fish-goals">
        {CRAFT_RECIPES.map((r) => {
          const b = craftBaitOf(r.bait)!, tier = craftTier(b);
          const why = craftWhy(st, r.id, now);
          return (
            <li key={r.id}>
              <span className="fish-bait-pic shrink-0" aria-hidden><CraftBaitIcon k={b.key} /></span>
              <span className="min-w-0 flex-1">
                <strong>{b.name} {r.uses}회</strong>
                <small className="block">{tier.name}처럼 {GRADES[tier.maxGrade]}까지 물어요 · {b.effect}</small>
                <small className="block">{craftNeeds(st, r, now).filter((x) => x.label !== "하트").map((x) => `${x.label} ${Math.min(x.have, x.need)}/${x.need}`).join(" · ")}</small>
                {r.fry && fry && <small className="block">쓸 치어: {fishName(fry)} — 수조를 떠나요</small>}
                {r.bait === "craft_shine" && !couple && <small className="block">혼자 하는 섬엔 상대의 병이 없어 덤이 없어요</small>}
                {why && <small className="block">{why}</small>}
              </span>
              <ActionButton disabled={busy || !!why} onClick={() => void act((s) => {
                const res = craftBait(s, r.id, now);
                return res.ok ? { ok: true, state: res.state } : res;
              })}>
                만들기 <span className="aqua-price"><Coin /> {r.coins.toLocaleString()}</span>
              </ActionButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
