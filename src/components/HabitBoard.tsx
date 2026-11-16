"use client";

/* 계획 › 습관(2026-11-13, README §10.27) — 같이 하는 습관을 만들고 고치고 체크하는 곳(고치는 곳은 여기 하나).
 * 습관마다: 아이콘 · 이름 · 목표(매일 / 주 N회) · 방식(둘 다 해야 / 한 명만 해도) · 연속 기록 · 이번 주 칸 일곱(나 분홍 · 상대 파랑).
 * 홈 '오늘의 우리'엔 오늘 체크 버튼만 있다(HabitTodayCard). 데이터 · 재시도 · 하트는 lib/habitstore 한 곳. */

import { useState } from "react";
import Icon from "@/components/Icon";
import HabitIcon from "@/components/HabitIcon";
import ConnectFirst from "@/components/ConnectFirst";
import Sheet from "@/components/Sheet";
import SegmentedControl from "@/components/SegmentedControl";
import StatePanel from "@/components/StatePanel";
import { SkeletonList } from "@/components/Skeleton";
import { confirmDialog } from "@/lib/confirm";
import { useHabits } from "@/lib/habitstore";
import { HABIT_ICONS, HABIT_ICON_KEYS } from "@/lib/icons";
import { newClientId } from "@/lib/clientid";
import {
  HABIT_HEART,
  HABIT_HEART_DAY_CAP,
  HABIT_MAX,
  HABIT_NAME_MAX,
  WEEKLY_MAX,
  checkedBy,
  habitStreak,
  modeLabel,
  normalizeHabitName,
  normalizeTarget,
  streakLabel,
  targetLabel,
  todaySummary,
  weekGrid,
  type Habit,
  type HabitMode,
  type HabitTarget,
} from "@/lib/habits";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

type Draft = { id: string | null; name: string; icon: string; kind: HabitTarget; count: number; mode: HabitMode };
const NEW_DRAFT: Draft = { id: null, name: "", icon: "water", kind: "daily", count: 3, mode: "both" };

