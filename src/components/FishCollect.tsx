"use client";
/** 낚시 '수집' 탭(2026-11-12) — 유리병 편지 · 어탁첩 · 보물 · 낚시터 숙련도 · 이달의 대회가 자리를 나눠 쓴다. 갈래마다 자기 칸(섹션)을 더한다. */
import type { IslandState } from "@/lib/island";
import { deepestOf, type FishingState, type FishResult, type GearResult } from "@/lib/fishing";
import { familyName } from "@/lib/fishingworld";
import { FishArt } from "@/components/AquaArt";
import FishBottles from "@/components/FishBottles";
import FishRelics from "@/components/FishRelics";
import FishTrophies from "@/components/FishTrophies";
import FishMastery from "@/components/FishMastery";
import FishContest from "@/components/FishContest";
import { FishJunk, FishSizes } from "@/components/FishingPanels";

export type FishTabProps = {
  st: IslandState;
  fs: FishingState;
  who: string;
  /** 커플 섬인가(혼자 하는 섬이면 편지 보내기 등을 숨긴다) */
  couple: boolean;
  busy: boolean;
  today: string;
  /** 시각(서버 보정, ms) */
  now: number;
  act: (make: (s: IslandState) => FishResult | GearResult) => Promise<unknown>;
  /** 이 사람의 이름(어탁 카드의 '잡은 사람') — 없으면 낚시 순위 닉네임 */
  myName?: string;
};

export default function FishCollect(p: FishTabProps) {
  // 한눈에(2026-11-13) — 칸 버튼 없이 대회(맨 앞: 지난달 1등 상품도 이 칸이 받는다) · 크기 기록 · 어탁 · 편지 · 보물 · 쓰레기 · 숙련도를 그대로 펼친다
  return (
    <div className="fish-collect">
      <FishContest {...p} />
      <FishSizes fs={p.fs} who={p.who} couple={p.couple} />
      <FishDeepest st={p.st} />
      <FishTrophies {...p} />
      <FishBottles {...p} />
      <FishRelics {...p} />
      <FishJunk fs={p.fs} />
      <FishMastery {...p} />
    </div>
  );
}

/** 가장 깊이에서 낚은 물고기(2026-11-14) — 심해 낚시로 끌어올린 판 중 가장 깊은 것(fishPlus.deepest) */
function FishDeepest({ st }: { st: IslandState }) {
  const d = deepestOf(st);
  return (
    <section className="aqua-card">
      <header><strong>가장 깊은 기록</strong><small>심해 낚시로 끌어올린 가장 깊은 곳</small></header>
      {d ? (
        <p className="fish-deepest"><FishArt artKey={d.key} size={44} /> <b>{d.m.toLocaleString()}m</b> · {familyName(d.family)}</p>
      ) : (
        <p className="aqua-note">아직 없어요 — 심해 낚시로 깊이 내려 끌어올려 보세요</p>
      )}
    </section>
  );
}
