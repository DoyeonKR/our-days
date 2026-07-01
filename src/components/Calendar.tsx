"use client";

import { useMemo, useState } from "react";
import {
  type CoupleEvent,
  generateMilestones,
  parseDate,
  toISODate,
  today,
} from "@/lib/dday";

type DayItem = {
  label: string;
  emoji: string;
  kind: "day" | "year" | "event";
  eventId?: string; // kind === "event" 인 사용자 추가 일정만 (삭제 대상)
  mine?: boolean; // 내가 작성한 일정이면 true (색 구분용). 기념일 마일스톤은 undefined.
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 미리보기 칩 색: 내 일정(로즈) / 상대 일정(블루) / 기념일(앰버)
function chipClass(it: DayItem): string {
  if (it.kind !== "event") return "bg-amber-300/40 text-amber-700";
  return it.mine
    ? "bg-rose-deep/15 text-rose-deep"
    : "bg-sky-500/15 text-sky-600";
}
function dotClass(it: DayItem): string {
  if (it.kind !== "event") return "bg-amber-400";
  return it.mine ? "bg-rose-deep" : "bg-sky-500";
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
  const [sel, setSel] = useState<number | null>(t.getDate());

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
            emoji: ms.kind === "year" ? "🎉" : "💖",
            kind: ms.kind,
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
        add(occ.getDate(), {
          label: e.title,
          emoji: e.emoji || "📅",
          kind: "event",
          eventId: e.id,
          // 로컬 일정(createdBy 없음)은 내 것으로 취급. 커플 공유는 작성자와 비교.
          mine: !e.createdBy || (myUserId != null && e.createdBy === myUserId),
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

  const selItems = sel ? (byDay[sel] ?? []) : [];
  const selIso = sel ? toISODate(new Date(ym.y, ym.m, sel)) : null;

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="mb-4 text-lg font-extrabold text-ink">공유 캘린더</h1>

      <div className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-line backdrop-blur-xl">
        {/* 월 네비 */}
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={prev}
            className="grid h-8 w-8 place-items-center rounded-full text-muted active:scale-90"
          >
            ‹
          </button>
          <p className="text-base font-bold text-ink">
            {ym.y}. {String(ym.m + 1).padStart(2, "0")}
          </p>
          <button
            onClick={next}
            className="grid h-8 w-8 place-items-center rounded-full text-muted active:scale-90"
          >
            ›
          </button>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 text-center text-[11px] text-muted">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={i === 0 ? "text-rose-deep" : i === 6 ? "text-sky-500" : ""}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 — 각 칸에 제목 미리보기 박스 */}
        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => (
            <button
              key={i}
              disabled={d === null}
              onClick={() => d && setSel(d)}
              className={`flex min-h-[3.6rem] flex-col items-stretch rounded-lg p-0.5 text-left ${
                d === null ? "" : "active:scale-95"
              } ${sel === d ? "bg-rose/15 ring-1 ring-rose/40" : ""}`}
            >
              {d && (
                <>
                  <span
                    className={`text-center text-[11px] ${
                      isToday(d)
                        ? "font-extrabold text-rose-deep"
                        : i % 7 === 0
                          ? "text-rose-deep/80"
                          : "text-ink"
                    }`}
                  >
                    {d}
                  </span>
                  <span className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                    {(byDay[d] ?? []).slice(0, 2).map((it, k) => (
                      <span
                        key={k}
                        className={`truncate rounded px-0.5 text-[8px] leading-[1.3] ${chipClass(it)}`}
                      >
                        {it.label}
                      </span>
                    ))}
                    {(byDay[d]?.length ?? 0) > 2 && (
                      <span className="px-0.5 text-[8px] leading-none text-muted">
                        +{(byDay[d]?.length ?? 0) - 2}
                      </span>
                    )}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 색 범례 — 누가 쓴 일정인지 구분 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-deep" />
          {(myName || "나").trim()} 일정
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          {(partnerName || "상대").trim()} 일정
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          기념일
        </span>
      </div>

      {/* 선택한 날 + 추가 */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-bold text-ink">
            {ym.y}.{String(ym.m + 1).padStart(2, "0")}.
            {String(sel ?? 1).padStart(2, "0")}
          </p>
          {selIso && (
            <button
              onClick={() => onAddOnDate(selIso)}
              className="rounded-full bg-rose-deep px-3 py-1.5 text-xs font-bold text-white active:scale-95"
            >
              + 이 날 일정 추가
            </button>
          )}
        </div>
        {selItems.length ? (
          <ul className="space-y-2">
            {selItems.map((it, k) => (
              <li
                key={k}
                className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-line"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(it)}`} />
                <span className="text-lg">{it.emoji}</span>
                <span className="flex-1 text-sm font-semibold text-ink">
                  {it.label}
                </span>
                {it.eventId ? (
                  <>
                    <span className="shrink-0 text-[10px] text-muted/70">
                      {it.mine ? (myName || "나").trim() : (partnerName || "상대").trim()}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`'${it.label}' 일정을 삭제할까요?`))
                          onDelete(it.eventId!);
                      }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted active:scale-90"
                      aria-label="일정 삭제"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted/70">기념일</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <button
            onClick={() => selIso && onAddOnDate(selIso)}
            className="w-full rounded-2xl border border-dashed border-rose/40 bg-white/40 px-4 py-6 text-center text-sm text-muted active:scale-[0.99]"
          >
            이 날은 일정이 없어요 · 눌러서 추가 +
          </button>
        )}
      </div>
    </section>
  );
}
