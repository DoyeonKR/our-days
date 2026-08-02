"use client";

/* 이 파일은 key→컴포넌트 **아트 레지스트리**(petArt/cropArt/productArt/decorArt)에서 얻은
   아트를 여러 곳에서 렌더한다. 레지스트리는 모듈 스코프 상수를 돌려주므로 같은 key 면 항상
   동일 참조라 재마운트가 없지만, 린트는 '렌더 중 컴포넌트 생성'으로 본다.
   ⚠ 우회하려고 `A(props)` 처럼 **함수로 호출하면 안 된다** — 아트 내부 useId 가 이 컴포넌트의
   훅 순서에 섞여 폼/작물 전환 시 훅 개수가 달라진다(React 오류). 반드시 JSX 로 렌더할 것.
   (펫 아트를 PetYard 로 넘긴 뒤로는 static-components 경고가 안 떠서 disable 을 뗐다 — 다시
    뜨면 이 위치에 `eslint-disable react-hooks/static-components` 를 되살릴 것.) */

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type IslandState,
  type CropKey,
  type ProductKey,
  type CraftSlot,
  type CraftUse,
  CROPS,
  PRODUCTS,
  DECORS,
  DECOR_SETS,
  TUNING,
  ACHIEVEMENTS,
  RARITY_PRICE,
  RARITY_RATING,
  decorDef,
  SEASON_LABEL,
  createIsland,
  islandSummary,
  petForm,
  petStage,
  nextEvolution,
  cropOf,
  cropStage,
  productOf,
  craftReady,
  xpForBondLevel,
  feedPet,
  feedPetWith,
  petPet,
  pettingCoinsNext,
  ambienceHappyBonusPct,
  cleanPet,
  playPet,
  hugPet,
  restPet,
  isAsleep,
  wakePet,
  medicinePet,
  evolve,
  retirePet,
  coopStart,
  coopConfirm,
  decorWishKey,
  decorWishClaimable,
  claimDecorWish,
  plant,
  waterPlot,
  harvest,
  fertilize,
  qualityPreview,
  weatherOf,
  WEATHER_LABEL,
  starOf,
  expandPlots,
  startCraft,
  collectCraft,
  craftPayout,
  buyTool,
  buyFertilizer,
  placeDecor,
  moveDecor,
  removeDecor,
  claimVisit,
  claimQuest,
  giftPartner,
  evolutionPreview,
  evolutionTree,
  harvestAllReady,
  harvestAllPreview,
  nextGoals,
  PET_FORMS,
} from "@/lib/island";
import {
  type IslandRow,
  getIsland,
  createIsland as createIslandRow,
  commitIslandAction,
  subscribeIsland,
} from "@/lib/couple";
import { confirmDialog } from "@/lib/confirm";
import { type PetActionKind, petFx } from "@/lib/petfx";
import Icon from "@/components/Icon";
// 자체 SVG 아트 — 게임 엔티티(펫/작물/가공품/데코)는 이모지가 아니라 여기서 그린다.
import type { ArtFC } from "@/components/island/art/parts";
import { petArt } from "@/components/island/art/pets";
import { cropArt, productArt, type CropStage } from "@/components/island/art/crops";
import { decorArt } from "@/components/island/art/decor";
import IslandScene from "@/components/island/IslandScene";
import PetYard from "@/components/island/PetYard";
import PixelPet, { type PixelFx } from "@/components/island/PixelPet";
import PetIcon from "@/components/island/PetIcon";
import { setPixelArt, usePixelArt } from "@/lib/pixelpref";
import { kstHourFloatOf, skyLook, skyPhaseOf } from "@/lib/scenetime";
import CoopPlay from "@/components/island/CoopPlay";
import EvoCinematic from "@/components/island/EvoCinematic";

type Tab = "pet" | "farm" | "craft" | "decor" | "more";
const won = (v: number) => v.toLocaleString();

/** 스탯 막대. */
function StatBar({ label, emoji, value, color }: { label: string; emoji: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-center text-xs">{emoji}</span>
      <span className="w-8 shrink-0 text-[10px] text-white/60">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-[10px] tabular-nums text-white/70">{Math.round(value)}</span>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/15">
      {children}
    </span>
  );
}

