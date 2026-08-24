"use client";

/* 홈 화면의 '말 거는 컴패니언' — 우리 섬(couple_island)과 실시간 동기화되면서,
   커플의 실제 상황(D-day·기념일·펫 상태·계절·상대 활동)을 알아채고 말풍선으로 말을 건다.
   · 펫을 탭하면 다음 대사로 넘어간다(대화). 이름 행은 표시 전용 — 섬은 게임 탭으로 간다
   · 표시 전용(쓰기 없음)이라 버전 충돌 없음. 대사 로직은 순수 petTalk() (테스트됨)
   · 안 보이는 탭(active=false)에선 시계/배회/순환을 멈춰 헛돌지 않게 한다 */

import { useEffect, useRef, useState } from "react";
import { useMountedRef } from "@/lib/useMountedRef";
import { loadIsland, watchIsland, type IslandRow } from "@/lib/couple";
import { islandSummary, petForm, cropStage, isAsleep, weatherOf } from "@/lib/island";
import { vibeOf } from "@/lib/petmotion";
import { petTalk } from "@/lib/homepetTalk";
import { publishPet } from "@/lib/petglobal";
import { daysTogether, parseDate, today, diffDays, upcomingMilestones } from "@/lib/dday";
import { petArt } from "@/components/island/art/pets";
import PetYard from "@/components/island/PetYard";
import PetBubble from "@/components/island/PetBubble";

