"use client";

import { useEffect, useState } from "react";
import { activeDaysSince } from "@/lib/couple";
import { computeStreak } from "@/lib/streak";
import { useDayTick } from "@/lib/useDayTick";
import { kstDate } from "@/lib/kst";

/** '오늘의 우리' 머리의 연속 기록 칩 — 함께 남긴 기록(일기·로그)이 며칠째 이어지는지(모닥불).
 *  [2026-09-24 IA 개편] 예전엔 홈에 '우리 현황' 카드가 따로 있었다(스트릭 + 이번 주 개수).
 *  매일 하는 일 셋을 한 묶음으로 모으면서 스트릭은 그 묶음의 머리로 올렸고, 개수는 기록 › 추억의
 *  월간 리캡이 같은 말을 해서 뺐다. 이어진 날이 없으면 그리지 않는다.
 *  ⚠ 날짜 기준은 **KST** — 집계 대상(log_date·entry_date)이 전부 KST 키라, 기기 로컬로 자르면
 *  미주 시간대에서 스트릭이 하루 어긋난다 [리뷰 2026-08-26]. useDayTick 은 자정 리렌더 트리거로만 쓴다. */
export default function StreakChip({ coupleId }: { coupleId: string }) {
  const tick = useDayTick();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const nowMs = Date.now();
    const since90 = kstDate(nowMs - 90 * 86_400_000); // KST 는 DST 가 없어 ms 산술이 안전하다
    activeDaysSince(coupleId, since90)
      .then((days) => {
        if (!cancelled) setStreak(computeStreak(days, kstDate(nowMs)).count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleId, tick]);

  if (streak === 0) return null;
  return (
    // 흰 글씨를 주황 그라데이션에 얹으면 대비가 2:1 이 안 된다 — 테마 칩(로즈 틴트 + 진한 글씨)으로 그린다
    <span
      className="flex items-center gap-1 rounded-full bg-rose/12 px-2.5 py-1 text-xs font-extrabold text-rose-deep ring-1 ring-rose/25"
      title="일기·로그를 남기면 불씨가 이어져요"
    >
      🔥 <span className="tabular-nums">{streak}</span>일째 모닥불
    </span>
  );
}
