"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CoupleEvent,
  daysTogether,
  ddayLabel,
  diffDays,
  isAnniversary,
  nextOccurrence,
  parseDate,
  toISODate,
  today,
  upcomingMilestones,
} from "@/lib/dday";
import dynamic from "next/dynamic";
import CoupleSync from "@/components/CoupleSync";
import AccountSection from "@/components/AccountSection";
import { SkeletonList } from "@/components/Skeleton";

// 탭 전용 화면은 코드 스플리팅 — 홈 첫 로드 번들에서 제외(드라마틱 초기 로딩 개선)
const tabLoading = () => (
  <div className="mx-auto max-w-md px-5 pt-8">
    <SkeletonList rows={3} />
  </div>
);
const Calendar = dynamic(() => import("@/components/Calendar"), {
  loading: tabLoading,
});
const PhotoAlbum = dynamic(() => import("@/components/PhotoAlbum"), {
  loading: tabLoading,
});
// 설정 패널 전용 컴포넌트도 지연 로드 — 설정을 열기 전엔 첫 로드 번들에 안 실림
const PushSettings = dynamic(() => import("@/components/PushSettings"), {
  loading: () => <SkeletonList rows={1} />,
});
const NotifySettings = dynamic(() => import("@/components/NotifySettings"), {
  loading: () => <SkeletonList rows={2} />,
});
const Diagnostics = dynamic(() => import("@/components/Diagnostics"));
const ThemePicker = dynamic(() => import("@/components/ThemePicker"), {
  loading: () => <SkeletonList rows={1} />,
});
import AuthGate from "@/components/AuthGate";
import { getAuthInfo } from "@/lib/auth";
import DailyQuestion from "@/components/DailyQuestion";
import MoodLine from "@/components/MoodLine";
import CoupleActivity from "@/components/CoupleActivity";
const DecoBook = dynamic(() => import("@/components/DecoBook"), {
  loading: tabLoading,
});
const BucketList = dynamic(() => import("@/components/BucketList"), {
  loading: tabLoading,
});
const TodayLog = dynamic(() => import("@/components/TodayLog"), {
  loading: () => <SkeletonList rows={2} />,
});
const GameArcade = dynamic(() => import("@/components/GameArcade"), {
  loading: tabLoading,
});
// 홈의 살아있는 펫 — 섬 아트가 무거워 지연 로드(연동된 커플만 렌더). 로드 전 스켈레톤.
const HomePet = dynamic(() => import("@/components/island/HomePet"), {
  loading: () => <div className="h-[172px] w-full animate-pulse rounded-2xl bg-card ring-1 ring-line" />,
});
import TodayLogCard from "@/components/TodayLogCard";
import Icon, { type IconName } from "@/components/Icon";
import SegmentedControl from "@/components/SegmentedControl";
import ConfirmHost from "@/components/ConfirmHost";
import { confirmDialog } from "@/lib/confirm";
import {
  type DiaryMark,
  addCoupleEvent,
  deleteCoupleEvent,
  getCoupleCover,
  getMyCouple,
  isSupabaseConfigured,
  listCoupleEvents,
  getCoupleHung,
  listDiaryMarks,
  listRecentPhotos,
  photosByPaths,
  updateCoupleHung,
  signedPhotoUrl,
  subscribeCouple,
  subscribeCoupleEvents,
  subscribeDeco,
  updateCoupleCover,
  updateCoupleStartDate,
} from "@/lib/couple";
import { asset, safeParse } from "@/lib/base";
import { useDayTick } from "@/lib/useDayTick";
import { useGlobalPet } from "@/lib/petglobal";
import { nextHung } from "@/lib/hung";
import PetIcon from "@/components/island/PetIcon";
import WorldProp from "@/components/island/WorldProp";
import WorldSectionHead from "@/components/WorldSectionHead";
import HomeWorld from "@/components/HomeWorld";
// UX/UI 개편: bg-white/* 는 globals 토큰(bg-glass/glass2)로 치환됨 → 다크 자동 대응.

