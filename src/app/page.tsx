"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CoupleEvent,
  daysTogether,
  ddayLabel,
  diffDays,
  eventContentMatches,
  eventRecurrence,
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
import { isPushSubscribed, resyncPushSubscription } from "@/lib/push";
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
import Icon from "@/components/Icon";
import SegmentedControl from "@/components/SegmentedControl";
import ConfirmHost from "@/components/ConfirmHost";
import { confirmDialog } from "@/lib/confirm";
import {
  type DiaryMark,
  type Member,
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
  updateCoupleEvent,
  signedPhotoUrl,
  subscribeCouple,
  subscribeCoupleEvents,
  subscribeMembers,
  subscribeDeco,
  updateCoupleCover,
  updateCoupleStartDate,
  updateMyMemberProfile,
} from "@/lib/couple";
import { asset, BASE, safeParse } from "@/lib/base";
import { useDayTick } from "@/lib/useDayTick";
import { useGlobalPet } from "@/lib/petglobal";
import { nextHung } from "@/lib/hung";
import PetIcon from "@/components/island/PetIcon";
import WorldProp from "@/components/island/WorldProp";
import WorldSectionHead from "@/components/WorldSectionHead";
import HomeWorld from "@/components/HomeWorld";
import BottomNav from "@/components/BottomNav";
import SaveStatus, { type SaveFeedback } from "@/components/SaveStatus";
import { clearOurDaysDeviceData } from "@/lib/accountData";
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from "@/lib/draft";
import { showNotice } from "@/lib/notice";
import ActivityInbox from "@/components/ActivityInbox";
import MemoriesRecap from "@/components/MemoriesRecap";
import { inviteCodeFromHref } from "@/lib/invite";
// UX/UI 개편: bg-white/* 는 globals 토큰(bg-glass/glass2)로 치환됨 → 다크 자동 대응.

const LS = {
  start: "ourdays:start",
  me: "ourdays:me",
  events: "ourdays:events",
  notified: "ourdays:notified", // '오늘 이 D-DAY 알림 이미 띄웠다' 마커
  cover: "ourdays:cover", // 대표 사진(홈 상단·배경) storage 경로
} as const;

