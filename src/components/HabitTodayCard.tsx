"use client";

/* 홈 '오늘의 우리'의 같이 하는 습관 카드(2026-11-13, README §10.27) — 오늘 할 습관과 내 체크 버튼만.
 * 만들기 · 고치기 · 이번 주 칸 · 연속 기록은 계획 › 습관 한 곳(탭 하나 = 질문 하나, §10.7). 여긴 바로가기.
 * 진행은 '오늘의 우리' 머리의 3개(로그 · 기분 · 질문)와 따로 센다 — 습관 수는 커플마다 달라 '3개 중 N개'에 섞으면 뜻이 흐려진다.
 * 표가 아직 없으면(migration 전) 카드째 안 그린다. */

import Icon from "@/components/Icon";
import HabitIcon from "@/components/HabitIcon";
import { useHabits } from "@/lib/habitstore";
import { checkedBy, dayMet, checksByDay, dayNum, todaySummary } from "@/lib/habits";

export default function HabitTodayCard({
  coupleId,
  myUserId,
  partnerId,
  partnerName,
  onOpen,
}: {
  coupleId: string;
  myUserId: string | null;
  partnerId: string | null;
  partnerName: string;
  /** 계획 › 습관으로 */
  onOpen: () => void;
}) {
  const { snap, view, members, today, toggle } = useHabits(coupleId, myUserId, partnerId);
  if (!myUserId || snap.missing) return null;
  const { total, done } = todaySummary(snap.habits, view, members, today);
  const who = partnerName.trim() || "상대";

  return (
    <div id="today-habit" className="home-chapter-entry scroll-mt-[calc(env(safe-area-inset-top)+12px)]">
    <section className="home-habit-card rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line" aria-label="같이 하는 습관">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">같이 하는 습관</p>
        <div className="flex items-center gap-2">
          {total > 0 && <span role="status" className="text-xs font-semibold text-muted tabular-nums">오늘 {total}개 중 {done}개</span>}
          <button onClick={onOpen} className="tap flex min-h-10 items-center gap-0.5 rounded-full px-2 text-xs font-bold text-rose-deep" aria-label="계획 › 습관에서 관리하기">
            관리
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      </div>

      {snap.loading && snap.habits.length === 0 ? (
        <p className="mt-2 text-xs text-muted">습관을 불러오는 중이에요…</p>
      ) : snap.loadError && snap.habits.length === 0 ? (
        <p role="alert" className="mt-2 text-xs text-rose-deep">습관을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      ) : snap.habits.length === 0 ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">둘이 같이 할 작은 습관을 만들어 보세요. 둘 다 하면 섬 하트가 와요.</p>
          <button onClick={onOpen} className="tap shrink-0 rounded-full bg-rose/12 px-3.5 py-2 text-xs font-bold text-rose-deep">
            습관 만들기
          </button>
        </div>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {snap.habits.map((h) => {
            const mine = checkedBy(view, h.id, myUserId, today);
            const theirs = checkedBy(view, h.id, partnerId, today);
            const met = dayMet(h.mode, checksByDay(view, h.id).get(dayNum(today)), members);
            return (
              <li key={h.id} className="flex items-center gap-2.5 rounded-xl bg-glass px-3 py-2 ring-1 ring-line">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${met ? "bg-rose/15 text-rose-deep" : "bg-glass2 text-muted"}`}>
                  <HabitIcon k={h.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{h.name}</span>
                  {partnerId && (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className={`inline-block h-2 w-2 rounded-full ${mine ? "bg-rose" : "bg-line-strong"}`} aria-hidden="true" />
                      <span>나 {mine ? "완료" : "아직"}</span>
                      <span className={`ml-1 inline-block h-2 w-2 rounded-full ${theirs ? "bg-partner" : "bg-line-strong"}`} aria-hidden="true" />
                      <span>{who} {theirs ? "완료" : "아직"}</span>
                    </span>
                  )}
                </span>
                <button
                  onClick={() => toggle(h.id, !mine)}
                  aria-pressed={mine}
                  aria-label={`${h.name} 오늘 ${mine ? "체크 취소" : "체크"}`}
                  className={`tap flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ring-1 ${
                    mine ? "bg-rose text-white ring-rose" : "bg-card text-rose-deep ring-rose/40"
                  }`}
                >
                  <Icon name="check" size={14} strokeWidth={2.5} />
                  {mine ? "했어요" : "체크"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {snap.reward && <p role="status" className="mt-2 text-xs font-bold text-rose-deep">둘 다 해냈어요 · 섬 하트 +{snap.reward.coins}</p>}
      {snap.offline && <p role="status" className="mt-2 text-xs text-muted">연결되면 체크를 다시 보낼게요.</p>}
      {snap.error && <p role="alert" className="mt-2 text-xs text-rose-deep">{snap.error}</p>}
    </section>
    </div>
  );
}
