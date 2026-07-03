"use client";

import { useEffect, useState } from "react";
import { type WeekStats, listActivityDays, weeklyStats } from "@/lib/couple";
import { type Streak, computeStreak } from "@/lib/streak";
import { useDayTick } from "@/lib/useDayTick";
import { toISODate } from "@/lib/dday";
import Icon, { type IconName } from "@/components/Icon";

/** 홈 '우리 현황' — 연속 기록 스트릭 + 이번 주 활동을 한 카드로 통합(홈 정리).
 *  기존 데이터 집계, 활동 전혀 없으면 숨김. 자정/재개 시 갱신. */
export default function CoupleActivity({ coupleId }: { coupleId: string }) {
  const today = useDayTick();
  const [streak, setStreak] = useState<Streak | null>(null);
  const [week, setWeek] = useState<WeekStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const since90 = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
    const since7 = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    listActivityDays(coupleId, since90)
      .then((d) => {
        if (!cancelled) setStreak(computeStreak(d, today));
      })
      .catch(() => {});
    weeklyStats(coupleId, since7)
      .then((w) => {
        if (!cancelled) setWeek(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleId, today]);

  const streakN = streak?.count ?? 0;
  const total = week ? week.diaries + week.vlogs + week.photos + week.answers : 0;
  if (streakN === 0 && total === 0) return null;

  const stats: { icon: IconName; n: number; label: string }[] = week
    ? [
        { icon: "book", n: week.diaries, label: "일기" },
        { icon: "camera", n: week.vlogs, label: "로그" },
        { icon: "image", n: week.photos, label: "사진" },
        { icon: "question", n: week.answers, label: "질문" },
      ]
    : [];

  return (
    <section className="mt-3 rounded-2xl bg-card glass px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-line">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose/12 text-rose-deep">
          <Icon name="flame" size={18} />
        </span>
        {streakN > 0 ? (
          <p className="text-sm font-extrabold text-ink">
            <span className="tabular-nums text-rose-deep">{streakN}</span>일 연속 기록 🔥
          </p>
        ) : (
          <p className="text-sm font-bold text-ink">이번 주 우리</p>
        )}
      </div>
      {total > 0 && (
        <div className="mt-2 flex items-center justify-around border-t border-line pt-2">
          {stats.map((x) => (
            <div key={x.label} className="flex items-center gap-1">
              <Icon name={x.icon} size={13} className="text-muted" />
              <span className="text-sm font-bold tabular-nums text-ink">{x.n}</span>
              <span className="text-[10px] text-muted">{x.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
