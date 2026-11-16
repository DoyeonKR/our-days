"use client";

/* 기록 › 추억 › 우리 연대기 — 처음부터 지금까지 한 줄로(최신 순 · 달 머리). [2026-11-13 사용자 승인 "우리 연대기"]
 * 추억 칸에서 '연대기 펼치기'를 눌렀을 때만 받는 조각이다(MemoriesRecap 이 next/dynamic 으로) — 홈 · 기록 첫 로드에 안 실린다.
 * 한 쪽 = MONTHS_PER_PAGE 달. 맨 아래에 닿으면 다음 쪽(observeInPage — iOS 는 main 이 스크롤한다), 바닥 달에서 멈춘다.
 * 항목을 누르면 그 기록이 있는 곳으로(lib/activity 의 AppRoute — 일기 · 사진 · 일정은 카드까지).
 * 맨 위 '올해의 우리' — 한 해의 숫자 · 기억할 순간을 펼치고 카드로 공유한다(lib/yearcard — 누를 때 받는다). */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Member } from "@/lib/couple";
import type { AppRoute } from "@/lib/activity";
import {
  MONTHS_PER_PAGE,
  appendMonths,
  chronicleDateLabel,
  groupByMonth,
  monthCountsLine,
  monthHeadLabel,
  monthsBack,
  shouldAutoLoad,
  type ChronicleItem,
  type ChronicleMonth,
  type YearSummary,
} from "@/lib/chronicle";
import { loadChronicleContext, loadChroniclePage, loadYearSummary, signChronicleThumbs, type ChronicleContext } from "@/lib/chronicledata";
import { shiftedMonthKey, type MonthlyRecap } from "@/lib/memories";
import { kstDate } from "@/lib/kst";
import { observeInPage } from "@/lib/pageScroll";
import Icon from "@/components/Icon";

