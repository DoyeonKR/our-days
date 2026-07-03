"use client";

import { useEffect, useState } from "react";
import {
  listActivityDays,
  subscribeCoupleLogs,
  subscribeDeco,
} from "@/lib/couple";
import { type Streak, computeStreak, streakMilestone } from "@/lib/streak";
import { useDayTick } from "@/lib/useDayTick";
import { toISODate } from "@/lib/dday";
import Icon from "@/components/Icon";

/** 홈 '연속 기록' 스트릭 — 함께 남긴 3초 브이로그·일기가 며칠 연속인지(🔥).
 *  기존 데이터로 클라 계산, 로그/일기 실시간 구독으로 라이브 갱신. 스트릭 0이면 숨김. */
export default function StreakCard({ coupleId }: { coupleId: string }) {
  const today = useDayTick(); // ISO 'YYYY-MM-DD' — 자정/재개 시 갱신
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since = toISODate(
      new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 90),
    );
    const load = () =>
      listActivityDays(coupleId, since)
        .then((days) => {
          if (!cancelled) setStreak(computeStreak(days, today));
        })
        .catch(() => {});
    load();
    // 새 브이로그/일기 반영 — 채널명은 홈의 다른 구독과 겹치지 않게 고유 key
    const u1 = subscribeCoupleLogs(coupleId, load, "streak-clogs");
    const u2 = subscribeDeco(coupleId, load, "streak-deco");
    return () => {
      cancelled = true;
      u1();
      u2();
    };
  }, [coupleId, today]);

  if (!streak || streak.count === 0) return null;

  const milestone = streakMilestone(streak.count);
  return (
    <section className="mt-3 flex items-center gap-3 rounded-2xl bg-card glass px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-line">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose/12 text-rose-deep">
        <Icon name="flame" size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-ink">
          <span className="text-lg tabular-nums text-rose-deep">
            {streak.count.toLocaleString()}
          </span>
          일 연속 기록 🔥
        </p>
        <p className="truncate text-xs text-muted">
          {milestone
            ? `${milestone.toLocaleString()}일 달성! 대단해요 🎉`
            : streak.activeToday
              ? "오늘도 기록했어요 · 이대로 쭉 이어가요"
              : "오늘 브이로그·일기를 남기면 계속 이어져요"}
        </p>
      </div>
      {milestone && (
        <span className="shrink-0 rounded-full bg-neon px-2.5 py-1 text-[11px] font-extrabold text-white shadow-[0_0_10px_var(--neon-glow)]">
          🎉
        </span>
      )}
    </section>
  );
}
