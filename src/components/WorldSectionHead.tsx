"use client";

/* 홈 V2 섹션 헤더 — 월드(상단 씬) 아래 섹션들이 같은 세계로 읽히게 하는 공용 문법.
   [소품 SVG] + 볼드 타이틀(+부제) + 시간대 억양 밑줄 + 우측 액션 슬롯.
   · 소품은 world.tsx 의 것(우편함/표지판/폴라로이드/러브레터…)을 재사용 — 월드 오브젝트를
     탭해 내려온 목적지가 같은 소품을 달고 있어 "세계 속 장소"로 이어진다.
   · 억양색은 scenetime 의 시간대 팔레트(mid)에서 — 하늘이 노을이면 섹션 밑줄도 노을빛.
     카드 표면은 앱 테마 토큰 그대로(라이트/다크 안전), 억양만 세계를 따른다. */

import { type ReactNode, useEffect, useState } from "react";
import { seasonOf } from "@/lib/island";
import { kstHourOf, skyLook, skyPhaseOf } from "@/lib/scenetime";

/** 현재 시간대 억양색(하늘 mid) — 1분 시계(홈 월드와 같은 주기, 마운트 중에만). */
export function useSkyAccent(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, []);
  return skyLook(skyPhaseOf(kstHourOf(now)), seasonOf(now)).mid;
}

export default function WorldSectionHead({
  prop,
  title,
  sub,
  action,
  className = "",
}: {
  // world.tsx 소품(권장 size 34~38). **선택**이다 — 2026-08-09 쿡 섹션이 소품을 뗐다.
  // 소품이 없어도 시간대 억양 밑줄이 남아 세계와의 끈은 끊기지 않는다.
  prop?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
  className?: string;
}) {
  const accent = useSkyAccent();
  return (
    <div className={`mb-2.5 flex items-end justify-between px-1 ${className}`}>
      <div className="flex items-end gap-2">
        {prop && (
          <span aria-hidden className="-mb-0.5 shrink-0">
            {prop}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-tight tracking-tight text-ink">{title}</p>
          {sub && <p className="mt-0.5 text-sm leading-tight text-muted">{sub}</p>}
          {/* 시간대 억양 밑줄 — 하늘색이 노을/밤이면 여기도 함께 물든다 */}
          <span
            aria-hidden
            className="mt-1 block h-[3px] w-12 rounded-full"
            style={{ background: `linear-gradient(90deg, ${accent}, transparent)`, transition: "background 1s" }}
          />
        </div>
      </div>
      {action && <div className="shrink-0 pb-0.5">{action}</div>}
    </div>
  );
}
