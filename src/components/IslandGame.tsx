"use client";

/* 이 파일은 key→컴포넌트 **아트 레지스트리**(petArt/cropArt/productArt/decorArt)에서 얻은
   아트를 여러 곳에서 렌더한다. 레지스트리는 모듈 스코프 상수를 돌려주므로 같은 key 면 항상
   동일 참조라 재마운트가 없지만, 린트는 '렌더 중 컴포넌트 생성'으로 본다.
   ⚠ 우회하려고 `A(props)` 처럼 **함수로 호출하면 안 된다** — 아트 내부 useId 가 이 컴포넌트의
   훅 순서에 섞여 폼/작물 전환 시 훅 개수가 달라진다(React 오류). 반드시 JSX 로 렌더할 것.
   (펫 아트를 PetYard 로 넘긴 뒤로는 static-components 경고가 안 떠서 disable 을 뗐다 — 다시
    뜨면 이 위치에 `eslint-disable react-hooks/static-components` 를 되살릴 것.) */

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  renameCostOf,
  type IslandState,
  type CraftSlot,
  type CraftUse,
  CROPS,
  PRODUCTS,
  DECORS,
  DECOR_SETS,
  TUNING,
  ACHIEVEMENTS,
  decorPrice,
  decorDef,
  SEASON_LABEL,
  createIsland,
  islandSummary,
  petForm,
  petStage,
  nextEvolutionOf,
  cropOf,
  cropStage,
  plotCompanions,
  COMPANIONS,
  BUFF_LABEL,
  craftCheck,
  todayOrders,
  orderReady,
  pantryAction,
  fulfillOrder,
  refreshOrders,
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
  renamePet,
  renameProposeName,
  renameAccept,
  renameCancel,
  pendingRename,
  MAX_PET_STAGE,
  coopStart,
  coopConfirm,
  decorWishKey,
  decorWishClaimable,
  claimDecorWish,
  DECOR_COMBOS,
  comboDef,
  knownCombos,
  comboHint,
  todayGuest,
  welcomeGuest,
  plant,
  waterPlot,
  waterAllDryPlots,
  harvest,
  fertilize,
  qualityPreview,
  weatherOf,
  WEATHER_LABEL,
  starOf,
  GEARS,
  GEAR_SLOTS,
  buyGear,
  equipGear,
  gearLockReason,
  heroOf,
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
  DECOR_COLS,
  ISLAND_EXPANSIONS,
  decorRowsOf,
  expandIsland,
  islandExpandLockReason,
  decorLockReason,
  produceStatus,
  collectProduce,
  goodsOf,
  PRODUCE_CAP,
  barnItem,
  rawFeedXp,
  HERO_SKILLS,
  heroSkillStatus,
  runHeroSkill,
  careStatus,
  gearDef,
  type CareKey,
  type GearSlot,
  type HeroSkill,
} from "@/lib/island";
import {
  type IslandRow,
  loadIsland,
  saveIsland,
  watchIsland,
  createIslandFor,
} from "@/lib/couple";
import { confirmDialog } from "@/lib/confirm";
import { petFx, type PetActionKind } from "@/lib/petfx";
import { vibeOf } from "@/lib/petmotion";
import { asset } from "@/lib/base";
import Icon from "@/components/Icon";
// 자체 SVG 아트 — 게임 엔티티(펫/작물/가공품/데코)는 이모지가 아니라 여기서 그린다.
import { petArt } from "@/components/island/art/pets";
import { type CropStage } from "@/components/island/art/crops";
import IslandScene from "@/components/island/IslandScene";
import PetYard from "@/components/island/PetYard";
import HeroV2 from "@/components/island/HeroV2";
import PetTapFx from "@/components/island/PetTapFx";
import PetIcon from "@/components/island/PetIcon";
import { CropIcon, ProductIcon } from "@/components/island/CropIcon";
import DecorIcon from "@/components/island/DecorIcon";
import { SheetShell } from "@/components/island/IslandSheet";
import SeedShop from "@/components/island/SeedShop";
import { BuffStrip, ItemIcon, OrderBoard, PantryView, RecipeBook } from "@/components/island/Workshop";
import { ComboBook, DecorPicker, DecorShop, ProducePanel, SetBoard } from "@/components/island/DecorPanels";
import { CareDeck, CareStyleChart, GearView, StatHud, recommendCare } from "@/components/island/PetPanels";
import { ActionIcon, GearIcon } from "@/components/island/UiIcon";
import { setPixelArt, usePixelArt } from "@/lib/pixelpref";
import CoopPlay from "@/components/island/CoopPlay";
import EvoCinematic from "@/components/island/EvoCinematic";

