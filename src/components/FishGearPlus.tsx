"use client";
/** '장비' 탭 아래 칸(2026-11-12) — 미끼 만들기 · 장비 꾸미기 · 강화가 자리를 나눠 쓴다. 갈래마다 자기 칸(컴포넌트)을 한 줄씩 더한다. */
import type { FishTabProps } from "@/components/FishCollect";
import FishLooks from "@/components/FishLooks";

export default function FishGearPlus(p: FishTabProps) {
  return (
    <div className="fish-gearplus">
      <FishLooks {...p} />
    </div>
  );
}
