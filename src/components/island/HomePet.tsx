"use client";

/* 홈 화면의 '말 거는 컴패니언' — 우리 섬(couple_island)과 실시간 동기화되면서,
   커플의 실제 상황(D-day·기념일·펫 상태·계절·상대 활동)을 알아채고 말풍선으로 말을 건다.
   · 펫을 탭하면 다음 대사로 넘어가고(대화), 밑줄 행을 탭하면 우리 섬으로 진입(게임)
   · 표시 전용(쓰기 없음)이라 버전 충돌 없음. 대사 로직은 순수 petTalk() (테스트됨)
   · 안 보이는 탭(active=false)에선 시계/배회/순환을 멈춰 헛돌지 않게 한다 */

import { useEffect, useState } from "react";
import { getIsland, subscribeIsland, type IslandRow } from "@/lib/couple";
import { islandSummary, petForm, cropStage } from "@/lib/island";
import { vibeOf } from "@/lib/petmotion";
import { petTalk } from "@/lib/homepetTalk";
import { daysTogether, parseDate, today, diffDays, upcomingMilestones } from "@/lib/dday";
import { petArt } from "@/components/island/art/pets";
import PetYard from "@/components/island/PetYard";

export default function HomePet({
  coupleId,
  onOpen,
  active = true,
  startDate,
  partnerName,
  myUserId,
}: {
  coupleId: string;
  onOpen: () => void;
  active?: boolean; // 홈 탭이 보일 때만 true — 안 보일 때 배회/순환 정지
  startDate?: string | null; // 사귄 날(D-day 대사용)
  partnerName?: string;
  myUserId?: string | null; // 함께놀기 대기가 '상대'가 건 것인지 판별용
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [idx, setIdx] = useState(0); // 현재 대사 인덱스(순환)
  const [bump, setBump] = useState(0); // 수동 넘김 시 자동순환 타이머 리셋

  // 섬 로드 + 실시간 구독(양쪽 동기화). 표시 전용이라 재조회만.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getIsland(coupleId)
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
    const unsub = subscribeIsland(coupleId, load);
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

  if (!loaded) {
    return <div className="h-[172px] w-full animate-pulse rounded-2xl bg-card ring-1 ring-line" />;
  }

  // 아직 섬이 없음 — 알 CTA(탭하면 섬에서 시작)
  if (!s) {
    return (
      <button
        onClick={onOpen}
        className="tap glass flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-sm)] ring-1 ring-line"
      >
        <span className="text-3xl">🥚</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">우리 펫 키우기</p>
          <p className="mt-0.5 text-[11px] text-muted">우리 섬에서 알을 함께 돌보면 여기서 말도 걸어줘요</p>
        </div>
        <span className="shrink-0 rounded-full bg-glass px-3 py-1.5 text-[11px] font-bold text-muted ring-1 ring-line">시작 →</span>
      </button>
    );
  }

  const sum = islandSummary(s, now);
  const pf = petForm(s.pet.form);
  // ⚠ 아트는 JSX 로만 렌더(레지스트리 조회) — PetYard 로 컴포넌트 참조를 넘긴다.
  const PetArt = petArt(s.pet.form);
  const current = nLines ? lines[((idx % nLines) + nLines) % nLines] : null;
  const advance = () => {
    setIdx((i) => i + 1);
    setBump((b) => b + 1); // 자동순환 타이머 리셋(방금 넘겼으니 처음부터)
  };

  return (
    <div>
      <div className="relative">
        <PetYard
          Art={PetArt}
          name={s.pet.name}
          stats={sum.pet.stats}
          sick={s.pet.sick}
          pendingEvolve={s.pet.pendingEvolve}
          onDisplayTap={advance}
          active={active}
        />
        {/* 컨텍스트 말풍선 — 씬 상단 하늘에 뜬다. 바뀔 때마다 살짝 팝. */}
        {current && (
          <div key={idx} className="animate-pop pointer-events-none absolute left-1/2 top-2.5 z-10 max-w-[86%] -translate-x-1/2">
            <div className="relative rounded-2xl bg-white/95 px-3 py-1.5 text-center text-[11px] font-bold leading-snug text-ink shadow-[var(--shadow-sm)]">
              {current}
              <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white/95" />
            </div>
          </div>
        )}
      </div>
      {/* 이름 · 종류 · 기분 + 진화/아픔 뱃지 + 우리 섬 진입 */}
      <button onClick={onOpen} className="tap mt-1.5 flex w-full items-center gap-1.5 px-1 text-left">
        <span className="text-sm font-extrabold">{s.pet.name}</span>
        <span className="truncate text-[11px] text-muted">
          · {pf.name} {sum.pet.mood}
        </span>
        {s.pet.pendingEvolve && (
          <span className="shrink-0 rounded-full bg-glass px-2 py-0.5 text-[10px] font-bold text-rose-deep ring-1 ring-line">진화 가능 ✨</span>
        )}
        {s.pet.sick && (
          <span className="shrink-0 rounded-full bg-glass px-2 py-0.5 text-[10px] font-bold text-rose-deep ring-1 ring-line">아파요 🤒</span>
        )}
        <span className="ml-auto shrink-0 rounded-full bg-glass px-2.5 py-0.5 text-[10px] font-bold text-rose-deep ring-1 ring-line">🏝️ 우리 섬 →</span>
      </button>
    </div>
  );
}
