"use client";

import { useMemo, useState } from "react";
import {
  type CoupleEvent,
  generateMilestones,
  parseDate,
  today,
} from "@/lib/dday";

type DayItem = { label: string; emoji: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function Calendar({
  start,
  events,
}: {
  start: string | null;
  events: CoupleEvent[];
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
        add(occ.getDate(), { label: e.title, emoji: e.emoji || "📅" });
      }
    }
    return map;
  }, [start, events, ym]);

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

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="mb-4 text-lg font-extrabold text-ink">공유 캘린더</h1>

      <div className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line backdrop-blur-xl">
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

        {/* 날짜 그리드 */}
        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => (
            <button
              key={i}
              disabled={d === null}
              onClick={() => d && setSel(d)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm ${
                d === null ? "" : "active:scale-95"
              } ${sel === d ? "bg-rose/15" : ""} ${
                isToday(d ?? -1) ? "font-extrabold text-rose-deep" : "text-ink"
              }`}
            >
              {d && <span>{d}</span>}
              {d && byDay[d] && (
                <span className="mt-0.5 flex gap-0.5 text-[8px] leading-none">
                  {byDay[d].slice(0, 3).map((it, k) => (
                    <span key={k}>{it.emoji}</span>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 선택한 날 일정 */}
      <div className="mt-5">
        <p className="mb-2 px-1 text-sm font-bold text-ink">
          {ym.y}.{String(ym.m + 1).padStart(2, "0")}.
          {String(sel ?? 1).padStart(2, "0")}
        </p>
        {selItems.length ? (
          <ul className="space-y-2">
            {selItems.map((it, k) => (
              <li
                key={k}
                className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-line"
              >
                <span className="text-lg">{it.emoji}</span>
                <span className="text-sm font-semibold text-ink">{it.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white/40 px-4 py-6 text-center text-sm text-muted">
            이 날은 일정이 없어요
          </p>
        )}
      </div>
    </section>
  );
}
