"use client";
/** 낚시 '수집' 탭(2026-11-12) — 유리병 편지 · 어탁첩 · 보물 · 낚시터 숙련도 · 이달의 대회가 자리를 나눠 쓴다. 갈래마다 자기 칸(섹션)을 더한다. */
import type { IslandState } from "@/lib/island";
import type { FishingState, FishResult, GearResult } from "@/lib/fishing";
import FishBottles from "@/components/FishBottles";
import FishRelics from "@/components/FishRelics";
import FishTrophies from "@/components/FishTrophies";
import FishMastery from "@/components/FishMastery";
import FishContest from "@/components/FishContest";
import { useState } from "react";
import { FishJunk, FishSizes, SubTabs } from "@/components/FishingPanels";

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
  // 한 번에 한 갈래(2026-11-13) — 대회(맨 앞: 지난달 1등 상품도 이 칸이 받는다) · 기록(크기 · 어탁) · 편지 · 보물 · 쓰레기 · 숙련도
  const [view, setView] = useState<"contest" | "record" | "bottle" | "relic" | "junk" | "mastery">("contest");
  return (
    <div className="fish-collect">
      <SubTabs label="수집 갈래" cur={view} onPick={setView} items={[["contest", "대회"], ["record", "기록"], ...(p.couple ? [["bottle", "편지"] as const] : []), ["relic", "보물"], ["junk", "쓰레기"], ["mastery", "숙련도"]]} />
      {view === "contest" && <FishContest {...p} />}
      {view === "record" && <><FishSizes fs={p.fs} who={p.who} couple={p.couple} /><FishTrophies {...p} /></>}
      {view === "bottle" && <FishBottles {...p} />}
      {view === "relic" && <FishRelics {...p} />}
      {view === "junk" && <FishJunk fs={p.fs} />}
      {view === "mastery" && <FishMastery {...p} />}
    </div>
  );
}
