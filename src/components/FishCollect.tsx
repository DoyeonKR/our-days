"use client";
/** 낚시 '수집' 탭(2026-11-12) — 유리병 편지 · 어탁첩 · 보물 · 낚시터 숙련도 · 이달의 대회가 자리를 나눠 쓴다. 갈래마다 자기 칸(섹션)을 더한다. */
import type { IslandState } from "@/lib/island";
import type { FishingState, FishResult, GearResult } from "@/lib/fishing";
import FishBottles from "@/components/FishBottles";
import FishRelics from "@/components/FishRelics";
import FishTrophies from "@/components/FishTrophies";
import FishMastery from "@/components/FishMastery";

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
  return (
    <div className="fish-collect">
      <FishBottles {...p} />
      <FishTrophies {...p} />
      <FishRelics {...p} />
      <FishMastery {...p} />
    </div>
  );
}