type Tab = "pet" | "farm" | "craft" | "decor" | "more";
const won = (v: number) => v.toLocaleString();

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold text-white ring-1 ring-white/15">
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
  /** null = 솔로 모드(로컬 섬) — 혼자서도 섬 전체가 돈다 [2026-08-12]. 저장소 갈림은
   *  couple.ts 의 loadIsland/saveIsland/watchIsland 가 전담한다. */
  coupleId: string | null;
  myUserId: string | null;
  partnerName: string;
  startDate: string | null; // 사귄 날(D-day)
  onEarnedSpent?: () => void;
  onClose: () => void;
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  /* 아직 서버에 못 보낸 로컬 상태. 화면은 항상 draft 를 먼저 본다 — 액션이 즉시 반영되는 이유. */
  const [draft, setDraft] = useState<IslandState | null>(null);
  const rowRef = useRef<IslandRow | null>(null);
  const draftRef = useRef<IslandState | null>(null);
  const flushing = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pet");
  const [now, setNow] = useState(() => Date.now());
  const [petName, setPetName] = useState("");
  const [seedFor, setSeedFor] = useState<number | null>(null); // 씨앗 시트: plotId
  const [plotFor, setPlotFor] = useState<number | null>(null); // 밭 돌보기 시트(품질 미리보기+비료): plotId
  const [craftFor, setCraftFor] = useState<number | null>(null); // 가공 시트: slotId
  // 공방 안의 네 칸 — 조리대 · 레시피 · 찬장 · 주문(2026-09-23 개편)
  const [craftView, setCraftView] = useState<"slots" | "recipes" | "pantry" | "orders">("slots");
  const [renameOpen, setRenameOpen] = useState(false); // 히어로 개명 시트(하트 소비)
  const [renameTo, setRenameTo] = useState("");
  const [feedOpen, setFeedOpen] = useState(false); // 밥주기 시트(작물/코인 선택)
  // 펫 탭 안의 세 칸 — 돌봄 · 장비 · 성장(2026-09-24 개편). 장비 칸은 한 번에 한 슬롯만 펼친다
  const [petView, setPetView] = useState<"care" | "gear" | "growth">("care");
  const [gearSlot, setGearSlot] = useState<GearSlot>("weapon");
  // 스탯 판에서 누른 스탯 → 그 스탯을 올리는 돌봄 카드를 보여 주고 반짝인다
  const [careFocus, setCareFocus] = useState<{ k: CareKey; ts: number } | null>(null);
  // 기술 결과(채집한 작물 · 모험의 보물) — 섬 화면엔 로그가 안 보여서 결과를 따로 띄운다
  const [skillToast, setSkillToast] = useState<{ k: HeroSkill; text: string; ts: number } | null>(null);
  // 함께 놀기 플레이 세션 — start=걸어두기 전 내 마음 담기 / confirm=상대 마음에 답하기
  const [coopSession, setCoopSession] = useState<null | "start" | "confirm">(null);
  // 수확 연출(★ 스탬프·금빛 축포) — 내 수확 탭에서만 로컬로 발사(상대 클라 재생 없음)
  const [harvestFx, setHarvestFx] = useState<{ id: number; plot: number; star: number; coins: number; bumper: boolean } | null>(null);
  const fxSeq = useRef(0);
  // 케어 액션 연출(씻기/밥/재우기/깨우기…) — petfx 스펙대로 PetYard 가 재생
  const [careFx, setCareFx] = useState<{ kind: PetActionKind; ts: number } | null>(null);
  /* 떠다니는 미니 펫 [사용자 리포트 2026-08-12 "안기 씻기 메뉴가 밑에 있어서 액션했을 때
     히어로가 하는 행동들을 보지 못해서 재미가 없어 — 팝업 형태로 계속 따라다니게"].
     무대가 화면 밖으로 나가면 우하단에 작은 펫이 떠서 케어 연출을 같이 재생한다.
     탭하면 무대로 스크롤. IntersectionObserver 라 스크롤 리스너 비용이 없다. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageVis, setStageVis] = useState(true);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      // 무대의 1/4 이라도 보이면 '보인다' — 팝업이 경계에서 깜빡이지 않게 여유를 둔다
      (es) => setStageVis(es[0].intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
    // ⚠ loading 이 deps 에 있어야 한다 — 첫 마운트는 로딩 화면이라 stageRef 가 null 이고,
    //   [tab] 만 보면 무대가 나타난 뒤에도 다시 안 붙어 미니 펫이 영영 안 떴다
    //   (실제 버그 2026-08-12 "히어로가 따라다니지 않아").
  }, [tab, loading]);
  // 픽셀 아트 모드 — 같은 펫을 도트로 렌더(사용자 요청: "2D 픽셀 형태로 화려하게").
  // 기본 ON. 취향이 갈릴 수 있어 토글로 남기고 선택을 로컬에 기억한다.
  const pixelMode = usePixelArt(); // 아트 스타일(기본 픽셀) — 앱 전역 공유
  // 꾸미기 안의 세 칸 — 섬 · 상점 · 세트·조합(2026-09-23 개편). 필터는 상점과 빠른 고르기가 함께 쓴다
  const [decorView, setDecorView] = useState<"island" | "shop" | "sets">("island");
  const [decorFilter, setDecorFilter] = useState<string>("all");
  const decorStageRef = useRef<HTMLDivElement | null>(null);
  const decorTabsRef = useRef<HTMLDivElement | null>(null);
  // 칸을 바꾼 뒤 보여 줄 자리 — 긴 상점 목록 아래에서 골라도 섬이, 세트판 아래에서 눌러도 칸 머리가 보이게
  const [decorScroll, setDecorScroll] = useState<{ to: "stage" | "tabs"; n: number } | null>(null);
  useEffect(() => {
    if (!decorScroll) return;
    const el = decorScroll.to === "stage" ? decorStageRef.current : decorTabsRef.current;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [decorScroll]);
  const goDecor = (view: "island" | "shop" | "sets") => {
    setDecorView(view);
    setDecorScroll((p) => ({ to: "tabs", n: (p?.n ?? 0) + 1 }));
  };
  /** 장식 고르기 — 어디서 골랐든(상점·빠른 고르기·위시) 섬 칸으로 돌아와 놓을 자리를 보여 준다. */
  const pickDecor = (key: string) => {
    setPlaceKey(key);
    setMoveId(null);
    setDecorAction(null);
    setDecorView("island");
    setDecorScroll((p) => ({ to: "stage", n: (p?.n ?? 0) + 1 }));
  };
  const [placeKey, setPlaceKey] = useState<string | null>(null); // 배치 대기 데코
  const [decorAction, setDecorAction] = useState<{ id: string; key: string } | null>(null); // 장식 탭 → 이동/치우기 칩
  const [moveId, setMoveId] = useState<string | null>(null); // 이동 중인 장식 id(픽업 상태)
  const [justPlacedAt, setJustPlacedAt] = useState<{ x: number; y: number; ts: number } | null>(null); // 배치/이동 연출 좌표
  const [setCele, setSetCele] = useState<string | null>(null); // 세트 완성 축하(set id)
  const prevSetsRef = useRef<string[] | null>(null);
  const [comboCele, setComboCele] = useState<string | null>(null); // 새 조합 발견 축하(combo id)
  const prevCombosRef = useRef<string[] | null>(null);
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


  // 로드 + 구독 — 솔로(coupleId null)면 로컬 섬, 구독은 no-op
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadIsland(coupleId)
        .then((r) => {
          if (cancelled) return;
          /* ⚠ 보낼 게 남아 있으면 갈아끼우지 않는다. 버전만 새로 받으면 우리 draft 가
             상대 변경을 조용히 덮어쓴다 — 다음 flush 가 충돌로 드러내고 재동기화하는
             편이 안전하다(낙관적 커밋 도입 전과 같은 결과). */
          if (draftRef.current) return;
          rowRef.current = r;
          setRow(r);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    const unsub = watchIsland(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  const s: IslandState | null = draft ?? row?.state ?? null;

  // 진화 대기 감지 → 축하(표시만; 실제 대상은 현재 상태에서 파생)
  useEffect(() => {
    if (s?.pet.pendingEvolve && !celebrate) setCelebrate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.pet.pendingEvolve, s?.pet.form]);

  // 상태 저장(버전 낙관적 락). 성공 true. 실패 시 최신 재조회로 동기화.
  async function pushState(version: number, next: IslandState): Promise<boolean> {
    try {
      const updated = await saveIsland(coupleId, version, next);
      rowRef.current = updated;
      if (mountedRef.current) setRow(updated);
      onEarnedSpent?.();
      return true;
    } catch {
      const fresh = await loadIsland(coupleId).catch(() => null);
      if (fresh) {
        rowRef.current = fresh;
        if (mountedRef.current) setRow(fresh);
      }
      return false;
    }
  }

  /* ── 낙관적 커밋 ────────────────────────────────────────────────
   * [사용자 리포트 2026-09-01 "지금 성능이 매우 느려 — 물주기나 비료, 사료 구매 등
   *  연속으로 구매할 때 어려움이 있어"]
   *
   * 예전 경로는 액션 하나마다 **서버 왕복을 await 하면서 busy 로 화면 전체를 잠갔다**.
   * 게다가 대기 중에 누른 탭은 `if (busy) return false` 로 **그냥 버려졌다** — 연타가
   * 되는 게 아니라 입력이 사라진 것이다. 모바일 회선에서 탭당 수백 ms 였다.
   *
   * 지금은 사냥(hunt)과 같은 방식이다 — **진행은 로컬로 굴리고 커밋은 모아서 보낸다**:
   *  · 엔진이 받아들인 액션은 draft 에 **즉시** 반영된다(화면이 곧바로 반응).
   *  · 서버 쓰기는 FLUSH_MS 동안 모았다가 한 번만 나간다(연타 10번 = 왕복 1번).
   *  · 규칙은 그대로 엔진이 소유한다 — 쿨다운·코인 부족이면 같은 참조를 돌려주고
   *    draft 에 안 들어간다(공짜 액션이 생기지 않는다).
   * ⚠ draft 가 남아 있는 동안에는 구독(상대 변경)으로 row 를 갈아끼우지 **않는다**.
   *   버전만 새로 받으면 우리 draft 가 상대 변경을 조용히 덮어쓴다 — 충돌로 드러나서
   *   재동기화되는 편이 낫다(예전 동작과 같은 안전).
   * ⚠ 화면을 떠날 때 반드시 flush 한다. 안 그러면 마지막 몇 초가 사라진다. */
  const FLUSH_MS = 450;


  /* ⚠ scheduleFlush 는 **flush 를 직접 참조하지 않는다**. 서로를 부르면(flush 가 남은
     draft 를 다시 예약하고, 예약이 flush 를 부른다) 순환이 생겨 컴파일러가 메모이제이션을
     보존하지 못한다. 타이머는 ref 를 거쳐 최신 flush 를 부르고, 이 함수는 deps 가 비어
     **항상 같은 참조**로 남는다. */
  const scheduleFlush = useCallback(() => {
    if (flushTimer.current != null) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      void flushRef.current?.();
    }, FLUSH_MS);
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return;
    const next = draftRef.current;
    const cur = rowRef.current;
    if (!next || !cur) return;
    flushing.current = true;
    const ok = await pushState(cur.version, next);
    flushing.current = false;
    if (ok) {
      // flush 중 더 눌렀으면 draft 가 이미 갱신됐다 — 그건 다음 flush 가 가져간다.
      if (draftRef.current === next) {
        draftRef.current = null;
        if (mountedRef.current) setDraft(null);
      } else {
        scheduleFlush();
      }
    } else {
      draftRef.current = null;
      if (mountedRef.current) {
        setDraft(null);
        setErr("상대가 방금 뭔가 했어요, 최신으로 맞췄으니 다시 눌러요.");
      }
    }
    /* pushState 는 컴포넌트 안 함수 선언이라 매 렌더 새 참조다 — deps 에 넣으면 flush 가
       매 렌더 새로 만들어져 예약이 계속 깨진다. 안에서 쓰는 값(coupleId)만 deps 에 둔다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, scheduleFlush]);

  // 타이머가 부를 최신 flush — 위 순환을 끊는 유일한 연결점.
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** 로컬 반영 + 지연 커밋 예약. 엔진이 이미 검증했으므로 여기서는 항상 성공이다. */
  const commit = useCallback(
    (next: IslandState): Promise<boolean> => {
      if (!rowRef.current) return Promise.resolve(false);
      draftRef.current = next;
      setDraft(next);
      setErr(null);
      scheduleFlush();
      return Promise.resolve(true);
    },
    [scheduleFlush],
  );

  // no-op(엔진이 원본 참조 그대로 반환)이면 커밋 안 함 → 헛된 버전 증가/거짓 충돌 방지. [리뷰 fix]
  const act = (fn: (s: IslandState) => IslandState): Promise<boolean> => {
    const cur = draftRef.current ?? rowRef.current?.state ?? null;
    if (!cur) return Promise.resolve(false);
    const next = fn(cur);
    if (next === cur) return Promise.resolve(false);
    return commit(next);
  };

  /* 못 보낸 draft 를 반드시 내보낸다 — 화면을 떠날 때·앱이 백그라운드로 갈 때.
     ⚠ 이게 없으면 마지막 FLUSH_MS 안의 액션이 통째로 사라진다(연타 끝에 바로 나가는 게
       가장 흔한 사용 패턴이라 실제로 잘 잃는다). unmount 정리는 아래 flush 훅에서. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && draftRef.current) {
        if (flushTimer.current != null) {
          clearTimeout(flushTimer.current);
          flushTimer.current = null;
        }
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (flushTimer.current != null) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      if (draftRef.current) void flush(); // 언마운트 — mountedRef 는 false 라 setState 는 안 탄다
    };
  }, [flush]);
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
    setTimeout(() => {
      if (mountedRef.current) setCareFx((f) => (f?.ts === ts ? null : f));
    }, petFx(kind).ms + 250);
  }

  // 배치/이동 연출 발사 — 씬이 해당 칸을 팝 바운스 + 스파클 + 펫 환호로 반긴다.
  // ts 는 이벤트 경계에서 확정해 주입(react-hooks/purity).
  // 기술 결과 토스트 — 엔진 로그 한 줄(펫 이모지 떼고)을 3.2초. ts 는 이벤트 경계에서 주입.
  function fireSkillToast(k: HeroSkill, line: string, ts: number) {
    setSkillToast({ k, text: line.replace(/^\S+\s/, ""), ts });
    setTimeout(() => {
      if (mountedRef.current) setSkillToast((t) => (t?.ts === ts ? null : t));
    }, 3200);
  }
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

  // 새 조합 발견 감지 → 축하. 세트와 같은 방식(catalog diff)이라 **상대가 붙여도 같이 축하**한다.
  useEffect(() => {
    const found = s?.catalog.filter((k) => k.startsWith("combo_")) ?? null;
    if (!found) return;
    const prev = prevCombosRef.current;
    prevCombosRef.current = found;
    if (prev && found.length > prev.length) {
      const added = found.find((k) => !prev.includes(k))?.slice("combo_".length);
      if (added) {
        setComboCele(added);
        setTimeout(() => {
          if (mountedRef.current) setComboCele((c) => (c === added ? null : c));
        }, 3000);
      }
    }

  }, [s?.catalog]);

  // 방문(조용) — 실패(버전 충돌) 시 최신 상태에 1회 재적용. claimVisit 은 멱등이라 이중 지급 없음.
  // nowMs 는 호출부(effect)에서 확정해 주입(react-hooks/purity). claimVisit 은 멱등이라 재시도에 같은 값 사용.
  async function doVisit(nowMs: number): Promise<void> {
    if (!myUserId || !row) return;
    const ok = await pushState(row.version, claimVisit(row.state, myUserId, nowMs, startDate));
    if (!ok) {
      const fresh = await loadIsland(coupleId).catch(() => null);
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

  // 주문 칸을 열었는데 오늘 주문이 없으면 채운다(자정을 넘겨 열어 둔 경우 · 방문 처리가 건너뛴 경우).
  // 오늘 날짜가 바뀔 때만 다시 본다 — 채우고 나면 조건이 거짓이라 반복하지 않는다.
  const ordersDay = row?.state.orders?.day ?? null;
  useEffect(() => {
    if (tab !== "craft" || craftView !== "orders" || !row) return;
    if (todayOrders(row.state, Date.now()).length > 0) return;
    act((x) => refreshOrders(x, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, craftView, ordersDay]);

  async function startGame() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const init = createIsland(petName.trim() || "우리 펫", startDate, Date.now());
      const created = await createIslandFor(coupleId, init);
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
      className="island-shell fixed inset-y-0 inset-x-0 z-[75] mx-auto flex w-full max-w-[430px] flex-col text-white"
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
          {coupleId ? "둘이 함께 가꾸는 섬이에요. " : "혼자 시작해도 돼요. "}
          알을 정성껏 돌보면 <b className="text-white">다양한 모습으로 진화</b>하고, 정원을 키우고 섬을
          꾸미며 <b className="text-white">유대</b>를 쌓아가요.
          {!coupleId && " 나중에 커플을 연동하면 이 섬이 그대로 우리 섬이 돼요."}
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
          className="tap mt-4 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-[var(--ink-on-light)] shadow-[var(--shadow-md)] disabled:opacity-50"
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
  const stage = petStage(s.pet.form);
  const weather = weatherOf(s, now); // 오늘의 섬 날씨(결정적 — 둘이 같은 하늘)
  // 지금 창고·스킬로 만들 수 있는 가공품 수 — 공방 탭 배지(탭을 열 이유)
  // 재료는 창고(작물)·찬장(제품) 둘 다에서 — 판정은 엔진(craftCheck) 하나로(화면이 따로 세면 어긋난다)
  const craftable = PRODUCTS.filter((p) => craftCheck(s, p).ok).length;
  const ordersReady = todayOrders(s, now).filter((o) => orderReady(s, o)).length;
  const slotsReady = s.farm.craft.filter((c) => craftReady(c, now)).length;

  // ⚠ 아트는 반드시 JSX 엘리먼트로 렌더(A(props) 함수 호출 금지 — 아트 내부 useId 가
  //   부모 훅 순서에 섞여 폼 전환 시 훅 개수가 달라진다).
  const PetArt = petArt(s.pet.form);
  // 탭 아이콘은 **엘리먼트**로 들고 있는다 — 픽셀(캔버스)/일러스트(SVG)가 섞이므로
  // ArtFC 참조로는 표현할 수 없다.
  const TABS: { k: Tab; label: string; icon: ReactNode }[] = [
    { k: "pet", label: "펫", icon: <PetIcon form={s.pet.form} size={22} face active={false} /> },
    { k: "farm", label: "정원", icon: <CropIcon cropKey="carrot" stage={3} size={22} /> },
    // 배지 = 지금 할 일(완성된 조리대 + 건넬 수 있는 주문), 없으면 만들 수 있는 요리 수
    {
      k: "craft",
      label: slotsReady + ordersReady > 0 ? `공방 ${slotsReady + ordersReady}` : craftable > 0 ? `공방 ${craftable}` : "공방",
      icon: <ProductIcon productKey="jam" size={22} />,
    },
    { k: "decor", label: "꾸미기", icon: <DecorIcon decorKey="tulip" size={22} /> },
    // 픽셀 탭 사이 OS 이모지 하나만 벡터 그림이라 이질적이었다 → 픽셀 아이콘으로 통일 [리뷰]
    { k: "more", label: "모아보기", icon: <Icon name="book" size={22} /> },
  ];

  return shell(
    <>
      {/* 헤더 */}
      <header className="island-command px-4 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="island-kicker">OUR ISLAND</p>
            <h1 className="text-base font-black">우리 섬</h1>
          </div>
          <button onClick={onClose} aria-label="닫기" className="tap island-close grid h-9 w-9 place-items-center">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="island-wallet mt-2 flex items-center gap-1.5">
            <Pill>💗 {won(s.coins)}</Pill>
            <Pill>
              {sum.ratingTier.emoji} {won(sum.rating)}
            </Pill>
            <Pill>💞 {s.bond.level}</Pill>
        </div>
        {/* 섬 레벨 바 + 계절 */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-bold text-white/70">섬 Lv.{s.level}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (s.xp / sum.xpNext) * 100)}%` }} />
          </div>
          <span className="text-sm text-white/60">{SEASON_LABEL[sum.season]}</span>
        </div>
      </header>

      {/* 탭 */}
      <nav className="island-tabs flex gap-1 px-3" aria-label="우리 섬 메뉴">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            aria-pressed={tab === t.k}
            className={`tap island-tab flex-1 py-1.5 text-sm font-bold ${
              tab === t.k ? "is-active" : ""
            }`}
          >
            <span className="mx-auto grid h-6 w-6 place-items-center">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {err && <p className="px-4 pt-1 text-center text-sm text-rose-300">{err}</p>}

      <div className="island-scroll flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {/* ── 펫 ── 무대 + 스탯 판(늘 보인다) · 돌봄 · 장비 · 성장(island/PetPanels) [2026-09-24 개편]
            예전엔 한 장의 카드(무대 · 스탯 · 장비 15칩 · 진화)가 968px 이라 케어 데크가 두 화면 아래에 있었고,
            CSS flex order 로 순서를 섞어 둬서 DOM 과 화면 순서도 달랐다. 지금은 DOM 순서가 곧 화면 순서다. */}
        {tab === "pet" && (
          <div className="island-view island-pet-view space-y-3">
            <div className="pet-stage">
              {/* ⚠ ref 는 **무대에만** — 스탯 판까지 재면 무대가 안 보여도 판이 보인다는 이유로 미니 펫이 안 뜬다. */}
              <div ref={stageRef} className="relative">
                {/* 픽셀 무대는 **PixelPet 그대로** 둔다(2026-08-04 오판 정정: 사용자 "픽셀로 맞춰달라는건데").
                    반응은 PetTapFx 로만 얹는다 — 스펙(tapReaction)이 홈과 같은 소스다. */}
                {pixelMode ? (
                  <div className="island-village-frame">
                    <span
                      className="island-village-art pet-stage-art"
                      style={{ backgroundImage: `url(${asset("/island/village-autumn-v1.png")})` }}
                    >
                      <span className="island-village-pet">
                        <PetTapFx
                          vibe={vibeOf(sum.pet.stats, s.pet.sick)}
                          onTap={() => {
                            if (isAsleep(s, now)) {
                              act((st) => wakePet(st, Date.now())).then((ok) => {
                                if (ok) fireCareFx("wake", Date.now());
                              });
                              return;
                            }
                            act((st) => petPet(st, Date.now()));
                          }}
                        >
                          <HeroV2
                            form={s.pet.form}
                            size={116}
                            asleep={isAsleep(s, now)}
                            active
                            title={s.pet.name}
                          />
                        </PetTapFx>
                      </span>
                    </span>
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
                {/* 이름표 — 이름 · 모습 · 레벨 · 기분. 연필 = 이름 바꾸기(하트 소비) */}
                <div className="pet-nameplate">
                  <p className="flex items-center gap-1 text-sm font-black">
                    <span className="truncate">{s.pet.name}</span>
                    <button
                      onClick={() => { setRenameTo(s.pet.name); setRenameOpen(true); }}
                      aria-label="히어로 이름 바꾸기"
                      className="tap shrink-0 rounded px-1 text-xs text-white/70"
                    >
                      ✏️
                    </button>
                  </p>
                  <p className="truncate text-xs text-white/75">
                    {pf.name} · Lv.{sum.pet.level} {sum.pet.mood}
                  </p>
                </div>
                {/* 모드 전환 — 전역 설정이라 홈·쿡찌르기·게임 카드의 펫도 같이 바뀐다 */}
                <button onClick={() => setPixelArt(!pixelMode)} className="tap pet-art-toggle">
                  {pixelMode ? "일러스트" : "픽셀"}
                </button>
                {/* 낀 장비 세 칸 — 누르면 장비 칸으로. 히어로 그림이 장비를 그리지 않으니 여기서 보여 준다 */}
                <button onClick={() => setPetView("gear")} className="tap pet-gear-strip" aria-label="낀 장비 보기">
                  {GEAR_SLOTS.map((sl) => {
                    const k = heroOf(s).equip[sl];
                    return (
                      <span key={sl} className={`pet-gear-pip ${k ? "" : "is-empty"}`}>
                        {k ? (
                          <GearIcon k={k} size={24} title={gearDef(k)?.name} />
                        ) : (
                          // 빈 칸 — 그 칸 첫 장비의 흐린 실루엣(글자 한 자 '망'은 뭔지 안 읽혔다)
                          <span className="pet-gear-ghost" aria-hidden>
                            <GearIcon k={GEARS.find((g) => g.slot === sl)!.key} size={24} />
                          </span>
                        )}
                      </span>
                    );
                  })}
                </button>
                {s.pet.pendingEvolve ? (
                  <button onClick={() => setCelebrate(true)} className="tap pet-evolve-cta animate-pop">
                    ✨ 진화할 수 있어요! 보러 가기
                  </button>
                ) : isAsleep(s, now) ? (
                  <span className="pet-status-chip">💤 자는 중 · 탭하면 깨워요</span>
                ) : pixelMode && pettingCoinsNext(s, now) > 0 ? (
                  <span className="pet-status-chip">탭해서 쓰다듬기 +{pettingCoinsNext(s, now)}💗</span>
                ) : null}
              </div>
              <StatHud
                stats={sum.pet.stats}
                onPick={(k) => {
                  setPetView("care");
                  setCareFocus({ k, ts: Date.now() });
                }}
              />
            </div>

            {/* 아파요 — 모든 칸 위에(회복이 절반으로 느려진다는 걸 어느 칸에 있든 알게) */}
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

            {/* 개명 제안 대기 — 상대의 동의가 필요한 일이라 칸과 상관없이 보이게.
                ⚠ 답이 '동의' 뿐이면 그건 동의가 아니다 → 양쪽 다 물릴 수 있게 둔다. */}
            {(() => {
              const pr = pendingRename(s, now);
              if (!pr) return null;
              const mine = pr.by === myUserId;
              return (
                <div className="rounded-xl bg-sky-400/10 p-2.5 text-left ring-1 ring-sky-300/25">
                  <p className="text-xs font-bold text-sky-200">
                    {mine
                      ? `✏️ "${pr.name}" 로 제안했어요 — ${partnerName}의 동의를 기다리는 중`
                      : `✏️ ${partnerName}가 "${pr.name}" 로 바꾸자고 해요`}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {!mine && (
                      <button
                        disabled={s.coins < renameCostOf(s)}
                        onClick={() => myUserId && act((x) => renameAccept(x, myUserId, Date.now()))}
                        className="tap flex-1 rounded-lg bg-sky-300 py-1.5 text-xs font-extrabold text-ink disabled:opacity-40"
                      >
                        동의 ({renameCostOf(s) ? `${renameCostOf(s)}💗` : "무료"})
                      </button>
                    )}
                    <button
                      onClick={() => act((x) => renameCancel(x))}
                      className="tap flex-1 rounded-lg bg-white/10 py-1.5 text-xs font-bold text-white/75"
                    >
                      {mine ? "제안 물리기" : "거절"}
                    </button>
                  </div>
                  {!mine && s.coins < renameCostOf(s) && <p className="mt-1 text-xs font-bold text-rose-300">하트가 모자라요</p>}
                </div>
              );
            })()}

            {(() => {
              const reco = recommendCare(sum.pet.stats, s.pet.sick);
              const skillsReady = HERO_SKILLS.filter((d) => heroSkillStatus(s, d.key, now).ok).length;
              const careN = (reco && careStatus(s, reco, now).ok ? 1 : 0) + skillsReady;
              const gearN = GEARS.filter((g) => !heroOf(s).owned.includes(g.key) && gearLockReason(s, g.key, now) === null).length;
              return (
                <div role="tablist" aria-label="펫 메뉴" className="grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-white/10">
                  {([
                    { k: "care", label: "돌봄", n: careN },
                    { k: "gear", label: "장비", n: gearN },
                    { k: "growth", label: "성장", n: s.pet.pendingEvolve ? 1 : 0 },
                  ] as const).map((t) => (
                    <button
                      key={t.k}
                      role="tab"
                      aria-selected={petView === t.k}
                      onClick={() => setPetView(t.k)}
                      className={`tap relative rounded-lg py-2 text-xs font-extrabold ${petView === t.k ? "bg-amber-300 text-[var(--ink-on-light)]" : "text-white/70"}`}
                    >
                      {t.label}
                      {t.n > 0 && (
                        <span className="absolute -right-0.5 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-emerald-400 px-1 text-xs font-black leading-none text-[var(--ink-on-light)]">
                          {t.n}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}

            {petView === "care" && (
              <>
                <CareDeck
                  s={s}
                  now={now}
                  stats={sum.pet.stats}
                  busy={busy}
                  focus={careFocus}
                  onCare={(k) => {
                    if (k === "feed") {
                      setFeedOpen(true); // 밥은 작물(무료)·코인 중에서 고른다
                      return;
                    }
                    const fn = { play: playPet, clean: cleanPet, hug: hugPet, rest: restPet, medicine: medicinePet }[k];
                    const nowMs = Date.now();
                    act((st) => fn(st, nowMs)).then((ok) => {
                      if (ok) fireCareFx(k as PetActionKind, nowMs);
                    });
                  }}
                  onSkill={(k) => {
                    const nowMs = Date.now();
                    let line = "";
                    act((st) => {
                      const n = runHeroSkill(st, k, nowMs);
                      if (n !== st) line = n.log[0] ?? "";
                      return n;
                    }).then((ok) => {
                      if (ok) fireSkillToast(k, line, nowMs);
                    });
                  }}
                  onLocked={(slot) => {
                    setGearSlot(slot);
                    setPetView("gear");
                  }}
                />
                {/* 함께 놀기 — 탭 한 번이 아니라 15초 플레이 세션(둘의 점수 합산 → 유대 보너스).
                    솔로에선 통째로 숨긴다 — 답할 상대가 없는 버튼은 문 없는 문이다. */}
                {!coupleId ? null : s.pending.some((p) => p.type === "coop" && p.by !== myUserId) ? (
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
              </>
            )}

            {petView === "gear" && (
              <GearView
                s={s}
                now={now}
                busy={busy}
                slot={gearSlot}
                onSlot={setGearSlot}
                onBuy={(key) => act((x) => buyGear(x, key, Date.now()))}
                onEquip={(key, slot) => act((x) => equipGear(x, key, slot))}
              />
            )}

            {petView === "growth" && (
              <div className="space-y-3">
                {/* 다음 진화 미리보기 — 블랙박스였던 진화를 목표로(2026-07-27 UX) */}
                {(() => {
                  const ev = evolutionPreview(s);
                  /* 사다리 끝 — 끝에 닿은 사람에게 아무 말도 안 하면 기능이 사라진 것처럼 보인다
                     [사용자 리포트 2026-09-01 "다음 진화까지 몇 레벨 남았어 라는 문구가 없어진 것 같은데"]. */
                  if (ev.needLevel == null && !ev.target) {
                    return (
                      <div className="island-panel p-3">
                        <p className="text-sm font-bold text-amber-200">🏔️ 진화의 끝에 닿았어요</p>
                        <p className="mt-0.5 text-xs text-white/60">더 자랄 곳이 없어요. 박물관에 보내면 새 알로 다시 시작할 수 있어요.</p>
                      </div>
                    );
                  }
                  if (ev.needLevel == null || !ev.target) return null;
                  const tf = petForm(ev.target);
                  const seen = s.catalog.includes(ev.target);
                  return (
                    <section className="island-panel p-3" aria-label="다음 진화">
                      <p className="island-section-kicker">EVOLUTION</p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/30 ring-1 ring-white/15">
                          <span style={seen ? undefined : { filter: "brightness(0) opacity(0.55)" }}>
                            <PetIcon form={ev.target} size={48} face active={false} />
                          </span>
                          {!seen && <span className="absolute text-base font-black text-white/85">?</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white/85">
                            다음 진화 · <span className="text-amber-200">{seen ? tf.name : "???"}</span>
                          </p>
                          <p className="text-xs text-white/55">
                            {/* ⚠ 분모를 손으로 적지 않는다 — 신화형이 붙은 뒤 "스테이지 5/4" 가 떴다 */}
                            스테이지 {stage}/{MAX_PET_STAGE} · Lv.{ev.level}/{ev.needLevel} · 정성 {Math.round(s.pet.cq)}
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-300" style={{ width: `${ev.pct}%`, transition: "width .5s" }} />
                          </div>
                        </div>
                      </div>
                      {ev.hint && <p className="mt-2 text-xs text-sky-200/90">💡 {ev.hint}</p>}
                      {s.pet.pendingEvolve && (
                        <button onClick={() => setCelebrate(true)} className="tap mt-3 w-full animate-pop rounded-xl bg-amber-300 py-2.5 text-sm font-extrabold text-ink">
                          ✨ 진화할 수 있어요! 확인하기
                        </button>
                      )}
                      <button onClick={() => setTab("more")} className="tap mt-2 w-full rounded-lg bg-white/[0.07] py-2 text-xs font-bold text-white/75">
                        진화 계보 · 도감 보기 →
                      </button>
                    </section>
                  );
                })()}
                {stage <= 1 && <CareStyleChart s={s} />}

                {/* 다음 목표 — 업적·세트·진화가 '언젠가'가 아니라 '지금 뭘 하면 되는지'로 보이게 */}
                {(() => {
                  const goals = nextGoals(s, now);
                  if (goals.length === 0) return null;
                  return (
                    <div className="island-panel island-goals space-y-1.5 p-3">
                      <p className="island-section-kicker">NEXT QUEST</p>
                      <p className="text-sm font-bold text-white/85">다음 목표</p>
                      {goals.map((g) => (
                        <button key={g.key} onClick={() => setTab(g.tab)} className="tap flex w-full items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2 text-left">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white/90">{g.label}</p>
                            <p className="truncate text-xs text-white/50">{g.hint}</p>
                            {g.pct < 100 && (
                              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                                <span className="block h-full rounded-full bg-amber-300" style={{ width: `${g.pct}%` }} />
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-white/40">→</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* ⚠ `>= 4` 다 — 엔진(retirePet)이 stage 4 이상이면 은퇴를 허용한다. UI 만 `=== 4` 라
                    신화형은 은퇴 버튼이 아예 안 떴던 사고(2026-09-01). 게이트는 엔진과 같은 조건. */}
                {stage >= 4 && (
                  <button
                    onClick={async () => {
                      const name = "새 친구";
                      if (await confirmDialog({ message: `${pf.name}를 박물관에 보내고 새 알을 시작할까요?`, detail: "지금까지의 진화형은 박물관에 남아요. 새 알의 첫 이름은 무료로 지을 수 있어요.", confirmText: "새 알" }))
                        act((st) => retirePet(st, name, Date.now()));
                    }}
                    className="tap w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80"
                  >
                    🏛️ 박물관에 보내고 새 알 시작
                  </button>
                )}
              </div>
            )}

            {/* 떠다니는 미니 펫 — 무대가 화면 밖이면 우하단에 펫이 따라온다
                [사용자 리포트 2026-08-12 "액션했을 때 히어로가 하는 행동들을 보지 못해서 재미가 없어 — 팝업 형태로 계속 따라다니게"].
                케어 연출(careFx)을 같은 스펙(petFx)으로 축소 재생 — 탭하면 무대로 스크롤.
                ⚠ 'tap fixed' 가 2026-09-08 ~ 09-24 동안 relative 로 떨어져 있었다(.tap 규칙이 레이어 밖이었다).
                ⚠ 돌봄 칸에서만 띄운다 — 제 역할(케어 연출 재생)이 거기 있고, 장비·성장 칸에선 오른쪽의
                  사기·끼기 버튼을 가렸다(떠다니게 고치자마자 드러난 겹침). */}
            {!stageVis && petView === "care" && (
              <button
                onClick={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                aria-label="펫에게 돌아가기"
                className="tap fixed right-3 z-40 overflow-visible"
                style={{ bottom: "calc(var(--vv-bottom, 0px) + 92px)" }}
              >
                <span className="relative block rounded-2xl bg-[#181a2c] p-1.5 shadow-[var(--shadow-lg)] ring-2 ring-white/25">
                  <PetIcon form={s.pet.form} size={52} active asleep={isAsleep(s, now)} title={s.pet.name} />
                  {careFx && (
                    <span key={careFx.ts} aria-hidden className="pointer-events-none absolute inset-0">
                      {petFx(careFx.kind).props.map((f, i) => (
                        <span
                          key={i}
                          className={`animate-${f.anim} absolute left-1/2 top-1/2 text-sm`}
                          style={{
                            marginLeft: f.x / 2,
                            marginTop: f.y / 2,
                            animationDelay: f.delay ? `${f.delay}ms` : undefined,
                          }}
                        >
                          {f.emoji}
                        </span>
                      ))}
                    </span>
                  )}
                  {s.pet.pendingEvolve && <span className="absolute -right-1 -top-1 text-sm">✨</span>}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── 정원 ── */}
        {tab === "farm" && (
          <div className="island-view island-farm-view space-y-3">
            <div className="island-view-intro flex items-center justify-between">
              <div><p className="island-section-kicker">GARDEN</p><h2 className="text-base font-black">오늘의 정원</h2><p className="text-xs text-white/55">농사 Lv.{sum.skill} · {SEASON_LABEL[sum.season]} 제철 작물이 잘 자라요</p></div>
              <span>{s.farm.plots.length}칸</span>
            </div>
            {/* 켜진 요리 효과(품질·풍년·판매 …) — 정원에서 바로 보이게 */}
            <BuffStrip s={s} now={now} />
            {/* 오늘의 날씨(결정적 — 둘이 같은 하늘) */}
            {WEATHER_LABEL[weather] && (
              <div className="rounded-xl bg-sky-400/10 px-3 py-2 text-sm font-bold text-sky-100 ring-1 ring-sky-300/25">
                {WEATHER_LABEL[weather]}
              </div>
            )}
            {(() => {
              const planted = s.farm.plots.filter((p) => p.crop).length;
              const ready = s.farm.plots.filter((p) => p.crop && cropStage(s, p, now).ripe).length;
              const dry = s.farm.sprinkler ? 0 : s.farm.plots.filter((p) => p.crop && (p.wateredAt == null || now - p.wateredAt >= 86400000)).length;
              return (
                <div className="garden-status-strip" aria-label="정원 현황">
                  <span><b>{planted}</b><small>재배 중</small></span>
                  <span className={ready ? "is-ready" : ""}><b>{ready}</b><small>수확 가능</small></span>
                  <span className={dry ? "is-dry" : ""}><b>{dry}</b><small>물 필요</small></span>
                  <button
                    disabled={busy || dry === 0}
                    onClick={() => act((x) => waterAllDryPlots(x, Date.now()))}
                    className="tap"
                  >
                    💦 모두 물주기
                  </button>
                </div>
              );
            })()}
            <div className="island-panel relative p-2">
              <div className="island-farm-grid grid grid-cols-4 gap-2">
                {s.farm.plots.map((plot, i) => {
                  const st = cropStage(s, plot, now);
                  const c = plot.crop ? cropOf(plot.crop) : null;
                  const stack = plot.fertStack ?? 0;
                  // 밭 궁합 — 옆 칸과 짝이 맞으면 초록 테두리 + 🤝 (배치가 결과를 바꾼다는 게 보이게)
                  const comps = plot.crop ? plotCompanions(s, i, now) : [];
                  // 다시 열리는 작물이 두 번째 열매를 기다리는 중 — 씨앗부터 다시 그리면 나무가 사라진 것처럼 보인다
                  const regrowing = !!c?.regrow && (plot.cycle ?? 0) > 0;
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
                      className={`tap relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl ${
                        comps.length ? "ring-2 ring-emerald-300/70" : "ring-1 ring-amber-900/40"
                      }`}
                      aria-label={
                        c
                          ? `${c.name} ${st.ripe ? "수확 가능" : `자라는 중 ${Math.round(st.progress * 100)}%`}${comps.length ? `, 궁합 ${comps.map((cp) => cp.name).join("·")}` : ""}`
                          : "빈 밭, 씨앗 심기"
                      }
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
                          <span className="animate-lucky-twinkle pointer-events-none absolute left-1 top-1 text-xs">✨</span>
                          <span className="animate-lucky-twinkle pointer-events-none absolute bottom-2 right-1 text-xs" style={{ animationDelay: "0.7s" }}>✨</span>
                        </>
                      )}
                      {!plot.crop ? (
                        <>
                          <span className="text-lg text-white/30">＋</span>
                          {stack > 0 && <span className="text-xs font-bold text-amber-300/80">거름 {stack}</span>}
                        </>
                      ) : st.ripe ? (
                        <>
                          <span className="animate-pop">
                            <CropIcon cropKey={plot.crop!} stage={3} size={44} title={c!.name} />
                          </span>
                          <span className="text-xs font-bold text-emerald-300">수확!</span>
                        </>
                      ) : (
                        <>
                          {(() => {
                            // 진행도 → 성장 단계(0 씨앗 / 1 새싹 / 2 자람). 수확 가능은 위 분기.
                            const stage: CropStage = regrowing ? 2 : st.progress < 0.25 ? 0 : st.progress < 0.7 ? 1 : 2;
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
                                  <CropIcon cropKey={plot.crop!} stage={stage} size={40} title={c!.name} />
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
                            <span className="absolute right-0.5 top-0.5 text-xs">💧</span>
                          )}
                        </>
                      )}
                      {/* 궁합 🤝 (우하단, 진행 막대 위) · 다시 열림 횟수(좌하단) */}
                      {comps.length > 0 && (
                        <span className="pointer-events-none absolute bottom-2 right-1 text-xs" aria-hidden>🤝</span>
                      )}
                      {c?.regrow && (
                        <span className="pointer-events-none absolute bottom-2 left-1 rounded bg-black/40 px-0.5 text-xs font-bold leading-none text-sky-200" aria-hidden>
                          {(plot.cycle ?? 0) + 1}/{1 + c.regrow.times}
                        </span>
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
                          <span className="animate-pet-coin absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-1.5 text-xs font-black text-ink">
                            +{harvestFx.coins}💗
                          </span>
                          {harvestFx.bumper && (
                            <span className="animate-pop absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-400 px-1.5 text-xs font-black text-ink">
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
                  <span className="block text-xs font-normal text-emerald-200/75">
                    연속 수확 콤보 최대 x{pv.maxCombo.toFixed(2)} · 확률로 🌾풍년(2배)
                  </span>
                </button>
              );
            })()}
            <p className="text-center text-xs text-white/40">빈 칸=씨앗 가게 · 자라는 중=돌보기(물·비료·품질) · 다 자람=수확 · 🤝=궁합</p>

            {/* 밭 궁합 도감 — 어떤 짝이 있고 무엇을 거둬 봤는지. 씨앗 가게가 짝을 알려 주므로 이름을 숨기지 않는다. */}
            {(() => {
              const got = COMPANIONS.filter((cp) => s.catalog.includes(`comp_${cp.id}`)).length;
              return (
                <details className="island-panel group p-3">
                  <summary className="tap flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="island-section-kicker block">COMPANIONS</span>
                      <span className="text-sm font-bold text-white/85">🤝 밭 궁합 {got}/{COMPANIONS.length}</span>
                    </span>
                    <Icon name="chevronDown" size={12} className="text-white/50 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-xs text-white/50">
                    가로·세로로 맞닿게 심으면 두 칸 모두 수확 품질이 올라요(한 칸 최대 +{TUNING.farm.companionCap}). 먼저 하나를 거둬도 12시간은 짝으로 쳐 줘요.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {COMPANIONS.map((cp) => {
                      const done = s.catalog.includes(`comp_${cp.id}`);
                      return (
                        <div
                          key={cp.id}
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ${done ? "bg-emerald-400/15 ring-1 ring-emerald-300/35" : "bg-white/[0.05]"}`}
                        >
                          <span className="flex shrink-0 items-center -space-x-1">
                            <CropIcon cropKey={cp.a} stage={3} size={16} />
                            <CropIcon cropKey={cp.b} stage={3} size={16} />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-bold">{cp.name}</span>
                          <span className={done ? "text-emerald-300" : "text-white/45"}>+{cp.bonus}</span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })()}

            {/* 농기구 · 밭 넓히기 */}
            <p className="island-section-kicker -mb-1 px-1">TOOLS</p>
            <div className="island-panel grid grid-cols-2 gap-2 p-3">
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
                <span className="block text-xs font-normal text-yellow-100/70">품질 +{TUNING.farm.quality.fertGold} · ★5 해금</span>
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

        {/* ── 공방 ── 조리대 · 레시피 · 찬장 · 주문(island/Workshop) */}
        {tab === "craft" && (
          <div className="island-view island-craft-view space-y-3">
            <div className="island-view-intro">
              <p className="island-section-kicker">WORKSHOP</p>
              <h2 className="text-base font-black">오늘의 공방</h2>
              <p className="text-xs text-white/55">농사 Lv.{sum.skill} · 거둔 재료로 요리하고, 보관하고, 손님 주문을 채워요</p>
            </div>
            <BuffStrip s={s} now={now} />
            {/* 네 칸 — 각 칸에 할 일 수를 붙여 '어디를 열어야 하는지'가 보이게 */}
            <div role="tablist" aria-label="공방 메뉴" className="grid grid-cols-4 gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-white/10">
              {([
                { k: "slots", label: "조리대", n: slotsReady },
                { k: "recipes", label: "레시피", n: craftable },
                { k: "pantry", label: "찬장", n: 0 },
                { k: "orders", label: "주문", n: ordersReady },
              ] as const).map((t) => (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={craftView === t.k}
                  onClick={() => setCraftView(t.k)}
                  className={`tap relative rounded-lg py-2 text-xs font-extrabold ${craftView === t.k ? "bg-amber-300 text-[var(--ink-on-light)]" : "text-white/70"}`}
                >
                  {t.label}
                  {t.n > 0 && (
                    <span className="absolute -right-0.5 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-emerald-400 px-1 text-xs font-black leading-none text-[var(--ink-on-light)]">
                      {t.n}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {craftView === "slots" && (
              <>
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
                <p className="text-center text-xs text-white/40">
                  조리대는 농사 Lv.8·14 에 늘어나요 · 완성된 요리는 “보관”해 두면 주문·단계 요리에 써요
                </p>
              </>
            )}
            {craftView === "recipes" && (
              <RecipeBook
                s={s}
                busy={busy}
                onCook={(key) => {
                  const slot = s.farm.craft.findIndex((c) => !c.product);
                  if (slot < 0) return;
                  act((x) => startCraft(x, slot, key, Date.now())).then((ok) => {
                    if (ok) setCraftView("slots");
                  });
                }}
              />
            )}
            {craftView === "pantry" && (
              <PantryView s={s} busy={busy} onUse={(key, use) => act((x) => pantryAction(x, key, use, Date.now()))} />
            )}
            {craftView === "orders" && (
              <OrderBoard s={s} now={now} busy={busy} onFulfill={(id) => act((x) => fulfillOrder(x, id, Date.now()))} />
            )}
          </div>
        )}

        {/* ── 꾸미기 ── 섬 · 상점 · 세트·조합(island/DecorPanels) [2026-09-23 개편]
            예전엔 장식 가로 줄 + 상점 시트 + 도감이 한 화면에 쌓였고, 장식을 누르면 뜨는 이동/치우기 칩이
            보관함·섬 넓히기 **아래**에 떠서 누른 자리와 멀었다. 지금은 섬 바로 밑 한 줄이 상황(배치·이동·선택)을 맡는다. */}
        {tab === "decor" && (
          <div className="island-view island-decor-view space-y-3">
            <div className="island-view-intro">
              <p className="island-section-kicker">DECORATE</p>
              <h2 className="text-base font-black">나만의 섬 꾸미기</h2>
              <p className="text-xs text-white/55">
                {sum.ratingTier.emoji} {sum.ratingTier.label} {won(sum.rating)} · 세트 {s.sets.length}/{DECOR_SETS.length} · 조합{" "}
                {knownCombos(s).length}/{DECOR_COMBOS.length}
              </p>
            </div>
            {(() => {
              const goodsReady = produceStatus(s, now).reduce((a, x) => a + x.ready, 0);
              const guest = todayGuest(s, now);
              const islandTodo = goodsReady + (guest?.ready && !guest.claimed ? 1 : 0) + (decorWishClaimable(s, now) ? 1 : 0);
              return (
                <div ref={decorTabsRef} role="tablist" aria-label="꾸미기 메뉴" className="grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-white/10">
                  {([
                    { k: "island", label: "섬 꾸미기", n: islandTodo },
                    { k: "shop", label: "상점", n: 0 },
                    { k: "sets", label: "세트·조합", n: 0 },
                  ] as const).map((t) => (
                    <button
                      key={t.k}
                      role="tab"
                      aria-selected={decorView === t.k}
                      onClick={() => setDecorView(t.k)}
                      className={`tap relative rounded-lg py-2 text-xs font-extrabold ${decorView === t.k ? "bg-amber-300 text-[var(--ink-on-light)]" : "text-white/70"}`}
                    >
                      {t.label}
                      {t.n > 0 && (
                        <span className="absolute -right-0.5 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-emerald-400 px-1 text-xs font-black leading-none text-[var(--ink-on-light)]">
                          {t.n}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}

            {decorView === "island" && (
              <>
                {/* 진짜 섬 풍경 — 배치 팝·이동·야간 야광·펫 환호·생산 말풍선이 사는 곳 */}
                <div ref={decorStageRef} className="decor-island-stage">
                  <IslandScene
                    decor={s.decor}
                    petForm={s.pet.form}
                    season={sum.season}
                    now={now}
                    rows={decorRowsOf(s)}
                    placing={moveId ? (s.decor.find((d) => d.id === moveId)?.key ?? null) : placeKey}
                    movingId={moveId}
                    justPlacedPos={justPlacedAt}
                    petAsleep={s.pet.stats.energy < 20}
                    bubbles={Object.fromEntries(
                      produceStatus(s, now)
                        .filter((x) => x.ready > 0)
                        .map((x) => [x.id, `${goodsOf(x.goods).emoji}${x.ready}`]),
                    )}
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
                          const ok = await act((st) => moveDecor(st, id, x, y, Date.now()));
                          if (ok) {
                            setMoveId(null);
                            firePlaceFx(x, y, nowMs);
                          }
                        }
                        return;
                      }
                      if (placed) {
                        // 생산물이 쌓인 생산 장식은 누르면 바로 모은다(말풍선을 누른 것과 같다).
                        // 비어 있을 때만 이동/치우기 줄 — 즉시 파괴 금지
                        if (!placeKey && produceStatus(s, nowMs).some((p) => p.id === placed.id && p.ready > 0)) {
                          const ok = await act((st) => collectProduce(st, nowMs));
                          if (ok) firePlaceFx(x, y, nowMs);
                          return;
                        }
                        setDecorAction(placed);
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
                </div>

                {/* 섬 바로 밑 한 줄 — 지금 상황(이동 · 선택한 장식 · 배치 대기 · 대기)을 여기서만 보여 준다 */}
                <div className="decor-placement-bar">
                  {moveId ? (
                    <>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-400/15 text-base font-black text-sky-200">↔</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-white/90">
                          {(() => {
                            // 상대가 그 사이 치웠을 수도 있다 — 없는 키로 decorDef 를 부르지 않는다
                            const m = s.decor.find((d) => d.id === moveId);
                            return m ? `${decorDef(m.key).name} 옮기는 중` : "옮기는 중";
                          })()}
                        </p>
                        <p className="text-xs text-white/45">빈 자리를 탭하면 옮겨져요</p>
                      </div>
                      <button onClick={() => setMoveId(null)} className="tap rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">
                        취소
                      </button>
                    </>
                  ) : decorAction ? (
                    (() => {
                      const d = decorDef(decorAction.key);
                      const refund = Math.floor(decorPrice(d) * 0.5);
                      const ps = produceStatus(s, now).find((x) => x.id === decorAction.id);
                      return (
                        <>
                          <span className="grid h-9 w-9 shrink-0 place-items-center">
                            <DecorIcon decorKey={decorAction.key} size={34} title={d.name} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-white/90">{d.name}</p>
                            <p className="truncate text-xs text-white/45">
                              {ps
                                ? `${goodsOf(ps.goods).emoji} ${ps.ready}/${PRODUCE_CAP}${ps.boosted ? " · ⚡ 2배" : ""}`
                                : `치우면 ${won(refund)}💗 돌려받아요`}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setMoveId(decorAction.id);
                              setPlaceKey(null);
                              setDecorAction(null);
                            }}
                            className="tap shrink-0 rounded-lg bg-sky-400/20 px-2.5 py-2 text-xs font-bold text-sky-200 ring-1 ring-sky-300/30"
                          >
                            ↔ 이동
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                await confirmDialog({
                                  message: `${d.emoji} ${d.name}을(를) 치울까요?`,
                                  detail: `치우면 ${refund}💗를 돌려받아요.`,
                                  confirmText: "치우기",
                                })
                              ) {
                                const id = decorAction.id;
                                act((st) => removeDecor(st, id, Date.now()));
                              }
                              setDecorAction(null);
                            }}
                            className="tap shrink-0 rounded-lg bg-rose-400/20 px-2.5 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-300/30"
                          >
                            치우기
                          </button>
                          <button onClick={() => setDecorAction(null)} aria-label="닫기" className="tap shrink-0 px-1 text-white/50">
                            ✕
                          </button>
                        </>
                      );
                    })()
                  ) : placeKey ? (
                    <>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                        <DecorIcon decorKey={placeKey} size={34} title={decorDef(placeKey).name} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-white/90">
                          {decorDef(placeKey).name} 배치 중 · {won(decorPrice(decorDef(placeKey)))}💗
                        </p>
                        <p className="text-xs text-white/45">섬의 빈 자리를 탭하면 바로 놓여요</p>
                      </div>
                      <button onClick={() => setPlaceKey(null)} className="tap rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                        <Icon name="image" size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-white/90">아래에서 장식을 골라 섬에 놓아요</p>
                        <p className="text-xs text-white/45">놓인 장식을 탭하면 옮기거나 치울 수 있어요</p>
                      </div>
                    </>
                  )}
                </div>

                <DecorPicker
                  s={s}
                  filter={decorFilter}
                  onFilter={setDecorFilter}
                  selected={placeKey}
                  onPick={pickDecor}
                  onMore={() => goDecor("shop")}
                />

                <ProducePanel
                  s={s}
                  now={now}
                  busy={busy}
                  onCollect={() => act((st) => collectProduce(st, Date.now()))}
                  onShop={() => {
                    setDecorFilter("farm");
                    goDecor("shop");
                  }}
                />

                {/* 오늘의 위시 — 펫이 매일 다른 장식을 갖고 싶어함(꾸미기에 '오늘의 이유', 2026-07-28) */}
                {(() => {
                  const wishKey = decorWishKey(s, now);
                  const wd = decorDef(wishKey);
                  const placed = s.decor.some((d) => d.key === wishKey);
                  const claimable = decorWishClaimable(s, now);
                  const claimed = placed && !claimable;
                  const price = decorPrice(wd);
                  return (
                    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/12">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                        <DecorIcon decorKey={wishKey} size={24} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white/85">
                          🗨️ “오늘은 <span className="text-amber-300">{wd.name}</span>
                          {claimed ? "이(가) 있어서 행복해!”" : "이(가) 갖고 싶어!”"}
                        </p>
                        <p className="text-xs text-white/50">
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
                          className="tap shrink-0 animate-pop rounded-full bg-amber-300 px-3 py-1.5 text-sm font-extrabold text-ink"
                        >
                          🎁 이뤄주기
                        </button>
                      ) : !placed ? (
                        <button
                          onClick={() => pickDecor(wishKey)}
                          disabled={decorLockReason(s, wd) != null || s.coins < price}
                          className="tap shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold ring-1 ring-white/15 disabled:opacity-40"
                        >
                          배치 {won(price)}💗
                        </button>
                      ) : null}
                    </div>
                  );
                })()}

                {/* 오늘의 손님 — 발견한 조합 소문을 듣고 온다. **그 조합이 지금 붙어 있어야** 맞이할 수 있다
                    → 매일 섬을 다시 들여다보고 옮기게 하는 장치(위시=사기 / 손님=배치, 역할이 안 겹친다) */}
                {(() => {
                  const v = todayGuest(s, now);
                  if (!v) return null;
                  return (
                    <div
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ${
                        v.ready && !v.claimed ? "animate-pop bg-sky-400/15 ring-sky-300/40" : "bg-white/[0.07] ring-white/12"
                      }`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xl">{v.guest.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white/85">
                          {v.guest.name} · <span className="text-sky-200">{v.combo.name}</span> 보러 왔어요
                        </p>
                        <p className="text-xs text-white/50">
                          {v.claimed
                            ? `“${v.guest.line}”, 오늘은 잘 보고 갔어요 ✨`
                            : v.ready
                              ? `“${v.guest.line}” · 맞이하면 +${v.reward}💗`
                              : `${decorDef(v.combo.a).name} + ${decorDef(v.combo.b).name} 를 나란히 놓아 주세요`}
                        </p>
                      </div>
                      {v.ready && !v.claimed && (
                        <button
                          onClick={() => act((st) => welcomeGuest(st, Date.now()))}
                          disabled={busy}
                          className="tap shrink-0 rounded-full bg-sky-300 px-3 py-1.5 text-sm font-extrabold text-ink"
                        >
                          🍵 맞이하기
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* 조합 힌트 — '다음에 뭘 하지?'를 한 줄로. 재료가 이미 있으면 '사라'가 아니라 '옮겨라'를 권한다 */}
                {(() => {
                  const h = comboHint(s, now);
                  if (!h) return null;
                  return (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-300/10 px-3 py-2 ring-1 ring-amber-300/25">
                      <span className="flex shrink-0 items-center -space-x-1">
                        <DecorIcon decorKey={h.combo.a} size={20} />
                        <DecorIcon decorKey={h.combo.b} size={20} />
                      </span>
                      <p className="min-w-0 flex-1 text-xs text-white/70">
                        {h.kind === "move" ? (
                          <>
                            <b className="text-amber-200">{decorDef(h.combo.a).name}</b> 옆에{" "}
                            <b className="text-amber-200">{decorDef(h.combo.b).name}</b> 를 붙이면 새 조합이 열려요
                          </>
                        ) : (
                          <>
                            <b className="text-amber-200">{h.missing.map((k) => decorDef(k).name).join(" + ")}</b> 를 사서 나란히 놓아 보세요
                          </>
                        )}
                      </p>
                      {h.kind === "buy" && (
                        <button
                          onClick={() => {
                            // 모자란 장식이 든 세트 상점으로 곧장 — '전체' 58종에서 다시 찾게 하지 않는다
                            setDecorFilter(decorDef(h.missing[0]).set);
                            goDecor("shop");
                          }}
                          className="tap shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold ring-1 ring-white/15"
                        >
                          상점
                        </button>
                      )}
                    </div>
                  );
                })()}

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
                      <div className="flex items-center justify-between text-sm">
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
                        <p className="mt-1 text-xs text-emerald-300">분위기 보너스: 펫 행복 감쇠 −{ambienceHappyBonusPct(s)}%</p>
                      )}
                    </div>
                  );
                })()}

                {/* 섬 넓히기 — 마당 앞줄 +6칸 [사용자 요청 2026-08-11 "밭 말고 섬을"].
                    잠긴 이유를 반드시 보여준다(골드비료 사고 재발 방지 규약). */}
                {(() => {
                  const why = islandExpandLockReason(s);
                  const next = ISLAND_EXPANSIONS[s.islandExp ?? 0];
                  return (
                    <button
                      disabled={busy || why != null}
                      onClick={() => act((x) => expandIsland(x, Date.now()))}
                      className="tap w-full rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-45"
                    >
                      🏝️ 섬 넓히기 — 마당 앞줄 +{DECOR_COLS}칸 {next ? `(${won(next.cost)}💗)` : "MAX"}
                      {why && <span className="ml-1 font-semibold text-white/45">· {why}</span>}
                    </button>
                  );
                })()}
              </>
            )}

            {decorView === "shop" && <DecorShop s={s} filter={decorFilter} onFilter={setDecorFilter} onPick={pickDecor} />}

            {decorView === "sets" && (
              <>
                <SetBoard
                  s={s}
                  onOpen={(id) => {
                    setDecorFilter(id);
                    goDecor("shop");
                  }}
                />
                <ComboBook s={s} />
              </>
            )}
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
                      <span className="text-xs text-emerald-300">완료 ✓</span>
                    ) : (
                      <button
                        disabled={busy || q.prog < q.goal}
                        onClick={() => act((x) => claimQuest(x, q.id, Date.now()))}
                        className="tap rounded-lg bg-brand px-2.5 py-1 text-sm font-bold text-white disabled:opacity-30"
                      >
                        +{q.reward}💗
                      </button>
                    )}
                  </div>
                ))}
                {s.quest.chest && <p className="text-center text-xs text-amber-300">오늘 퀘스트 전부 완료! 🎁</p>}
              </div>
            </div>
            {/* 유대 — 솔로에선 선물 버튼만 숨긴다(받을 상대가 없다). 게이지는 남긴다:
                연동하면 이어질 축이라는 예고다. */}
            <div className="rounded-xl bg-white/[0.06] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">💞 유대 Lv.{s.bond.level}</span>
                {coupleId && (
                  <button onClick={() => act((x) => giftPartner(x, Date.now()))} className="tap rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                    🎁 마음 전하기
                  </button>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-pink-400" style={{ width: `${Math.min(100, (s.bond.xp / xpForBondLevel(s.bond.level + 1)) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/45">함께 놀기·선물·둘 다 출석·기념일로 깊어져요</p>
              <p className="mt-0.5 text-xs text-amber-200/80">
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
                      className={`rounded-lg px-2 py-1 text-sm ${got ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40" : "bg-white/[0.05] text-white/30"}`}
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
                    <p className="text-xs font-bold text-white/50">펫 {seenPets}/{pets.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {pets.map((f) => (
                        <Cell key={f.key} seen={has(f.key)} name={f.name}>
                          <PetIcon form={f.key} size={36} face active={false} />
                        </Cell>
                      ))}
                    </div>
                    <p className="text-xs font-bold text-white/50">작물 {seenCrops}/{CROPS.length} · 별⭐는 최고 품질</p>
                    <div className="flex flex-wrap gap-1">
                      {CROPS.map((c) => {
                        const best = [5, 4, 3, 2, 1].find((n) => has(`star${n}_${c.key}`)) ?? 0;
                        return (
                          <span key={c.key} className="relative">
                            <Cell seen={has(`crop_${c.key}`)} name={c.name}>
                              <CropIcon cropKey={c.key} stage={3} size={34} />
                            </Cell>
                            {best > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-amber-300 px-1 text-xs font-black text-ink">
                                ★{best}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs font-bold text-white/50">요리 {seenProds}/{PRODUCTS.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {PRODUCTS.map((pr) => (
                        <Cell key={pr.key} seen={has(`product_${pr.key}`)} name={pr.name}>
                          <ProductIcon productKey={pr.key} size={34} />
                        </Cell>
                      ))}
                    </div>
                    <p className="text-xs font-bold text-white/50">장식 {seenDecos}/{DECORS.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {DECORS.map((d) => {
                        return (
                          <Cell key={d.key} seen={has(`decor_${d.key}`)} name={d.name}>
                            <DecorIcon decorKey={d.key} size={34} />
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
                      <PetIcon form={nodeKey} size={big ? 36 : 18} face active={false} title={known ? name : "???"} />
                    </span>
                    <span
                      className={`mt-0.5 max-w-[52px] truncate text-xs font-bold ${
                        st === "current" ? "text-amber-200" : st === "museum" ? "text-violet-200" : known ? "text-white/60" : "text-white/25"
                      }`}
                    >
                      {known ? name : "???"}
                    </span>
                    {st === "museum" && <span className="text-xs text-violet-300">🏛️</span>}
                    {st === "current" && <span className="text-xs text-amber-300">지금</span>}
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
                  <p className="mb-2 text-xs leading-snug text-white/45">
                    최종형까지 키운 뒤 <b className="text-violet-200">박물관에 보내면</b> 한 칸이 채워지고 새 알이 시작돼요 — 어떤 돌봄을 많이 했는지, 얼마나 정성껏 키웠는지에 따라 갈래가 달라집니다.
                  </p>
                  <div className="space-y-1.5">
                    {tree.branches.map((b) => (
                      <div key={b.mid.key} className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] p-1.5">
                        {cell(b.mid.key, b.mid.name, b.mid.status, true)}
                        <span className="text-xs text-white/30">→</span>
                        <div className="grid flex-1 grid-cols-2 gap-1">
                          {b.finals.map((f) => cell(f.key, f.name, f.status))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 신화형 — 계보 밖 한 줄. 어느 최종형에서든 Lv.70 에 갈 수 있어 갈래가 아니다. */}
                  <div className="mt-1.5 rounded-xl bg-amber-300/[0.06] p-1.5 ring-1 ring-amber-300/20">
                    <p className="mb-1 text-xs font-bold text-amber-200/80">
                      신화형 <span className="font-semibold text-white/40">최종형을 Lv.70 까지 키우면, 키운 방식이 영물을 정해요</span>
                    </p>
                    <div className="grid grid-cols-5 gap-1">
                      {tree.mythics.map((m) => cell(m.key, m.name, m.status))}
                    </div>
                  </div>
                  {/* 신화 위 세 층 — 전부 한 줄. 위로 갈수록 짧아진다(4 → 2 → 1). */}
                  <div className="mt-1.5 rounded-xl bg-sky-300/[0.06] p-1.5 ring-1 ring-sky-300/20">
                    <p className="mb-1 text-xs font-bold text-sky-200/80">
                      사신 <span className="font-semibold text-white/40">Lv.85 — 가장 깊이 판 섬 놀이가 방위를 정해요</span>
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                      {tree.divines.map((m) => cell(m.key, m.name, m.status))}
                    </div>
                  </div>
                  <div className="mt-1.5 rounded-xl bg-violet-300/[0.06] p-1.5 ring-1 ring-violet-300/20">
                    <p className="mb-1 text-xs font-bold text-violet-200/80">
                      천수 <span className="font-semibold text-white/40">Lv.100 — 여러 생을 거쳤나, 한 생을 곧게 살았나</span>
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {tree.celestials.map((m) => cell(m.key, m.name, m.status))}
                    </div>
                  </div>
                  <div className="mt-1.5 rounded-xl bg-amber-300/[0.1] p-1.5 ring-1 ring-amber-300/40">
                    <p className="mb-1 text-xs font-bold text-amber-200">
                      황룡 <span className="font-semibold text-white/40">Lv.120 — 끝까지 간 이는 모두 여기에 닿아요</span>
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {tree.apex.map((m) => cell(m.key, m.name, m.status))}
                    </div>
                  </div>
                </div>
              );
            })()}
            <p className="text-center text-xs text-white/40">사냥·보글보글에서도 💗코인이 쌓여요</p>
          </div>
        )}
      </div>

      {/* 씨앗 가게 — 분류·제철·하루 수익·궁합·쓰임새로 고른다(island/SeedShop) */}
      {seedFor != null && (
        <SeedShop
          s={s}
          plotId={seedFor}
          now={now}
          busy={busy}
          onClose={() => setSeedFor(null)}
          onPlant={(key) => {
            act((x) => plant(x, seedFor, key, Date.now()));
            setSeedFor(null);
          }}
        />
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

      {/* 히어로 개명 시트 — 하트 소비. [사용자 요청 2026-09-01 "상시는 말고 하트 2000 정도"] */}
      {renameOpen && s && (
        <SheetShell onClose={() => setRenameOpen(false)} title="히어로 이름 바꾸기">
          <div className="space-y-3">
            <input
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value.slice(0, TUNING.pet.nameMax))}
              maxLength={TUNING.pet.nameMax}
              autoFocus
              className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-white/40"
              placeholder="새 이름"
            />
            <p className="text-xs text-white/55">
              {/* 솔로엔 답할 상대가 없다 — 동의를 요구하면 '문 없는 문'이 된다(솔로 모드 규약) */}
              {coupleId
                ? `${partnerName}가 동의하면 바뀌어요. 하트는 바뀌는 순간에만 빠져요.`
                : renameCostOf(s)
                  ? `${renameCostOf(s)}💗 를 써서 지금 키우는 히어로의 이름만 바꿔요.`
                  : "새로 태어난 아이의 첫 이름은 무료예요."}
              {" "}진화형·기록은 그대로예요.
              <br />
              보유 {won(s.coins)}💗 · 최대 {TUNING.pet.nameMax}자
            </p>
            {(() => {
              const name = renameTo.trim();
              const poor = s.coins < renameCostOf(s);
              const same = name === s.pet.name;
              return (
                <>
                  {poor && <p className="text-xs font-bold text-rose-300">하트가 모자라요</p>}
                  {!poor && same && name !== "" && (
                    <p className="text-xs font-bold text-amber-300">지금과 같은 이름이에요</p>
                  )}
                  <button
                    disabled={!name || poor || same}
                    onClick={() => {
                      // 커플이면 제안(상대 동의 필요) · 솔로면 바로 바꾼다
                      act((x) =>
                        coupleId
                          ? renameProposeName(x, myUserId ?? "", name, Date.now())
                          : renamePet(x, name, Date.now()),
                      ).then((ok) => {
                        if (ok) setRenameOpen(false);
                      });
                    }}
                    className="tap w-full rounded-xl bg-amber-300 py-2.5 text-sm font-extrabold text-ink disabled:opacity-40"
                  >
                    {coupleId ? "동의 요청 보내기" : renameCostOf(s) ? `${renameCostOf(s)}💗 쓰고 바꾸기` : "이름 짓기"}
                  </button>
                </>
              );
            })()}
          </div>
        </SheetShell>
      )}

      {/* 가공 시트 — 빈 조리대의 '만들기'. 레시피북과 같은 목록(island/Workshop) */}
      {craftFor != null && (
        <SheetShell onClose={() => setCraftFor(null)} title="무엇을 만들까요?" wide>
          <RecipeBook
            s={s}
            busy={busy}
            onCook={(key) => {
              const slot = craftFor;
              act((x) => startCraft(x, slot, key, Date.now()));
              setCraftFor(null);
            }}
          />
        </SheetShell>
      )}

      {/* 함께 놀기 플레이 세션 — 점수를 엔진(coopStart/coopConfirm)에 실어 유대 보너스 스케일 */}
      {coopSession && (
        <CoopPlay
          form={s.pet.form}
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
          <p className="mb-2 text-sm leading-snug text-white/55">
            직접 키운 작물은 <b className="text-emerald-300">무료</b>이고, ★가 높을수록 <b className="text-amber-300">진화가 빨라져요</b>(★4↑은 배불러도 정성 상승).
          </p>
          {Object.keys(s.farm.barn).length === 0 ? (
            <p className="rounded-xl bg-white/[0.06] px-3 py-3 text-center text-sm text-white/50">
              창고가 비었어요 — 정원에서 작물을 키워 수확하면 여기서 먹일 수 있어요 🌱
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(s.farm.barn).map(([k, v]) => {
                // 창고엔 작물 말고 생산 재료(꿀·달걀·우유)도 있다 — cropOf 로 바로 가면 달걀 한 알에 시트가 죽는다
                const c = barnItem(k);
                if (!c) return null;
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
                      <ItemIcon k={k} size={34} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">
                        {c.name} <span className="text-amber-300">{"★".repeat(v.star)}</span>
                      </p>
                      <p className="text-xs text-emerald-300">
                        무료 · 보유 {v.qty} · 성장 +{rawFeedXp(c, v.star)}
                      </p>
                      {v.star >= TUNING.pet.cropFeed.cqStar && (
                        <p className="text-xs font-bold text-amber-300">⭐ 특별식, 배불러도 정성이 올라가요</p>
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
              <p className="text-xs text-white/50">{TUNING.pet.action.feed.cost}💗 · 포만 +{TUNING.pet.action.feed.hunger}</p>
            </div>
          </button>
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
                <p className="mt-0.5 text-sm text-white/70">{set.perk} 🎁</p>
              </div>
            </div>
          );
        })()}

      {/* 새 조합 발견 — 세트 완성보다 가벼운 토스트(자주 일어나므로 화면을 덮지 않는다) */}
      {comboCele &&
        (() => {
          const c = comboDef(comboCele);
          if (!c) return null;
          return (
            <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex justify-center px-4">
              <div className="animate-pop flex items-center gap-2.5 rounded-2xl bg-[#1a2540]/95 px-4 py-2.5 ring-1 ring-amber-300/50">
                <span className="flex shrink-0 items-center -space-x-1">
                  <DecorIcon decorKey={c.a} size={26} />
                  <DecorIcon decorKey={c.b} size={26} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-amber-200">새 조합 · {c.name} {c.emoji}</p>
                  <p className="truncate text-xs text-white/70">{c.line}</p>
                </div>
              </div>
            </div>
          );
        })()}

      {/* 히어로 기술 결과 — 채집한 작물·모험의 보물이 어디에도 안 보이면 '눌렀는데 뭐가 됐지?'가 된다 */}
      {skillToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex justify-center px-4" role="status">
          <div key={skillToast.ts} className="animate-pop flex max-w-sm items-center gap-2.5 rounded-2xl bg-[#1a2540]/95 px-4 py-2.5 ring-1 ring-sky-300/50">
            <ActionIcon k={skillToast.k} size={32} />
            <p className="min-w-0 text-xs font-bold leading-snug text-white/90">{skillToast.text}</p>
          </div>
        </div>
      )}

      {/* 진화 축하 — 대상은 현재 상태에서 파생(evolve()가 실제 적용할 것과 항상 일치) */}
      {celebrate &&
        s.pet.pendingEvolve &&
        (() => {
          // ⚠ nextEvolutionOf 만 쓴다 — 인자를 여기서 따로 늘어놓다가 두 번 어긋났다
          //   (legendFed 누락 → 연출 뱅갈·적용 무등산 / care 누락 → 연출 햇살이·적용 새싹이).
          const target = nextEvolutionOf(s);
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
  const regrowing = !!c.regrow && (plot.cycle ?? 0) > 0;
  const stg: CropStage = st.ripe ? 3 : regrowing ? 2 : st.progress < 0.25 ? 0 : st.progress < 0.7 ? 1 : 2;
  return (
    <SheetShell onClose={onClose} title="밭 돌보기">
      {/* 상태 헤더 */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
          <CropIcon cropKey={plot.crop} stage={stg} size={38} title={c.name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">
            {c.name} {(plot.lucky ?? false) && <span className="text-xs text-emerald-300">🍀 행운의 두둑</span>}
          </p>
          <p className="text-sm text-white/55">
            {st.ripe
              ? "다 자랐어요, 수확하세요!"
              : regrowing
                ? `다음 열매 ${Math.round(st.progress * 100)}%`
                : `자라는 중 ${Math.round(st.progress * 100)}%`}
            {c.regrow && (
              <span className="ml-1 text-sky-200">
                · 🌳 {(plot.cycle ?? 0) + 1}/{1 + c.regrow.times}번째 열매
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 예상 품질 — 점수 막대(임계 눈금) + 기여 칩. 비료를 누르면 눈앞에서 차오른다 */}
      <p className="mb-1 text-sm font-bold text-white/60">
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
            className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${pp.val > 0 ? "bg-white/[0.07] text-white/75 ring-white/10" : "bg-white/[0.03] text-white/35 ring-white/5"}`}
          >
            {pp.label} +{pp.val}
          </span>
        ))}
      </div>
      {coach && (
        <p className="animate-pop mt-2 rounded-lg bg-amber-300/15 px-2.5 py-1.5 text-sm font-extrabold text-amber-200 ring-1 ring-amber-300/30">
          💡 {coach}
        </p>
      )}
      {pv.star5Locked && pv.starMax >= 5 && (
        <p className="mt-1.5 text-xs text-white/45">★5는 농사 Lv.{TUNING.farm.star5MinSkill} 또는 골드비료·비료 3단계 정성이 필요해요</p>
      )}

      {/* 액션 — 한 손 엄지 범위 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          disabled={busy || watered}
          onClick={onWater}
          className="tap min-h-12 rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold ring-1 ring-white/10 disabled:opacity-40"
        >
          💧 물주기
          <span className="block text-xs font-normal text-white/45">
            {s.farm.sprinkler ? "자동 급수 중" : watered ? "촉촉함 (내일 또)" : "성장 1.5배"}
          </span>
        </button>
        <button
          disabled={busy || s.farm.fert <= 0 || stack >= TUNING.farm.fertStackMax}
          onClick={() => onFert(false)}
          className="tap min-h-12 rounded-xl bg-amber-300/15 py-2.5 text-xs font-extrabold text-amber-200 ring-1 ring-amber-300/30 disabled:opacity-40"
        >
          💩 비료 {stack}/{TUNING.farm.fertStackMax}
          <span className="block text-xs font-normal text-amber-200/70">
            보유 {s.farm.fert} {stack < TUNING.farm.fertStackMax ? `· 다음 +${pv.fertGain} & 가속` : "· 최대"}
          </span>
        </button>
        <button
          disabled={busy || s.farm.gold <= 0 || (plot.gold ?? false)}
          onClick={() => onFert(true)}
          className="tap min-h-12 rounded-xl bg-yellow-300/10 py-2.5 text-xs font-extrabold text-yellow-200 ring-1 ring-yellow-200/30 disabled:opacity-40"
        >
          ✨ 골드비료
          <span className="block text-xs font-normal text-yellow-100/70">
            {(plot.gold ?? false) ? "적용됨" : `보유 ${s.farm.gold} · +${TUNING.farm.quality.fertGold} & ★5 해금`}
          </span>
        </button>
        <button
          disabled={busy || !st.ripe}
          onClick={onHarvest}
          className="tap min-h-12 rounded-xl bg-brand py-2.5 text-xs font-extrabold text-white disabled:opacity-40"
        >
          🌾 수확
          <span className="block text-xs font-normal text-white/70">{st.ripe ? "지금!" : "다 자라면"}</span>
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
  const opts: { use: CraftUse; label: string; sub: string; cls: string }[] = [
    { use: "sell", label: "팔기", sub: `+${won(pay.coins)}💗`, cls: "bg-amber-300/15 text-amber-200 ring-amber-300/30" },
    // ⚠ heal 을 안 적으면 불로장생탕의 **제일 큰 값어치가 화면에 없다**(성장 숫자만 보이고
    //   완전회복·정성은 눌러 봐야 안다). 보상이 보이지 않으면 선택지가 아니다.
    {
      use: "treat",
      label: "간식",
      // 요리 효과도 여기 보여야 '먹일 이유'가 선택지에 선다(2026-09-23)
      sub: pay.heal
        ? `성장 +${pay.careXp} · 완전회복`
        : p?.effect
          ? `성장 +${pay.careXp} · ${BUFF_LABEL[p.effect.kind].emoji}${BUFF_LABEL[p.effect.kind].name}`
          : `성장 +${pay.careXp}`,
      cls: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
    },
    { use: "gift", label: "선물", sub: `유대 +${pay.bondXp}`, cls: "bg-pink-400/15 text-pink-200 ring-pink-300/30" },
    // 보관 — 찬장으로. 주문·단계 요리 재료로 쓸 수 있다(재료 제품은 사실상 이것 하나)
    { use: "store", label: "보관", sub: "찬장으로", cls: "bg-sky-400/15 text-sky-200 ring-sky-300/30" },
  ];
  return (
    <div className={`island-panel craft-slot p-3 ${ready ? "is-ready" : p ? "is-cooking" : "is-empty"}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center">
          {p ? <ProductIcon productKey={p.key} size={34} title={p.name} /> : <span className="text-2xl opacity-40">🍳</span>}
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
          <span className="text-xs font-bold text-emerald-300">어디에 쓸까요 ↓</span>
        ) : (
          <span className="text-xs text-white/40">진행중</span>
        )}
      </div>

      {/* 완성 4택 — 만든 걸 어디에 쓸지가 공방의 결정(전부 ★에 비례) */}
      {p && ready && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {opts.map((o) => (
            <button
              key={o.use}
              disabled={busy}
              onClick={() => onCollect(o.use)}
              className={`tap rounded-lg py-1.5 text-sm font-extrabold ring-1 disabled:opacity-40 ${o.cls}`}
            >
              {o.label}
              <span className="block text-xs font-normal opacity-80">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
