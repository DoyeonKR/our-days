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
import CoupleSync from "@/components/CoupleSync";
import Calendar from "@/components/Calendar";
import PhotoAlbum from "@/components/PhotoAlbum";
import AccountSection from "@/components/AccountSection";
import PushSettings from "@/components/PushSettings";
import Diagnostics from "@/components/Diagnostics";
import MoodCheckin from "@/components/MoodCheckin";
import DailyQuestion from "@/components/DailyQuestion";
import DecoBook from "@/components/DecoBook";
import {
  addCoupleEvent,
  deleteCoupleEvent,
  getCoupleCover,
  listCoupleEvents,
  signedPhotoUrl,
  subscribeCouple,
  subscribeCoupleEvents,
  updateCoupleCover,
  updateCoupleStartDate,
} from "@/lib/couple";
import { asset } from "@/lib/base";

const LS = {
  start: "ourdays:start",
  me: "ourdays:me",
  events: "ourdays:events",
  notified: "ourdays:notified", // '오늘 이 D-DAY 알림 이미 띄웠다' 마커
  cover: "ourdays:cover", // 대표 사진(홈 상단·배경) storage 경로
} as const;

type View = "home" | "calendar" | "deco" | "album";

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
  const [partnerName, setPartnerName] = useState(""); // 연결된 상대 애칭(커플에서 자동)
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [panel, setPanel] = useState<null | "add" | "settings">(null);
  const [notif, setNotif] = useState<NotificationPermission>("default");
  const [tick, setTick] = useState(0); // 자정마다 +1 → today() 재계산 트리거
  const [coupleId, setCoupleId] = useState<string | null>(null); // 연동된 커플 (있으면 시작일 공유)
  const [view, setView] = useState<View>("home"); // 하단 탭: 홈/캘린더/사진첩
  const [addDate, setAddDate] = useState<string | null>(null); // 캘린더에서 고른 추가 날짜
  const [coverPath, setCoverPath] = useState<string | null>(null); // 대표 사진 storage 경로
  const [coverUrl, setCoverUrl] = useState<string | null>(null); // 대표 사진 서명 URL

  // 최초 로드 (localStorage → 클라이언트 전용)
  useEffect(() => {
    setStart(localStorage.getItem(LS.start));
    setMe(localStorage.getItem(LS.me) ?? "");
    setCoverPath(localStorage.getItem(LS.cover));
    try {
      setEvents(JSON.parse(localStorage.getItem(LS.events) ?? "[]"));
    } catch {
      setEvents([]);
    }
    if (typeof Notification !== "undefined") setNotif(Notification.permission);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(asset("/sw.js")).catch(() => {});
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
        icon: asset("/icon.svg"),
      });
      safeSet(LS.notified, marker);
    } catch {
      /* noop */
    }
  }, [mounted, notif, upcoming, dayKey]);

  // 기념일 소스: 연동되면 커플 공유(couple_events)로 전환(로컬은 1회 이관) + 실시간 동기화.
  // 미연동이면 로컬(localStorage). → 상대가 추가한 기념일이 서로 보이게 됨.
  useEffect(() => {
    if (!mounted) return;
    if (!coupleId) {
      try {
        setEvents(JSON.parse(localStorage.getItem(LS.events) ?? "[]"));
      } catch {
        setEvents([]);
      }
      return;
    }
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      // 로컬에 남아있던 기념일을 커플로 이관 후 로컬 비움(중복 방지)
      let local: CoupleEvent[] = [];
      try {
        local = JSON.parse(localStorage.getItem(LS.events) ?? "[]");
      } catch {
        local = [];
      }
      if (local.length) {
        for (const e of local) {
          try {
            await addCoupleEvent(coupleId, e);
          } catch {
            /* noop */
          }
        }
        safeSet(LS.events, "[]");
      }
      try {
        if (!cancelled) setEvents(await listCoupleEvents(coupleId));
      } catch {
        /* noop */
      }
      unsub = subscribeCoupleEvents(coupleId, async () => {
        try {
          setEvents(await listCoupleEvents(coupleId));
        } catch {
          /* noop */
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [mounted, coupleId]);

  function saveEvents(next: CoupleEvent[]) {
    setEvents(next);
    safeSet(LS.events, JSON.stringify(next));
  }

  // 내 프로필 저장 (사귄 날 + 내 애칭). 상대 애칭은 저장 안 함 — 연결되면 상대가 넣은 값 사용.
  function saveProfile(iso: string, a: string) {
    safeSet(LS.start, iso);
    safeSet(LS.me, a);
    setStart(iso);
    setMe(a);
    // 커플 연동 상태면 공유 시작일도 함께 갱신 (best-effort)
    if (coupleId) updateCoupleStartDate(coupleId, iso).catch(() => {});
  }

  // 커플의 공유 시작일을 로컬에 반영 (커플로 되돌려 쓰지 않음 — 루프 방지)
  function adoptStart(iso: string) {
    safeSet(LS.start, iso);
    setStart(iso);
  }

  // 대표 사진 경로 → 서명 URL(홈 상단/배경). coverPath 변경 시 재해석.
  useEffect(() => {
    let cancelled = false;
    if (!coverPath) {
      setCoverUrl(null);
      return;
    }
    signedPhotoUrl(coverPath)
      .then((u) => {
        if (!cancelled) setCoverUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coverPath]);

  function onSetCover(path: string) {
    const p = path || null;
    setCoverPath(p);
    if (coupleId) {
      updateCoupleCover(coupleId, p).catch(() => {}); // 커플 공유 대표사진
    } else if (p) {
      safeSet(LS.cover, p);
    } else {
      try {
        localStorage.removeItem(LS.cover);
      } catch {
        /* noop */
      }
    }
  }

  // 연동 시 대표사진은 커플 공유(couples.cover_path) + 실시간(상대가 바꿔도 반영).
  useEffect(() => {
    if (!mounted || !coupleId) return;
    let cancelled = false;
    const refresh = () =>
      getCoupleCover(coupleId)
        .then((p) => {
          if (!cancelled) setCoverPath(p);
        })
        .catch(() => {});
    refresh();
    const unsub = subscribeCouple(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [mounted, coupleId]);

  // 기념일 추가 — 연동 상태면 커플 공유(couple_events), 아니면 로컬.
  async function addEvent(ev: CoupleEvent) {
    if (coupleId) {
      try {
        await addCoupleEvent(coupleId, ev);
        setEvents(await listCoupleEvents(coupleId));
      } catch {
        /* 실패 무시 — 실시간 구독이 곧 최신화 */
      }
    } else {
      saveEvents([...events, ev]);
    }
  }

  // 기념일 삭제 — 연동 상태면 커플 공유에서, 아니면 로컬.
  async function removeEvent(id: string) {
    if (coupleId) {
      try {
        await deleteCoupleEvent(id);
        setEvents(await listCoupleEvents(coupleId));
      } catch {
        /* noop */
      }
    } else {
      saveEvents(events.filter((e) => e.id !== id));
    }
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
    <>
      {/* 대표 사진 배경 (은은하게) */}
      {coverUrl && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center opacity-[0.13]"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}

      <main className="mx-auto min-h-dvh max-w-md">
        {view === "home" && (
          <div className="px-5 pb-28 pt-8">
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

            {/* 대표 사진 (있으면 홈 상단 이미지) */}
            {coverUrl && (
              <div className="animate-pop mt-4 overflow-hidden rounded-[2rem] shadow-lg ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="" className="h-44 w-full object-cover" />
              </div>
            )}

      {/* 히어로 카드 */}
      <section className="animate-pop mt-6 rounded-[2rem] bg-card p-8 text-center shadow-[0_20px_60px_-24px_rgba(232,74,127,0.5)] ring-1 ring-line backdrop-blur-xl">
        <p className="text-sm text-muted">
          {me && partnerName
            ? `${me} 💕 ${partnerName}`
            : me
              ? `${me} 💕 …`
              : "우리가 함께한 지"}
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

      {/* 무드 체크인 + 오늘의 질문 (연동 시) */}
      {coupleId && (
        <MoodCheckin coupleId={coupleId} partnerName={partnerName} />
      )}
      {coupleId && (
        <DailyQuestion coupleId={coupleId} partnerName={partnerName} />
      )}

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
                  onClick={() => removeEvent(u.removable!)}
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

      {/* 커플 연동 + 쿡찌르기 */}
      <CoupleSync
        localStart={start}
        myName={me}
        notif={notif}
        onCoupleChange={setCoupleId}
        onAdoptStart={adoptStart}
        onPartnerName={setPartnerName}
        onOpenAccount={() => setPanel("settings")}
      />

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
          </div>
        )}

        {view === "calendar" && (
          <Calendar
            start={start}
            events={events}
            onAddOnDate={(iso) => {
              setAddDate(iso);
              setPanel("add");
            }}
          />
        )}
        {view === "deco" && <DecoBook coupleId={coupleId} />}
        {view === "album" && (
          <PhotoAlbum
            coupleId={coupleId}
            coverPath={coverPath}
            onSetCover={onSetCover}
          />
        )}

        {panel === "add" && (
        <AddEvent
          initialDate={addDate ?? undefined}
          onClose={() => {
            setPanel(null);
            setAddDate(null);
          }}
          onAdd={(ev) => {
            addEvent(ev);
            setPanel(null);
            setAddDate(null);
          }}
        />
      )}
      {panel === "settings" && (
        <Settings
          start={start}
          me={me}
          onClose={() => setPanel(null)}
          onSave={(iso, a) => {
            saveProfile(iso, a);
            setPanel(null);
          }}
          onReset={() => {
            localStorage.clear();
            setStart(null);
            setEvents([]);
            setMe("");
            setPartnerName("");
            setPanel(null);
          }}
        />
      )}
      </main>

      {/* 하단 탭 네비 */}
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-line bg-[var(--bg-1)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="flex">
          {(
            [
              { k: "home", icon: "🏠", label: "홈" },
              { k: "calendar", icon: "📅", label: "캘린더" },
              { k: "deco", icon: "🎨", label: "데코북" },
              { k: "album", icon: "📷", label: "사진첩" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.k}
              onClick={() => setView(tab.k)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] active:scale-95 ${
                view === tab.k ? "font-bold text-rose-deep" : "text-muted"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

/* ---------- 온보딩 ---------- */
function Onboarding({
  onDone,
}: {
  onDone: (iso: string, me: string) => void;
}) {
  const [date, setDate] = useState(toISODate(today()));
  const [me, setMe] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="animate-floaty text-center text-6xl">💗</div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">
        우리, 며칠째일까?
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        사귄 날과 내 애칭을 넣어주세요. 상대 애칭은 커플 연결 시 자동으로 가져와요.
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
        <Field label="내 애칭">
          <input
            value={me}
            onChange={(e) => setMe(e.target.value)}
            placeholder="나"
            className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 text-ink outline-none focus:border-rose"
          />
        </Field>
      </div>

      <button
        disabled={!date}
        onClick={() => onDone(date, me.trim())}
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
  initialDate,
}: {
  onClose: () => void;
  onAdd: (ev: CoupleEvent) => void;
  initialDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || toISODate(today()));
  const [repeat, setRepeat] = useState(true);
  const [emoji, setEmoji] = useState(EMOJI[0]);

  return (
    <Sheet title="기념일 추가" onClose={onClose}>
      <Field label="이름">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 유진이 생일"
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
  onClose,
  onSave,
  onReset,
}: {
  start: string;
  me: string;
  onClose: () => void;
  onSave: (iso: string, me: string) => void;
  onReset: () => void;
}) {
  const [date, setDate] = useState(start);
  const [a, setA] = useState(me);

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
      <Field label="내 애칭">
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="나"
          className="w-full rounded-xl border border-line bg-white/70 px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <p className="text-xs text-muted">상대 애칭은 커플 연결 시 상대가 넣은 이름으로 자동 표시돼요.</p>

      <AccountSection />

      <PushSettings />

      <Diagnostics />

      <button
        onClick={() => onSave(date, a.trim())}
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
