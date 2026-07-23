"use client";

/* 홈 화면의 살아있는 펫 — 우리 섬(couple_island)과 실시간 동기화되는 읽기전용 위젯.
   · 섬에서 밥/놀기/진화하거나 상대가 무언가 하면 subscribeIsland 로 즉시 반영(양쪽 동기화)
   · 표시 전용(쓰기 없음)이라 버전 충돌이 없다 — 터치하면 우리 섬으로 이동(onOpen)
   · 펫 배회/기분/반응은 PetYard(표시 모드) 가 담당, 여기선 상태 로드 + 이름/상태 라인만 */

import { useEffect, useState } from "react";
import { getIsland, subscribeIsland, type IslandRow } from "@/lib/couple";
import { islandSummary, petForm } from "@/lib/island";
import { petArt } from "@/components/island/art/pets";
import PetYard from "@/components/island/PetYard";

export default function HomePet({
  coupleId,
  onOpen,
  active = true,
}: {
  coupleId: string;
  onOpen: () => void;
  active?: boolean; // 홈 탭이 보일 때만 true — 안 보일 때 펫 배회 루프를 멈춘다
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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

  // 기분/감쇠 표시 갱신용 느린 시계(홈은 정밀할 필요 없음)
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(iv);
  }, []);

  if (!loaded) {
    return <div className="h-[172px] w-full animate-pulse rounded-2xl bg-card ring-1 ring-line" />;
  }

  const s = row?.state ?? null;

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
          <p className="mt-0.5 text-[11px] text-muted">우리 섬에서 알을 함께 돌보면 여기서도 만나요</p>
        </div>
        <span className="shrink-0 rounded-full bg-glass px-3 py-1.5 text-[11px] font-bold text-muted ring-1 ring-line">시작 →</span>
      </button>
    );
  }

  const sum = islandSummary(s, now);
  const pf = petForm(s.pet.form);
  // ⚠ 아트는 JSX 로만 렌더(레지스트리 조회) — PetYard 로 컴포넌트 참조를 넘긴다.
  const PetArt = petArt(s.pet.form);

  return (
    <div>
      <PetYard
        Art={PetArt}
        name={s.pet.name}
        stats={sum.pet.stats}
        sick={s.pet.sick}
        pendingEvolve={s.pet.pendingEvolve}
        onOpen={onOpen}
        active={active}
      />
      {/* 이름 · 종류 · 기분 + 진화/아픔 뱃지 + 섬 평점 */}
      <button onClick={onOpen} className="tap mt-1.5 flex w-full items-center gap-1.5 px-1 text-left">
        <span className="text-sm font-extrabold">{s.pet.name}</span>
        <span className="truncate text-[11px] text-muted">
          · {pf.name} {sum.pet.mood}
        </span>
        {s.pet.pendingEvolve && (
          <span className="shrink-0 rounded-full bg-glass px-2 py-0.5 text-[10px] font-bold text-rose-deep ring-1 ring-line">
            진화 가능 ✨
          </span>
        )}
        {s.pet.sick && (
          <span className="shrink-0 rounded-full bg-glass px-2 py-0.5 text-[10px] font-bold text-rose-deep ring-1 ring-line">
            아파요 🤒
          </span>
        )}
        <span className="ml-auto shrink-0 rounded-full bg-glass px-2 py-0.5 text-[10px] font-bold text-muted ring-1 ring-line">
          {sum.ratingTier.emoji} {sum.rating.toLocaleString()}
        </span>
      </button>
    </div>
  );
}
