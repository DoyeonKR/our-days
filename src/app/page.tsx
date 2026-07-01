"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CoupleEvent,
  daysTogether,
  ddayLabel,
  diffDays,
  nextOccurrence,
  parseDate,
  toISODate,
  today,
  upcomingMilestones,
} from "@/lib/dday";

const LS = {
  start: "ourdays:start",
  me: "ourdays:me",
  partner: "ourdays:partner",
  events: "ourdays:events",
  notified: "ourdays:notified", // '오늘 이 D-DAY 알림 이미 띄웠다' 마커
} as const;

const EMOJI = ["🎂", "🌸", "🎁", "✈️", "🍽️", "🎬", "💍", "⭐"];

type Upcoming = {
  key: string;
  label: string;
  sub: string;
  date: Date;
  dday: string;
  days: number;
  emoji: string;
  removable?: string; // event id
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** localStorage 쓰기 — 할당량 초과/사파리 프라이빗 모드 예외를 삼켜 크래시 방지. */
function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [me, setMe] = useState("");
  const [partner, setPartner] = useState("");
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [panel, setPanel] = useState<null | "add" | "settings">(null);
  const [notif, setNotif] = useState<NotificationPermission>("default");
  const [tick, setTick] = useState(0); // 자정마다 +1 → today() 재계산 트리거

  // 최초 로드 (localStorage → 클라이언트 전용)
  useEffect(() => {
    setStart(localStorage.getItem(LS.start));
    setMe(localStorage.getItem(LS.me) ?? "");
    setPartner(localStorage.getItem(LS.partner) ?? "");
    try {
      setEvents(JSON.parse(localStorage.getItem(LS.events) ?? "[]"));
    } catch {
      setEvents([]);
    }
    if (typeof Notification !== "undefined") setNotif(Notification.permission);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setMounted(true);
  }, []);

  // 자정을 넘기면 D-day/알림이 갱신되도록 다음 자정에 재렌더 (tick 이 바뀌면 다음 자정으로 재무장)
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      5,
    );
    const id = setTimeout(
      () => setTick((v) => v + 1),
      Math.max(1000, nextMidnight.getTime() - now.getTime()),
    );
    return () => clearTimeout(id);
  }, [tick]);

  const t = today();
  const dayKey = toISODate(t); // 날짜(일 단위) 키 — 자정 넘어가면 바뀜

  const upcoming: Upcoming[] = useMemo(() => {
    if (!start) return [];
    const s = parseDate(start);
    const ms: Upcoming[] = upcomingMilestones(s, 6, t).map((m) => ({
      key: m.key,
      label: m.label,
      sub: m.kind === "year" ? "주년 기념일" : "함께한 날",
      date: m.date,
      dday: ddayLabel(m.date, t),
      days: diffDays(t, m.date),
      emoji: m.kind === "year" ? "🎉" : "💖",
    }));
    const ev: Upcoming[] = events.map((e) => {
      const d = nextOccurrence(e, t);
      return {
        key: e.id,
        label: e.title,
        sub: e.repeatYearly ? "매년 반복" : "기념일",
        date: d,
        dday: ddayLabel(d, t),
        days: diffDays(t, d),
        emoji: e.emoji || "📅",
        removable: e.id,
      };
    });
    return [...ms, ...ev].sort((a, b) => a.days - b.days).slice(0, 10);
    // dayKey: 자정 롤오버 시 재계산. t 는 dayKey 와 동일 날짜라 의도적으로 deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, events, dayKey]);

  // 오늘이 D-DAY 인 항목이 있으면 (권한 있을 때) 하루에 항목당 한 번만 알림.
  // 마커(오늘 날짜:key)를 저장해 이벤트 추가/삭제·재렌더로 중복 발화되는 걸 막는다.
  useEffect(() => {
    if (!mounted || notif !== "granted") return;
    if (typeof Notification === "undefined") return;
    const dday = upcoming.find((u) => u.days === 0);
    if (!dday) return;
    const marker = `${dayKey}:${dday.key}`;
    if (localStorage.getItem(LS.notified) === marker) return;
    try {
      new Notification("오늘은 특별한 날 💖", {
        body: `${dday.emoji} ${dday.label} · 오늘이에요!`,
        icon: "/icon.svg",
      });
      safeSet(LS.notified, marker);
    } catch {
      /* noop */
    }
  }, [mounted, notif, upcoming, dayKey]);

  function saveEvents(next: CoupleEvent[]) {
    setEvents(next);
    safeSet(LS.events, JSON.stringify(next));
  }

  function saveProfile(iso: string, a: string, b: string) {
    safeSet(LS.start, iso);
    safeSet(LS.me, a);
    safeSet(LS.partner, b);
    setStart(iso);
    setMe(a);
    setPartner(b);
  }

  async function enableNotif() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
  }

  if (!mounted) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
        <div className="animate-floaty text-5xl">💗</div>
      </main>
    );
  }

  if (!start) {
    return (
      <Onboarding onDone={saveProfile} />
    );
  }

  const s = parseDate(start);
  const nDays = daysTogether(s, t);
  const nextMs = upcoming.find((u) => u.days >= 0);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-8">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-wide text-rose-deep">
          우리의 하루
        </span>
        <button
          onClick={() => setPanel("settings")}
          className="rounded-full bg-card px-3 py-1.5 text-xs text-muted shadow-sm ring-1 ring-line active:scale-95"
        >
          ⚙︎ 설정
        </button>
      </header>

      {/* 히어로 카드 */}
      <section className="animate-pop mt-6 rounded-[2rem] bg-card p-8 text-center shadow-[0_20px_60px_-24px_rgba(232,74,127,0.5)] ring-1 ring-line backdrop-blur-xl">
        <p className="text-sm text-muted">
          {me && partner ? `${me} 💕 ${partner}` : "우리가 함께한 지"}
        </p>
        <div className="mt-3 flex items-end justify-center gap-1">
          <span className="text-7xl font-extrabold leading-none text-rose-deep tabular-nums">
            {nDays.toLocaleString()}
          </span>
          <span className="mb-1.5 text-2xl font-bold text-rose">일째</span>
        </div>
        <p className="mt-3 text-xs text-muted">
          {start.replaceAll("-", ".")} 부터 · 함께한 시간 💗
        </p>

        {nextMs && (
          <div className="mt-6 rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-line">
            <p className="text-xs text-muted">다음 기념일</p>
            <p className="mt-0.5 text-base font-bold text-ink">
              {nextMs.emoji} {nextMs.label}{" "}
              <span className="text-rose-deep">{nextMs.dday}</span>
            </p>
          </div>
        )}
      </section>

      {/* 다가오는 기념일 */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-ink">다가오는 기념일</h2>
          <button
            onClick={() => setPanel("add")}
            className="text-xs font-semibold text-rose-deep active:scale-95"
          >
            + 추가
          </button>
        </div>
        <ul className="space-y-2.5">
          {upcoming.map((u) => (
            <li
              key={u.key}
              className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm ring-1 ring-line"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-lg">
                {u.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{u.label}</p>
                <p className="text-xs text-muted">
                  {u.date.getFullYear()}.
                  {String(u.date.getMonth() + 1).padStart(2, "0")}.
                  {String(u.date.getDate()).padStart(2, "0")} · {u.sub}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${
                  u.days === 0
                    ? "bg-rose-deep text-white"
                    : "bg-rose/12 text-rose-deep"
                }`}
              >
                {u.dday}
              </span>
              {u.removable && (
                <button
                  onClick={() =>
                    saveEvents(events.filter((e) => e.id !== u.removable))
                  }
                  className="shrink-0 text-muted active:scale-90"
                  aria-label="삭제"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 알림 유도 (앱을 열었을 때만 뜨는 걸 정직하게 안내) */}
      {notif !== "granted" && (
        <button
          onClick={enableNotif}
          className="mt-6 w-full rounded-2xl border border-dashed border-rose/40 bg-white/40 px-4 py-3 text-left active:scale-[0.99]"
        >
          <span className="block text-sm font-semibold text-rose-deep">
            🔔 기념일 알림 켜기
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            앱을 열었을 때 D-DAY를 알려드려요 · 백그라운드 예약 알림은 준비 중이에요
          </span>
        </button>
      )}

      {/* 하단 추가 버튼 (플로팅) */}
      <button
        onClick={() => setPanel("add")}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-rose-deep px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_-8px_rgba(232,74,127,0.7)] active:scale-95"
      >
        + 기념일 추가하기
      </button>

      {panel === "add" && (
        <AddEvent
          onClose={() => setPanel(null)}
          onAdd={(ev) => {
            saveEvents([...events, ev]);
            setPanel(null);
          }}
        />
      )}
      {panel === "settings" && (
        <Settings
          start={start}
          me={me}
          partner={partner}
          notif={notif}
          onEnableNotif={enableNotif}
          onClose={() => setPanel(null)}
          onSave={(iso, a, b) => {
            saveProfile(iso, a, b);
            setPanel(null);
          }}
          onReset={() => {
            localStorage.clear();
            setStart(null);
            setEvents([]);
            setMe("");
            setPartner("");
            setPanel(null);
          }}
        />
      )}
    </main>
  );
}

/* ---------- 온보딩 ---------- */
function Onboarding({
  onDone,
}: {
  onDone: (iso: string, me: string, partner: string) => void;
}) {
  const [date, setDate] = useState(toISODate(today()));
  const [me, setMe] = useState("");
  const [partner, setPartner] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="animate-floaty text-center text-6xl">💗</div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">
        우리, 며칠째일까?
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        사귄 날을 입력하면 함께한 날과 기념일을 챙겨드려요.
      </p>

      <div className="mt-8 space-y-4 rounded-3xl bg-card p-6 shadow-lg ring-1 ring-line backdrop-blur-xl">
        <Field label="사귀기 시작한 날">
          <input
            type="date"
            value={date}
            max={toISODate(today())}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 text-ink outline-none focus:border-rose"
          />
        </Field>
        <div className="flex gap-3">
          <Field label="내 애칭 (선택)">
            <input
              value={me}
              onChange={(e) => setMe(e.target.value)}
              placeholder="나"
              className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 text-ink outline-none focus:border-rose"
            />
          </Field>
          <Field label="상대 애칭 (선택)">
            <input
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="그대"
              className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 text-ink outline-none focus:border-rose"
            />
          </Field>
        </div>
      </div>

      <button
        disabled={!date}
        onClick={() => onDone(date, me.trim(), partner.trim())}
        className="mt-6 w-full rounded-2xl bg-rose-deep py-4 text-base font-bold text-white shadow-lg active:scale-[0.99] disabled:opacity-40"
      >
        시작하기
      </button>
    </main>
  );
}

/* ---------- 기념일 추가 ---------- */
function AddEvent({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (ev: CoupleEvent) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toISODate(today()));
  const [repeat, setRepeat] = useState(true);
  const [emoji, setEmoji] = useState(EMOJI[0]);

  return (
    <Sheet title="기념일 추가" onClose={onClose}>
      <Field label="이름">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 지연이 생일"
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="날짜">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="아이콘">
        <div className="flex flex-wrap gap-2">
          {EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-10 w-10 place-items-center rounded-xl text-lg ring-1 ${
                emoji === e ? "bg-rose/15 ring-rose" : "bg-white/60 ring-line"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={repeat}
          onChange={(e) => setRepeat(e.target.checked)}
          className="h-4 w-4 accent-rose-deep"
        />
        매년 반복 (생일·기념일)
      </label>

      <button
        disabled={!title.trim()}
        onClick={() =>
          onAdd({
            id: uid(),
            title: title.trim(),
            date,
            repeatYearly: repeat,
            emoji,
          })
        }
        className="mt-2 w-full rounded-2xl bg-rose-deep py-3.5 font-bold text-white active:scale-[0.99] disabled:opacity-40"
      >
        추가하기
      </button>
    </Sheet>
  );
}

/* ---------- 설정 ---------- */
function Settings({
  start,
  me,
  partner,
  notif,
  onEnableNotif,
  onClose,
  onSave,
  onReset,
}: {
  start: string;
  me: string;
  partner: string;
  notif: NotificationPermission;
  onEnableNotif: () => void;
  onClose: () => void;
  onSave: (iso: string, me: string, partner: string) => void;
  onReset: () => void;
}) {
  const [date, setDate] = useState(start);
  const [a, setA] = useState(me);
  const [b, setB] = useState(partner);

  return (
    <Sheet title="설정" onClose={onClose}>
      <Field label="사귀기 시작한 날">
        <input
          type="date"
          value={date}
          max={toISODate(today())}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <div className="flex gap-3">
        <Field label="내 애칭">
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 outline-none focus:border-rose"
          />
        </Field>
        <Field label="상대 애칭">
          <input
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 outline-none focus:border-rose"
          />
        </Field>
      </div>

      {notif !== "granted" && (
        <button
          onClick={onEnableNotif}
          className="w-full rounded-xl border border-line bg-white/60 py-2.5 text-sm text-rose-deep"
        >
          🔔 알림 켜기
        </button>
      )}

      <button
        onClick={() => onSave(date, a.trim(), b.trim())}
        className="mt-1 w-full rounded-2xl bg-rose-deep py-3.5 font-bold text-white active:scale-[0.99]"
      >
        저장
      </button>
      <button
        onClick={() => {
          if (confirm("모든 정보를 지우고 처음부터 다시 시작할까요?")) onReset();
        }}
        className="w-full rounded-2xl py-2.5 text-sm text-muted"
      >
        전부 초기화
      </button>
    </Sheet>
  );
}

/* ---------- 공용 UI ---------- */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block flex-1">
      <span className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-md space-y-4 rounded-t-[2rem] bg-[var(--bg-1)] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line" />
        <h3 className="text-lg font-extrabold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}
