"use client";

import { useMemo, useState } from "react";
import {
  type CoupleEvent,
  diffDays,
  generateMilestones,
  isAnniversary,
  parseDate,
  toISODate,
  today,
} from "@/lib/dday";
import Icon from "@/components/Icon";

type DayItem = {
  label: string;
  emoji: string;
  kind: "day" | "year" | "event";
  eventId?: string; // 사용자 추가 일정만 (삭제 대상)
  mine?: boolean; // 내가 작성 → 작성자색
  isAnniv?: boolean; // 기념일(골드)
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 카테고리 색 점: 기념일(골드) / 내 일정(로즈) / 상대 일정(스카이)
function dotClass(it: DayItem): string {
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
  myUserId,
  myName,
  partnerName,
  onAddOnDate,
  onDelete,
}: {
  start: string | null;
  events: CoupleEvent[];
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onAddOnDate: (iso: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = today();
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [sel, setSel] = useState<number>(t.getDate());

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
    for (const e of events) {
      const base = parseDate(e.date);
      const occ = e.repeatYearly
        ? new Date(ym.y, base.getMonth(), base.getDate())
        : base;
      if (occ.getFullYear() === ym.y && occ.getMonth() === ym.m) {
        const anniv = isAnniversary(e);
        add(occ.getDate(), {
          label: e.title,
          emoji: e.emoji || (anniv ? "🎉" : "📅"),
          kind: "event",
          eventId: e.id,
          mine: !e.createdBy || (myUserId != null && e.createdBy === myUserId),
          isAnniv: anniv,
        });
      }
    }
    return map;
  }, [start, events, ym, myUserId]);

  const firstDow = new Date(ym.y, ym.m, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d: number) =>
    t.getFullYear() === ym.y && t.getMonth() === ym.m && t.getDate() === d;

  const prev = () =>
    setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const next = () =>
    setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));

  const selDate = new Date(ym.y, ym.m, sel);
  const selIso = toISODate(selDate);
  const selItems = byDay[sel] ?? [];
  const relLabel = relativeLabel(diffDays(t, selDate));

  const authorLabel = (it: DayItem) =>
    it.isAnniv
      ? "기념일"
      : `${(it.mine ? myName || "나" : partnerName || "상대").trim()} 일정`;

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-ink">
        공유 캘린더
      </h1>

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
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={i === 0 ? "text-rose-deep/80" : i === 6 ? "text-partner" : ""}
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
                  ? "text-rose-deep/70"
                  : i % 7 === 6
                    ? "text-partner"
                    : "text-ink";
            return (
              <button
                key={i}
                onClick={() => setSel(d)}
                aria-label={`${ym.m + 1}월 ${d}일${items.length ? `, 일정 ${items.length}건` : ""}`}
                aria-current={selected ? "date" : undefined}
                className="tap flex min-h-[2.9rem] flex-col items-center justify-start gap-1 py-1.5"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-[13px] tabular-nums ${numCls}`}
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
                    <span className="text-[7px] font-bold leading-none text-muted">
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
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-anniv" /> 기념일
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-deep" />
          {(myName || "나").trim()} 일정
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-partner" />
          {(partnerName || "상대").trim()} 일정
        </span>
      </div>

      {/* 선택일 아젠다 */}
      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-deep">
              {relLabel}
            </p>
            <p className="text-xl font-extrabold tracking-tight text-ink">
              {ym.m + 1}월 {sel}일{" "}
              <span className="text-sm font-semibold text-muted">
                ({WEEKDAYS[selDate.getDay()]})
              </span>
            </p>
          </div>
          <button
            onClick={() => onAddOnDate(selIso)}
            className="tap flex items-center gap-1 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-[var(--shadow-md)]"
          >
            <Icon name="plus" size={15} strokeWidth={2.4} />
            추가
          </button>
        </div>

        {selItems.length ? (
          <ul className="space-y-2">
            {selItems.map((it, k) => (
              <li
                key={k}
                className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-line"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(it)}`}
                />
                <span className="text-lg">{it.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {it.label}
                  </p>
                  <p className="text-[11px] text-muted">{authorLabel(it)}</p>
                </div>
                {it.eventId && (
                  <button
                    onClick={() => {
                      if (confirm(`'${it.label}' 삭제할까요?`)) onDelete(it.eventId!);
                    }}
                    className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
                    aria-label={`${it.label} 삭제`}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                )}
              </li>
            ))}
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
