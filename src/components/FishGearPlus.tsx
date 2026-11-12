"use client";
/** '장비' 탭 아래 칸(2026-11-12) — 미끼 만들기 · 장비 꾸미기 · 강화가 자리를 나눠 쓴다. */
import type { FishTabProps } from "@/components/FishCollect";
import FishCraft from "@/components/FishCraft";

export default function FishGearPlus(p: FishTabProps) {
  return <div className="fish-gearplus"><FishCraft {...p} /></div>;
}