export default function OurChronicle({
  coupleId,
  members,
  myUserId,
  onRoute,
}: {
  coupleId: string;
  members: Member[];
  myUserId: string | null;
  onRoute?: (route: AppRoute) => void;
}) {
  const [today] = useState(() => kstDate(Date.now()));
  const [ctx, setCtx] = useState<ChronicleContext | null>(null);
  const [ctxFailed, setCtxFailed] = useState(false);
  const [months, setMonths] = useState<ChronicleMonth[]>([]);
  const [recaps, setRecaps] = useState<Record<string, MonthlyRecap>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(() => today.slice(0, 7));
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageFailed, setPageFailed] = useState(false);
  /** 이어진 빈 쪽 수 — 저절로 받기는 shouldAutoLoad 까지만(그 뒤는 버튼) */
  const [emptyStreak, setEmptyStreak] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const nameOf = useCallback(
    (id: string) => (id === myUserId ? "나" : members.find((m) => m.user_id === id)?.nickname?.trim() || "상대"),
    [members, myUserId],
  );
  const nameRef = useRef(nameOf);
  useEffect(() => {
    nameRef.current = nameOf;
  }, [nameOf]);

  const [ctxTry, setCtxTry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadChronicleContext(coupleId, today, (id) => nameRef.current(id))
      .then((c) => {
        if (cancelled) return;
        setCtx(c);
        setCtxFailed(false);
      })
      .catch(() => !cancelled && setCtxFailed(true));
    return () => {
      cancelled = true;
    };
  }, [coupleId, today, ctxTry]);

  const loadMore = useCallback(async (manual = false) => {
    if (!ctx || busy.current || done) return;
    if (manual) setEmptyStreak(0);
    const page = monthsBack(cursor, MONTHS_PER_PAGE, ctx.floor);
    if (page.length === 0) {
      setDone(true);
      return;
    }
    busy.current = true;
    setLoading(true);
    setPageFailed(false);
    try {
      const got = await loadChroniclePage(coupleId, page, ctx, today);
      if (!alive.current) return;
      setMonths((prev) => appendMonths(prev, groupByMonth(got.items)));
      setEmptyStreak((n) => (got.items.length ? 0 : n + 1));
      setRecaps((prev) => ({ ...prev, ...got.recaps }));
      const next = shiftedMonthKey(`${page[page.length - 1]}-01`, -1);
      setCursor(next);
      if (page.length < MONTHS_PER_PAGE || next < ctx.floor) setDone(true);
      const urls = await signChronicleThumbs(got.items);
      if (alive.current && Object.keys(urls).length) setThumbs((prev) => ({ ...prev, ...urls }));
    } catch {
      if (alive.current) setPageFailed(true);
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [coupleId, ctx, cursor, done, today]);

  // 맨 아래가 보이면 다음 쪽 — 빈 쪽(기록 없는 석 달)이면 센티널이 그대로 보여 다시 부른다. 빈 쪽이 이어지면 버튼으로만
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !ctx || done || loading || pageFailed || !shouldAutoLoad(emptyStreak)) return;
    const stop = observeInPage(
      el,
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    return () => stop?.();
  }, [ctx, done, loading, pageFailed, emptyStreak, loadMore]);

  return (
    <div className="mt-3 space-y-3">
      {ctx && <YearRecap coupleId={coupleId} ctx={ctx} today={today} />}

      {ctxFailed ? (
        <div className="rounded-xl bg-glass2 px-3 py-4 text-center text-xs text-muted ring-1 ring-line">
          <p role="alert">연대기를 불러오지 못했어요. 연결을 확인해 주세요.</p>
          <button onClick={() => setCtxTry((n) => n + 1)} className="tap mt-2 rounded-full bg-glass px-3 py-1.5 font-bold text-rose-deep ring-1 ring-line">
            다시 시도
          </button>
        </div>
      ) : (
        <ol className="space-y-4" aria-label="우리 연대기">
          {months.map((m) => {
            const counts = monthCountsLine(recaps[m.monthKey]);
            return (
              <li key={m.monthKey}>
                <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
                  <h3 className="text-sm font-extrabold text-ink">{monthHeadLabel(m.monthKey)}</h3>
                  {counts && <p className="text-xs text-muted">{counts}</p>}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {m.items.map((it) => (
                    <li key={it.key}>
                      <EntryRow item={it} thumb={it.thumbPath ? thumbs[it.thumbPath] : undefined} onOpen={() => onRoute?.(it.route)} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

      {!ctxFailed && (
        <div ref={sentinel} className="py-2 text-center text-xs text-muted">
          {pageFailed ? (
            <>
              <p role="alert">더 불러오지 못했어요.</p>
              <button onClick={() => void loadMore(true)} className="tap mt-2 rounded-full bg-glass px-3 py-1.5 font-bold text-rose-deep ring-1 ring-line">
                다시 시도
              </button>
            </>
          ) : done ? (
            <p>{months.length ? "우리 이야기의 처음까지 왔어요" : "아직 연대기에 남길 기록이 없어요"}</p>
          ) : ctx ? (
            <button onClick={() => void loadMore(true)} disabled={loading} className="tap rounded-full bg-glass px-3 py-1.5 font-bold text-muted ring-1 ring-line disabled:opacity-60">
              {loading ? "불러오는 중…" : "더 지난 달 보기"}
            </button>
          ) : (
            <p role="status">불러오는 중…</p>
          )}
        </div>
      )}
    </div>
  );
}

function EntryRow({ item, thumb, onOpen }: { item: ChronicleItem; thumb?: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="tap flex w-full items-center gap-3 rounded-xl bg-glass2 p-2.5 text-left ring-1 ring-line">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line" aria-hidden>
        <Icon name={item.icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{item.title}</span>
        <span className="block truncate text-xs text-muted">
          {chronicleDateLabel(item)}
          {item.sub ? ` · ${item.sub}` : ""}
        </span>
      </span>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
      )}
    </button>
  );
}

/** 올해의 우리 — 해를 고르고 펼치면 그 해의 숫자를 받는다(달마다 서버 집계 — 펼칠 때만). 카드는 누를 때 그린다. */
function YearRecap({ coupleId, ctx, today }: { coupleId: string; ctx: ChronicleContext; today: string }) {
  const thisYear = Number(today.slice(0, 4));
  const firstYear = Math.min(thisYear, Number(ctx.floor.slice(0, 4)));
  const [year, setYear] = useState(thisYear);
  const [open, setOpen] = useState(false);
  const [sum, setSum] = useState<YearSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    loadYearSummary(coupleId, year, today, ctx)
      .then((s) => !cancelled && setSum(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, year, coupleId, today, ctx]);

  async function share() {
    if (!sum || sum.year !== year) return;
    setCardBusy(true);
    setNote(null);
    try {
      const { shareYearCard } = await import("@/lib/yearcard");
      const how = await shareYearCard(sum);
      setNote(how === "saved" ? "카드를 저장했어요" : null);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("카드를 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      setCardBusy(false);
    }
  }

  const shown = sum && sum.year === year ? sum : null;
  return (
    <section className="rounded-xl bg-glass2 p-3 ring-1 ring-line" aria-label="올해의 우리">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-ink">{year === thisYear ? "올해의 우리" : `${year}년의 우리`}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear((y) => Math.max(firstYear, y - 1))} disabled={year <= firstYear} aria-label="이전 해" className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-muted ring-1 ring-line disabled:opacity-40">
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="min-w-12 text-center text-xs font-bold tabular-nums text-muted">{year}</span>
          <button onClick={() => setYear((y) => Math.min(thisYear, y + 1))} disabled={year >= thisYear} aria-label="다음 해" className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-muted ring-1 ring-line disabled:opacity-40">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="tap mt-2 w-full rounded-full bg-glass px-3 py-2 text-xs font-bold text-rose-deep ring-1 ring-line">
          한 해 돌아보기
        </button>
      ) : failed ? (
        <p role="alert" className="mt-2 text-xs text-rose-deep">한 해를 불러오지 못했어요. 연결을 확인해 주세요.</p>
      ) : !shown ? (
        <p role="status" className="mt-2 text-xs text-muted">한 해를 모으는 중…</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
            {(
              [
                ["일기", shown.diaries],
                ["사진", shown.photos],
                ["로그", shown.logs],
                ["일정", shown.events],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-xl bg-glass px-1 py-2 ring-1 ring-line">
                <p className="text-base font-extrabold tabular-nums text-ink">{n.toLocaleString("ko-KR")}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
          {shown.moments.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink">
              {shown.moments.map((m) => (
                <li key={m} className="flex gap-1.5">
                  <span className="mt-0.5 text-rose-deep" aria-hidden>
                    <Icon name="sparkles" size={12} />
                  </span>
                  <span className="min-w-0">{m}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button onClick={() => void share()} disabled={cardBusy} className="tap rounded-full bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {cardBusy ? "카드 만드는 중…" : "카드로 공유"}
            </button>
            {note && <span role="status" className="text-xs text-muted">{note}</span>}
          </div>
        </>
      )}
    </section>
  );
}