export default function IslandGame({
  coupleId,
  myUserId,
  partnerName,
  startDate,
  onEarnedSpent,
  onClose,
}: {
  coupleId: string;
  myUserId: string | null;
  partnerName: string;
  startDate: string | null; // 사귄 날(D-day)
  onEarnedSpent?: () => void;
  onClose: () => void;
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pet");
  const [now, setNow] = useState(() => Date.now());
  const [petName, setPetName] = useState("");
  const [seedFor, setSeedFor] = useState<number | null>(null); // 씨앗 시트: plotId
  const [plotFor, setPlotFor] = useState<number | null>(null); // 밭 돌보기 시트(품질 미리보기+비료): plotId
  const [craftFor, setCraftFor] = useState<number | null>(null); // 가공 시트: slotId
  const [feedOpen, setFeedOpen] = useState(false); // 밥주기 시트(작물/코인 선택)
  // 함께 놀기 플레이 세션 — start=걸어두기 전 내 마음 담기 / confirm=상대 마음에 답하기
  const [coopSession, setCoopSession] = useState<null | "start" | "confirm">(null);
  // 수확 연출(★ 스탬프·금빛 축포) — 내 수확 탭에서만 로컬로 발사(상대 클라 재생 없음)
  const [harvestFx, setHarvestFx] = useState<{ id: number; plot: number; star: number; coins: number; bumper: boolean } | null>(null);
  const fxSeq = useRef(0);
  // 케어 액션 연출(씻기/밥/재우기/깨우기…) — petfx 스펙대로 PetYard 가 재생
  const [careFx, setCareFx] = useState<{ kind: PetActionKind; ts: number } | null>(null);
  // 픽셀 아트 모드 — 같은 펫을 도트로 렌더(사용자 요청: "2D 픽셀 형태로 화려하게").
  // 기본 ON. 취향이 갈릴 수 있어 토글로 남기고 선택을 로컬에 기억한다.
  const pixelMode = usePixelArt(); // 아트 스타일(기본 픽셀) — 앱 전역 공유
  const [pixelFx, setPixelFx] = useState<{ kind: PixelFx; key: number }>({ kind: null, key: 0 });
  const [shopOpen, setShopOpen] = useState(false); // 데코 상점
  const [placeKey, setPlaceKey] = useState<string | null>(null); // 배치 대기 데코
  const [decorAction, setDecorAction] = useState<{ id: string; key: string } | null>(null); // 장식 탭 → 이동/치우기 칩
  const [moveId, setMoveId] = useState<string | null>(null); // 이동 중인 장식 id(픽업 상태)
  const [justPlacedAt, setJustPlacedAt] = useState<{ x: number; y: number; ts: number } | null>(null); // 배치/이동 연출 좌표
  const [setCele, setSetCele] = useState<string | null>(null); // 세트 완성 축하(set id)
  const prevSetsRef = useRef<string[] | null>(null);
  const [celebrate, setCelebrate] = useState(false); // 진화 축하 표시(대상은 현재 상태에서 파생)

  const visitedRef = useRef(false);
  const mountedRef = useRef(true);

  // 살아있는 시계(게이지/쿨다운 갱신) + 언마운트 가드
  // ⚠ 정리에서 false 로 내렸으면 **재실행 때 반드시 true 로 되돌린다**. 안 그러면
  // effect→cleanup→effect 로 두 번 도는 환경(React Strict Mode)에서 ref 가 false 로 고착되어
  // commit 의 `if (mountedRef.current) setBusy(false)` 가 영영 안 돌고 **모든 버튼이 잠긴다**.
  // (2026-08-02: 공방 3택이 첫 클릭 뒤 disabled 로 굳는 증상으로 실제 확인)
  useEffect(() => {
    mountedRef.current = true;
    const iv = setInterval(() => setNow(Date.now()), 3000);
    return () => {
      clearInterval(iv);
      mountedRef.current = false;
    };
  }, []);

  // 로드 + 구독
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    const load = () =>
      getIsland(coupleId)
        .then((r) => !cancelled && setRow(r))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    const unsub = subscribeIsland(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  const s: IslandState | null = row?.state ?? null;

  // 진화 대기 감지 → 축하(표시만; 실제 대상은 현재 상태에서 파생)
  useEffect(() => {
    if (s?.pet.pendingEvolve && !celebrate) setCelebrate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.pet.pendingEvolve, s?.pet.form]);

  // 상태 저장(버전 낙관적 락). 성공 true. 실패 시 최신 재조회로 동기화.
  async function pushState(version: number, next: IslandState): Promise<boolean> {
    try {
      const updated = await commitIslandAction(version, next);
      if (mountedRef.current) setRow(updated);
      onEarnedSpent?.();
      return true;
    } catch {
      const fresh = await getIsland(coupleId).catch(() => null);
      if (fresh && mountedRef.current) setRow(fresh);
      return false;
    }
  }
  // 사용자 액션 커밋 — busy/에러 표시. 성공 여부 반환(시트/선택 정리에 사용).
  async function commit(next: IslandState): Promise<boolean> {
    if (!row || busy) return false;
    setBusy(true);
    setErr(null);
    const ok = await pushState(row.version, next);
    if (mountedRef.current) {
      if (!ok) setErr("상대가 방금 뭔가 했어요 — 최신으로 맞췄으니 다시 눌러요.");
      setBusy(false);
    }
    return ok;
  }
  // no-op(엔진이 원본 참조 그대로 반환)이면 커밋 안 함 → 헛된 버전 증가/거짓 충돌 방지. [리뷰 fix]
  const act = (fn: (s: IslandState) => IslandState): Promise<boolean> => {
    if (!s) return Promise.resolve(false);
    const next = fn(s);
    if (next === s) return Promise.resolve(false);
    return commit(next);
  };
  // 수확 — 커밋과 동시에 로컬 연출(★ 스탬프 드럼롤·★5 금빛 축포·햅틱)을 낙관적으로 발사.
  // 별 등급은 엔진 로그(⭐ 반복)에서, 코인은 diff 로 읽는다(연출용 근사 — 규칙은 엔진 소유).
  // nowMs 는 이벤트 경계에서 확정해 주입(react-hooks/purity — 렌더 불순 함수 호출 금지).
  function doHarvest(i: number, nowMs: number) {
    if (!s || busy) return;
    const next = harvest(s, i, nowMs);
    if (next === s) return;
    const star = (next.log[0]?.match(/⭐/g) ?? []).length || 1;
    const coins = next.coins - s.coins;
    const bumper = (next.log[0] ?? "").includes("풍년"); // 엔진 로그가 단일 소스
    const id = ++fxSeq.current;
    setHarvestFx({ id, plot: i, star, coins, bumper });
    try {
      navigator.vibrate?.(bumper ? [14, 40, 14, 40, 30] : star >= 5 ? [12, 40, 12, 40, 26] : star >= 4 ? [10, 40, 10] : 12);
    } catch {
      /* noop */
    }
    setTimeout(() => {
      if (mountedRef.current) setHarvestFx((f) => (f?.id === id ? null : f));
    }, 1700);
    commit(next);
  }

  // 케어 연출 발사 — 스펙 길이만큼 재생 후 자동 종료. ts 는 이벤트 경계에서 주입.
  function fireCareFx(kind: PetActionKind, ts: number) {
    setCareFx({ kind, ts });
    // 픽셀 모드용 파티클 — 액션 성격에 맞는 도트가 터진다
    const pk: PixelFx = kind === "hug" || kind === "play" ? "heart" : kind === "clean" || kind === "medicine" ? "star" : kind === "feed" ? "flower" : null;
    if (pk) setPixelFx({ kind: pk, key: ts });
    setTimeout(() => {
      if (mountedRef.current) setCareFx((f) => (f?.ts === ts ? null : f));
    }, petFx(kind).ms + 250);
  }

  // 배치/이동 연출 발사 — 씬이 해당 칸을 팝 바운스 + 스파클 + 펫 환호로 반긴다.
  // ts 는 이벤트 경계에서 확정해 주입(react-hooks/purity).
  function firePlaceFx(x: number, y: number, ts: number) {
    setJustPlacedAt({ x, y, ts });
    setTimeout(() => {
      if (mountedRef.current) setJustPlacedAt((j) => (j?.ts === ts ? null : j));
    }, 1400);
  }

  // 세트 완성 감지 → 축하(콘페티 + 토스트). 상대가 완성해도 같이 축하하게 상태 diff 로 감지.
  useEffect(() => {
    const sets = s?.sets ?? null;
    if (!sets) return;
    const prev = prevSetsRef.current;
    prevSetsRef.current = sets;
    if (prev && sets.length > prev.length) {
      const added = sets.find((id) => !prev.includes(id));
      if (added) {
        setSetCele(added);
        setTimeout(() => {
          if (mountedRef.current) setSetCele((c) => (c === added ? null : c));
        }, 3000);
      }
    }
     
  }, [s?.sets]);

  // 방문(조용) — 실패(버전 충돌) 시 최신 상태에 1회 재적용. claimVisit 은 멱등이라 이중 지급 없음.
  // nowMs 는 호출부(effect)에서 확정해 주입(react-hooks/purity). claimVisit 은 멱등이라 재시도에 같은 값 사용.
  async function doVisit(nowMs: number): Promise<void> {
    if (!myUserId || !row) return;
    const ok = await pushState(row.version, claimVisit(row.state, myUserId, nowMs, startDate));
    if (!ok) {
      const fresh = await getIsland(coupleId).catch(() => null);
      if (fresh) await pushState(fresh.version, claimVisit(fresh.state, myUserId, nowMs, startDate));
    }
  }

  // 방문 처리(1회) — 출석/함께/D-day/퀘스트. 함수 선언 뒤에 위치(React Compiler: 선언 전 참조 금지).
  // Date.now 는 effect 에서 state 로 1회 확정(react-hooks/purity — TetrisBattle 패턴),
  // 실제 doVisit 호출은 그 값을 받은 두 번째 effect 가 수행한다.
  const [visitAt, setVisitAt] = useState(0);
  useEffect(() => {
    if (!row || !myUserId || visitedRef.current) return;
    visitedRef.current = true;
    setVisitAt(Date.now());
  }, [row, myUserId]);
  useEffect(() => {
    if (!visitAt) return;
    doVisit(visitAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitAt]);

  async function startGame() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const init = createIsland(petName.trim() || "우리 펫", startDate, Date.now());
      const created = await createIslandRow(init);
      if (mountedRef.current) setRow(created);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "시작 실패");
    } finally {
      setBusy(false);
    }
  }

  // ── 렌더 셸 ─────────────────────────────────────────────────
  const shell = (inner: ReactNode) => (
    <div
      className="fixed inset-0 z-[75] flex flex-col text-white"
      style={{ background: "linear-gradient(180deg,#1b2b4a 0%,#20304e 40%,#25506e 100%)" }}
      role="dialog"
      aria-modal="true"
      aria-label="우리 섬"
    >
      {inner}
    </div>
  );

  if (loading) return shell(<div className="flex flex-1 items-center justify-center text-sm text-white/60">불러오는 중…</div>);

  if (!row || !s) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="text-6xl">🏝️</span>
        <h2 className="mt-4 text-2xl font-black">우리 섬</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
          둘이 함께 가꾸는 섬이에요. 알을 정성껏 돌보면 <b className="text-white">다양한 모습으로 진화</b>하고,
          정원을 키우고 섬을 꾸미며 <b className="text-white">유대</b>를 쌓아가요.
        </p>
        <input
          value={petName}
          onChange={(e) => setPetName(e.target.value.slice(0, 12))}
          placeholder="펫 이름 (예: 방울이)"
          className="mt-6 w-full max-w-xs rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-white/40"
        />
        <button
          onClick={startGame}
          disabled={busy}
          className="tap mt-4 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "섬 시작하기 🥚"}
        </button>
        {err && <p className="mt-4 text-xs text-rose-300">{err}</p>}
        <button onClick={onClose} className="tap mt-3 text-xs text-white/50 underline">
          닫기
        </button>
      </div>,
    );
  }

  const sum = islandSummary(s, now);
  const pf = petForm(s.pet.form);
  // 추천 케어 — 가장 급한 스탯의 액션 1개(45 미만일 때만). 아프면 약이 최우선.
  const careReco: string = (() => {
    if (s.pet.sick) return "medicine";
    const st = sum.pet.stats;
    const cand: [string, number][] = [
      ["feed", st.hunger],
      ["play", st.happy],
      ["rest", st.energy],
      ["clean", st.clean],
    ];
    const worst = cand.reduce((a, b) => (b[1] < a[1] ? b : a));
    return worst[1] < 45 ? worst[0] : "";
  })();
  const stage = petStage(s.pet.form);
  const weather = weatherOf(s, now); // 오늘의 섬 날씨(결정적 — 둘이 같은 하늘)
  // 픽셀 펫 조명 — 홈 월드와 같은 시간대 팔레트를 쓴다(앱 전체가 한 하늘 아래)
  const pixelLook = skyLook(skyPhaseOf(kstHourFloatOf(now)), sum.season);
  // 지금 창고·스킬로 만들 수 있는 가공품 수 — 공방 탭 배지(탭을 열 이유)
  const craftable = PRODUCTS.filter(
    (p) =>
      sum.skill >= p.minSkill &&
      Object.entries(p.recipe).every(([ck, n]) => (s.farm.barn[ck]?.qty ?? 0) >= (n as number)),
  ).length;
  const cdLeft = (key: string, hrs: number) => Math.max(0, (s.pet.cd[key] ?? 0) + hrs * 3600_000 - now);
  const cdLabel = (ms: number) => (ms <= 0 ? "" : ms > 3600_000 ? `${Math.ceil(ms / 3600_000)}시간` : `${Math.ceil(ms / 60000)}분`);

  // ⚠ 아트는 반드시 JSX 엘리먼트로 렌더(A(props) 함수 호출 금지 — 아트 내부 useId 가
  //   부모 훅 순서에 섞여 폼 전환 시 훅 개수가 달라진다).
  const PetArt = petArt(s.pet.form);
  const TABS: { k: Tab; label: string; Art?: ArtFC; emoji?: string }[] = [
    { k: "pet", label: "펫", Art: PetArt },
    { k: "farm", label: "정원", Art: cropArt("carrot", 1) },
    { k: "craft", label: craftable > 0 ? `공방 ${craftable}` : "공방", Art: productArt("jam") },
    { k: "decor", label: "꾸미기", Art: decorArt("tulip") },
    { k: "more", label: "모아보기", emoji: "📖" },
  ];

  return shell(
    <>
      {/* 헤더 */}
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Pill>💗 {won(s.coins)}</Pill>
            <Pill>
              {sum.ratingTier.emoji} {won(sum.rating)}
            </Pill>
            <Pill>💞 {s.bond.level}</Pill>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="tap grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {/* 섬 레벨 바 + 계절 */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-bold text-white/70">섬 Lv.{s.level}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (s.xp / sum.xpNext) * 100)}%` }} />
          </div>
          <span className="text-[11px] text-white/60">{SEASON_LABEL[sum.season]}</span>
        </div>
      </div>

      {/* 탭 */}
      <div className="mt-2 flex gap-1 px-3">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`tap flex-1 rounded-xl py-1.5 text-[11px] font-bold ${
              tab === t.k ? "bg-white/20 ring-1 ring-white/40" : "bg-white/[0.06] text-white/60"
            }`}
          >
            <span className="mx-auto grid h-5 w-5 place-items-center">
              {t.Art ? <t.Art size={20} /> : <span className="text-sm">{t.emoji}</span>}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="px-4 pt-1 text-center text-[11px] text-rose-300">{err}</p>}

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {/* ── 펫 ── */}
        {tab === "pet" && (
          <div className="space-y-3">
            {/* 다음 목표 — 업적·세트·진화가 '언젠가'가 아니라 '지금 뭘 하면 되는지'로 보이게 */}
            {(() => {
              const goals = nextGoals(s, now);
              if (goals.length === 0) return null;
              return (
                <div className="space-y-1.5 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <p className="text-[11px] font-bold text-white/60">다음 목표 🎯</p>
                  {goals.map((g) => (
                    <button
                      key={g.key}
                      onClick={() => setTab(g.tab)}
                      className="tap flex w-full items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-white/90">{g.label}</p>
                        <p className="truncate text-[10px] text-white/50">{g.hint}</p>
                        {g.pct < 100 && (
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                            <span className="block h-full rounded-full bg-amber-300" style={{ width: `${g.pct}%` }} />
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-white/40">→</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="rounded-2xl bg-black/20 p-4 text-center ring-1 ring-white/10">
              {/* 살아있는 메인 캐릭터 — 마당을 돌아다니고 터치하면 반응 */}
              {/* 펫 무대 — 픽셀 아트(도트) / 일러스트(SVG) 전환. 같은 펫·같은 상태를 다르게 그린다. */}
              <div className="relative">
                {pixelMode ? (
                  <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
                    <PixelPet
                      form={s.pet.form}
                      asleep={isAsleep(s, now)}
                      look={pixelLook}
                      fx={pixelFx.kind}
                      fxKey={pixelFx.key}
                      onTap={() => {
                        if (isAsleep(s, now)) {
                          act((st) => wakePet(st, Date.now())).then((ok) => {
                            if (ok) fireCareFx("wake", Date.now());
                          });
                          return;
                        }
                        act((st) => petPet(st, Date.now())).then((ok) => {
                          if (ok) setPixelFx({ kind: "heart", key: Date.now() });
                        });
                      }}
                    />
                  </div>
                ) : (
                  <PetYard
                    Art={PetArt}
                    name={s.pet.name}
                    stats={sum.pet.stats}
                    sick={s.pet.sick}
                    pendingEvolve={s.pet.pendingEvolve}
                    petReward={pettingCoinsNext(s, now)}
                    onPet={() => act((st) => petPet(st, Date.now()))}
                    asleep={isAsleep(s, now)}
                    fx={careFx}
                    onWake={() =>
                      act((st) => wakePet(st, Date.now())).then((ok) => {
                        if (ok) fireCareFx("wake", Date.now());
                      })
                    }
                  />
                )}
                {/* 모드 전환 — 전역 설정이라 홈·쿡찌르기·게임 카드의 펫도 같이 바뀐다 */}
                <button
                  onClick={() => setPixelArt(!pixelMode)}
                  className="tap absolute right-2 top-2 z-10 rounded-full bg-black/35 px-2.5 py-1 text-[9px] font-bold text-white/90 backdrop-blur-sm"
                >
                  {pixelMode ? "🎨 일러스트로" : "👾 픽셀로"}
                </button>
              </div>
              <p className="mt-2 text-sm font-extrabold">
                {s.pet.name} <span className="text-white/50">· {pf.name}</span> {sum.pet.mood}
              </p>
              <p className="text-[11px] text-white/50">
                Lv.{sum.pet.level} · 스테이지 {stage}/4 · 정성 {Math.round(s.pet.cq)}
                {s.pet.sick && " · 아파요 🤒"}
              </p>
              {/* 스탯 */}
              <div className="mt-3 space-y-1.5 text-left">
                <StatBar label="포만" emoji="🍖" value={sum.pet.stats.hunger} color="#fb923c" />
                <StatBar label="행복" emoji="😊" value={sum.pet.stats.happy} color="#f472b6" />
                <StatBar label="기력" emoji="⚡" value={sum.pet.stats.energy} color="#fbbf24" />
                <StatBar label="청결" emoji="🧼" value={sum.pet.stats.clean} color="#38bdf8" />
                <StatBar label="건강" emoji="❤️" value={sum.pet.stats.health} color="#f87171" />
              </div>
              {/* 다음 진화 미리보기 — 블랙박스였던 진화를 목표로(2026-07-27 UX) */}
              {(() => {
                const ev = evolutionPreview(s);
                if (ev.needLevel == null || !ev.target) return null;
                const tf = petForm(ev.target);
                const seen = s.catalog.includes(ev.target);
                return (
                  <div className="mt-3 rounded-xl bg-white/[0.06] p-2.5 text-left ring-1 ring-white/10">
                    <div className="flex items-center gap-2">
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-black/25 ring-1 ring-white/15">
                        <span style={seen ? undefined : { filter: "brightness(0) opacity(0.55)" }}>
                          <PetIcon form={ev.target} size={30} active={false} />
                        </span>
                        {!seen && <span className="absolute text-[11px] font-black text-white/85">?</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white/85">
                          다음 진화 · <span className="text-amber-200">{seen ? tf.name : "???"}</span>
                          <span className="ml-1 text-white/45">Lv.{ev.level}/{ev.needLevel}</span>
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-300" style={{ width: `${ev.pct}%`, transition: "width .5s" }} />
                        </div>
                      </div>
                    </div>
                    {ev.hint && <p className="mt-1.5 text-[10px] text-sky-200/90">💡 {ev.hint}</p>}
                  </div>
                );
              })()}
              {s.pet.pendingEvolve && (
                <button
                  onClick={() => setCelebrate(true)}
                  className="tap mt-3 w-full animate-pop rounded-xl bg-amber-300 py-2.5 text-sm font-extrabold text-ink"
                >
                  ✨ 진화할 수 있어요! 확인하기
                </button>
              )}
              {stage === 4 && (
                <button
                  onClick={async () => {
                    const name = "새 친구";
                    if (await confirmDialog({ message: `${pf.name}를 박물관에 보내고 새 알을 시작할까요?`, detail: "지금까지의 진화형은 박물관에 남아요.", confirmText: "새 알" }))
                      act((st) => retirePet(st, name, Date.now()));
                  }}
                  className="tap mt-2 w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80"
                >
                  🏛️ 박물관에 보내고 새 알 시작
                </button>
              )}
            </div>
            {/* 아파요 배너 — sick 은 존재하지만 안 보여서 '약이 무의미'했던 문제(2026-07-28) */}
            {s.pet.sick && (
              <button
                onClick={() => {
                  const nowMs = Date.now();
                  act((st) => medicinePet(st, nowMs)).then((ok) => {
                    if (ok) fireCareFx("medicine" as PetActionKind, nowMs);
                  });
                }}
                disabled={busy || s.coins < TUNING.pet.action.medicine.cost}
                className="tap w-full animate-pop rounded-xl bg-red-400/20 py-3 text-sm font-extrabold text-red-200 ring-1 ring-red-300/40 disabled:opacity-50"
              >
                🤒 {s.pet.name}가 아파요! 회복이 절반으로 느려져요 — 💊 약 먹이기 ({TUNING.pet.action.medicine.cost}💗)
              </button>
            )}
            {/* 케어 액션 — 가장 급한 스탯의 액션에 '추천' 뱃지(스탯↔액션 연결, 2026-07-27 UX) */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "feed", label: "밥주기", emoji: "🍚", cd: 4, fn: feedPet, cost: TUNING.pet.action.feed.cost },
                { k: "play", label: "놀기", emoji: "🎾", cd: 3, fn: playPet },
                { k: "clean", label: "씻기기", emoji: "🛁", cd: 6, fn: cleanPet },
                { k: "hug", label: "안아주기", emoji: "🤗", cd: 2, fn: hugPet },
                { k: "rest", label: "재우기", emoji: "😴", cd: 8, fn: restPet },
                { k: "medicine", label: "약", emoji: "💊", cd: 0, fn: medicinePet, cost: TUNING.pet.action.medicine.cost },
              ].map((a) => {
                const left = a.cd ? cdLeft(a.k, a.cd) : 0;
                const isFeed = a.k === "feed";
                // 약 — 아프거나 체력이 깎였을 때만 의미(건강하면 비활성 + '건강해요' 표시).
                // "약은 먹을 필요도 없는 건데" 리포트: 상태가 안 보여 죽은 버튼처럼 느껴졌음
                const isMed = a.k === "medicine";
                const medIdle = isMed && !s.pet.sick && s.pet.stats.health >= 100;
                // 밥주기는 시트에서 작물(무료)/코인 중 선택 → 쿨다운만 막고 코인 부족은 막지 않음
                const disabled = busy || left > 0 || medIdle || (!isFeed && a.cost != null && s.coins < a.cost);
                return (
                  <button
                    key={a.k}
                    disabled={disabled}
                    onClick={() => {
                      if (isFeed) {
                        setFeedOpen(true);
                        return;
                      }
                      const nowMs = Date.now();
                      act((st) => a.fn(st, nowMs)).then((ok) => {
                        if (ok) fireCareFx(a.k as PetActionKind, nowMs);
                      });
                    }}
                    className={`tap relative flex flex-col items-center gap-0.5 rounded-xl py-2.5 ring-1 disabled:opacity-35 ${
                      careReco === a.k && !disabled
                        ? "bg-amber-300/15 ring-amber-300/50"
                        : "bg-white/[0.08] ring-white/10"
                    }`}
                  >
                    {careReco === a.k && !disabled && (
                      <span className="animate-pop absolute -top-1.5 rounded-full bg-amber-300 px-1.5 text-[8px] font-black text-ink">
                        추천
                      </span>
                    )}
                    <span className="text-xl">{isMed && s.pet.sick ? "🤒" : a.emoji}</span>
                    <span className="text-[11px] font-bold">{a.label}</span>
                    <span className={`text-[9px] ${isMed && s.pet.sick ? "font-bold text-red-300" : "text-white/45"}`}>
                      {left > 0
                        ? cdLabel(left)
                        : isMed
                          ? s.pet.sick
                            ? "지금 필요!"
                            : medIdle
                              ? "건강해요 ✓"
                              : `${a.cost}💗 회복`
                          : isFeed
                            ? "먹이 고르기"
                            : a.cost
                              ? `${a.cost}💗`
                              : "무료"}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* 함께 놀기 — 탭 한 번이 아니라 15초 플레이 세션(둘의 점수 합산 → 유대 보너스) */}
            {s.pending.some((p) => p.type === "coop" && p.by !== myUserId) ? (
              <button
                onClick={() => setCoopSession("confirm")}
                className="tap w-full animate-pop rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
              >
                💞 {partnerName}가 마음 {s.pending.find((p) => p.type === "coop")?.score ?? 0}💗 을 걸어뒀어요 — 답하러 가기!
              </button>
            ) : s.pending.some((p) => p.type === "coop") ? (
              <p className="rounded-xl bg-white/[0.06] py-2.5 text-center text-xs text-white/60">
                💞 내 마음 {s.pending.find((p) => p.type === "coop")?.score ?? 0}💗 대기 중 — 상대가 답하면 합산돼요
              </p>
            ) : (
              <button
                onClick={() => setCoopSession("start")}
                className="tap w-full rounded-xl bg-white/[0.08] py-3 text-sm font-bold ring-1 ring-white/10"
              >
                💞 함께 놀기 — 15초 하트 탭으로 마음 담기
              </button>
            )}
            <p className="text-center text-[10px] text-white/40">정성껏 자주 돌볼수록 더 멋진 모습으로 진화해요 ✨</p>
          </div>
        )}

        {/* ── 정원 ── */}
        {tab === "farm" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>농사 Lv.{sum.skill} · {SEASON_LABEL[sum.season]} 제철 작물이 잘 자라요</span>
              <span>{s.farm.plots.length}칸</span>
            </div>
            {/* 오늘의 날씨(결정적 — 둘이 같은 하늘) */}
            {WEATHER_LABEL[weather] && (
              <div className="rounded-xl bg-sky-400/10 px-3 py-2 text-[11px] font-bold text-sky-100 ring-1 ring-sky-300/25">
                {WEATHER_LABEL[weather]}
              </div>
            )}
            <div className="relative">
              <div className="grid grid-cols-4 gap-2">
                {s.farm.plots.map((plot, i) => {
                  const st = cropStage(s, plot, now);
                  const c = plot.crop ? cropOf(plot.crop) : null;
                  const stack = plot.fertStack ?? 0;
                  // 비료 단계별 흙색(짙어짐) — 갈아둔 정성이 눈에 남는다
                  const soil = ["#3b2f1d99", "#4a3a2299", "#57411f99", "#63481c99"][Math.min(3, stack)];
                  const wetness =
                    s.farm.sprinkler || plot.wateredAt == null
                      ? s.farm.sprinkler && plot.crop ? 0.5 : 0
                      : Math.max(0, 1 - (now - plot.wateredAt) / 86400000);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!plot.crop) setSeedFor(i);
                        else if (st.ripe) doHarvest(i, Date.now()); // 다 자람 = 즉시 수확(손맛)
                        else setPlotFor(i); // 자라는 중 = 돌보기 시트(품질 미리보기·물·비료)
                      }}
                      className="tap relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl ring-1 ring-amber-900/40"
                      style={{ background: soil, transition: "background 500ms" }}
                    >
                      {/* 젖은 흙 — 물기가 하루에 걸쳐 마른다 */}
                      {wetness > 0 && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: "radial-gradient(120% 80% at 50% 100%, rgba(15,8,0,0.5), transparent)",
                            opacity: wetness,
                            transition: "opacity 3s linear",
                          }}
                        />
                      )}
                      {/* 행운의 두둑 — 반짝임 */}
                      {(plot.lucky ?? false) && plot.crop && (
                        <>
                          <span className="animate-lucky-twinkle pointer-events-none absolute left-1 top-1 text-[9px]">✨</span>
                          <span className="animate-lucky-twinkle pointer-events-none absolute bottom-2 right-1 text-[8px]" style={{ animationDelay: "0.7s" }}>✨</span>
                        </>
                      )}
                      {!plot.crop ? (
                        <>
                          <span className="text-lg text-white/30">＋</span>
                          {stack > 0 && <span className="text-[8px] font-bold text-amber-300/80">거름 {stack}</span>}
                        </>
                      ) : st.ripe ? (
                        <>
                          {(() => {
                            const A = cropArt(plot.crop!, 3);
                            return (
                              <span className="animate-pop">
                                <A size={44} title={c!.name} />
                              </span>
                            );
                          })()}
                          <span className="text-[8px] font-bold text-emerald-300">수확!</span>
                        </>
                      ) : (
                        <>
                          {(() => {
                            // 진행도 → 성장 단계(0 씨앗 / 1 새싹 / 2 자람). 수확 가능은 위 분기.
                            const stage: CropStage = st.progress < 0.25 ? 0 : st.progress < 0.7 ? 1 : 2;
                            const A = cropArt(plot.crop!, stage);
                            return (
                              // 바깥 span=연속 성장 스케일(3s 보간), 안쪽 span=바람 sway — 한 요소 = 한 transform
                              <span
                                className="block"
                                style={{
                                  transform: `scale(${0.72 + 0.28 * st.progress})`,
                                  transformOrigin: "50% 88%",
                                  transition: "transform 3s linear",
                                }}
                              >
                                <span
                                  className={weather === "wind" ? "animate-crop-sway-hard block" : "animate-crop-sway block"}
                                  style={{ transformOrigin: "50% 88%", animationDelay: `${i * -0.17}s` }}
                                >
                                  <A size={40} title={c!.name} />
                                </span>
                              </span>
                            );
                          })()}
                          <span className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-black/40">
                            <span
                              className="block h-full bg-emerald-400"
                              style={{ width: `${st.progress * 100}%`, transition: "width 3s linear" }}
                            />
                          </span>
                          {s.farm.sprinkler || (plot.wateredAt != null && now - plot.wateredAt < 86400000) ? null : (
                            <span className="absolute right-0.5 top-0.5 text-[9px]">💧</span>
                          )}
                        </>
                      )}
                      {/* 비료 pip (좌상단) */}
                      {stack > 0 && plot.crop && (
                        <span className="pointer-events-none absolute left-1 top-1 flex gap-0.5">
                          {Array.from({ length: stack }).map((_, k) => (
                            <span key={k} className="h-1 w-1 rounded-full bg-amber-300/90" />
                          ))}
                          {(plot.gold ?? false) && <span className="h-1 w-1 rounded-full bg-yellow-200 ring-1 ring-yellow-100" />}
                        </span>
                      )}
                      {/* 수확 연출 — ★ 스탬프 드럼롤 + 코인 */}
                      {harvestFx?.plot === i && (
                        <span key={harvestFx.id} className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                          <span className="animate-harvest-ring absolute h-10 w-10 rounded-full border-2 border-amber-200/80" />
                          <span className="animate-harvest-ring absolute h-10 w-10 rounded-full border-2 border-amber-200/60" style={{ animationDelay: "0.14s" }} />
                          <span className="flex gap-0.5">
                            {Array.from({ length: harvestFx.star }).map((_, k) => (
                              <span key={k} className="animate-star-stamp text-sm" style={{ animationDelay: `${k * 90}ms` }}>
                                ⭐
                              </span>
                            ))}
                          </span>
                          <span className="animate-pet-coin absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-1.5 text-[10px] font-black text-ink">
                            +{harvestFx.coins}💗
                          </span>
                          {harvestFx.bumper && (
                            <span className="animate-pop absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-400 px-1.5 text-[9px] font-black text-ink">
                              🌾 풍년! 2배
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* 비 오는 날 — 밭 위 빗줄기(결정적 오프셋, 랜덤 금지) */}
              {weather === "rain" && (
                <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span
                      key={i}
                      className="animate-rain-fall absolute top-0 h-3 w-0.5 rounded-full bg-sky-200/60"
                      style={{ left: `${(i * 137.5) % 100}%`, animationDuration: `${0.8 + ((i * 7) % 5) / 10}s`, animationDelay: `${(i % 13) * 0.11}s` }}
                    />
                  ))}
                </span>
              )}
            </div>
            {/* 모두 수확 — 연속 수확 콤보가 붙는다(거둘수록 배수↑). 배수를 **미리** 보여줘
                '한 칸씩 vs 몰아서'가 의미 있는 선택이 되게 한다. */}
            {(() => {
              const pv = harvestAllPreview(s, now);
              if (pv.plots < 2) return null;
              return (
                <button
                  disabled={busy}
                  onClick={() => act((st) => harvestAllReady(st, Date.now()))}
                  className="tap w-full animate-pop rounded-xl bg-emerald-400/20 py-2.5 text-sm font-extrabold text-emerald-200 ring-1 ring-emerald-300/40"
                >
                  🧺 모두 수확 ({pv.plots}개)
                  <span className="block text-[10px] font-normal text-emerald-200/75">
                    연속 수확 콤보 최대 x{pv.maxCombo.toFixed(2)} · 확률로 🌾풍년(2배)
                  </span>
                </button>
              );
            })()}
            <p className="text-center text-[10px] text-white/40">빈 칸=심기 · 자라는 중=돌보기(물·비료·품질 미리보기) · 다 자람=수확</p>
            {/* 도구/확장 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy || s.farm.plots.length >= 24 || s.coins < (TUNING.farm.plotBatches[Math.floor((s.farm.plots.length - 4) / 2)] ?? 1e9)}
                onClick={() => act((x) => expandPlots(x))}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                밭 넓히기 {s.farm.plots.length < 24 ? `(${won(TUNING.farm.plotBatches[Math.floor((s.farm.plots.length - 4) / 2)] ?? 0)}💗)` : "MAX"}
              </button>
              <button
                onClick={() => act((x) => buyFertilizer(x, false))}
                disabled={busy || s.coins < TUNING.farm.fertilizer}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                비료 사기 ({TUNING.farm.fertilizer}💗) · 보유 {s.farm.fert}
              </button>
              {/* 골드비료 — ★5 관문을 여는 열쇠. 엔진엔 있었는데 사는 곳이 없어 죽어 있던 기능(2026-08-02) */}
              <button
                onClick={() => act((x) => buyFertilizer(x, true))}
                disabled={busy || s.coins < TUNING.farm.goldFertilizer}
                className="tap rounded-xl bg-yellow-300/10 py-2.5 text-xs font-bold text-yellow-200 ring-1 ring-yellow-200/30 disabled:opacity-35"
              >
                ✨ 골드비료 ({won(TUNING.farm.goldFertilizer)}💗) · 보유 {s.farm.gold}
                <span className="block text-[9px] font-normal text-yellow-100/70">품질 +{TUNING.farm.quality.fertGold} · ★5 해금</span>
              </button>
              <button
                disabled={busy || s.farm.sprinkler || s.coins < TUNING.farm.sprinkler}
                onClick={() => act((x) => buyTool(x, "sprinkler", Date.now()))}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                💧 스프링클러 {s.farm.sprinkler ? "✓" : `(${won(TUNING.farm.sprinkler)}💗)`}
              </button>
              <button
                disabled={busy || s.farm.greenhouse || s.coins < TUNING.farm.greenhouse}
                onClick={() => act((x) => buyTool(x, "greenhouse", Date.now()))}
                className="tap rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-35"
              >
                🏡 온실 {s.farm.greenhouse ? "✓" : `(${won(TUNING.farm.greenhouse)}💗)`}
              </button>
            </div>
          </div>
        )}

        {/* ── 공방 ── */}
        {tab === "craft" && (
          <div className="space-y-3">
            {/* 게이트는 농사 스킬(레시피별) — 잠금 화면 대신 항상 전체 레시피를 보여준다 */}
            <p className="text-[11px] text-white/60">
              농사 Lv.{sum.skill} · 창고 재료로 요리를 만들어 더 비싸게 팔아요 {craftable > 0 && <b className="text-emerald-300">지금 {craftable}개 제작 가능!</b>}
            </p>
            {/* 창고 */}
            <div>
              <p className="mb-1 text-[11px] font-bold text-white/60">창고 (수확물)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(s.farm.barn).length === 0 && <span className="text-[11px] text-white/40">비었어요 — 정원에서 수확해요</span>}
                {Object.entries(s.farm.barn).map(([k, v]) => {
                  const A = cropArt(k, 3);
                  return (
                    <Pill key={k}>
                      <span className="inline-flex items-center gap-1 align-middle">
                        <A size={18} title={cropOf(k as CropKey).name} />
                        {v.qty} <span className="text-amber-300">{"★".repeat(v.star)}</span>
                      </span>
                    </Pill>
                  );
                })}
              </div>
            </div>
            {/* 가공 슬롯 */}
            {s.farm.craft.map((slot, i) => (
              <CraftSlotRow
                key={i}
                slot={slot}
                now={now}
                busy={busy}
                onStart={() => setCraftFor(i)}
                onCollect={(use) => act((x) => collectCraft(x, i, Date.now(), use))}
              />
            ))}
          </div>
        )}

        {/* ── 꾸미기 ── */}
        {tab === "decor" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1 text-[11px] text-white/60">
                {moveId ? (
                  "↔ 옮길 자리를 탭 (다시 탭하면 취소)"
                ) : placeKey ? (
                  <>
                    {(() => {
                      const A = decorArt(placeKey);
                      return <A size={16} />;
                    })()}
                    놓을 자리를 탭
                  </>
                ) : (
                  "빈 곳 탭=배치 · 장식 탭=이동/치우기"
                )}
              </p>
              <button onClick={() => setShopOpen(true)} className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold ring-1 ring-white/15">
                🛒 상점
              </button>
            </div>

            {/* 섬 평점 게이지 — 다음 등급까지 얼마나 남았는지(꾸미기의 목표) */}
            {(() => {
              const tiers = [
                { key: "bronze", label: "브론즈", emoji: "🥉", cut: TUNING.island.ratingTiers.bronze },
                { key: "silver", label: "실버", emoji: "🥈", cut: TUNING.island.ratingTiers.silver },
                { key: "gold", label: "골드", emoji: "🥇", cut: TUNING.island.ratingTiers.gold },
                { key: "diamond", label: "다이아", emoji: "💎", cut: TUNING.island.ratingTiers.diamond },
                { key: "royal", label: "로열", emoji: "👑", cut: TUNING.island.ratingTiers.royal },
              ];
              const idx = tiers.findIndex((t) => t.key === sum.ratingTier.key);
              const nextTier = tiers[idx + 1] ?? null;
              const base = tiers[idx].cut;
              const pct = nextTier ? Math.min(100, ((sum.rating - base) / (nextTier.cut - base)) * 100) : 100;
              return (
                <div className="rounded-xl bg-gradient-to-r from-pink-400/15 to-amber-300/15 px-3 py-2 ring-1 ring-white/10">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white/85">
                      {sum.ratingTier.emoji} {sum.ratingTier.label} · {won(sum.rating)}
                    </span>
                    <span className="text-white/60">
                      {nextTier ? `${nextTier.emoji} ${nextTier.label}까지 +${won(nextTier.cut - sum.rating)}` : "최고 등급! 👑"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-pink-300 to-amber-300" style={{ width: `${pct}%`, transition: "width .5s" }} />
                  </div>
                  {ambienceHappyBonusPct(s) > 0 && (
                    <p className="mt-1 text-[10px] text-emerald-300">분위기 보너스: 펫 행복 감쇠 −{ambienceHappyBonusPct(s)}%</p>
                  )}
                </div>
              );
            })()}

            {/* 오늘의 위시 — 펫이 매일 다른 장식을 갖고 싶어함(꾸미기에 '오늘의 이유', 2026-07-28) */}
            {(() => {
              const wishKey = decorWishKey(s, now);
              const wd = decorDef(wishKey);
              const WA = decorArt(wishKey);
              const placed = s.decor.some((d) => d.key === wishKey);
              const claimable = decorWishClaimable(s, now);
              const claimed = placed && !claimable;
              const price = RARITY_PRICE[wd.rarity];
              return (
                <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/12">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                    <WA size={24} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white/85">
                      🗨️ “오늘은 <span className="text-amber-300">{wd.name}</span>{claimed ? "이(가) 있어서 행복해!”" : "이(가) 갖고 싶어!”"}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {claimed
                        ? "오늘 소원 성취 ✨ 내일 새 소원이 생겨요"
                        : claimable
                          ? `이뤄주면 +${TUNING.island.wish.coins}💗 · 행복 +${TUNING.island.wish.happy}`
                          : `섬에 배치하면 선물을 줘요 (+${TUNING.island.wish.coins}💗)`}
                    </p>
                  </div>
                  {claimable ? (
                    <button
                      onClick={() => act((st) => claimDecorWish(st, Date.now()))}
                      disabled={busy}
                      className="tap shrink-0 animate-pop rounded-full bg-amber-300 px-3 py-1.5 text-[11px] font-extrabold text-ink"
                    >
                      🎁 이뤄주기
                    </button>
                  ) : !placed ? (
                    <button
                      onClick={() => setPlaceKey(wishKey)}
                      disabled={s.coins < price || s.level < wd.minLevel}
                      className="tap shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold ring-1 ring-white/15 disabled:opacity-40"
                    >
                      배치 {price}💗
                    </button>
                  ) : null}
                </div>
              );
            })()}

            {/* 진짜 섬 풍경 — 배치 팝·이동·야간 야광·펫 환호가 사는 곳 */}
            <IslandScene
              decor={s.decor}
              petForm={s.pet.form}
              season={sum.season}
              now={now}
              placing={moveId ? (s.decor.find((d) => d.id === moveId)?.key ?? null) : placeKey}
              movingId={moveId}
              justPlacedPos={justPlacedAt}
              petAsleep={s.pet.stats.energy < 20}
              ratingLabel={
                <>
                  {sum.ratingTier.emoji} {won(sum.rating)}
                </>
              }
              onSlotTap={async (x, y, placed) => {
                const nowMs = Date.now();
                if (moveId) {
                  // 이동 모드 — 빈 칸이면 옮기고, 자기 자신을 다시 탭하면 취소
                  if (placed?.id === moveId) {
                    setMoveId(null);
                    return;
                  }
                  if (!placed) {
                    const id = moveId;
                    const ok = await act((st) => moveDecor(st, id, x, y));
                    if (ok) {
                      setMoveId(null);
                      firePlaceFx(x, y, nowMs);
                    }
                  }
                  return;
                }
                if (placed) {
                  setDecorAction(placed); // 액션 칩(이동/치우기) — 즉시 파괴 금지
                } else if (placeKey) {
                  const key = placeKey;
                  const ok = await act((st) => placeDecor(st, key, x, y, nowMs));
                  if (ok) {
                    setPlaceKey(null); // 성공 시에만 선택 해제(충돌 시 한 번 더 탭) [리뷰 fix]
                    firePlaceFx(x, y, nowMs);
                  }
                }
              }}
            />

            {/* 장식 액션 칩 — 탭한 장식을 이동/치우기 */}
            {decorAction && (
              <div className="animate-pop flex items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-2 ring-1 ring-white/15">
                <span className="grid h-8 w-8 shrink-0 place-items-center">
                  {(() => {
                    const A = decorArt(decorAction.key);
                    return <A size={28} />;
                  })()}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{decorDef(decorAction.key).name}</span>
                <button
                  onClick={() => {
                    setMoveId(decorAction.id);
                    setPlaceKey(null);
                    setDecorAction(null);
                  }}
                  className="tap rounded-full bg-sky-400/20 px-3 py-1.5 text-[11px] font-bold text-sky-200 ring-1 ring-sky-300/30"
                >
                  ↔ 이동
                </button>
                <button
                  onClick={async () => {
                    const d = decorDef(decorAction.key);
                    const refund = Math.floor(RARITY_PRICE[d.rarity] * 0.5);
                    if (
                      await confirmDialog({
                        message: `${d.emoji} ${d.name}을(를) 치울까요?`,
                        detail: `치우면 ${refund}💗를 돌려받아요.`,
                        confirmText: "치우기",
                      })
                    ) {
                      const id = decorAction.id;
                      act((st) => removeDecor(st, id));
                    }
                    setDecorAction(null);
                  }}
                  className="tap rounded-full bg-rose-400/20 px-3 py-1.5 text-[11px] font-bold text-rose-200 ring-1 ring-rose-300/30"
                >
                  🗑 치우기
                </button>
                <button onClick={() => setDecorAction(null)} aria-label="닫기" className="tap px-1 text-white/50">
                  ✕
                </button>
              </div>
            )}

            {/* 세트 진행 */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-white/60">테마 세트</p>
              {DECOR_SETS.map((set) => {
                const items = DECORS.filter((d) => d.set === set.id);
                const have = items.filter((d) => s.decor.some((p) => p.key === d.key)).length;
                const done = s.sets.includes(set.id);
                return (
                  <div key={set.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${done ? "bg-amber-400/15 ring-1 ring-amber-300/40" : "bg-white/[0.05]"}`}>
                    <span>{set.emoji}</span>
                    <span className="flex-1 font-bold">{set.name}</span>
                    {!done && (
                      <span className="flex shrink-0 items-center gap-0.5" title="아직 없는 장식">
                        {items
                          .filter((d) => !s.decor.some((p) => p.key === d.key))
                          .slice(0, 5)
                          .map((d) => {
                            const MA = decorArt(d.key);
                            return (
                              <span key={d.key} className="opacity-35">
                                <MA size={14} />
                              </span>
                            );
                          })}
                      </span>
                    )}
                    <span className="text-white/50">{have}/{items.length}</span>
                    {done && <span className="text-[10px] text-amber-300">완성 · {set.perk}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 모아보기(퀘스트·유대·업적·도감) ── */}
        {tab === "more" && (
          <div className="space-y-4">
            {/* 일일 퀘스트 */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-white/70">오늘의 퀘스트 🎯</p>
              <div className="space-y-1.5">
                {s.quest.list.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{q.label}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-emerald-400" style={{ width: `${(q.prog / q.goal) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-white/50 tabular-nums">{q.prog}/{q.goal}</span>
                    {q.claimed ? (
                      <span className="text-[10px] text-emerald-300">완료 ✓</span>
                    ) : (
                      <button
                        disabled={busy || q.prog < q.goal}
                        onClick={() => act((x) => claimQuest(x, q.id, Date.now()))}
                        className="tap rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-30"
                      >
                        +{q.reward}💗
                      </button>
                    )}
                  </div>
                ))}
                {s.quest.chest && <p className="text-center text-[10px] text-amber-300">오늘 퀘스트 전부 완료! 🎁</p>}
              </div>
            </div>
            {/* 유대 */}
            <div className="rounded-xl bg-white/[0.06] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">💞 유대 Lv.{s.bond.level}</span>
                <button onClick={() => act((x) => giftPartner(x, Date.now()))} className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">
                  🎁 마음 전하기
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-pink-400" style={{ width: `${Math.min(100, (s.bond.xp / xpForBondLevel(s.bond.level + 1)) * 100)}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-white/45">함께 놀기·선물·둘 다 출석·기념일로 깊어져요</p>
              <p className="mt-0.5 text-[10px] text-amber-200/80">
                {s.bond.level < 3 ? "Lv.3: 💑 커플 장식 해금" : s.bond.level < 5 ? "Lv.5: ✨ 특별 진화 분기 열림" : "모든 유대 보상 해금! 👑"}
              </p>
            </div>
            {/* 업적 */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-white/70">업적 🏆 ({s.achievements.length}/{ACHIEVEMENTS.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {ACHIEVEMENTS.map((a) => {
                  const got = s.achievements.includes(a.key);
                  return (
                    <span
                      key={a.key}
                      title={a.name}
                      className={`rounded-lg px-2 py-1 text-[11px] ${got ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40" : "bg-white/[0.05] text-white/30"}`}
                    >
                      {a.emoji} {got ? a.name : "???"}
                    </span>
                  );
                })}
              </div>
            </div>
            {/* 도감 — catalog 데이터를 드디어 눈에 보이는 수집 갤러리로(2026-07-27 UX) */}
            {(() => {
              const has = (k: string) => s.catalog.includes(k);
              const Cell = ({ seen, name, children }: { seen: boolean; name: string; children: ReactNode }) => (
                <span
                  title={seen ? name : "???"}
                  className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${
                    seen ? "bg-white/[0.08] ring-white/15" : "bg-white/[0.03] ring-white/5"
                  }`}
                >
                  <span style={seen ? undefined : { filter: "brightness(0) opacity(0.4)" }}>{children}</span>
                </span>
              );
              const pets = Object.values(PET_FORMS);
              const seenPets = pets.filter((f) => has(f.key)).length;
              const seenCrops = CROPS.filter((c) => has(`crop_${c.key}`)).length;
              const seenProds = PRODUCTS.filter((pr) => has(`product_${pr.key}`)).length;
              const seenDecos = DECORS.filter((d) => has(`decor_${d.key}`)).length;
              return (
                <div>
                  <p className="mb-1.5 text-xs font-bold text-white/70">
                    도감 📖 <span className="text-white/40">({seenPets + seenCrops + seenProds + seenDecos}/{pets.length + CROPS.length + PRODUCTS.length + DECORS.length})</span>
                  </p>
                  <div className="space-y-2 rounded-xl bg-white/[0.05] p-2.5">
                    <p className="text-[10px] font-bold text-white/50">펫 {seenPets}/{pets.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {pets.map((f) => (
                        <Cell key={f.key} seen={has(f.key)} name={f.name}>
                          <PetIcon form={f.key} size={34} active={false} />
                        </Cell>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-white/50">작물 {seenCrops}/{CROPS.length} · 별⭐는 최고 품질</p>
                    <div className="flex flex-wrap gap-1">
                      {CROPS.map((c) => {
                        const A = cropArt(c.key, 3);
                        const best = [5, 4, 3, 2, 1].find((n) => has(`star${n}_${c.key}`)) ?? 0;
                        return (
                          <span key={c.key} className="relative">
                            <Cell seen={has(`crop_${c.key}`)} name={c.name}>
                              <A size={34} />
                            </Cell>
                            {best > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-amber-300 px-1 text-[8px] font-black text-ink">
                                ★{best}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[10px] font-bold text-white/50">요리 {seenProds}/{PRODUCTS.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {PRODUCTS.map((pr) => {
                        const A = productArt(pr.key);
                        return (
                          <Cell key={pr.key} seen={has(`product_${pr.key}`)} name={pr.name}>
                            <A size={34} />
                          </Cell>
                        );
                      })}
                    </div>
                    <p className="text-[10px] font-bold text-white/50">장식 {seenDecos}/{DECORS.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {DECORS.map((d) => {
                        const A = decorArt(d.key);
                        return (
                          <Cell key={d.key} seen={has(`decor_${d.key}`)} name={d.name}>
                            <A size={34} />
                          </Cell>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* 진화 계보도 — 이 게임이 '무엇을 모으는 게임인지'를 처음으로 보여준다.
                박물관이 0개면 섹션 자체가 안 보여서 종착점이 투명했다(2026-08-03). */}
            {(() => {
              const tree = evolutionTree(s);
              const cell = (nodeKey: string, name: string, st: string, big = false) => {
                const known = st !== "locked";
                return (
                  <div
                    key={nodeKey}
                    className={`flex flex-col items-center rounded-lg px-1 py-1 ${
                      st === "current"
                        ? "bg-amber-300/20 ring-1 ring-amber-300/60"
                        : st === "museum"
                          ? "bg-violet-400/15 ring-1 ring-violet-300/40"
                          : "bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className="grid place-items-center"
                      style={known ? undefined : { filter: "brightness(0) opacity(0.28)" }}
                    >
                      <PetIcon form={nodeKey} size={big ? 34 : 24} active={false} title={known ? name : "???"} />
                    </span>
                    <span
                      className={`mt-0.5 max-w-[52px] truncate text-[8px] font-bold ${
                        st === "current" ? "text-amber-200" : st === "museum" ? "text-violet-200" : known ? "text-white/60" : "text-white/25"
                      }`}
                    >
                      {known ? name : "???"}
                    </span>
                    {st === "museum" && <span className="text-[7px] text-violet-300">🏛️</span>}
                    {st === "current" && <span className="text-[7px] text-amber-300">지금</span>}
                  </div>
                );
              };
              return (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/70">
                    진화 계보 🧬
                    <span className="text-white/40">최종형 {tree.finalsCollected}/{tree.finalsTotal} 수집</span>
                  </p>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-300 to-amber-300"
                      style={{ width: `${(tree.finalsCollected / tree.finalsTotal) * 100}%`, transition: "width .5s" }}
                    />
                  </div>
                  <p className="mb-2 text-[10px] leading-snug text-white/45">
                    최종형까지 키운 뒤 <b className="text-violet-200">박물관에 보내면</b> 한 칸이 채워지고 새 알이 시작돼요 — 정성(CQ)에 따라 갈래가 달라집니다.
                  </p>
                  <div className="space-y-1.5">
                    {tree.branches.map((b) => (
                      <div key={b.mid.key} className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] p-1.5">
                        {cell(b.mid.key, b.mid.name, b.mid.status, true)}
                        <span className="text-[10px] text-white/30">→</span>
                        <div className="grid flex-1 grid-cols-2 gap-1">
                          {b.finals.map((f) => cell(f.key, f.name, f.status))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p className="text-center text-[10px] text-white/40">아케이드/부루마블/테트리스에서 이겨도 💗코인이 쌓여요</p>
          </div>
        )}
      </div>

      {/* 씨앗 시트 */}
      {seedFor != null && (
        <SheetShell onClose={() => setSeedFor(null)} title="무엇을 심을까요?">
          <div className="grid grid-cols-2 gap-2">
            {CROPS.map((c) => {
              const inSeason = s.farm.greenhouse || c.season === sum.season;
              return (
                <button
                  key={c.key}
                  disabled={busy || s.coins < c.seed}
                  onClick={() => {
                    act((x) => plant(x, seedFor, c.key, Date.now()));
                    setSeedFor(null);
                  }}
                  className="tap flex items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10 disabled:opacity-35"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center">
                    {(() => {
                      const A = cropArt(c.key, 3);
                      return <A size={34} title={c.name} />;
                    })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">
                      {c.name} {!inSeason && <span className="text-[9px] text-rose-300">비제철</span>}
                    </p>
                    <p className="text-[10px] text-white/50">씨앗 {c.seed}💗 · {c.growDays < 1 ? Math.round(c.growDays * 24) + "시간" : c.growDays + "일"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {/* 밭 돌보기 시트 — 품질 미리보기(레시피) + 물/비료. '죽은 비료'가 사는 집 */}
      {plotFor != null && s.farm.plots[plotFor]?.crop && (
        <PlotSheet
          s={s}
          plotId={plotFor}
          now={now}
          busy={busy}
          onClose={() => setPlotFor(null)}
          onWater={() => act((x) => waterPlot(x, plotFor, Date.now()))}
          onFert={(g) => act((x) => fertilize(x, plotFor, g, Date.now()))}
          onHarvest={() => {
            doHarvest(plotFor, Date.now());
            setPlotFor(null);
          }}
        />
      )}

      {/* 가공 시트 */}
      {craftFor != null && (
        <SheetShell onClose={() => setCraftFor(null)} title="무엇을 만들까요?">
          <div className="space-y-2">
            {PRODUCTS.map((p) => {
              const canSkill = sum.skill >= p.minSkill;
              const missing = Object.entries(p.recipe).find(([ck, n]) => (s.farm.barn[ck]?.qty ?? 0) < (n as number));
              const enough = !missing;
              return (
                <button
                  key={p.key}
                  disabled={busy || !canSkill || !enough}
                  onClick={() => {
                    act((x) => startCraft(x, craftFor, p.key as ProductKey, Date.now()));
                    setCraftFor(null);
                  }}
                  className="tap flex items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10 disabled:opacity-40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center">
                    {(() => {
                      const A = productArt(p.key);
                      return <A size={34} title={p.name} />;
                    })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">
                      {p.name}{" "}
                      {canSkill && enough && <span className="text-[9px] font-bold text-emerald-300">제작 가능</span>}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {Object.entries(p.recipe).map(([ck, n]) => `${cropOf(ck as CropKey).emoji}${n}`).join(" ")} · {p.days < 1 ? Math.round(p.days * 24) + "시간" : p.days + "일"} · ~{won(p.sell)}💗
                    </p>
                    {/* 잠긴 항목도 이유를 정확히 — '갖고 싶은 목록'으로 기능 */}
                    {!canSkill ? (
                      <p className="text-[9px] font-bold text-rose-300">농사 Lv.{p.minSkill}부터 (지금 Lv.{sum.skill})</p>
                    ) : missing ? (
                      <p className="text-[9px] font-bold text-amber-300">
                        재료 부족 — {cropOf(missing[0] as CropKey).emoji}
                        {cropOf(missing[0] as CropKey).name} {(missing[1] as number) - (s.farm.barn[missing[0]]?.qty ?? 0)}개 더
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {/* 함께 놀기 플레이 세션 — 점수를 엔진(coopStart/coopConfirm)에 실어 유대 보너스 스케일 */}
      {coopSession && (
        <CoopPlay
          Art={PetArt}
          petName={s.pet.name}
          mode={coopSession}
          partnerName={partnerName || "상대"}
          onClose={() => setCoopSession(null)}
          onDone={(score) => {
            const mode = coopSession;
            setCoopSession(null);
            act((st) =>
              mode === "start"
                ? coopStart(st, myUserId ?? "", Date.now(), score)
                : coopConfirm(st, myUserId ?? "", Date.now(), score),
            );
          }}
        />
      )}

      {/* 밥주기 시트 — 직접 키운 작물(무료)이 코인 먹이보다 좋다 [요청: 작물 키우는 이유] */}
      {feedOpen && (
        <SheetShell onClose={() => setFeedOpen(false)} title="무엇을 먹일까요?">
          <p className="mb-2 text-[11px] leading-snug text-white/55">
            직접 키운 작물은 <b className="text-emerald-300">무료</b>이고, ★가 높을수록 <b className="text-amber-300">진화가 빨라져요</b>(★4↑은 배불러도 정성 상승).
          </p>
          {Object.keys(s.farm.barn).length === 0 ? (
            <p className="rounded-xl bg-white/[0.06] px-3 py-3 text-center text-[11px] text-white/50">
              창고가 비었어요 — 정원에서 작물을 키워 수확하면 여기서 먹일 수 있어요 🌱
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(s.farm.barn).map(([k, v]) => {
                const c = cropOf(k as CropKey);
                const A = cropArt(k, 3);
                return (
                  <button
                    key={k}
                    disabled={busy}
                    onClick={() => {
                      const nowMs = Date.now();
                      act((x) => feedPetWith(x, k, nowMs)).then((ok) => {
                        if (ok) fireCareFx("feed", nowMs);
                      });
                      setFeedOpen(false);
                    }}
                    className="tap flex items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10 disabled:opacity-35"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center">
                      <A size={34} title={c.name} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">
                        {c.name} <span className="text-amber-300">{"★".repeat(v.star)}</span>
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        무료 · 보유 {v.qty} · 성장 +{TUNING.pet.action.feed.xp + TUNING.pet.cropFeed.xpBonus + TUNING.pet.cropFeed.xpPerStar * v.star}
                      </p>
                      {v.star >= TUNING.pet.cropFeed.cqStar && (
                        <p className="text-[10px] font-bold text-amber-300">⭐ 특별식 — 배불러도 정성이 올라가요</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {/* 코인 먹이(간편) */}
          <button
            disabled={busy || s.coins < TUNING.pet.action.feed.cost}
            onClick={() => {
              const nowMs = Date.now();
              act((x) => feedPet(x, nowMs)).then((ok) => {
                if (ok) fireCareFx("feed", nowMs);
              });
              setFeedOpen(false);
            }}
            className="tap mt-3 flex w-full items-center gap-2 rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10 disabled:opacity-35"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center text-2xl">🍚</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">사료 사서 먹이기</p>
              <p className="text-[10px] text-white/50">{TUNING.pet.action.feed.cost}💗 · 포만 +{TUNING.pet.action.feed.hunger}</p>
            </div>
          </button>
        </SheetShell>
      )}

      {/* 데코 상점 */}
      {shopOpen && (
        <SheetShell onClose={() => setShopOpen(false)} title="🛒 데코 상점">
          <div className="grid grid-cols-3 gap-2">
            {DECORS.map((d) => {
              const owned = s.decor.some((p) => p.key === d.key);
              const price = RARITY_PRICE[d.rarity];
              const locked = s.level < d.minLevel || (d.set === "couple" && s.bond.level < 3);
              return (
                <button
                  key={d.key}
                  disabled={owned || locked || s.coins < price}
                  onClick={() => {
                    setPlaceKey(d.key);
                    setShopOpen(false);
                  }}
                  className={`tap flex flex-col items-center gap-0.5 rounded-xl py-2.5 ring-1 disabled:opacity-40 ${
                    d.rarity === "legendary" ? "bg-amber-400/10 ring-amber-300/40" : d.rarity === "epic" ? "bg-purple-400/10 ring-purple-300/30" : "bg-white/[0.06] ring-white/10"
                  }`}
                >
                  <span className="grid h-10 w-10 place-items-center">
                    {(() => {
                      const A = decorArt(d.key);
                      return <A size={38} title={d.name} />;
                    })()}
                  </span>
                  <span className="text-[10px] font-bold">{d.name}</span>
                  <span className="text-[9px] text-amber-300">{owned ? "보유" : locked ? (d.set === "couple" ? "유대3" : `Lv${d.minLevel}`) : `${price}💗`}</span>
                  {!owned && !locked && <span className="text-[8px] text-white/45">평점 +{RARITY_RATING[d.rarity]}</span>}
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {/* ★5 수확 — 화면 전체 금빛 축포(0.9s 후 자연 소멸) */}
      {harvestFx && harvestFx.star >= 5 && (
        <div key={`gf${harvestFx.id}`} aria-hidden className="animate-gold-flash pointer-events-none fixed inset-0 z-[84]" />
      )}

      {/* 테마 세트 완성 — 콘페티 + 토스트(상대가 완성해도 함께 축하) */}
      {setCele &&
        (() => {
          const set = DECOR_SETS.find((x) => x.id === setCele);
          if (!set) return null;
          return (
            <div className="pointer-events-none fixed inset-0 z-[85] flex items-center justify-center">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="animate-bg-confetti absolute top-0 text-lg"
                  style={{ left: `${6 + i * 7.5}%`, animationDuration: `${1.6 + (i % 4) * 0.3}s`, animationDelay: `${(i % 5) * 0.12}s` }}
                >
                  {["🎉", "✨", "💛", "🌸"][i % 4]}
                </span>
              ))}
              <div className="animate-pop rounded-2xl bg-[#1a2540]/95 px-6 py-4 text-center ring-1 ring-amber-300/50">
                <p className="text-3xl">{set.emoji}</p>
                <p className="mt-1 text-base font-black text-amber-200">&apos;{set.name}&apos; 세트 완성!</p>
                <p className="mt-0.5 text-[11px] text-white/70">{set.perk} 🎁</p>
              </div>
            </div>
          );
        })()}

      {/* 진화 축하 — 대상은 현재 상태에서 파생(evolve()가 실제 적용할 것과 항상 일치) */}
      {celebrate &&
        s.pet.pendingEvolve &&
        (() => {
          const target = nextEvolution(s.pet.form, s.pet.cq, s.bond.level, s.pet.neglect);
          if (!target) return null;
          return (
            <EvoCinematic
              fromForm={s.pet.form}
              toForm={target}
              petName={s.pet.name}
              onStart={() => act((x) => evolve(x, Date.now()))}
              onClose={() => setCelebrate(false)}
            />
          );
        })()}
    </>,
  );
}

/** 공용 바텀시트. */
function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[82] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#1a2540] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-white ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
        <h3 className="mb-3 text-base font-extrabold">{title}</h3>
        {children}
        <button onClick={onClose} className="tap mt-4 w-full rounded-xl bg-white/15 py-2.5 text-sm font-bold">
          닫기
        </button>
      </div>
    </div>
  );
}

/** 밭 돌보기 시트 — 품질 미리보기(단일 소스 qualityPreview)와 물/비료/수확 액션.
 *  거대 렌더 IIFE 를 피해 정식 컴포넌트로 분리(React Compiler 분석 친화). */
function PlotSheet({
  s,
  plotId,
  now,
  busy,
  onClose,
  onWater,
  onFert,
  onHarvest,
}: {
  s: IslandState;
  plotId: number;
  now: number;
  busy: boolean;
  onClose: () => void;
  onWater: () => void;
  onFert: (gold: boolean) => void;
  onHarvest: () => void;
}) {
  const plot = s.farm.plots[plotId];
  const pv = qualityPreview(s, plotId, now);
  if (!plot || !plot.crop || !pv) return null;
  const st = cropStage(s, plot, now);
  const c = cropOf(plot.crop);
  const stack = plot.fertStack ?? 0;
  const watered = s.farm.sprinkler || (plot.wateredAt != null && now - plot.wateredAt < 86400000);
  const BAR_MAX = 150;
  const coach =
    pv.nextCut != null && pv.fertGain >= pv.gap && s.farm.fert > 0 && stack < TUNING.farm.fertStackMax
      ? `비료 1개 더 주면 ★${starOf(pv.nextCut)} 확정!`
      : null;
  const stg: CropStage = st.ripe ? 3 : st.progress < 0.25 ? 0 : st.progress < 0.7 ? 1 : 2;
  const CropA = cropArt(plot.crop, stg);
  return (
    <SheetShell onClose={onClose} title="밭 돌보기">
      {/* 상태 헤더 */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
          {/* eslint-disable-next-line react-hooks/static-components */}
          <CropA size={38} title={c.name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">
            {c.name} {(plot.lucky ?? false) && <span className="text-[10px] text-emerald-300">🍀 행운의 두둑</span>}
          </p>
          <p className="text-[11px] text-white/55">{st.ripe ? "다 자랐어요 — 수확하세요!" : `자라는 중 ${Math.round(st.progress * 100)}%`}</p>
        </div>
      </div>

      {/* 예상 품질 — 점수 막대(임계 눈금) + 기여 칩. 비료를 누르면 눈앞에서 차오른다 */}
      <p className="mb-1 text-[11px] font-bold text-white/60">
        예상 품질 ★{pv.starMin}
        {pv.starMax > pv.starMin ? `~★${pv.starMax}` : ""}
      </p>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
        {/* 운(rng) 밴드 고스트 */}
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-amber-200/30"
          style={{
            width: `${Math.min(100, ((pv.score + TUNING.farm.quality.rngMax - 1) / BAR_MAX) * 100)}%`,
            transition: "width .45s cubic-bezier(.34,1.56,.64,1)",
          }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-amber-300"
          style={{ width: `${Math.min(100, (pv.score / BAR_MAX) * 100)}%`, transition: "width .45s cubic-bezier(.34,1.56,.64,1)" }}
        />
        {TUNING.farm.starCut.map((cut, k) => (
          <span key={k} className="absolute inset-y-0 w-px bg-white/45" style={{ left: `${(cut / BAR_MAX) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {pv.parts.map((pp) => (
          <span
            key={pp.key}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${pp.val > 0 ? "bg-white/[0.07] text-white/75 ring-white/10" : "bg-white/[0.03] text-white/35 ring-white/5"}`}
          >
            {pp.label} +{pp.val}
          </span>
        ))}
      </div>
      {coach && (
        <p className="animate-pop mt-2 rounded-lg bg-amber-300/15 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-200 ring-1 ring-amber-300/30">
          💡 {coach}
        </p>
      )}
      {pv.star5Locked && pv.starMax >= 5 && (
        <p className="mt-1.5 text-[10px] text-white/45">★5는 농사 Lv.{TUNING.farm.star5MinSkill} 또는 골드비료·비료 3단계 정성이 필요해요</p>
      )}

      {/* 액션 — 한 손 엄지 범위 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          disabled={busy || watered}
          onClick={onWater}
          className="tap min-h-12 rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-40"
        >
          💧 물주기
          <span className="block text-[9px] font-normal text-white/45">
            {s.farm.sprinkler ? "자동 급수 중" : watered ? "촉촉함 (내일 또)" : "성장 1.5배"}
          </span>
        </button>
        <button
          disabled={busy || s.farm.fert <= 0 || stack >= TUNING.farm.fertStackMax}
          onClick={() => onFert(false)}
          className="tap min-h-12 rounded-xl bg-amber-300/15 py-2.5 text-xs font-extrabold text-amber-200 ring-1 ring-amber-300/30 disabled:opacity-40"
        >
          💩 비료 {stack}/{TUNING.farm.fertStackMax}
          <span className="block text-[9px] font-normal text-amber-200/70">
            보유 {s.farm.fert} {stack < TUNING.farm.fertStackMax ? `· 다음 +${pv.fertGain} & 가속` : "· 최대"}
          </span>
        </button>
        <button
          disabled={busy || s.farm.gold <= 0 || (plot.gold ?? false)}
          onClick={() => onFert(true)}
          className="tap min-h-12 rounded-xl bg-yellow-300/10 py-2.5 text-xs font-extrabold text-yellow-200 ring-1 ring-yellow-200/30 disabled:opacity-40"
        >
          ✨ 골드비료
          <span className="block text-[9px] font-normal text-yellow-100/70">
            {(plot.gold ?? false) ? "적용됨" : `보유 ${s.farm.gold} · +${TUNING.farm.quality.fertGold} & ★5 해금`}
          </span>
        </button>
        <button
          disabled={busy || !st.ripe}
          onClick={onHarvest}
          className="tap min-h-12 rounded-xl bg-brand py-2.5 text-xs font-extrabold text-white disabled:opacity-40"
        >
          🌾 수확
          <span className="block text-[9px] font-normal text-white/70">{st.ripe ? "지금!" : "다 자라면"}</span>
        </button>
      </div>
    </SheetShell>
  );
}

/** 공방 조리대 한 칸 — 현황 + 완성 시 3택(팔기/간식/선물).
 *  거대 렌더 클로저를 피해 정식 컴포넌트로 분리(React Compiler ref 분석 친화, PlotSheet 와 동일 패턴). */
function CraftSlotRow({
  slot,
  now,
  busy,
  onStart,
  onCollect,
}: {
  slot: CraftSlot;
  now: number;
  busy: boolean;
  onStart: () => void;
  onCollect: (use: CraftUse) => void;
}) {
  const ready = craftReady(slot, now);
  const p = slot.product ? productOf(slot.product) : null;
  const pay = craftPayout(slot);
  const A = p ? productArt(p.key) : null;
  const opts: { use: CraftUse; label: string; sub: string; cls: string }[] = [
    { use: "sell", label: "팔기", sub: `+${won(pay.coins)}💗`, cls: "bg-amber-300/15 text-amber-200 ring-amber-300/30" },
    { use: "treat", label: "간식", sub: `성장 +${pay.careXp}`, cls: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30" },
    { use: "gift", label: "선물", sub: `유대 +${pay.bondXp}`, cls: "bg-pink-400/15 text-pink-200 ring-pink-300/30" },
  ];
  return (
    <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center">
          {/* eslint-disable-next-line react-hooks/static-components */}
          {A && p ? <A size={34} title={p.name} /> : <span className="text-2xl opacity-40">🍳</span>}
        </span>
        <div className="min-w-0 flex-1">
          {!p ? (
            <p className="text-xs text-white/60">비어있는 조리대</p>
          ) : ready ? (
            <p className="text-xs font-bold text-emerald-300">
              {p.name} 완성! <span className="text-amber-300">{"★".repeat(Math.max(1, slot.star))}</span>
            </p>
          ) : (
            <p className="text-xs text-white/70">{p.name} 만드는 중…</p>
          )}
        </div>
        {!p ? (
          <button disabled={busy} onClick={onStart} className="tap rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold disabled:opacity-35">
            만들기
          </button>
        ) : ready ? (
          <span className="text-[10px] font-bold text-emerald-300">어디에 쓸까요 ↓</span>
        ) : (
          <span className="text-[10px] text-white/40">진행중</span>
        )}
      </div>

      {/* 완성 3택 — 만든 걸 어디에 쓸지가 공방의 결정(전부 ★에 비례) */}
      {p && ready && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {opts.map((o) => (
            <button
              key={o.use}
              disabled={busy}
              onClick={() => onCollect(o.use)}
              className={`tap rounded-lg py-1.5 text-[11px] font-extrabold ring-1 disabled:opacity-40 ${o.cls}`}
            >
              {o.label}
              <span className="block text-[9px] font-normal opacity-80">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
