"use client";

import { useEffect, useState } from "react";
import { type WeekStats, homeActivity } from "@/lib/couple";
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
    homeActivity(coupleId, since90, since7)
      .then(({ activeDays, week }) => {
        if (cancelled) return;
        setStreak(computeStreak(activeDays, today));
        setWeek(week);
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
    <section className="relative mt-3 overflow-hidden rounded-[var(--radius-card)] bg-card glass px-4 py-3.5 shadow-[var(--shadow-sm)] ring-1 ring-line">
      {/* V2 — 모닥불 잔광(카드 왼쪽 위에서 은은히) */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-6 -top-8 h-24 w-24 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,170,80,0.22), transparent 70%)" }}
      />
      <div className="relative flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          style={{
            background: "linear-gradient(160deg, #ffb45e, #ff5f97)",
            boxShadow: "0 0 14px rgba(255,150,80,0.45)",
          }}
        >
          <Icon name="flame" size={18} />
        </span>
        {streakN > 0 ? (
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-tight text-ink">
              <span className="tabular-nums text-rose-deep">{streakN}</span>일째 모닥불이 타고 있어요 🔥
            </p>
            <p className="text-[10px] leading-tight text-muted">기록을 남기면 불씨가 이어져요</p>
          </div>
        ) : (
          <p className="text-sm font-bold text-ink">이번 주 우리</p>
        )}
      </div>
      {total > 0 && (
        <div className="relative mt-2.5 flex items-center justify-around border-t border-line pt-2.5">
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
