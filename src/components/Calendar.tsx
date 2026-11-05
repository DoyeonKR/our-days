"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CoupleEvent,
  daysInMonth,
  diffDays,
  eventDaysInMonth,
  eventRecurrence,
  eventSpanDays,
  eventTimeLabel,
  generateMilestones,
  isAnniversary,
  nextOccurrence,
  ongoingOccurrence,
  parseDate,
  toISODate,
  today,
} from "@/lib/dday";
import Icon from "@/components/Icon";
import type { DiaryMark } from "@/lib/couple";

type DayItem = {
  label: string;
  emoji: string;
  kind: "day" | "year" | "event" | "diary";
  eventId?: string; // 사용자 추가 일정만 (편집 대상)
  event?: CoupleEvent;
  diaryId?: string; // 일기 — 누르면 그 일기 카드로
  occurrence?: string; // 이 칸이 속한 회차의 시작일(건너뛰기 · 여러 날 표시)
  span?: { first: boolean; end: Date }; // 여러 날 일정 — 이어지는 날엔 '이어서' 표시
  mine?: boolean; // 내가 작성 → 작성자색
  isAnniv?: boolean; // 기념일(골드)
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 카테고리 색 점: 기념일(골드) / 내 일정(로즈) / 상대 일정(스카이) / 일기(바이올렛)
function dotClass(it: DayItem): string {
  if (it.kind === "diary") return "bg-diary";
  if (it.kind !== "event" || it.isAnniv) return "bg-anniv";
  return it.mine ? "bg-rose-deep" : "bg-partner";
}

/** 선택일의 상대 라벨(오늘/내일/어제/N일 뒤·전). */
function relativeLabel(diff: number): string {
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  return diff > 0 ? `${diff}일 뒤` : `${-diff}일 전`;
}

export default function Calendar({
  start,
  events,
  diary,
  myUserId,
  myName,
  partnerName,
  onAddOnDate,
  onEdit,
  onOpenDiary,
  focusEvent = null,
  onFocusHandled,
}: {
  start: string | null;
  events: CoupleEvent[];
  diary: DiaryMark[];
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onAddOnDate: (iso: string) => void;
  /** 일정 편집 시트 — 삭제 · 이번만 건너뛰기도 그 안에서(README §10.9: 줄마다 휴지통을 두지 않는다).
   *  occurrence = 누른 칸이 속한 회차의 시작일. */
  onEdit: (event: CoupleEvent, occurrence?: string) => void;
  /** 일기 열기(그 일기 id). **안 주면 일기 항목이 눌리지 않는다** — 일기장 탭을 잠시 숨긴 동안
   *  (2026-08-11) 갈 곳 없는 문을 만들지 않기 위한 구멍. 복구 시 다시 넘기면 된다. */
  onOpenDiary?: (id: string) => void;
  /** 알림 · 활동함 → 이 일정의 다음 회차가 있는 달 · 날을 연다. 처리하면 onFocusHandled. */
  focusEvent?: { id: string; ts: number } | null;
  onFocusHandled?: () => void;
}) {
  const t = today();
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [sel, setSel] = useState<number>(t.getDate());
  const [flashId, setFlashId] = useState<string | null>(null);
  const agendaRef = useRef<HTMLDivElement>(null);

  // 알림으로 들어오면 그 일정의 회차(진행 중이면 지금 회차, 아니면 다음 회차)로 달력을 옮긴다.
  // 일정 목록이 아직 안 왔으면(막 부팅) 목록이 올 때 다시 본다. 지워진 일정이면 아무 일도 안 한다.
  const handledFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!focusEvent || handledFocus.current === focusEvent.ts) return;
    const ev = events.find((e) => e.id === focusEvent.id);
    if (!ev) return;
    handledFocus.current = focusEvent.ts;
    const ref = today();
    const at = ongoingOccurrence(ev, ref) ?? nextOccurrence(ev, ref);
    setYm({ y: at.getFullYear(), m: at.getMonth() });
    setSel(at.getDate());
    setFlashId(ev.id);
    onFocusHandled?.();
    // 탭 전환 때 page 가 맨 위로 올린 뒤에 내려가야 한다(자식 effect 가 먼저 돈다).
    // ⚠ 정리(cleanup)로 타이머를 지우지 않는다 — onFocusHandled 로 focusEvent 가 비면 이 effect 가 곧바로 다시 돌아 타이머가 지워진다.
    setTimeout(() => agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    setTimeout(() => setFlashId(null), 2600);
  }, [focusEvent, events, onFocusHandled]);

  const byDay = useMemo(() => {
    const map: Record<number, DayItem[]> = {};
    const add = (day: number, item: DayItem) => {
      (map[day] ??= []).push(item);
    };
    if (start) {
      const s = parseDate(start);
      for (const ms of generateMilestones(s)) {
        if (ms.date.getFullYear() === ym.y && ms.date.getMonth() === ym.m) {
          add(ms.date.getDate(), {
            label: ms.label,
            emoji: "🎉",
            kind: ms.kind,
            isAnniv: true,
          });
        }
      }
    }
    // 건너뛴 회차는 빼고, 여러 날 일정은 이어지는 날마다(2026-11-05)
    for (const e of events) {
      const anniv = isAnniversary(e);
      const span = eventSpanDays(e);
      for (const hit of eventDaysInMonth(e, ym.y, ym.m)) {
        const start = parseDate(hit.start);
        add(hit.day, {
          label: e.title,
          emoji: e.emoji || (anniv ? "🎉" : "📅"),
          kind: "event",
          eventId: e.id,
          event: e,
          mine: !e.createdBy || (myUserId != null && e.createdBy === myUserId),
          isAnniv: anniv,
          occurrence: hit.start,
          ...(span ? { span: { first: hit.first, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + span) } } : {}),
        });
      }
    }
    // 일기 마커 — 쓴 날에 바이올렛 점 + 아젠다 노출(탭하면 일기장으로)
    for (const dm of diary) {
      const d = parseDate(dm.entry_date);
      if (d.getFullYear() === ym.y && d.getMonth() === ym.m) {
        add(d.getDate(), {
          label: dm.title?.trim() || "일기",
          emoji: dm.mood_emoji || "📔",
          kind: "diary",
          diaryId: dm.id,
          mine: myUserId != null && dm.created_by === myUserId,
        });
      }
    }
    return map;
  }, [start, events, diary, ym, myUserId]);

  const firstDow = new Date(ym.y, ym.m, 1).getDay();
  const monthDays = daysInMonth(ym.y, ym.m);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= monthDays; d++) cells.push(d);

  const isToday = (d: number) =>
    t.getFullYear() === ym.y && t.getMonth() === ym.m && t.getDate() === d;

  // 월 이동 시 선택일(sel)을 새 달의 일수로 clamp — 31일 선택 후 2월 이동 시
  // new Date(y,1,31)=3월 오버플로우로 엉뚱한 날에 일정이 생기던 버그 방지.
  const shiftMonth = (delta: number) => {
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      const ny = d.getFullYear();
      const nm = d.getMonth();
      const dim = daysInMonth(ny, nm);
      setSel((s) => Math.min(s, dim));
      return { y: ny, m: nm };
    });
  };
  const prev = () => shiftMonth(-1);
  const next = () => shiftMonth(1);

  const selDate = new Date(ym.y, ym.m, sel);
  const selIso = toISODate(selDate);
  // 시간이 있는 일정은 시간순으로 위에, 종일·기념일·일기는 원래 순서대로 뒤에(2026-10-30 일정 시간)
  const selItems = [...(byDay[sel] ?? [])].sort((a, b) => {
    const ta = a.event?.time ?? "99", tb = b.event?.time ?? "99";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  const relLabel = relativeLabel(diffDays(t, selDate));

  const authorLabel = (it: DayItem) =>
    it.kind === "diary"
      ? `${(it.mine ? myName || "나" : partnerName || "상대").trim()} 일기`
      : it.isAnniv
        ? "기념일"
        : `${(it.mine ? myName || "나" : partnerName || "상대").trim()} 일정`;

  return (
    <section className="reading mx-auto max-w-md px-5 pb-28 pt-4">
      {/* 보이는 제목은 없다 — 위 세그먼트가 이미 '일정'이라고 말한다(DecoBook 주석 참고).
          '공유' 캘린더라는 이름도 혼자 쓰는 사람에겐 틀린 말이었다. */}
      <h1 className="sr-only">캘린더</h1>

      {/* 월 그리드 카드 */}
      <div className="rounded-[var(--radius-card)] bg-card p-3.5 shadow-[var(--shadow-md)] ring-1 ring-line">
        {/* 월 네비 */}
        <div className="mb-2 flex items-center justify-between">
          <p className="pl-1 text-base font-bold text-ink tabular-nums">
            {ym.y}. {String(ym.m + 1).padStart(2, "0")}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              aria-label="이전 달"
              className="tap grid h-10 w-10 place-items-center rounded-full text-muted"
            >
              <Icon name="chevronLeft" size={20} />
            </button>
            <button
              onClick={() => {
                setYm({ y: t.getFullYear(), m: t.getMonth() });
                setSel(t.getDate());
              }}
              className="tap rounded-full px-2.5 py-1 text-xs font-bold text-rose-deep"
            >
              오늘
            </button>
            <button
              onClick={next}
              aria-label="다음 달"
              className="tap grid h-10 w-10 place-items-center rounded-full text-muted"
            >
              <Icon name="chevronRight" size={20} />
            </button>
          </div>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 text-center text-sm font-semibold text-muted">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={i === 0 ? "text-rose-deep" : i === 6 ? "text-partner" : ""}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 — 숫자 + 카테고리 색 점(제목은 아래 아젠다에) */}
        <div className="mt-1 grid grid-cols-7">
          {cells.map((d, i) => {
            if (d === null) return <span key={i} />;
            const items = byDay[d] ?? [];
            const selected = sel === d;
            const todayCell = isToday(d);
            const numCls = selected
              ? "bg-rose-deep text-white font-bold shadow-[var(--shadow-sm)]"
              : todayCell
                ? "text-rose-deep font-bold ring-1 ring-rose-deep"
                : i % 7 === 0
                  ? "text-rose-deep"
                  : i % 7 === 6
                    ? "text-partner"
                    : "text-ink";
            return (
              <button
                key={i}
                onClick={() => setSel(d)}
                aria-label={`${ym.m + 1}월 ${d}일${items.length ? `, ${items.map((it) => `${it.emoji ?? ""}${it.label}`).join(", ")}` : ""}`}
                aria-current={selected ? "date" : undefined}
                className="tap flex min-h-[2.9rem] flex-col items-center justify-start gap-1 py-1.5"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm tabular-nums ${numCls}`}
                >
                  {d}
                </span>
                <span className="flex h-1.5 items-center justify-center gap-[3px]">
                  {items.slice(0, 3).map((it, k) => (
                    <span
                      key={k}
                      className={`h-1.5 w-1.5 rounded-full ${
                        selected ? "opacity-90" : ""
                      } ${dotClass(it)}`}
                    />
                  ))}
                  {items.length > 3 && (
                    <span className="text-xs font-bold leading-none text-muted">
                      +{items.length - 3}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 색 범례 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-anniv" /> 기념일
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-deep" />
          {(myName || "나").trim()} 일정
        </span>
        {/* 상대가 없으면 이 색은 달력 어디에도 안 나온다 — 없는 사람의 범례를 걸어 두지 않는다 */}
        {partnerName.trim() && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-partner" />
            {partnerName.trim()} 일정
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-diary" /> 일기
        </span>
      </div>

      {/* 선택일 아젠다 */}
      <div ref={agendaRef} className="mt-6 scroll-mt-6">
        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-deep">
              {relLabel}
            </p>
            <p className="text-xl font-extrabold tracking-tight text-ink">
              {ym.m + 1}월 {sel}일{" "}
              <span className="text-sm font-semibold text-muted">
                ({WEEKDAYS[selDate.getDay()]})
              </span>
            </p>
          </div>
          {/* 빈 날엔 아래 카드의 '이 날 일정 추가'가 같은 일을 한다 — 같은 버튼 두 개를 나란히 두지 않는다 */}
          {selItems.length > 0 && (
            <button
              onClick={() => onAddOnDate(selIso)}
              className="tap flex items-center gap-1 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-[var(--shadow-md)]"
            >
              <Icon name="plus" size={15} strokeWidth={2.4} />
              추가
            </button>
          )}
        </div>

        {selItems.length ? (
          <ul className="space-y-2">
            {selItems.map((it, k) => {
              // 줄 전체가 버튼 — 일정은 편집 시트(삭제 · 이번만 건너뛰기는 그 안에서), 일기는 그 일기 카드로.
              // 예전엔 줄마다 연필 · 휴지통이 떠 있었고(잘못 누르기 쉬웠다) 일기는 일기장 맨 위로만 갔다.
              const open =
                it.kind === "diary"
                  ? it.diaryId && onOpenDiary
                    ? () => onOpenDiary(it.diaryId!)
                    : undefined
                  : it.event
                    ? () => onEdit(it.event!, it.occurrence)
                    : undefined;
              const body = (
                <>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(it)}`} />
                  <span className="text-lg">{it.emoji}</span>
                  <span className="block min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{it.label}</span>
                    <span className="block text-sm text-muted">
                      {it.event?.time ? `${eventTimeLabel(it.event.time)} · ` : ""}
                      {authorLabel(it)}
                      {it.event && eventRecurrence(it.event) !== "none"
                        ? ` · ${eventRecurrence(it.event) === "monthly" ? "매월" : "매년"}`
                        : ""}
                      {it.span ? ` · ${it.span.first ? "" : "이어서 · "}~${it.span.end.getMonth() + 1}.${it.span.end.getDate()}` : ""}
                    </span>
                    {it.event?.note && (
                      <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted">{it.event.note}</span>
                    )}
                  </span>
                  {open && <Icon name="chevronRight" size={16} className="shrink-0 text-muted" />}
                </>
              );
              const cls = `flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-[var(--shadow-sm)] ring-1 ${
                flashId && it.eventId === flashId ? "ring-rose-deep" : "ring-line"
              }`;
              return (
                <li key={k}>
                  {open ? (
                    <button
                      type="button"
                      onClick={open}
                      aria-label={it.kind === "diary" ? `일기 열기: ${it.label}` : `${it.label} 편집`}
                      className={`tap ${cls}`}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-glass2 px-5 py-10 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-glass text-muted ring-1 ring-line">
              <Icon name="calendar" size={22} />
            </div>
            <p className="text-sm font-semibold text-ink">이 날은 일정이 없어요</p>
            <p className="mt-1 text-xs text-muted">
              기념일이나 데이트를 추가해 볼까요?
            </p>
            <button
              onClick={() => onAddOnDate(selIso)}
              className="tap mx-auto mt-4 flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)]"
            >
              <Icon name="plus" size={16} strokeWidth={2.4} />이 날 일정 추가
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