export default function HabitBoard({
  coupleId,
  myUserId,
  partnerId,
  myName,
  partnerName,
  onConnect,
}: {
  coupleId: string | null;
  myUserId: string | null;
  partnerId: string | null;
  myName: string;
  partnerName: string;
  onConnect?: () => void;
}) {
  const { snap, view, members, today, toggle, create, update, remove, retry, clearError } = useHabits(coupleId, myUserId, partnerId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const me = myName.trim() || "나";
  const who = partnerName.trim() || "상대";

  if (!coupleId) {
    return (
      <section className="mx-auto max-w-md px-5 pb-28 pt-4">
        <h1 className="sr-only">같이 하는 습관</h1>
        <ConnectFirst icon="check" title="커플 연결 후 같이 해요" body="'함께' 탭에서 상대와 연결하면 둘이 같은 습관을 매일 체크할 수 있어요." onConnect={onConnect} />
      </section>
    );
  }

  const { total, done } = todaySummary(snap.habits, view, members, today);

  function openNew() {
    clearError();
    setFormErr(null);
    setDraft({ ...NEW_DRAFT, id: null });
  }
  function openEdit(h: Habit) {
    clearError();
    setFormErr(null);
    setDraft({ id: h.id, name: h.name, icon: h.icon, kind: h.target_kind, count: h.target_kind === "weekly" ? h.target_count : 3, mode: h.mode });
  }

  async function save() {
    if (!draft || saving) return;
    const n = normalizeHabitName(draft.name);
    if (!n.ok) return setFormErr(n.reason);
    const input = { name: n.name, icon: draft.icon, mode: draft.mode, ...normalizeTarget(draft.kind, draft.count) };
    setSaving(true);
    setFormErr(null);
    const ok = draft.id ? await update(draft.id, input) : await create(input, newClientId());
    setSaving(false);
    if (ok) setDraft(null);
  }

  async function del() {
    if (!draft?.id || saving) return;
    const ok = await confirmDialog({
      message: `'${draft.name}' 습관을 지울까요? 둘의 체크 기록도 함께 사라져요.`,
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    const gone = await remove(draft.id);
    setSaving(false);
    if (gone) setDraft(null);
  }

  return (
    <section className="habit-board mx-auto max-w-md px-5 pb-28 pt-4" aria-busy={snap.loading}>
      <h1 className="sr-only">같이 하는 습관</h1>
      <p className="mb-4 text-xs text-muted">
        둘이 같은 습관을 하루 한 번씩 체크해요. 둘 다 한 날은 섬 하트 +{HABIT_HEART}(하루 {HABIT_HEART_DAY_CAP}개까지).
      </p>

      {snap.missing ? (
        <StatePanel kind="error" title="습관 기능을 준비하고 있어요" detail="잠시 후 다시 열어 주세요." onRetry={retry} busy={snap.loading} />
      ) : (
        <>
          <div className="rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
            <div className="flex items-end justify-between">
              <p className="text-sm font-bold text-ink">오늘의 습관</p>
              <p role="status" className="text-sm font-extrabold text-gradient tabular-nums">
                {snap.loading && total === 0 ? "확인 중" : `오늘 ${total}개 중 ${done}개`}
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="오늘 습관 달성"
              aria-valuemin={0}
              aria-valuemax={Math.max(total, 1)}
              aria-valuenow={done}
              className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-rose/12"
            >
              <div className="h-full rounded-full bg-brand motion-safe:transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
            {partnerId && (
              <p className="mt-2 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose" />{me}</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-partner" />{who}</span>
              </p>
            )}
          </div>

          <button
            onClick={openNew}
            disabled={snap.habits.length >= HABIT_MAX}
            className="tap mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
          >
            <Icon name="plus" size={16} strokeWidth={2.25} />
            {snap.habits.length >= HABIT_MAX ? `습관은 ${HABIT_MAX}개까지예요` : "습관 만들기"}
          </button>

          {snap.reward && <p role="status" className="mt-3 text-xs font-bold text-rose-deep">둘 다 해냈어요 · 섬 하트 +{snap.reward.coins}</p>}
          {snap.offline && <p role="status" className="mt-3 text-xs text-muted">연결되면 체크를 다시 보낼게요.</p>}
          {snap.error && !draft && <p role="alert" className="mt-3 text-xs text-rose-deep">{snap.error}</p>}

          {snap.loading && snap.habits.length === 0 ? (
            <div className="mt-5"><SkeletonList rows={3} /></div>
          ) : snap.loadError && snap.habits.length === 0 ? (
            <div className="mt-5">
              <StatePanel kind="error" title="습관을 불러오지 못했어요" detail="저장된 습관은 지워지지 않았어요. 다시 불러와 주세요." onRetry={retry} busy={snap.loading} />
            </div>
          ) : snap.habits.length === 0 ? (
            <div className="cosmic-feed-card mt-5 border-dashed px-5 py-5 text-center">
              <p className="text-sm font-semibold text-ink">아직 같이 하는 습관이 없어요</p>
              <p className="mt-1 text-xs text-muted">물 마시기 · 30분 걷기처럼 작게 시작해 보세요</p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {snap.habits.map((h) => {
                const streak = habitStreak(h, view, members, today);
                const grid = weekGrid(h, view, myUserId, partnerId, members, today);
                const mine = checkedBy(view, h.id, myUserId, today);
                const weekDone = grid.filter((c) => c.met).length;
                return (
                  <li key={h.id} className="rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose/12 text-rose-deep">
                        <HabitIcon k={h.icon} size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{h.name}</span>
                        <span className="block text-xs text-muted">
                          {targetLabel(h)} · {modeLabel(h.mode)}
                          {h.target_kind === "weekly" ? ` · 이번 주 ${weekDone}/${h.target_count}` : ""}
                        </span>
                      </span>
                      <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${streak.count ? "bg-rose/12 text-rose-deep" : "bg-glass text-muted"}`}>
                        <Icon name="flame" size={13} />
                        {streakLabel(streak)}
                      </span>
                      <button onClick={() => openEdit(h)} aria-label={`${h.name} 고치기`} className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted">
                        <Icon name="pencil" size={16} />
                      </button>
                    </div>

                    <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label={`${h.name} 이번 주`}>
                      {grid.map((c, i) => {
                        const [, m, d] = c.day.split("-").map(Number);
                        const state = [c.me ? `${me} 함` : null, partnerId && c.partner ? `${who} 함` : null].filter(Boolean).join(", ") || "아직";
                        return (
                          <li key={c.day} className="flex flex-col items-center gap-1" aria-label={`${m}월 ${d}일(${WEEKDAYS[i]}) ${c.future ? "앞으로" : state}${c.met ? " · 채움" : ""}`}>
                            <span className={`text-xs ${c.today ? "font-extrabold text-ink" : "text-muted"}`} aria-hidden="true">{WEEKDAYS[i]}</span>
                            <span
                              aria-hidden="true"
                              className={`flex h-8 w-full max-w-9 overflow-hidden rounded-lg ring-1 ${c.met ? "ring-2 ring-rose-deep" : c.today ? "ring-ink/40" : "ring-line"} ${c.future ? "opacity-40" : ""}`}
                            >
                              <span className={`h-full flex-1 ${c.me ? "bg-rose" : "bg-glass"}`} />
                              {partnerId && <span className={`h-full flex-1 ${c.partner ? "bg-partner" : "bg-glass"}`} />}
                            </span>
                          </li>
                        );
                      })}
                    </ol>

                    <button
                      onClick={() => toggle(h.id, !mine)}
                      aria-pressed={mine}
                      className={`tap mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold ring-1 ${
                        mine ? "bg-rose text-white ring-rose" : "bg-card text-rose-deep ring-rose/40"
                      }`}
                    >
                      <Icon name="check" size={16} strokeWidth={2.5} />
                      {mine ? "오늘 했어요 · 누르면 취소" : "오늘 체크하기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {draft && (
        <Sheet
          title={draft.id ? "습관 고치기" : "새 습관"}
          onClose={() => !saving && setDraft(null)}
          footer={
            <div className="space-y-2">
              {(formErr || snap.error) && <p role="alert" className="text-xs text-rose-deep">{formErr || snap.error}</p>}
              <button
                onClick={() => void save()}
                disabled={saving || !draft.name.trim()}
                className="tap flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-40"
              >
                {saving ? "저장 중…" : draft.id ? "저장하기" : "만들기"}
              </button>
            </div>
          }
        >
          <label className="block">
            <span className="mb-1 flex justify-between text-xs font-bold text-muted">
              <span>이름</span>
              <span className="tabular-nums">{[...draft.name].length}/{HABIT_NAME_MAX}</span>
            </span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: [...e.target.value].slice(0, HABIT_NAME_MAX).join("") })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
              }}
              placeholder="예) 물 2L 마시기"
              aria-label="습관 이름"
              className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-sm outline-none focus:border-rose"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-bold text-muted">아이콘</p>
            <div role="radiogroup" aria-label="습관 아이콘" className="grid grid-cols-6 gap-1.5">
              {HABIT_ICON_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={draft.icon === k}
                  aria-label={HABIT_ICONS[k].label}
                  onClick={() => setDraft({ ...draft, icon: k })}
                  className={`tap grid h-11 place-items-center rounded-xl ring-1 ${draft.icon === k ? "bg-rose/15 text-rose-deep ring-rose" : "bg-glass text-muted ring-line"}`}
                >
                  <HabitIcon k={k} size={20} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold text-muted">목표</p>
            <SegmentedControl
              value={draft.kind}
              onChange={(kind) => setDraft({ ...draft, kind })}
              ariaLabel="목표"
              options={[
                { value: "daily", label: "매일" },
                { value: "weekly", label: "주 N회" },
              ]}
            />
            {draft.kind === "weekly" && (
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label="한 번 줄이기"
                  disabled={draft.count <= 1}
                  onClick={() => setDraft({ ...draft, count: Math.max(1, draft.count - 1) })}
                  className="tap grid h-10 w-10 place-items-center rounded-full bg-glass text-lg font-bold text-ink ring-1 ring-line disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-20 text-center text-sm font-bold text-ink tabular-nums" aria-live="polite">주 {draft.count}회</span>
                <button
                  type="button"
                  aria-label="한 번 늘리기"
                  disabled={draft.count >= WEEKLY_MAX}
                  onClick={() => setDraft({ ...draft, count: Math.min(WEEKLY_MAX, draft.count + 1) })}
                  className="tap grid h-10 w-10 place-items-center rounded-full bg-glass text-ink ring-1 ring-line disabled:opacity-40"
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold text-muted">하루를 채우는 조건</p>
            <SegmentedControl
              value={draft.mode}
              onChange={(mode) => setDraft({ ...draft, mode })}
              ariaLabel="하루를 채우는 조건"
              options={[
                { value: "both", label: "둘 다 해야" },
                { value: "either", label: "한 명만 해도" },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">
              {draft.mode === "both" ? "둘 다 체크한 날만 연속 기록에 들어가요." : "누구든 한 명이 체크하면 그 날은 채워져요."} 섬 하트는 둘 다 한 날에만 와요.
            </p>
          </div>

          {draft.id && (
            <button
              type="button"
              onClick={() => void del()}
              disabled={saving}
              className="tap flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-rose-deep ring-1 ring-rose/40 disabled:opacity-40"
            >
              <Icon name="trash" size={16} />
              이 습관 삭제
            </button>
          )}
        </Sheet>
      )}
    </section>
  );
}