type View = "home" | "records" | "plan" | "together" | "game";

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
  event?: CoupleEvent;
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
  const [coupleMembers, setCoupleMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [panel, setPanel] = useState<null | "add" | "settings">(null);
  const [notif, setNotif] = useState<NotificationPermission>("default");
  const [coupleId, setCoupleId] = useState<string | null>(null); // 연동된 커플 (있으면 시작일 공유)
  const [view, setView] = useState<View>("home"); // 하단 탭: 홈/캘린더/사진첩
  const [openIslandReq, setOpenIslandReq] = useState(0); // 홈 펫 탭 → 게임 탭의 섬 오버레이 열기 신호
  const [addDate, setAddDate] = useState<string | null>(null); // 캘린더에서 고른 추가 날짜
  const [editingEvent, setEditingEvent] = useState<CoupleEvent | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null); // 대표 사진 storage 경로
  const [coverUrl, setCoverUrl] = useState<string | null>(null); // 대표 사진 서명 URL
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false); // 이메일 계정 로그인 여부
  const [myUserId, setMyUserId] = useState<string | null>(null); // 내 user id (일정 작성자 색 구분)
  const [diaryMarks, setDiaryMarks] = useState<DiaryMark[]>([]); // 캘린더에 표시할 일기 마커
  const [homePhotos, setHomePhotos] = useState<{ id: string; url: string; created_at: string }[]>([]); // 홈 빨랫줄
  const [hungPaths, setHungPaths] = useState<string[]>([]); // 커플이 고른 빨랫줄 사진(빈 배열 = 자동)
  const [hungSave, setHungSave] = useState<SaveFeedback>({ phase: "idle" });
  const hungSaveLock = useRef(false); // 빠른 연타가 같은 서버 버전에 겹쳐 쓰지 않도록 직렬화
  const hungSaveOp = useRef(0); // 커플 변경/늦은 응답이 새 화면 상태를 덮지 않게 하는 세대 번호
  const hungSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [planView, setPlanView] = useState<"cal" | "bucket">("cal"); // 캘린더 탭: 일정 | 버킷
  const [recordView, setRecordView] = useState<"log" | "diary" | "photos">("log");
  const [visitedRecords, setVisitedRecords] = useState<Set<"log" | "diary" | "photos">>(
    () => new Set(["log"]),
  );
  // 한 번 연 탭은 언마운트하지 않고 숨김(keep-mounted) — 탭 전환마다 전체 refetch/채널 재구독 반복 제거
  const [visited, setVisited] = useState<Set<View>>(() => new Set(["home"]));
  // 새 기기 로그인 시 서버(커플) 시작일 확인 전 온보딩을 띄우지 않기 위한 게이트
  const [serverStartChecked, setServerStartChecked] = useState(false);
  // 홈 '3초 남기기' CTA → 로그 탭 이동과 동시에 촬영 오픈 (탭만 열리고 한 번 더 눌러야 하던 마찰 제거)
  const [logCaptureReq, setLogCaptureReq] = useState(0);

  useEffect(() => {
    hungSaveOp.current += 1;
    hungSaveLock.current = false;
    if (hungSaveTimer.current) clearTimeout(hungSaveTimer.current);
    setHungSave({ phase: "idle" });
    return () => {
      if (hungSaveTimer.current) clearTimeout(hungSaveTimer.current);
    };
  }, [coupleId]);

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
      // 푸시 구독 재동기화 — endpoint 교체(410 삭제·토큰 회전)로 '켜짐 표시인데
      // 아무 푸시도 안 오는' 무증상 단절을 부팅마다 조용히 복구한다
      void resyncPushSubscription();
    }
    setMounted(true);
  }, []);

  // QR/공유 링크로 들어오면 로그인·온보딩 뒤 곧바로 합류 화면까지 이어 준다.
  useEffect(() => {
    if (inviteCodeFromHref(window.location.href)) setView("together");
  }, []);

  // SW 가 pushsubscriptionchange 에서 재구독하면 저장(re-sync)을 앱에 맡긴다(sw.js 참고)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onMsg = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "pushResync") void resyncPushSubscription();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  // 알림 권한은 앱 밖(브라우저/OS 설정)에서도 바뀐다 — 마운트 1회 샘플만 믿으면
  // 설정에서 허용하고 돌아와도 배너가 남는다. 앱으로 돌아올 때마다 다시 읽는다.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const sync = () => setNotif(Notification.permission);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // 탭 방문 기록(keep-mounted) + 탭 전환 시 스크롤 상단 (window 스크롤은 탭 간 공유라 유지가 오히려 어색)
  useEffect(() => {
    setVisited((prev) => (prev.has(view) ? prev : new Set(prev).add(view)));
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (view !== "records") return;
    setVisitedRecords((previous) =>
      previous.has(recordView) ? previous : new Set(previous).add(recordView),
    );
  }, [view, recordView]);

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

  // 상위 탭으로 커플 연동 UI를 옮겨도 홈 첫 진입에서 공유 데이터가 즉시 잡혀야 한다.
  useEffect(() => {
    if (!mounted || !authReady || !authed || !isSupabaseConfigured) return;
    let cancelled = false;
    let unsubscribe = () => {};
    let subscribedCouple: string | null = null;
    const refresh = async () => {
      const state = await getMyCouple();
      if (cancelled) return;
      if (!state) {
        unsubscribe();
        subscribedCouple = null;
        setCoupleId(null);
        setCoupleMembers([]);
        setPartnerName("");
        return;
      }
      setCoupleId(state.couple.id);
      setCoupleMembers(state.members);
      if (myUserId) {
        const partner = state.members.find((member) => member.user_id !== myUserId);
        setPartnerName(partner?.nickname ?? "");
      }
      if (state.couple.start_date) {
        safeSet(LS.start, state.couple.start_date);
        setStart(state.couple.start_date);
      }
      if (subscribedCouple !== state.couple.id) {
        unsubscribe();
        subscribedCouple = state.couple.id;
        unsubscribe = subscribeMembers(state.couple.id, () => void refresh());
      }
    };
    void refresh().catch(() => {});
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [mounted, authReady, authed, myUserId]);

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
        sub: `${anniv ? "기념일" : "일정"}${
          eventRecurrence(e) === "monthly"
            ? " · 매월"
            : eventRecurrence(e) === "yearly"
              ? " · 매년"
              : ""
        }`,
        date: d,
        dday: ddayLabel(d, t),
        days: diffDays(t, d),
        emoji: e.emoji || (anniv ? "🎉" : "📅"),
        removable: e.id,
        event: e,
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
    // getItem 은 try — iOS 프라이빗/디스크풀에서 throw 하면 effect 가 트리를 백지로 만든다(200행 규약)
    try {
      if (localStorage.getItem(LS.notified) === marker) return;
    } catch {
      return;
    }
    // 모바일(안드로이드 Chrome/iOS PWA)은 page-context `new Notification()` 이 Illegal
    // constructor 로 죽거나 미지원 → SW showNotification 경유가 정답. 폴백으로만 생성자 사용.
    (async () => {
      // 푸시 구독 + 커플 연동 기기는 서버 크론(daily-reminders)이 같은 기념일 푸시를 이미
      // 보낸다 — 로컬까지 쏘면 같은 날 두 번 울린다. ⚠ 커플 없음(솔로)이면 기념일이 로컬
      // 전용이라 서버가 모른다 — 그때 생략하면 알림이 0 이 된다 [리뷰 2026-08-26].
      if (coupleId && (await isPushSubscribed().catch(() => false))) {
        safeSet(LS.notified, marker); // 마커는 남겨 구독 해제 당일 재발화도 막는다
        return;
      }
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
  }, [mounted, notif, upcoming, dayKey, coupleId]);

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
    if (!safeSet(LS.events, JSON.stringify(next)))
      throw new Error("이 기기의 저장 공간이 부족해 일정을 저장하지 못했어요.");
    setEvents(next);
  }

  // 내 프로필 저장 (사귄 날 + 내 애칭). 상대 애칭은 저장 안 함 — 연결되면 상대가 넣은 값 사용.
  async function saveProfile(iso: string, a: string) {
    // 공유 시작일을 먼저 확정한다. 실패했는데 설정 창을 닫아 로컬만 성공처럼 보이지 않게 한다.
    if (coupleId) {
      await updateCoupleStartDate(coupleId, iso);
      const member = await updateMyMemberProfile(coupleId, { nickname: a });
      if ((member.nickname ?? "") !== a.trim())
        throw new Error("서버에서 애칭 저장을 확인하지 못했어요.");
    }
    const startStored = safeSet(LS.start, iso);
    const nameStored = safeSet(LS.me, a);
    setStart(iso);
    setMe(a);
    if (!startStored || !nameStored) {
      throw new Error("서버에는 반영했지만 이 기기의 저장 공간을 확인하지 못했어요.");
    }
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
    const previous = coverPath;
    setCoverPath(p);
    if (coupleId) {
      /* 실패를 삼키면 가짜 성공이 된다(같은 행의 빨랫줄 persistHung 은 저장중·정본
         재확인·복원을 다 갖췄는데 이 형제 컬럼만 빠져 있었다) [리뷰 2026-08-26]. */
      showHungSave({ phase: "saving", message: "대표사진 저장 중…" });
      updateCoupleCover(coupleId, p)
        .then(() => showHungSave({ phase: "saved", message: "두 사람의 홈에 저장됐어요" }, 2600))
        .catch(async () => {
          const server = await getCoupleCover(coupleId).catch(() => previous);
          setCoverPath(server ?? null);
          showHungSave({ phase: "error", message: "대표사진을 저장하지 못했어요. 다시 시도해 주세요." });
        });
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
      // (getItem 은 try — iOS 프라이빗/디스크풀 throw 가 화면을 백지로 만든다, 200행 규약)
      try {
        setCoverPath(localStorage.getItem(LS.cover));
      } catch {
        setCoverPath(null);
      }
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
      // 내 낙관적 저장 중에는 다른 컬럼의 realtime UPDATE가 이전 hung_paths를 되씌우지 않게 한다.
      if (!hungSaveLock.current) {
        getCoupleHung(coupleId)
          .then((p) => {
            // 같은 내용이면 새 배열을 넣지 않는다 — hungPaths 는 사진 로더의 deps 라
            // 매번 새 참조를 주면 커플 행이 바뀔 때마다 서명 요청이 다시 나간다.
            if (!cancelled) setHungPaths((cur) => (cur.join("|") === p.join("|") ? cur : p));
          })
          .catch(() => {});
      }
    };
    refresh();
    const unsub = subscribeCouple(coupleId, refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [mounted, coupleId]);

  /** 저장 결과를 잠깐 보여 주고 다음 동작 전에 이전 타이머를 정리한다. */
  function showHungSave(feedback: SaveFeedback, clearAfter = 0) {
    if (hungSaveTimer.current) clearTimeout(hungSaveTimer.current);
    setHungSave(feedback);
    if (clearAfter > 0) {
      hungSaveTimer.current = setTimeout(
        () => setHungSave({ phase: "idle" }),
        clearAfter,
      );
    }
  }

  async function persistHung(next: string[]) {
    if (!coupleId || hungSaveLock.current) return;
    const targetCouple = coupleId;
    const previous = hungPaths;
    const op = ++hungSaveOp.current;
    hungSaveLock.current = true;
    setHungPaths(next);
    showHungSave({ phase: "saving", message: "홈 화면에 저장 중…" });
    try {
      await updateCoupleHung(targetCouple, next);
      if (op === hungSaveOp.current) {
        showHungSave({ phase: "saved", message: "두 사람의 홈에 저장됐어요" }, 2600);
      }
    } catch {
      try {
        // 응답만 유실됐을 수도 있으므로 먼저 서버 정본을 확인한다.
        const server = await getCoupleHung(targetCouple);
        if (op !== hungSaveOp.current) return;
        setHungPaths(server);
        if (server.join("|") === next.join("|")) {
          showHungSave({ phase: "saved", message: "서버에서 저장을 확인했어요" }, 2600);
        } else {
          showHungSave(
            { phase: "restored", message: "저장되지 않아 기존 선택으로 복원했어요" },
            4200,
          );
        }
      } catch {
        if (op !== hungSaveOp.current) return;
        setHungPaths(previous);
        showHungSave(
          { phase: "error", message: "저장을 확인하지 못해 이전 선택으로 돌렸어요" },
          5200,
        );
      }
    } finally {
      if (op === hungSaveOp.current) hungSaveLock.current = false;
    }
  }

  /** 홈 빨랫줄 걸기/내리기. 가득 차면 가장 오래 걸린 것이 빠진다(FIFO). */
  function toggleHung(path: string) {
    void persistHung(nextHung(hungPaths, path));
  }

  // 일정 추가/편집 — 서버 응답 뒤 정본을 다시 읽어 저장 여부까지 확인한다.
  async function saveEvent(ev: CoupleEvent) {
    const exists = events.some((item) => item.id === ev.id);
    if (coupleId) {
      const saved = exists
        ? await updateCoupleEvent(ev)
        : await addCoupleEvent(coupleId, ev);
      if (!saved) throw new Error("일정 저장 결과를 확인하지 못했어요.");
      const authoritative = await listCoupleEvents(coupleId);
      const readBack = authoritative.find((item) => item.id === saved.id);
      if (!readBack || !eventContentMatches(readBack, ev)) {
        throw new Error("서버에서 일정 저장을 확인하지 못했어요. 다시 시도해 주세요.");
      }
      setEvents(authoritative);
    } else {
      saveEvents(exists ? events.map((item) => (item.id === ev.id ? ev : item)) : [...events, ev]);
    }
    showNotice(exists ? "일정 변경을 저장했어요." : "새 일정을 저장했어요.", "success");
  }

  // 기념일 삭제 — 연동 상태면 커플 공유에서, 아니면 로컬.
  async function removeEvent(id: string) {
    try {
      if (coupleId) {
        await deleteCoupleEvent(id);
        const authoritative = await listCoupleEvents(coupleId);
        if (authoritative.some((item) => item.id === id))
          throw new Error("일정 삭제를 확인하지 못했어요. 다시 시도해 주세요.");
        setEvents(authoritative);
      } else {
        saveEvents(events.filter((e) => e.id !== id));
      }
      showNotice("일정을 삭제했어요.", "success");
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : "일정을 삭제하지 못했어요.", "error");
    }
  }

  function openAddEvent(date?: string) {
    setEditingEvent(null);
    setAddDate(date ?? null);
    setPanel("add");
  }

  function openEditEvent(event: CoupleEvent) {
    setEditingEvent(event);
    setAddDate(null);
    setPanel("add");
  }

  function goRecords(next: "log" | "diary" | "photos") {
    setRecordView(next);
    setView("records");
  }

  function goPlan(next: "cal" | "bucket" = "cal") {
    setPlanView(next);
    setView("plan");
  }

  function openActivityKind(kind: import("@/lib/couple").ActivityEvent["kind"]) {
    if (kind === "photo") goRecords("photos");
    else if (kind === "diary") goRecords("diary");
    else if (kind === "log") goRecords("log");
    else if (kind === "event") goPlan("cal");
    else if (kind === "bucket") goPlan("bucket");
    // 쿡은 쿡 채팅으로, 기분·오늘의 질문 답은 그 카드가 있는 홈으로 — 라우팅이 없으면
    // 활동함의 이 행들은 눌림 효과만 있고 아무 일도 안 하는 죽은 버튼이었다 [리뷰 2026-08-26]
    else if (kind === "poke") setView("together");
    else if (kind === "mood" || kind === "answer") setView("home");
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

      {/* ⚠ overflow-x-clip — 앱 컬럼 안에서 뭐가 넘쳐도 **문서 폭을 늘리지 못하게** 가둔다.
          문서가 화면보다 넓어지면 일부 모바일 엔진(삼성 인터넷)은 fixed 요소를 문서 폭 기준으로
          눕혀서 GNB 6칸이 화면 밖까지 펼쳐지고 '게임' 탭이 잘린다(제보 스크린샷 2026-08-05).
          clip 은 스크롤 컨테이너를 안 만들어 일기장 sticky 헤더를 깨지 않는다(hidden 금지). */}
      <main className="mx-auto min-h-dvh max-w-md overflow-x-clip pt-[env(safe-area-inset-top)]">
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
        onGoAlbum={() => goRecords("photos")}
        onOpenSettings={() => setPanel("settings")}
      >
        {/* 미연동도 펫이 산다 [사용자 리포트 2026-08-12 "혼자서라도 할 수 있는게"] —
            HomePet 이 로컬 섬을 읽고, 섬이 없으면 알 CTA 를 스스로 띄운다.
            (예전 '커플 연동하고 알 키우기' CTA 는 연동 없인 아무것도 못 하던 시절의 문구다) */}
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
      </HomeWorld>

      {/* 우리 현황 — 스트릭 + 이번 주 활동 통합(연동 시, 활동 있을 때만) */}
      {coupleId && <CoupleActivity coupleId={coupleId} />}

      {/* 오늘의 우리 — 로그 카드 복원 [사용자 요청 2026-08-18 "일기 하고 로그 다시 살리자"].
          날씨 카드(HomeWeatherCard)는 잠시 숨김 — 홈 하늘이 실시간 날씨를 이미 말해준다.
          복구: <HomeWeatherCard onOpen={() => setView("weather")} /> + BottomNav 날씨 탭 주석. */}
      {coupleId && (
        <WorldSectionHead className="mt-8" prop={<WorldProp kind="photocard" size={38} />} title="오늘의 우리" />
      )}
      {coupleId && (
        <TodayLogCard
          coupleId={coupleId}
          myUserId={myUserId}
          myName={me}
          partnerName={partnerName}
          onOpen={(openCapture) => {
            goRecords("log");
            if (openCapture) setLogCaptureReq((n) => n + 1);
          }}
        />
      )}

      {/* 핵심 목적지 요약 — 상세 피드를 홈에 전부 쌓지 않고 각 상위 탭으로 보낸다. */}
      <section className="mt-5 grid grid-cols-3 gap-2.5 reading" aria-label="빠른 이동">
        {[
          { label: "기록 남기기", icon: "book" as const, onClick: () => goRecords("diary") },
          { label: "일정 보기", icon: "calendar" as const, onClick: () => goPlan("cal") },
          { label: "우리 소식", icon: "heart" as const, onClick: () => setView("together") },
        ].map((item) => (
          <button key={item.label} onClick={item.onClick} className="tap cosmic-feed-action flex min-w-0 flex-col items-center justify-center gap-1.5 px-1 py-3 text-xs font-extrabold text-ink">
            <Icon name={item.icon} size={20} className="text-rose-deep" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </section>
      {/* 다가오는 기념일 */}
      <section className="mt-8">
        <WorldSectionHead
          prop={<WorldProp kind="signpost" size={38} />}
          title="다가오는 기념일"
          action={
            <button
              onClick={() => openAddEvent()}
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
          {upcoming.slice(0, 3).map((u) => (
            <li
              key={u.key}
              className="cosmic-feed-card flex items-center gap-3 px-4 py-3"
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
                className={`cosmic-rank-chip shrink-0 px-2.5 py-1 text-xs font-extrabold tabular-nums ${
                  u.days === 0
                    ? "bg-neon text-white shadow-[0_0_0_2px_var(--neon-glow)]"
                    : "bg-rose/12 text-rose-deep"
                }`}
              >
                {u.dday}
              </span>
              {u.removable && (
                <div className="flex shrink-0">
                  <button
                    onClick={() => u.event && openEditEvent(u.event)}
                    className="tap grid h-9 w-9 place-items-center rounded-full text-muted"
                    aria-label={`${u.label} 편집`}
                  >
                    <Icon name="pencil" size={17} />
                  </button>
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
                        void removeEvent(u.removable!);
                    }}
                    className="tap grid h-9 w-9 place-items-center rounded-full text-muted"
                    aria-label={`${u.label} 삭제`}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {upcoming.length > 3 && (
          <button onClick={() => goPlan("cal")} className="tap mt-3 w-full rounded-xl bg-glass py-2.5 text-xs font-bold text-rose-deep ring-1 ring-line">
            나머지 일정 {upcoming.length - 3}개 보기
          </button>
        )}
      </section>

          </div>
        </div>

        {visited.has("records") && (
          <div hidden={view !== "records"}>
            <div className="mx-auto max-w-md px-5 pt-8">
              <p className="eyebrow mb-2 px-1">우리의 기록</p>
              <SegmentedControl
                value={recordView}
                onChange={setRecordView}
                ariaLabel="기록 종류"
                options={[
                  { value: "log", label: "오늘 로그", icon: "camera" },
                  { value: "diary", label: "일기", icon: "book" },
                  { value: "photos", label: "사진", icon: "image" },
                ]}
              />
            </div>
            {visitedRecords.has("log") && (
              <div hidden={recordView !== "log"}>
                <section className="mx-auto max-w-md px-5 pb-28 pt-5">
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
                      <p className="mt-3 text-sm font-bold text-ink">커플 연결 후 함께 남겨요</p>
                      <p className="mt-1 text-xs text-muted">하루 두 번, 3초 브이로그로 서로의 지금을 나눠요.</p>
                    </div>
                  )}
                </section>
              </div>
            )}
            {visitedRecords.has("diary") && (
              <div hidden={recordView !== "diary"} className="reading">
                <DecoBook coupleId={coupleId} myUserId={myUserId} myName={me} partnerName={partnerName} />
              </div>
            )}
            {visitedRecords.has("photos") && (
              <div hidden={recordView !== "photos"}>
                <PhotoAlbum
                  coupleId={coupleId}
                  coverPath={coverPath}
                  onSetCover={onSetCover}
                  hungPaths={hungPaths}
                  onToggleHung={toggleHung}
                  onResetHung={() => void persistHung([])}
                  hungBusy={hungSave.phase === "saving"}
                  hungFeedback={hungSave}
                />
              </div>
            )}
          </div>
        )}

        {visited.has("plan") && (
          <div hidden={view !== "plan"}>
            <div className="mx-auto max-w-md px-5 pt-8">
              <p className="eyebrow mb-2 px-1">우리의 계획</p>
              <SegmentedControl
                value={planView}
                onChange={setPlanView}
                ariaLabel="계획 종류"
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
                onAddOnDate={openAddEvent}
                onDelete={removeEvent}
                onEdit={openEditEvent}
                onOpenDiary={() => goRecords("diary")}
              />
            ) : (
              <BucketList coupleId={coupleId} />
            )}
          </div>
        )}

        {visited.has("together") && (
          <div hidden={view !== "together"}>
            <section className="mx-auto max-w-md px-5 pb-28 pt-8">
              <p className="eyebrow">둘만의 공간</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">함께</h1>
              <CoupleSync
                localStart={start}
                myName={me}
                notif={notif}
                onCoupleChange={(nextCoupleId) => {
                  setCoupleId(nextCoupleId);
                  if (!nextCoupleId) setCoupleMembers([]);
                }}
                onMembersChange={setCoupleMembers}
                onAdoptStart={adoptStart}
                onPartnerName={setPartnerName}
                onOpenAccount={() => setPanel("settings")}
              />
              {coupleId && (
                <div className="mt-4 space-y-3">
                  <ActivityInbox
                    coupleId={coupleId}
                    members={coupleMembers}
                    myUserId={myUserId}
                    onOpenKind={openActivityKind}
                  />
                  <MoodLine coupleId={coupleId} myUserId={myUserId} myName={me} partnerName={partnerName} />
                  <DailyQuestion coupleId={coupleId} myUserId={myUserId} partnerName={partnerName} />
                  <MemoriesRecap
                    coupleId={coupleId}
                    members={coupleMembers}
                    myUserId={myUserId}
                    onOpenRecords={() => goRecords("diary")}
                  />
                </div>
              )}
            </section>
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
          existing={editingEvent}
          onClose={() => {
            setPanel(null);
            setAddDate(null);
            setEditingEvent(null);
          }}
          onSave={saveEvent}
        />
      )}
      {panel === "settings" && (
        <Settings
          start={start}
          me={me}
          onClose={() => setPanel(null)}
          onSave={saveProfile}
          onReset={() => {
            clearOurDaysDeviceData();
            window.location.reload();
          }}
        />
      )}
      </main>

      {/* 하단 탭 네비 — 레이아웃 계약과 회귀 주석은 BottomNav.tsx 안에 있다 */}
      <BottomNav view={view} onSelect={setView} />

      <ConfirmHost />
    </>
  );
}

/* ---------- 홈 한눈에 스탯 타일 ---------- */

/* ---------- 온보딩 ---------- */
function Onboarding({
  onDone,
}: {
  onDone: (iso: string, me: string) => Promise<void>;
}) {
  const [date, setDate] = useState(toISODate(today()));
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!date || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDone(date, me.trim() || "나");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "시작 정보를 저장하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <main className="reading mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
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
            disabled={busy}
            maxLength={40}
            onChange={(e) => setMe(e.target.value)}
            placeholder="나"
            className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-ink outline-none focus:border-rose"
          />
        </Field>
      </div>

      {error && <p role="alert" className="mt-3 text-sm leading-relaxed text-rose-deep">{error}</p>}

      <button
        disabled={!date || busy}
        aria-busy={busy}
        onClick={() => void submit()}
        className="tap mt-6 w-full rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
      >
        {busy ? "저장 중…" : "시작하기"}
      </button>
    </main>
  );
}

/* ---------- 기념일 추가 ---------- */
function AddEvent({
  onClose,
  onSave,
  initialDate,
  existing,
}: {
  onClose: () => void;
  onSave: (ev: CoupleEvent) => Promise<void>;
  initialDate?: string;
  existing: CoupleEvent | null;
}) {
  type EventDraft = {
    title: string;
    date: string;
    recurrence: "none" | "monthly" | "yearly";
    emoji: string;
    category: "anniversary" | "plan";
    note: string;
    reminderOffsets: number[];
  };
  const key = draftStorageKey("event", existing?.id ?? "new");
  const fallback: EventDraft = existing
    ? {
        title: existing.title,
        date: existing.date,
        recurrence: eventRecurrence(existing),
        emoji: existing.emoji ?? EMOJI[0],
        category: existing.category ?? "plan",
        note: existing.note ?? "",
        reminderOffsets: existing.reminderOffsets ?? [0, 1, 3, 7],
      }
    : {
        title: "",
        date: initialDate || toISODate(today()),
        recurrence: "yearly",
        emoji: EMOJI[0],
        category: "anniversary",
        note: "",
        reminderOffsets: [0, 1, 3, 7],
      };
  const restored = typeof localStorage === "undefined" ? null : loadDraft<EventDraft>(localStorage, key);
  /* 캘린더에서 날짜를 탭해 들어온 경우(initialDate)는 **방금의 명시적 선택**이라 초안의
     date 보다 우선한다 — 통째로 덮으면 '날짜 탭해 추가' 흐름이 옛 초안에 가로채였다 [리뷰 2026-08-26]. */
  const initial = restored
    ? !existing && initialDate
      ? { ...restored, date: initialDate }
      : restored
    : fallback;
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date);
  const [recurrence, setRecurrence] = useState<EventDraft["recurrence"]>(initial.recurrence);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [category, setCategory] = useState<EventDraft["category"]>(initial.category);
  const [note, setNote] = useState(initial.note);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>(initial.reminderOffsets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(!!restored);
  const [showRestored, setShowRestored] = useState(!!restored);

  // 초안 버리기 — 복원이 원치 않는 것일 때 빈 폼으로 시작할 유일한 길(없으면 필드를 일일이 지워야 했다)
  const discardDraft = () => {
    clearDraft(localStorage, key);
    setTitle(fallback.title);
    setDate(fallback.date);
    setRecurrence(fallback.recurrence);
    setEmoji(fallback.emoji);
    setCategory(fallback.category);
    setNote(fallback.note);
    setReminderOffsets(fallback.reminderOffsets);
    setDraftSaved(false);
    setShowRestored(false);
  };

  // 종류 선택 시 반복 기본값도 자연스럽게 (기념일=매년, 일정=한 번). 이후 수동 토글 가능.
  const pickCategory = (c: "anniversary" | "plan") => {
    setCategory(c);
    setRecurrence(c === "anniversary" ? "yearly" : "none");
  };

  const isPristineDraft =
    title === fallback.title &&
    date === fallback.date &&
    recurrence === fallback.recurrence &&
    emoji === fallback.emoji &&
    category === fallback.category &&
    note === fallback.note &&
    [...reminderOffsets].sort((a, b) => a - b).join(",") ===
      [...fallback.reminderOffsets].sort((a, b) => a - b).join(",");

  useEffect(() => {
    const current: EventDraft = {
      title,
      date,
      recurrence,
      emoji,
      category,
      note,
      reminderOffsets,
    };
    if (isPristineDraft) {
      clearDraft(localStorage, key);
      setDraftSaved(false);
      return;
    }
    setDraftSaved(false);
    const timer = setTimeout(() => {
      const saved = saveDraft<EventDraft>(localStorage, key, current);
      setDraftSaved(saved);
    }, 350);
    return () => clearTimeout(timer);
  }, [key, title, date, recurrence, emoji, category, note, reminderOffsets, isPristineDraft]);

  async function submit() {
    if (!title.trim() || !date || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        id: existing?.id ?? uid(),
        title: title.trim(),
        date,
        recurrence,
        repeatYearly: recurrence === "yearly",
        emoji,
        category,
        note: note.trim() || undefined,
        reminderOffsets: [...reminderOffsets].sort((a, b) => a - b),
        createdBy: existing?.createdBy,
      });
      clearDraft(localStorage, key);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "일정을 저장하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={`${category === "anniversary" ? "기념일" : "일정"} ${existing ? "편집" : "추가"}`}
      onClose={busy ? () => {} : onClose}
    >
      {showRestored && (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-glass2 px-3 py-2 text-xs leading-relaxed text-muted ring-1 ring-line">
          <span>이전에 작성하던 초안을 복원했어요.</span>
          <button onClick={discardDraft} className="tap shrink-0 font-bold text-rose-deep">
            초안 버리기
          </button>
        </p>
      )}
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
          maxLength={120}
          disabled={busy}
          placeholder={category === "anniversary" ? "예) 유진이 생일" : "예) 영화 데이트"}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="날짜">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={busy}
          className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
        />
      </Field>
      <Field label="아이콘">
        <div className="flex flex-wrap gap-2">
          {EMOJI.map((e) => (
            <button
              key={e}
              disabled={busy}
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
      <Field label="반복">
        <SegmentedControl
          value={recurrence}
          onChange={setRecurrence}
          ariaLabel="일정 반복"
          options={[
            { value: "none", label: "반복 없음" },
            { value: "monthly", label: "매월" },
            { value: "yearly", label: "매년" },
          ]}
        />
      </Field>
      <Field label="메모 (선택)">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          disabled={busy}
          placeholder="장소, 준비할 것, 예약 정보 등을 적어두세요"
          className="w-full resize-y rounded-xl border border-line bg-glass px-3 py-2.5 leading-relaxed outline-none focus:border-rose"
        />
        <p className="mt-1 text-right text-xs text-muted">{note.length}/2000</p>
      </Field>
      <Field label="미리 알림">
        <div className="flex flex-wrap gap-2">
          {[30, 14, 7, 3, 1, 0].map((offset) => {
            const selected = reminderOffsets.includes(offset);
            return (
              <button
                key={offset}
                type="button"
                disabled={busy}
                aria-pressed={selected}
                onClick={() =>
                  setReminderOffsets((current) =>
                    selected ? current.filter((value) => value !== offset) : [...current, offset],
                  )
                }
                className={`tap rounded-full px-3 py-2 text-xs font-bold ring-1 ${
                  selected ? "bg-brand text-white ring-rose-deep" : "bg-glass text-muted ring-line"
                }`}
              >
                {offset === 0 ? "당일" : `D-${offset}`}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          알림 권한과 기기 푸시가 켜져 있을 때 선택한 날에 알려드려요.
        </p>
      </Field>

      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="text-xs text-muted">{draftSaved ? "이 기기에 초안 저장됨" : "초안 저장 중…"}</span>
        <span className="text-xs text-muted">이름 {title.length}/120</span>
      </div>
      {error && <p role="alert" className="text-sm leading-relaxed text-rose-deep">{error}</p>}

      <button
        disabled={!title.trim() || !date || busy}
        onClick={() => void submit()}
        aria-busy={busy}
        className="tap mt-2 w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-40"
      >
        {busy ? "저장 중…" : existing ? "변경 저장" : "추가하기"}
      </button>
    </Sheet>
  );
}

/* ---------- 설정 ---------- */
type SettingsSection = "profile" | "screen" | "notifications" | "data" | "help";

const SETTINGS_SECTIONS: Array<{
  key: SettingsSection;
  label: string;
  icon: "heart" | "settings" | "bell" | "lock" | "question";
}> = [
  { key: "profile", label: "프로필", icon: "heart" },
  { key: "screen", label: "화면", icon: "settings" },
  { key: "notifications", label: "알림", icon: "bell" },
  { key: "data", label: "데이터", icon: "lock" },
  { key: "help", label: "도움말", icon: "question" },
];

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
  onSave: (iso: string, me: string) => Promise<void>;
  onReset: () => void;
}) {
  const [date, setDate] = useState(start);
  const [a, setA] = useState(me);
  const [section, setSection] = useState<SettingsSection>("profile");
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({ phase: "idle" });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalPet = useGlobalPet(); // 메인 캐릭터 — 설정에서도 함께

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  async function submit() {
    if (saving) return;
    setSaving(true);
    setSaveFeedback({ phase: "saving", message: "공유 설정 저장 중…" });
    try {
      await onSave(date, a.trim());
      setSaveFeedback({ phase: "saved", message: "설정 저장 완료" });
      setSaving(false);
      closeTimer.current = setTimeout(() => setSaveFeedback({ phase: "idle" }), 2600);
    } catch (error) {
      setSaveFeedback({
        phase: "error",
        message: error instanceof Error ? error.message : "설정을 저장하지 못했어요",
      });
      setSaving(false);
    }
  }

  return (
    <Sheet title="설정" onClose={saving ? () => {} : onClose}>
      <div className="reading space-y-4">
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          style={{ touchAction: "pan-x" }}
          role="tablist"
          aria-label="설정 영역"
        >
          {SETTINGS_SECTIONS.map((item) => {
            const selected = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSection(item.key)}
                className={`tap flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ring-1 ${
                  selected
                    ? "bg-brand text-white ring-rose-deep"
                    : "bg-glass text-muted ring-line"
                }`}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </button>
            );
          })}
        </div>

        {section === "profile" && (
          <div className="space-y-3" role="tabpanel">
            {globalPet && (
              <div className="flex items-center gap-2 rounded-2xl bg-glass px-3 py-2 ring-1 ring-line">
                <span className="animate-floaty grid h-9 w-9 shrink-0 place-items-center">
                  <PetIcon form={globalPet.form} size={36} face active={false} title={globalPet.name} />
                </span>
                <p className="text-sm font-bold text-muted">
                  {globalPet.name}{globalPet.mood} · 오늘도 둘을 응원해요!
                </p>
              </div>
            )}
            <Field label="사귀기 시작한 날">
              <input
                type="date"
                value={date}
                disabled={saving}
                max={toISODate(today())}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
              />
            </Field>
            <Field label="내 애칭">
              <input
                value={a}
                disabled={saving}
                maxLength={40}
                onChange={(e) => setA(e.target.value)}
                placeholder="나"
                className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 outline-none focus:border-rose"
              />
            </Field>
            <p className="text-xs leading-relaxed text-muted">
              상대 애칭은 커플 연결 시 상대가 저장한 이름으로 표시돼요.
            </p>
            {saveFeedback.phase !== "idle" && (
              <div className="flex justify-center" aria-live="polite">
                <SaveStatus feedback={saveFeedback} />
              </div>
            )}
            <button
              onClick={() => void submit()}
              disabled={saving || !date || !a.trim()}
              className="tap w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-[var(--shadow-md)] disabled:cursor-wait disabled:opacity-55"
            >
              {saveFeedback.phase === "saved" ? "저장 완료" : saving ? "저장 중…" : "프로필 저장"}
            </button>
          </div>
        )}

        {section === "screen" && (
          <div className="space-y-3" role="tabpanel">
            <ThemePicker />
            <div className="rounded-2xl bg-glass p-4 ring-1 ring-line">
              <div className="flex items-start gap-3">
                <Icon name="search" size={20} className="mt-0.5 shrink-0 text-rose-deep" />
                <div>
                  <p className="font-bold text-ink">읽기 편한 화면</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    입력창·일기·캘린더·설정은 선명한 시스템 글꼴을 사용해요. 두 손가락 확대와 브라우저 글자 확대도 제한하지 않아요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-3" role="tabpanel">
            <PushSettings />
            <NotifySettings />
          </div>
        )}

        {section === "data" && (
          <div className="space-y-3" role="tabpanel">
            <AccountSection />
            <div className="rounded-2xl bg-glass p-4 ring-1 ring-line">
              <p className="font-bold text-ink">이 기기 데이터</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                캐시·작성 중인 초안·화면 설정만 지웁니다. 계정과 서버의 공유 기록은 그대로 유지돼요.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (
                    await confirmDialog({
                      message: "이 기기의 캐시·초안·화면 설정을 지울까요? 계정과 서버의 공유 기록은 삭제되지 않아요.",
                      confirmText: "기기 데이터 지우기",
                      danger: true,
                    })
                  ) {
                    onReset();
                  }
                }}
                disabled={saving}
                className="mt-3 w-full rounded-xl border border-line bg-card py-2.5 text-sm font-bold text-muted disabled:opacity-40"
              >
                이 기기 데이터 초기화
              </button>
            </div>
          </div>
        )}

        {section === "help" && (
          <div className="space-y-3" role="tabpanel">
            <div className="rounded-2xl bg-glass p-4 ring-1 ring-line">
              <p className="font-bold text-ink">데이터를 투명하게 관리해요</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                어떤 정보를 저장하는지, 내보내기와 탈퇴 시 무엇이 지워지는지 한곳에서 확인할 수 있어요.
              </p>
              <a
                href={`${BASE}/privacy/`}
                className="tap mt-3 flex min-h-11 items-center justify-between rounded-xl bg-card px-3 py-2.5 font-bold text-rose-deep ring-1 ring-line"
              >
                개인정보·데이터 관리 안내
                <Icon name="chevronRight" size={18} />
              </a>
            </div>
            <Diagnostics />
          </div>
        )}
      </div>
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