export default function HomePet({
  coupleId,
  onOpen,
  active = true,
  startDate,
  partnerName,
  myUserId,
  variant = "card",
  onDark = false,
}: {
  coupleId: string | null; // null = 솔로(로컬 섬)
  onOpen: () => void;
  active?: boolean; // 홈 탭이 보일 때만 true — 안 보일 때 배회/순환 정지
  startDate?: string | null; // 사귄 날(D-day 대사용)
  partnerName?: string;
  myUserId?: string | null; // 함께놀기 대기가 '상대'가 건 것인지 판별용
  variant?: "card" | "hero"; // hero = 히어로 카드에 녹아드는 투명 무대(V2 홈)
  onDark?: boolean; // hero 가 어두운 배경(커버 사진) 위인지 — 텍스트 대비 전환
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [idx, setIdx] = useState(0); // 현재 대사 인덱스(순환)
  const [bump, setBump] = useState(0); // 수동 넘김 시 자동순환 타이머 리셋
  const [quiet, setQuiet] = useState(false); // 큰 탭 반응 중엔 말풍선을 잠깐 비운다
  const quietSeq = useRef(0);
  // 언마운트 가드(공용 훅) — quiet 해제 타이머가 죽은 컴포넌트에 setState 하지 않게.
  const mountedRef = useMountedRef();

  // 섬 로드 + 실시간 구독(양쪽 동기화). 표시 전용이라 재조회만.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadIsland(coupleId)
        .then((r) => {
          if (!cancelled) {
            setRow(r);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) setLoaded(true);
        });
    load();
    const unsub = watchIsland(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  // 기분/컨텍스트 갱신용 느린 시계 — 홈이 보일 때만. 보이게 되는 순간 즉시 최신화.
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(iv);
  }, [active]);

  const s = row?.state ?? null;

  // 대사 목록(순수) — 컨텍스트를 모아 계산. s 없으면 빈 배열.
  const lines: string[] = (() => {
    if (!s) return [];
    const sum = islandSummary(s, now);
    const vibe = vibeOf(sum.pet.stats, s.pet.sick);
    const cropsReady = s.farm.plots.filter((pl) => pl.crop && cropStage(s, pl, now).ripe).length;
    // myUserId 를 알 때만 '상대가 건 coop'을 판별(null 이면 내 coop 을 상대 것으로 오인 방지)
    const coopWaiting = !!myUserId && s.pending.some((pp) => pp.type === "coop" && pp.by !== myUserId);

    let nDays: number | null = null;
    let milestoneDay: number | null = null;
    let milestoneInDays: number | null = null;
    let annivLabel: string | null = null;
    let annivInDays: number | null = null;
    if (startDate) {
      const start = parseDate(startDate);
      const ref = today();
      const d = daysTogether(start, ref);
      // 미래로 설정된 시작일(오늘=1) 방어 — d<1 이면 '0일째' 같은 엉뚱한 대사 방지
      if (d >= 1) {
        nDays = d;
        // 다음 100일 단위(오늘 포함), 임박(≤14일)일 때만
        const D = d % 100 === 0 ? d : (Math.floor(d / 100) + 1) * 100;
        const mIn = D - d;
        if (mIn <= 14) {
          milestoneDay = D;
          milestoneInDays = mIn;
        }
        // 다음 주년(가장 가까운), 임박(≤10일)일 때만
        const nextAnniv = upcomingMilestones(start, 1, ref)[0];
        if (nextAnniv) {
          const aIn = diffDays(ref, nextAnniv.date);
          if (aIn >= 0 && aIn <= 10) {
            annivLabel = nextAnniv.label;
            annivInDays = aIn;
          }
        }
      }
    }

    return petTalk({
      petName: s.pet.name,
      partnerName: partnerName ?? "",
      vibe,
      pendingEvolve: s.pet.pendingEvolve,
      coopWaiting,
      cropsReady,
      nDays,
      milestoneDay,
      milestoneInDays,
      annivLabel,
      annivInDays,
      season: sum.season,
      hour: new Date(now + 9 * 3600 * 1000).getUTCHours(), // KST 시각(계절도 KST 기준이라 일치)
      seed: nDays ?? 0,
    });
  })();

  // 대사 자동 순환 — 홈이 보이고 대사가 2개 이상일 때만. 수동 넘김(bump) 시 타이머 리셋.
  const nLines = lines.length;
  useEffect(() => {
    if (!active || nLines <= 1) return;
    const iv = setInterval(() => setIdx((i) => i + 1), 5500);
    return () => clearInterval(iv);
  }, [active, nLines, bump]);

  // 펫 전역 발행 — 앱 곳곳(쿡찌르기·게임 카드·설정)이 같은 캐릭터를 쓴다. 네트워크 0.
  useEffect(() => {
    const st = row?.state ?? null;
    if (!st) {
      publishPet(null);
      return;
    }
    const ts = Date.now();
    publishPet({
      form: st.pet.form,
      name: st.pet.name,
      mood: islandSummary(st, ts).pet.mood,
      asleep: isAsleep(st, ts),
      weather: weatherOf(st, ts),
    });
  }, [row]);

  const hero = variant === "hero";

  if (!loaded) {
    return hero ? (
      // 실제 컬럼 높이와 맞춘다(밴드 78 + 무대 128 + 이름행 32 + mb 2). 어긋나면 로드되는
      // 순간 블록이 위로 확 자라며 월드 소품 위로 튀어오른다.
      <div className="h-[240px] w-full" />
    ) : (
      <div className="h-[172px] w-full animate-pulse rounded-2xl bg-card ring-1 ring-line" />
    );
  }

  // 아직 섬이 없음 — 알 CTA(탭하면 섬에서 시작)
  if (!s) {
    return hero ? (
      <button
        onClick={onOpen}
        className={`tap mx-auto mb-1 mt-2 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
          onDark ? "bg-white/20 text-white ring-1 ring-white/25" : "bg-glass text-muted ring-1 ring-line"
        }`}
      >
        🥚 우리 펫 키우러 가기 →
      </button>
    ) : (
      <button
        onClick={onOpen}
        className="tap glass flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-sm)] ring-1 ring-line"
      >
        <span className="text-3xl">🥚</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">우리 펫 키우기</p>
          <p className="mt-0.5 text-sm text-muted">우리 섬에서 알을 함께 돌보면 여기서 말도 걸어줘요</p>
        </div>
        <span className="shrink-0 rounded-full bg-glass px-3 py-1.5 text-sm font-bold text-muted ring-1 ring-line">시작 →</span>
      </button>
    );
  }

  const sum = islandSummary(s, now);
  const pf = petForm(s.pet.form);
  // ⚠ 아트는 JSX 로만 렌더(레지스트리 조회) — PetYard 로 컴포넌트 참조를 넘긴다.
  const PetArt = petArt(s.pet.form);
  const current = nLines ? lines[((idx % nLines) + nLines) % nLines] : null;
  /** 탭 반응. **1단계를 넘는 모든 반응**에서 말풍선을 잠깐 비운다.
   *  실측(실렌더 390×844): 정지 시 여유 26px 인데 bounce(2단계)가 -5px, joy/blast 가 -42px 로
   *  뚫고 올라온다. 3단계부터만 숨기면 대사를 넘기려 탭할 때 바로 그 구간(3~4탭)에서 겹친다.
   *  연타 중엔 대사를 읽지도 않으므로 연출에 자리를 내주는 편이 낫다. */
  const advance = (tier = 1) => {
    setIdx((i) => i + 1);
    setBump((b) => b + 1); // 자동순환 타이머 리셋(방금 넘겼으니 처음부터)
    if (tier >= 2) {
      const id = ++quietSeq.current;
      setQuiet(true);
      setTimeout(() => {
        if (mountedRef.current && quietSeq.current === id) setQuiet(false);
      }, 1100);
    }
  };

  return (
    <div>
      {/* 말풍선 = **캐릭터 위의 독립 밴드**. [사용자 피드백 2026-08-04 "계속 겹쳐"]
          예전엔 말풍선을 무대 안에 absolute top-1 로 얹었는데, 무대 128px 안에서
          펫(96px)이 bottom-20% 에 서므로 펫 머리는 항상 y=6.4px 였다. 말풍선은 4~33px →
          **27px 가 구조적으로 항상 겹쳤다**(가끔이 아니라 언제나).
          이제 두 밴드를 세로로 분리해 좌표가 겹칠 수 없게 만든다. 밴드는 대사가 없어도
          자리를 지킨다 — 안 그러면 말풍선이 뜰 때마다 펫이 아래로 튄다. */}
      <div className={`flex flex-col items-center ${hero ? "" : "relative"}`}>
        {/* ⚠ 밴드는 반드시 (a) pointer-events-none (b) 가운데 좁은 폭이어야 한다.
            첫 시도는 w-full 이라 겹침을 펫에서 **월드 소품(우편함·표지판)** 으로 옮겼고,
            스테이지가 z-20 이라 소품 탭까지 가로챘다 — 배지를 달아 놓고 못 누르게 만든 셈.
            폭 62% = 좌우 소품 사이 대역(x 78.5~281.5px @360폭)에 정확히 갇힌다.
            높이는 2줄 기준으로 **고정** — auto 면 1줄↔2줄 순환마다 밴드가 20.6px 씩 출렁인다. */}
        <div className="pointer-events-none flex h-[78px] w-full items-end justify-center pb-1">
          {current && !quiet && <PetBubble key={idx} text={current} />}
        </div>
        <PetYard
          Art={PetArt}
          form={s.pet.form}
          name={s.pet.name}
          stats={sum.pet.stats}
          sick={s.pet.sick}
          pendingEvolve={s.pet.pendingEvolve}
          onDisplayTap={advance}
          active={active}
          asleep={isAsleep(s, now)}
          bare={hero}
          height={hero ? 128 : 172}
        />
      </div>
      {/* 이름 · 종류 · 기분 + 진화/아픔 뱃지 + 우리 섬 진입 (hero 는 어두운 커버 위 대비로 전환)
          ⚠ hero 는 월드 무대(bottom-0, inset-x-0) 안이라 w-full 로 깔면 좌우 모서리의
          나룻배/벤치 오브젝트 메뉴(z-30)와 정확히 같은 높이에서 겹친다(사용자 리포트:
          "메뉴와 텍스트가 겹쳐"). → 중앙 컴팩트 필(w-fit, max-w 58%)로 좌우를 비운다. */}
      {/* 이름·종류·기분 **표시 줄**. 버튼이 아니다 — '우리 섬 →' CTA 는 하단 탭 '게임'과
          목적지가 겹쳐 뗐다(월드 소품 4개를 지운 것과 같은 이유). 섬은 게임 탭으로 간다.
          정보(이름·기분·진화 가능·아파요)는 그대로 남는다. [2026-08-04] */}
      <div
        className={`flex items-center gap-1.5 text-left ${
          hero
            ? `mx-auto mb-0.5 w-fit max-w-[58%] justify-center rounded-full px-3 py-1 ${
                onDark ? "bg-black/25 ring-1 ring-white/15" : "bg-white/55 ring-1 ring-line"
              }`
            : "mt-1.5 w-full px-1"
        }`}
      >
        <span className={`truncate text-sm font-extrabold ${hero && onDark ? "text-white" : hero ? "text-ink" : ""}`}>{s.pet.name}</span>
        <span className={`truncate text-sm ${hero && onDark ? "text-white/70" : "text-muted"}`}>
          · {pf.name} {sum.pet.mood}
        </span>
        {s.pet.pendingEvolve && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${hero && onDark ? "bg-white/20 text-amber-200 ring-1 ring-white/25" : "bg-glass text-rose-deep ring-1 ring-line"}`}>
            진화 가능 ✨
          </span>
        )}
        {s.pet.sick && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${hero && onDark ? "bg-white/20 text-rose-200 ring-1 ring-white/25" : "bg-glass text-rose-deep ring-1 ring-line"}`}>
            아파요 🤒
          </span>
        )}
      </div>
    </div>
  );
}
