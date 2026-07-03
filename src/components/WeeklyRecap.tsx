"use client";

import { useEffect, useState } from "react";
import { type WeekStats, weeklyStats } from "@/lib/couple";
import { useDayTick } from "@/lib/useDayTick";
import { toISODate } from "@/lib/dday";
import Icon, { type IconName } from "@/components/Icon";

/** 홈 '이번 주 우리' — 최근 7일 함께한 활동 요약(일기·브이로그·사진·질문답).
 *  기존 데이터 경량 count 집계, 활동 0이면 숨김. 자정/재개 시 주간 창 롤오버. */
export default function WeeklyRecap({ coupleId }: { coupleId: string }) {
  const today = useDayTick();
  const [s, setS] = useState<WeekStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const since = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); // 오늘 포함 7일
    weeklyStats(coupleId, since)
      .then((r) => {
        if (!cancelled) setS(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleId, today]);

  if (!s) return null;
  const total = s.diaries + s.vlogs + s.photos + s.answers;
  if (total === 0) return null;

  const items: { icon: IconName; label: string; n: number }[] = [
    { icon: "book", label: "일기", n: s.diaries },
    { icon: "camera", label: "브이로그", n: s.vlogs },
    { icon: "image", label: "사진", n: s.photos },
    { icon: "question", label: "질문답", n: s.answers },
  ];

  return (
    <section className="mt-3">
      <p className="eyebrow mb-2 px-1">이번 주 우리</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="glass rounded-2xl bg-card px-1.5 py-3 text-center shadow-[var(--shadow-sm)] ring-1 ring-line"
          >
            <span className="mx-auto grid h-7 w-7 place-items-center text-rose-deep">
              <Icon name={it.icon} size={18} />
            </span>
            <p className="mt-1 text-lg font-black leading-none tabular-nums text-ink">
              {it.n}
            </p>
            <p className="mt-1 text-[10px] text-muted">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