const LS = {
  start: "ourdays:start",
  me: "ourdays:me",
  events: "ourdays:events",
  notified: "ourdays:notified", // '오늘 이 D-DAY 알림 이미 띄웠다' 마커
  cover: "ourdays:cover", // 대표 사진(홈 상단·배경) storage 경로
} as const;

type View = "home" | "log" | "calendar" | "deco" | "album" | "game";

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

/** 로컬 저장 기념일 안전 읽기 — getItem throw(iOS 프라이빗)와 깨진 JSON 모두 방어. */
function loadEvents(): CoupleEvent[] {
  try {
    return safeParse<CoupleEvent[]>(localStorage.getItem(LS.events), []);
  } catch {
    return [];
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
  const [coupleId, setCoupleId] = useState<string | null>(null); // 연동된 커플 (있으면 시작일 공유)
  const [view, setView] = useState<View>("home"); // 하단 탭: 홈/캘린더/사진첩
  const [openIslandReq, setOpenIslandReq] = useState(0); // 홈 펫 탭 → 게임 탭의 섬 오버레이 열기 신호
  const [addDate, setAddDate] = useState<string | null>(null); // 캘린더에서 고른 추가 날짜
  const [coverPath, setCoverPath] = useState<string | null>(null); // 대표 사진 storage 경로
  const [coverUrl, setCoverUrl] = useState<string | null>(null); // 대표 사진 서명 URL
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false); // 이메일 계정 로그인 여부
  const [myUserId, setMyUserId] = useState<string | null>(null); // 내 user id (일정 작성자 색 구분)
  const [diaryMarks, setDiaryMarks] = useState<DiaryMark[]>([]); // 캘린더에 표시할 일기 마커
  const [homePhotos, setHomePhotos] = useState<{ id: string; url: string; created_at: string }[]>([]); // 홈 빨랫줄
  const [hungPaths, setHungPaths] = useState<string[]>([]); // 커플이 고른 빨랫줄 사진(빈 배열 = 자동)
  const [planView, setPlanView] = useState<"cal" | "bucket">("cal"); // 캘린더 탭: 일정 | 버킷
  // 한 번 연 탭은 언마운트하지 않고 숨김(keep-mounted) — 탭 전환마다 전체 refetch/채널 재구독 반복 제거
  const [visited, setVisited] = useState<Set<View>>(() => new Set(["home"]));
  // 새 기기 로그인 시 서버(커플) 시작일 확인 전 온보딩을 띄우지 않기 위한 게이트
  const [serverStartChecked, setServerStartChecked] = useState(false);
  // 홈 '3초 남기기' CTA → 로그 탭 이동과 동시에 촬영 오픈 (탭만 열리고 한 번 더 눌러야 하던 마찰 제거)
  const [logCaptureReq, setLogCaptureReq] = useState(0);

  // 로그인 게이트: Supabase 설정 시 이메일 계정 필수 (익명/미로그인 → 로그인 화면)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthed(true);
      setAuthReady(true);
      return;
    }
    // getUser 1회로 인증 상태 + uid 동시 확보 (부팅 왕복 -1)
    getAuthInfo()
      .then((info) => {
        setAuthed(!!(info && !info.isAnonymous && info.email));
        setMyUserId(info?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);

  // 최초 로드 (localStorage → 클라이언트 전용)
  useEffect(() => {
    // iOS 프라이빗/디스크 풀에서 getItem 이 throw 하면 부팅이 백지로 멎을 수 있어 방어(쓰기는 safeSet 로 이미 가드).
    try {
      setStart(localStorage.getItem(LS.start));
      setMe(localStorage.getItem(LS.me) ?? "");
      setCoverPath(localStorage.getItem(LS.cover));
      setEvents(loadEvents());
    } catch {
      setEvents([]);
    }
    if (typeof Notification !== "undefined") setNotif(Notification.permission);
    // SW 는 프로덕션만 — dev 에서 등록하면 cache-first 가 옛 dev 청크를 서빙해
    // 코드 수정이 반영 안 되는 지옥이 열린다 (2026-07-02 디버깅 방해 실증)
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(asset("/sw.js")).catch(() => {});
    }
    setMounted(true);
  }, []);

  // 탭 방문 기록(keep-mounted) + 탭 전환 시 스크롤 상단 (window 스크롤은 탭 간 공유라 유지가 오히려 어색)
  useEffect(() => {
    setVisited((prev) => (prev.has(view) ? prev : new Set(prev).add(view)));
    window.scrollTo(0, 0);
  }, [view]);

  // 서버에 커플 시작일이 있으면 온보딩 생략 — 새 기기 로그인 직후 '며칠째일까?' 재입력 강제 제거
  useEffect(() => {
    if (!mounted || !authReady) return;
    if (!isSupabaseConfigured || !authed || start) {
      setServerStartChecked(true);
      return;
    }
    let cancelled = false;
    getMyCouple()
      .then((c) => {
        if (cancelled) return;
        const iso = c?.couple?.start_date;
        if (iso) {
          setStart(iso);
          safeSet(LS.start, iso);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setServerStartChecked(true);
      });
    return () => {
      cancelled = true;
    };
    // start 채워지면 재실행돼 checked 만 true 로 — 루프 없음
  }, [mounted, authReady, authed, start]);

  // 오프라인 PWA 대비: 아직 안 연 탭/설정 청크를 유휴 시간에 미리 받아 SW 캐시에 적재
  // (코드 스플리팅으로 첫 로드에서 뺀 청크가, 오프라인에서 첫 진입 시 로드 실패하는 구멍 봉합)
  useEffect(() => {
    if (!mounted) return;
    const warm = () => {
      import("@/components/TodayLog");
      import("@/components/Calendar");
      import("@/components/DecoBook");
      import("@/components/PhotoAlbum");
      import("@/components/BucketList");
      import("@/components/PushSettings");
      import("@/components/NotifySettings");
      import("@/components/Diagnostics");
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 8000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 3500);
    return () => window.clearTimeout(id);
  }, [mounted]);

  // 자정을 넘기면(백그라운드 앱 재개 포함) D-day/알림이 갱신되도록 '오늘' 키를 구독.
  // 값이 바뀌면 리렌더 → today()/upcoming 재계산.
  const dayKey = useDayTick(); // 날짜(일 단위) 키 'YYYY-MM-DD' — 자정 넘어가면 바뀜
  const t = today();

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
      const anniv = isAnniversary(e);
      return {
        key: e.id,
        label: e.title,
        sub: anniv ? (e.repeatYearly ? "기념일 · 매년" : "기념일") : "일정",
        date: d,
        dday: ddayLabel(d, t),
        days: diffDays(t, d),
        emoji: e.emoji || (anniv ? "🎉" : "📅"),
        removable: e.id,
      };
    });
    // 앞으로 3개월(약 92일) 이내 기념일만 노출
    return [...ms, ...ev]
      .filter((u) => u.days >= 0 && u.days <= 92)
      .sort((a, b) => a.days - b.days)
      .slice(0, 10);
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
    // 모바일(안드로이드 Chrome/iOS PWA)은 page-context `new Notification()` 이 Illegal
    // constructor 로 죽거나 미지원 → SW showNotification 경유가 정답. 폴백으로만 생성자 사용.
    (async () => {
      const title = "오늘은 특별한 날 💖";
      const opts = {
        body: `${dday.emoji} ${dday.label} · 오늘이에요!`,
        icon: asset("/icon-192.png"),
      };
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) await reg.showNotification(title, opts);
        else new Notification(title, opts);
        safeSet(LS.notified, marker);
      } catch {
        /* noop */
      }
    })();
  }, [mounted, notif, upcoming, dayKey]);

  // 기념일 소스: 연동되면 커플 공유(couple_events)로 전환(로컬은 1회 이관) + 실시간 동기화.
  // 미연동이면 로컬(localStorage). → 상대가 추가한 기념일이 서로 보이게 됨.
  useEffect(() => {
    if (!mounted) return;
    if (!coupleId) {
      setEvents(loadEvents());
      return;
    }
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      // 로컬에 남아있던 기념일을 커플로 이관 후 로컬 비움(중복 방지)
      const local: CoupleEvent[] = loadEvents();
      if (local.length) {
        // 이관 성공한 것만 로컬에서 제거 — 실패분은 남겨 다음 로드에 재이관(데이터 유실 방지)
        const remaining: CoupleEvent[] = [];
        for (const e of local) {
          try {
            await addCoupleEvent(coupleId, e);
          } catch {
            remaining.push(e);
          }
        }
        safeSet(LS.events, JSON.stringify(remaining));
      }
      try {
        if (!cancelled) setEvents(await listCoupleEvents(coupleId));
      } catch {
        /* noop */
      }
      unsub = subscribeCoupleEvents(coupleId, async () => {
        try {
          const next = await listCoupleEvents(coupleId);
          if (!cancelled) setEvents(next); // 커플 전환/해제 후 stale 반영 차단
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

  // 일기 마커(캘린더 표시) — 연동 시 로드 + 일기 추가/삭제 실시간 반영.
  useEffect(() => {
    if (!mounted || !coupleId) {
      setDiaryMarks([]);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      listDiaryMarks(coupleId)
        .then((d) => {
          if (!cancelled) setDiaryMarks(d);
        })
        .catch(() => {});
    refresh();
    const unsub = subscribeDeco(coupleId, refresh, "deco-cal"); // 일기장 탭 구독과 채널 분리
    return () => {
      cancelled = true;
      unsub();
    };
  }, [mounted, coupleId]);

  /* 홈 빨랫줄 — 커플이 고른 사진이 있으면 그것을, 없으면 최근 4장 자동.
     사진첩 실시간을 새로 구독하지 않는다(무료 티어에서 채널 하나가 곧 비용).
     선택 변경은 아래 커플 구독(subscribeCouple)이 이미 잡아 준다 — hungPaths 가 deps 다. */
  useEffect(() => {
    if (!mounted || !coupleId) {
      setHomePhotos([]);
      return;
    }
    let cancelled = false;
    const load = hungPaths.length
      ? photosByPaths(coupleId, hungPaths)
      : listRecentPhotos(coupleId, 4);
    load
      .then((p) => {
        if (!cancelled) setHomePhotos(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mounted, coupleId, hungPaths]);

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
    if (!mounted) return;
    if (!coupleId) {
      // 연결 해제 시 이전 커플 대표사진이 홈 배경에 계속 남지 않도록 로컬 값으로 복원
      setCoverPath(localStorage.getItem(LS.cover));
      return;
    }
    let cancelled = false;
    // 대표사진과 빨랫줄 선택은 **같은 행(couples)** 이라 한 구독으로 함께 따라온다 —
    // 상대가 사진을 걸거나 바꾸면 내 홈도 같이 바뀐다(새 채널 0).
    const refresh = () => {
      getCoupleCover(coupleId)
        .then((p) => {
          if (!cancelled) setCoverPath(p);
        })
        .catch(() => {});
      getCoupleHung(coupleId)
        .then((p) => {
          // 같은 내용이면 새 배열을 넣지 않는다 — hungPaths 는 사진 로더의 deps 라
          // 매번 새 참조를 주면 커플 행이 바뀔 때마다 서명 요청이 다시 나간다.
          if (!cancelled) setHungPaths((cur) => (cur.join("|") === p.join("|") ? cur : p));
        })
        .catch(() => {});
    };
    refresh();
    const unsub = subscribeCouple(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [mounted, coupleId]);

  /** 홈 빨랫줄 걸기/내리기. 가득 차면 **가장 오래 걸린 것이 빠진다**(FIFO) —
   *  '4장이 꽉 찼습니다' 로 막으면 사용자가 뭘 빼야 할지 찾으러 가야 한다. */
  function toggleHung(path: string) {
    if (!coupleId) return;
    const cur = hungPaths;
    const next = nextHung(cur, path);
    setHungPaths(next); // 낙관적 — 실패하면 커플 구독이 서버 값으로 되돌린다
    updateCoupleHung(coupleId, next).catch(() => {});
  }

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


  if (!mounted || !authReady) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
        <div className="animate-floaty text-rose-deep">
          <Icon name="heart" size={54} filled />
        </div>
      </main>
    );
  }

  // 로그인 안 하면 앱 사용 불가 (Supabase 설정 시)
  if (!authed) {
    return <AuthGate onAuthed={() => window.location.reload()} />;
  }

  if (!start) {
    // 서버 확인 전 온보딩 노출 → 입력 직후 커플 값으로 덮이며 D-day 가 '틀렸다 맞는' 깜빡임 → 확인까지 로딩
    if (isSupabaseConfigured && authed && !serverStartChecked) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
          <div className="animate-floaty text-rose-deep">
            <Icon name="heart" size={54} filled />
          </div>
        </main>
      );
    }
    return <Onboarding onDone={saveProfile} />;
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

      <main className="mx-auto min-h-dvh max-w-md pt-[env(safe-area-inset-top)]">
        <div hidden={view !== "home"}>
          <div className="px-5 pb-28">
      {/* ── 홈 월드(풀체인지) — 헤더·D-day·내비·펫이 한 폭의 살아있는 세계 ──
          하늘은 실제 시각(새벽/낮/노을/밤)·계절·섬 날씨를 따르고, 세계 속
          오브젝트(우편함/표지판/나룻배/벤치)가 곧 내비게이션이다. */}
      <HomeWorld
        me={me}
        partnerName={partnerName}
        nDays={nDays}
        startLabel={start.replaceAll("-", ".")}
        coverUrl={coverUrl}
        photos={homePhotos.map((p) => ({
          id: p.id,
          url: p.url,
          date: p.created_at.slice(5, 10).replace("-", "."), // "08.03"
        }))}
        nextDday={nextMs ? { label: nextMs.label, dday: nextMs.dday } : null}
        active={view === "home"}
        onGoAlbum={() => setView("album")}
        onOpenSettings={() => setPanel("settings")}
      >
        {coupleId ? (
          <HomePet
            coupleId={coupleId}
            active={view === "home"}
            startDate={start}
            partnerName={partnerName}
            myUserId={myUserId}
            variant="hero"
            onDark
            onOpen={() => {
              setView("game");
              setOpenIslandReq((n) => n + 1);
            }}
          />
        ) : (
          <button
            onClick={() => document.getElementById("poke-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="tap mx-auto mb-1 flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/25"
          >
            <WorldProp kind="nestegg" size={30} /> 커플 연동하고 알 키우기 →
          </button>
        )}
      </HomeWorld>

      {/* 우리 현황 — 스트릭 + 이번 주 활동 통합(연동 시, 활동 있을 때만) */}
      {coupleId && <CoupleActivity coupleId={coupleId} />}

      {/* 오늘의 우리 (연동 시) */}
      {coupleId && (
        <WorldSectionHead
          className="mt-8"
          prop={<WorldProp kind="photocard" size={38} />}
          title="오늘의 우리"
        />
      )}

      {/* 지금의 우리 — 현재 슬롯 3초 브이로그 (연동 시) */}
      {coupleId && (
        <TodayLogCard
          coupleId={coupleId}
          myUserId={myUserId}
          myName={me}
          partnerName={partnerName}
          onOpen={(openCapture) => {
            setView("log");
            if (openCapture) setLogCaptureReq((n) => n + 1);
          }}
        />
      )}

      {/* 오늘 어땠어? — 오늘의 기분 한 줄 평(재미 복귀판: 매일 다른 질문 + 칩 1탭 + 이심전심) */}
      {coupleId && (
        <MoodLine coupleId={coupleId} myUserId={myUserId} myName={me} partnerName={partnerName} />
      )}

      {/* 오늘의 질문 (연동 시) */}
      {coupleId && (
        <DailyQuestion coupleId={coupleId} myUserId={myUserId} partnerName={partnerName} />
      )}
      {/* 다가오는 기념일 */}
      <section className="mt-8">
        <WorldSectionHead
          prop={<WorldProp kind="signpost" size={38} />}
          title="다가오는 기념일"
          action={
            <button
              onClick={() => setPanel("add")}
              className="tap flex items-center gap-1 rounded-full bg-rose/12 px-3 py-1.5 text-xs font-bold text-rose-deep"
            >
              <Icon name="plus" size={15} strokeWidth={2.25} />
              추가
            </button>
          }
        />
        {upcoming.length === 0 && (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-glass2 px-5 py-5 text-center">
            <p className="text-sm font-semibold text-ink">다가오는 기념일이 없어요</p>
            <p className="mt-1 text-xs text-muted">위 ＋추가로 생일·기념일을 넣으면 D-day 로 챙겨드려요</p>
          </div>
        )}
        <ul className="space-y-2">
          {upcoming.map((u) => (
            <li
              key={u.key}
              className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-line"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-base ring-1 ring-line">
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
                    ? "bg-neon text-white shadow-[0_0_0_2px_var(--neon-glow)]"
                    : "bg-rose/12 text-rose-deep"
                }`}
              >
                {u.dday}
              </span>
              {u.removable && (
                <button
                  onClick={async () => {
                    // 실행취소가 없는 파괴적 액션 — 캘린더 쪽 삭제와 동일하게 확인 경유
                    if (
                      await confirmDialog({
                        message: `'${u.label}' 일정을 삭제할까요?`,
                        confirmText: "삭제",
                        danger: true,
                      })
                    )
                      removeEvent(u.removable!);
                  }}
                  className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
                  aria-label="삭제"
                >
                  <Icon name="trash" size={17} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 커플 연동 + 쿡찌르기 — 월드 우편함의 목적지 */}
      <div id="poke-section" className="scroll-mt-4">
      <CoupleSync
        localStart={start}
        myName={me}
        notif={notif}
        onCoupleChange={setCoupleId}
        onAdoptStart={adoptStart}
        onPartnerName={setPartnerName}
        onOpenAccount={() => setPanel("settings")}
      />
      </div>

          </div>
        </div>

        {visited.has("log") && (
          <div hidden={view !== "log"}>
          <section className="mx-auto max-w-md px-5 pb-28 pt-8">
            <p className="eyebrow">지금의 우리</p>
            <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-ink">
              오늘의 로그
            </h1>
            {coupleId ? (
              <TodayLog
                coupleId={coupleId}
                myUserId={myUserId}
                myName={me}
                partnerName={partnerName}
                captureReq={logCaptureReq}
              />
            ) : (
              <div className="rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
                  <Icon name="camera" size={26} />
                </div>
                <p className="mt-3 text-sm font-bold text-ink">
                  커플 연결 후 함께 남겨요
                </p>
                <p className="mt-1 text-xs text-muted">
                  하루 두 번, 3초 브이로그로 서로의 지금을 나눠요.
                </p>
              </div>
            )}
          </section>
          </div>
        )}
        {visited.has("calendar") && (
          <div hidden={view !== "calendar"}>
            {/* 일정과 버킷은 '함께의 계획'이라 한 탭에 — 세그먼트 전환 */}
            <div className="mx-auto max-w-md px-5 pt-8">
              <p className="eyebrow mb-2 px-1">우리의 계획</p>
              <SegmentedControl
                value={planView}
                onChange={setPlanView}
                ariaLabel="캘린더 보기"
                options={[
                  { value: "cal", label: "일정", icon: "calendar" },
                  { value: "bucket", label: "버킷리스트", icon: "target" },
                ]}
              />
            </div>
            {planView === "cal" ? (
              <Calendar
                start={start}
                events={events}
                diary={diaryMarks}
                myUserId={myUserId}
                myName={me}
                partnerName={partnerName}
                onAddOnDate={(iso) => {
                  setAddDate(iso);
                  setPanel("add");
                }}
                onDelete={removeEvent}
                onOpenDiary={() => setView("deco")}
              />
            ) : (
              <BucketList coupleId={coupleId} />
            )}
          </div>
        )}
        {visited.has("deco") && (
          /* 일기장은 **읽기 화면**이라 픽셀 서체를 끈다(.reading).
             사용자 피드백: "일기쪽은 픽셀 빼줬으면 좋겠어 폰트가 너무 깨져서".
             픽셀 폰트는 한글 자모 3개를 12칸에 넣어야 해서 문단이 길어지면 뭉개진다.
             톤(모서리·색·아이콘)은 그대로 두고 **서체와 글자 크기만** 읽기용으로 되돌린다. */
          <div hidden={view !== "deco"} className="reading">
          <DecoBook
            coupleId={coupleId}
            myUserId={myUserId}
            myName={me}
            partnerName={partnerName}
          />
          </div>
        )}
        {visited.has("album") && (
          <div hidden={view !== "album"}>
          <PhotoAlbum
            coupleId={coupleId}
            coverPath={coverPath}
            onSetCover={onSetCover}
            hungPaths={hungPaths}
            onToggleHung={toggleHung}
          />
          </div>
        )}
        {visited.has("game") && (
          <div hidden={view !== "game"}>
            <GameArcade
              coupleId={coupleId}
              myUserId={myUserId}
              myName={me}
              partnerName={partnerName}
              startDate={start}
              openIslandReq={openIslandReq}
            />
          </div>
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
      {/* .ui-sans — 탭 라벨만 읽기 서체로(아이콘은 픽셀 유지). 6칸이라 칸당 폭이 가장 좁아
          픽셀 격자에서 한글이 제일 먼저 뭉치는 자리다. [사용자 피드백 2026-08-04] */}
      <nav className="ui-sans glass fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-line bg-[var(--surface-nav)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex px-1.5 py-1.5">
          {(
            [
              { k: "home", icon: "house", label: "홈" },
              { k: "log", icon: "camera", label: "로그" },
              { k: "calendar", icon: "calendar", label: "캘린더" },
              { k: "deco", icon: "book", label: "일기장" },
              { k: "album", icon: "image", label: "사진첩" },
              { k: "game", icon: "gamepad", label: "게임" },
            ] as const satisfies readonly { k: View; icon: IconName; label: string }[]
          ).map((tab) => {
            const active = view === tab.k;
            return (
              <button
                key={tab.k}
                onClick={() => setView(tab.k)}
                aria-current={active ? "page" : undefined}
                className={`tap relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 ${
                  active ? "text-rose-deep" : "text-muted"
                }`}
              >
                {/* 활성 인디케이터 바 (색 외 형태로도 이중 인코딩) — 네온 글로우로 프레임과 통일 */}
                <span
                  className={`absolute top-0 h-1 rounded-full bg-neon shadow-[0_0_0_2px_var(--neon-glow)] transition-all duration-200 ${
                    active ? "w-6 opacity-100" : "w-0 opacity-0"
                  }`}
                />
                <Icon
                  name={tab.icon}
                  size={23}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                <span className={`whitespace-nowrap text-sm ${active ? "font-bold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <ConfirmHost />
    </>
  );
}

/* ---------- 홈 한눈에 스탯 타일 ---------- */

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
      <div className="animate-floaty flex justify-center text-rose-deep">
        <Icon name="heart" size={64} filled />
      </div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">
        우리, 며칠째일까?
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        사귄 날과 내 애칭을 넣어주세요. 상대 애칭은 커플 연결 시 자동으로 가져와요.
      </p>

      <div className="glass mt-8 space-y-4 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-lg)] ring-1 ring-line">
        <Field label="사귀기 시작한 날">
          <input
            type="date"
            value={date}
            max={toISODate(today())}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-ink outline-none focus:border-rose"
          />
        </Field>
        <Field label="내 애칭">
          <input
            value={me}
            onChange={(e) => setMe(e.target.value)}
            placeholder="나"
            className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-ink outline-none focus:border-rose"
          />
        </Field>
      </div>

      <button
        disabled={!date}
        onClick={() => onDone(date, me.trim())}
        className="tap mt-6 w-full rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
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
  const [category, setCategory] = useState<"anniversary" | "plan">("anniversary");

  // 종류 선택 시 반복 기본값도 자연스럽게 (기념일=매년, 일정=한 번). 이후 수동 토글 가능.
  const pickCategory = (c: "anniversary" | "plan") => {
    setCategory(c);
    setRepeat(c === "anniversary");
  };

  return (
    <Sheet title={category === "anniversary" ? "기념일 추가" : "일정 추가"} onClose={onClose}>
      <Field label="종류">
        <SegmentedControl
          value={category}
          onChange={pickCategory}
          ariaLabel="일정 종류"
          options={[
            { value: "anniversary", label: "기념일", icon: "sparkles" },
            { value: "plan", label: "일정", icon: "calendar" },
          ]}
        />
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <span
            className={`h-2 w-2 rounded-full ${
              category === "anniversary" ? "bg-anniv" : "bg-rose-deep"
            }`}
          />
          {category === "anniversary"
            ? "노란색으로 표시 · 생일·주년처럼 매년"
            : "작성자 색으로 표시 · 내/상대 구분"}
        </p>
      </Field>
      <Field label="이름">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={category === "anniversary" ? "예) 유진이 생일" : "예) 영화 데이트"}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="날짜">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="아이콘">
        <div className="flex flex-wrap gap-2">
          {EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-10 w-10 place-items-center rounded-xl text-lg ring-1 ${
                emoji === e ? "bg-rose/15 ring-rose" : "bg-glass ring-line"
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
        매년 반복 (생일·주년처럼 해마다)
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
            category,
          })
        }
        className="tap mt-2 w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
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
  const globalPet = useGlobalPet(); // 메인 캐릭터 — 설정에서도 함께

  return (
    <Sheet title="설정" onClose={onClose}>
      {globalPet && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-glass px-3 py-2 ring-1 ring-line">
          {(() => {
            return (
              <span className="animate-floaty grid h-9 w-9 shrink-0 place-items-center">
                <PetIcon form={globalPet.form} size={36} face active={false} title={globalPet.name} />
              </span>
            );
          })()}
          <p className="text-sm font-bold text-muted">
            {globalPet.name}{globalPet.mood} · 오늘도 둘을 응원해요!
          </p>
        </div>
      )}
      <Field label="사귀기 시작한 날">
        <input
          type="date"
          value={date}
          max={toISODate(today())}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="내 애칭">
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="나"
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <p className="text-xs text-muted">상대 애칭은 커플 연결 시 상대가 넣은 이름으로 자동 표시돼요.</p>

      <ThemePicker />

      <AccountSection />

      <PushSettings />

      <NotifySettings />

      <Diagnostics />

      <button
        onClick={() => onSave(date, a.trim())}
        className="tap mt-1 w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)]"
      >
        저장
      </button>
      <button
        onClick={async () => {
          if (
            await confirmDialog({
              message: "모든 정보를 지우고 처음부터 다시 시작할까요?",
              confirmText: "초기화",
              danger: true,
            })
          )
            onReset();
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
  // dialog 시맨틱 + Esc 닫기 + 초기 포커스 — 다른 모달(Letters/PhotoAlbum/ConfirmHost)과 일관
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 열기 직전 포커스를 기억했다가 닫힐 때 복원 — 키보드 사용자 포커스 유실 방지
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    sheetRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="glass animate-sheet max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[var(--radius-card)] bg-surface p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] ring-1 ring-line outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="tap grid h-8 w-8 place-items-center rounded-full bg-glass text-base text-muted ring-1 ring-line"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
