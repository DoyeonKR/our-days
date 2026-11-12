"use client";

/* 낚시 화면 — 규칙은 전부 lib/fishing(순수), 찌 · 줄 · 물보라는 lib/fishingfx(캔버스). 여기는 입력 · 타이머 · 글자판과 저장뿐이다.
 * 한 손가락으로 다 한다. 방식마다 손이 다르다: 찌(누르고 떼기) · 루어(박자 맞춰 치기 → 좌우로 끌기) · 뜰채(앞서 겨눠 누르기) · 심해(릴 돌리기) · 집어등(불 밝기 지키기 → 터질 때 채기). 규칙은 lib/fishingmodes · lib/fishinglight.
 * 저장은 던질 때(미끼) · 끌어올린 뒤 · 장비를 바꿀 때만(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더). 힘겨루기 중엔 쓰지 않는다. */
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { GameCoach, GameHead, coachSeen } from "@/components/GameHead";
import { BossSheet, FishGear, FishListSheet, FishStats, GearPic, MoonSheet, TimedSheet, useBackdropClose } from "@/components/FishingPanels";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { confirmDialog } from "@/lib/confirm";
import { logDebug } from "@/lib/debug";
import { claimableGoals } from "@/lib/fishinggoals";
import { useBackClose } from "@/lib/useBackClose";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import AquariumGame from "@/components/AquariumGame";
import { FishArt, preloadFishArt } from "@/components/AquaArt";
import { BaitIcon, JunkIcon, MethodIcon, MoonIcon } from "@/components/FishingIcons";
import FishFever from "@/components/FishFever";
import FishCoopHelp from "@/components/FishCoopHelp";
import { coopBonus, coopChance, coopRoundId, wantHelp } from "@/lib/fishcoop";
import { useFishCoop } from "@/lib/usefishcoop";
import BossRaidGame, { type RaidSetup } from "@/components/BossRaidGame";
import { partnerWound, raidLeft, raidScore, raidTune, type Raid } from "@/lib/bossraid";
import FishRank, { readFishNick } from "@/components/FishRank";
import FishCollect from "@/components/FishCollect";
import FishGearPlus from "@/components/FishGearPlus";
import { CraftBaitIcon } from "@/components/FishCraft";
import { CRAFT_BAITS, castBlockCraft, craftAsBait, craftEffects, craftInUse, craftLeft, craftTier, spendCraft } from "@/lib/fishcraft";
import { SpecialPanel, SpecialPic } from "@/components/FishSpecial";
import { landSpecial, rollSpecial, type SpecialCtx } from "@/lib/fishplus";
import { TrophySheet } from "@/components/FishTrophies";
import { noteTrophy, trophyCard, type TrophyCard } from "@/lib/fishtrophy";
import { feverArts, rollFever, upgradeCatch, upgradeChance } from "@/lib/fishingfever";
import { Coin } from "@/components/island/UiIcon";
import { NET_MAX, familyOf, fishArtKey, fishCount, fishName, releaseReward, syncAqua } from "@/lib/aquarium";
import { TANK_FULL, bossRecOf, bossWhy as bossWhyOf, claimFishGoal, tryNet, tryStoreSwap } from "@/lib/fishing";
import { awakeBossAt, masterySaleBonus, spotLookOf, spotStars, withMasteryLuck } from "@/lib/fishmastery";
import { gearStats, wornLooks } from "@/lib/fishlooks";
import { asset } from "@/lib/base";
import { FISH_IMAGE_KEYS } from "@/lib/aquaimages";
import { GRADES, tankOf, type Grade } from "@/lib/aquarium";
import { getFishStanding, loadIsland, saveIsland, sendPoke, submitFishCatch, watchIsland, type IslandRow } from "@/lib/couple";
import { islandSnapshot } from "@/lib/islandstore";
import { sendPokePush } from "@/lib/push";
import { BOSS_DUO, bossChunk, bossDealt, bossDuo } from "@/lib/fishingworld";
import { BOSS_TRIES, EXPED_NAME, TIME_ICON, TIME_NAME, WX_ICON, WX_NAME, bossAt, bossHp, bossLeft, bossOf, bossReward, bossTriesLeft, expedText, fishTimeOf, fishWxOf, fmtCm, lightNight, timedAt, type ExpedKey, type FishBoss, type FishMoment } from "@/lib/fishingworld";
import { lightBand, lightFightTune, lightHook, lightQuality, lightTotalQuality, lightTune, startLight, stepLight, type Light, type LightTune } from "@/lib/fishinglight";
import { useForecast } from "@/lib/useforecast";
import { useWeatherPlace } from "@/lib/weatherplace";
import { WEATHER_TTL_MS, wmoInfo } from "@/lib/weather";
import { FX_GRADE_LIGHT, FishFx, landingPoint, type FxLost } from "@/lib/fishingfx";
import {
  DEEP_METERS, LIFT_EDGE, LIFT_SAFE, LIFT_SLIP_S, PLUNGE_S, SCOOP_SHOTS, SCOOP_TIME_S, liftQuality, liftTune, startLift, stepLift, type Lift, type LiftTune, deepBand, deepQuality, deepTune, lureQuality, lureRing, lureTune, netRadius, plunge, scoopPos, startDeep, startLure, startScoop, startSway, stepDeep, stepLure, stepScoop, stepSway, swayQuality, swayTune, tapLure,
  type Deep, type DeepTune, type Lure, type LureTune, type Scoop, type Sway, type SwayTune, type TapGrade,
} from "@/lib/fishingmodes";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import {
  WATER_NAME, spotArtKey, BAITS, FLICK_FULL, GREEN_HIGH, GREEN_LOW, MAX_LEVEL, METHODS, NETS, PERFECT_HOOK, RODS, SPOTS,
  baitIndex, baitStock, fightLevel, prefMethod, prefMethodWrite, STREAK_MAX, bossCatch, bossLost, bossOpen, bossPhase, BOSS_PHASE_NAME, bossRefund, bossTune, bossWon, buyBait, buyNet, buyRod, captureChance, castBlock, castBoost, castMeters, castCurve, castRange, castRating, castScore, castTiming, SPIN_HI, catchArt, catchName, catchPoints, catchableCount, coinValue, currentBait, formsSeen, currentSpot, expedFor, fightQuality, fightTune, fishingOf, haulJunk, headingDelta, hookWindowMs, junkOf, methodOf, poolFor,
  rankLine, revealMs, rollCatch, sellCatch, shadowSize, spendBait, spendPoint, spinGain, startFight, startSpin, stepFight, stepSpin, storeBlock, tryStore, waitPlan, xpNeed, xpValue,
  type CastSpin, type Fight, type FightTune, type FishCatch, type FishResult, type FishStanding, type GearResult, type MethodKey,
} from "@/lib/fishing";
import type { IslandState } from "@/lib/island";
import { josa } from "@/lib/josa";
import { kstDate } from "@/lib/kst";
import { withTimeout } from "@/lib/logreview";
import { gameNow } from "@/lib/islandsync";
import { moonMomentOf, moonPhase, tideEffect, tideOf } from "@/lib/fishtide";

type Tab = "fish" | "gear" | "stat" | "more" | "rank";
type Phase = "ready" | "charge" | "wait" | "bite" | "lure" | "aim" | "lift" | "glow" | "fight" | "fever" | "reveal" | "landed" | "scoop" | "result" | "lost";
type StampTone = "hit" | "gold" | "miss";
/** 시각 · 주사위 — 눌렀을 때만 부른다(렌더 중에 부르지 않는다). 시각은 서버에 맞춘 지금(islandsync.gameNow) — 폰 날짜를 바꿔
 *  하루 도전 · 공짜 미끼 · 목표를 다시 열지 못하게(2026-11-11 리뷰). 경과 시간(프레임 · 챔질 · 휙)과 날씨 신선도는 기기 시계로 잰다:
 *  gameNow 는 저장 응답마다 다시 맞춰져 한 판 도중에 뛸 수 있고, 예보는 기기 시계로 찍힌다(useforecast). */
const clock = () => gameNow();
const deviceClock = () => Date.now();
/** 집어등 밤인가 — 때 손님과 같은 시각(clock = gameNow)으로 KST 19시 ~ 새벽 5시.
 *  개발 빌드에서만: 콘솔에서 window.__fishNight = true 면 밤, false 면 낮으로 친다(프리뷰에서 낮에도 집어등을 시험하려고). 배포 빌드엔 이 분기가 없다(NODE_ENV 가 빌드 때 박힌다) */
const nightNow = (): boolean => {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    const o = (window as { __fishNight?: unknown }).__fishNight;
    if (typeof o === "boolean") return o;
  }
  return lightNight(clock());
};
/** 집어등 — 손가락을 이만큼(px) 이 시간(ms) 안에 위로 튕기면 '채기'. 누르고 있던 손으로도 챌 수 있게 */
const LIGHT_FLICK_PX = 34;
const LIGHT_FLICK_MS = 140;
const dice = () => Math.random();
const TABS: readonly (readonly [Tab, string])[] = [["fish", "낚시터"], ["gear", "장비"], ["stat", "목표"], ["more", "수집"], ["rank", "랭킹"]];
const gradeClass = (g: Grade) => `aqua-grade g-${GRADES.indexOf(g)}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const buzz = (p: number | number[]) => navigator.vibrate?.(p);
/** 놓기 직전 이만큼의 움직임으로 '휙'을 잰다 */
const FLICK_WINDOW_MS = 90;
/** 손가락이 이만큼 움직여야 방향을 잰다 — 떨림을 돌리기로 세지 않게 */
const MIN_MOVE_PX = 4;
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
/** 뜰채로 건지는 시간 — 판정은 바로 나도 이만큼은 조마조마해야 한다 */
const SCOOP_MS = 1500;
/** 릴 다이얼 중심(낚시터 높이의 비율) — 화면 CSS 의 .fish-dial 과 같은 값 */
const DIAL_Y = 0.7;
const PREFS = "ourdays:fish:prefs";
/** method 칸엔 옛 넷만, 집어등은 lamp 칸 — 되돌린 옛 앱이 모르는 방식을 읽고 깨지지 않게(fishing.ts prefMethod).
 *  craft — 고른 만든 미끼(fishcraft.ts). 산 미끼 bait 와 따로 둔다 — 만든 미끼가 떨어지면 원래 고른 산 미끼로 돌아간다 */
type Prefs = { method?: MethodKey; lamp?: boolean; bait?: string; spot?: string; craft?: string | null };
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS) ?? "{}");
  } catch {
    return {};
  }
}
function savePrefs(v: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ ...readPrefs(), ...v }));
  } catch {
    /* 저장 못 해도 이번 판은 된다 */
  }
}

const FEVER_DRY = "ourdays:fever:dry";
function readFeverDry(): number {
  try {
    return Number(localStorage.getItem(FEVER_DRY)) || 0;
  } catch {
    return 0;
  }
}
function writeFeverDry(n: number) {
  try {
    localStorage.setItem(FEVER_DRY, String(n));
  } catch {
    /* 못 세도 3% 는 그대로다 */
  }
}

const LOST_TEXT = {
  early: "너무 일찍 챘어요! 물고기가 놀라 달아났어요",
  late: "늦었어요! 미끼만 먹고 뱉어 버렸어요",
  snapped: "줄이 끊어졌어요! 팽팽해지면 손을 떼세요",
  slack: "줄이 너무 느슨해 바늘이 빠졌어요",
  escaped: "물고기가 멀리 달아났어요",
  swaySnap: "줄이 끊어졌어요! 물고기 반대쪽으로 끌어야 해요",
  spinSnap: "줄이 끊어졌어요! 파고들 땐 릴을 멈추고, 빠르면 늦추세요",
  idle: "릴을 멈춘 사이 물고기가 빠져나갔어요. 파고들 때만 멈추세요",
  empty: "루어를 다 감았어요. 박자에 맞춰 쳐야 관심을 가져요",
  out: "그물이 다 빗나갔어요. 그림자가 갈 곳을 앞서 노리세요",
  time: "물고기들이 다 흩어졌어요",
  netDrop: "그물이 기울어 물고기가 튀어 나갔어요. 기울면 반대쪽으로 끌어요",
  fever: "피버타임 실패! 물고기가 달아났어요",
  bossBroke: "거의 다 왔는데 주인이 마지막 힘으로 뿌리쳤어요",
  lightScare: "불이 너무 밝아 무리가 놀라 흩어졌어요. 밝으면 손을 떼세요",
  lightGone: "불빛이 약해 무리가 모이지 않았어요. 초록 칸까지 밝혀요",
  lightEarly: "너무 일찍 챘어요! 무리가 터지기 전엔 불만 지켜요",
  lightMiss: "무리가 지나가 버렸어요. 불빛으로 솟구치는 순간 채세요",
} as const;
type LostKey = keyof typeof LOST_TEXT;
const LOST_FX: Record<LostKey, FxLost> = { early: "early", late: "late", snapped: "snapped", slack: "slack", escaped: "escaped", swaySnap: "snapped", spinSnap: "snapped", idle: "slack", empty: "escaped", out: "escaped", time: "escaped", netDrop: "escaped", fever: "escaped", bossBroke: "escaped", lightScare: "escaped", lightGone: "escaped", lightEarly: "early", lightMiss: "late" };
const LOST_STAMP: Record<FxLost, string> = { early: "앗, 일렀다!", late: "늦었다!", snapped: "툭! 끊어졌다", slack: "바늘이 빠졌다", escaped: "도망쳤다!" };
const TAP_NOTE: Record<TapGrade, string> = { great: "완벽!", good: "좋아!", miss: "엇박!" };
/** 만화 효과선 판 — 뾰족한 칸의 길이를 일부러 들쭉날쭉하게 */
const BURST = Array.from({ length: 34 }, (_, i) => {
  const a = (i / 34) * Math.PI * 2;
  const r = i % 2 === 0 ? 1 - ((i * 7) % 5) * 0.045 : 0.68;
  return `${(100 + Math.cos(a) * 98 * r).toFixed(1)},${(50 + Math.sin(a) * 48 * r).toFixed(1)}`;
}).join(" ");

/** 끌어올린 결과를 순위판에 올린다 — 게임을 기다리게 하지 않고, 실패해도 판에는 영향이 없다(점수 한 줄만 빠진다).
 *  points 는 서버가 실제로 준 점수다(2초 안 연속 · 하루 300마리를 넘기면 0). 화면은 이 값을 믿고, 못 받았으면(로컬 · 실패) null. */
type CatchReport = { points: number | null; standing: FishStanding | null };
/** 주인 저장의 결과 — 알릴 문구 · 토벌 연출(성공했을 때만) */
/** 레이드 결과 창을 닫을 때 판 끝 저장을 기다리는 시간 — 넘으면 창은 닫고 '저장 중'이라 알린다(늦게 끝나면 그 결과를 알린다) */
const RAID_CLOSE_TIMEOUT_MS = 10_000;
type BossSaved = { res: FishResult | GearResult | null; win: { id: number; name: string; me: number; you: number } | null; note: string };
function reportCatch(myName: string, c: FishCatch, quality: number, perfect: boolean, stored: boolean): Promise<CatchReport> {
  const name = c.junk ? junkOf(c.junk)?.name ?? "쓰레기" : catchName(c);
  return submitFishCatch(myName.trim() || readFishNick(), name, GRADES.indexOf(c.grade), c.stage, quality, perfect, stored, !!c.junk, c.boss || c.junk ? null : c.family, c.boss || c.junk ? null : c.cm ?? null)
    .then(async (points): Promise<CatchReport> => ({ points, standing: points === null ? null : await getFishStanding().catch(() => null) }))
    .catch((): CatchReport => ({ points: null, standing: null }));
}

function Stamp({ text, tone, high }: { text: string; tone: StampTone; high: boolean }) {
  return (
    <div className={`fish-stamp is-${tone} ${high ? "is-high" : ""}`} aria-live="polite">
      <svg viewBox="0 0 200 100" aria-hidden><polygon points={BURST} /></svg>
      <strong>{text}</strong>
    </div>
  );
}


const COACH: Record<MethodKey, readonly string[]> = {
  float: ["화면을 눌러 던져요. 돌리다 위로 튕기면 더 멀리 가요", "찌가 크게 잠기면 바로 눌러요. 살짝 흔들릴 땐 참아요", "누르면 줄이 감겨요. 빨간 칸에 닿기 전에 손을 떼요"],
  lure: ["던진 뒤 고리가 겹칠 때 톡 눌러 물고기를 꾀어요", "물면 손가락을 물고기 반대쪽으로 끌어요", "좌우로 버티면 다 큰 물고기가 잘 올라와요"],
  scoop: ["그림자가 수면으로 떠올라 빛 고리가 밝아질 때, 갈 곳을 앞서 눌러 건져요. 기회는 세 번이에요", "건지면 누르고 있어 들어 올려요. 그물이 기울면 손가락을 반대쪽으로 끌어 버텨요", "빛 고리가 있는 그림자가 물고기예요. 없으면 쓰레기예요"],
  deep: ["입질에 챔질한 뒤 손가락으로 릴을 돌려요", "바늘이 초록 칸에 있게 속도를 맞춰요", "물고기가 파고들면 잠깐 멈춰요. 미끼는 2개 써요"],
  light: ["밤바다(저녁 7시 ~ 새벽 5시)에서만 켤 수 있어요. 던지면 찌에 등불이 켜져요", "누르면 불이 밝아지고 떼면 어두워져요. 초록 칸에 두면 무리가 모여요 — 너무 밝으면 놀라 흩어져요", "다 모이면 무리가 불빛으로 솟구쳐요. 그 순간 손가락을 위로 휙 튕겨 채요(키보드는 ↑). 일찍 채면 흩어져요"],
};

export default function FishingGame({ coupleId, myUserId = null, myName = "", onClose, onOpenIsland }: { coupleId: string | null; myUserId?: string | null; myName?: string; onClose: () => void; onOpenIsland: () => void }) {
  const who = myUserId ?? "me";
  const by = useMemo(() => ({ who, couple: !!coupleId }), [who, coupleId]);
  const { cached: forecast } = useForecast(useWeatherPlace());
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("fish");
  const [tankOpen, setTankOpen] = useState(false);
  const [spotPick, setSpotPick] = useState<string | null>(() => readPrefs().spot ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<MethodKey>(() => prefMethod(readPrefs()));
  const [baitPick, setBaitPick] = useState<string | null>(() => readPrefs().bait ?? null);
  const [craftPick, setCraftPick] = useState<string | null>(() => readPrefs().craft ?? null);
  /** 이번 판에 쓴 만든 미끼 — 던질 때 붙잡아 둔다. 마지막 한 번을 쓰면 고른 칸은 비지만 이번 판의 덤(끈끈 미끼의 포획 +5%p)은 끝까지 간다 */
  const [roundCraft, setRoundCraft] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [charge, setCharge] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feverSeed, setFeverSeed] = useState<number | null>(null);
  const [feverNote, setFeverNote] = useState<string | null>(null);
  const [feverWon, setFeverWon] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [coachTick, setCoachTick] = useState(0);
  const [spinLive, setSpinLive] = useState<CastSpin | null>(null);
  const [thrown, setThrown] = useState<{ id: number; m: number; rating: string; record: boolean; banana: 0 | 1 | 2 | 3 } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [rankNote, setRankNote] = useState<string | null>(null);
  const [fx, setFx] = useState<FishFx | null>(null);
  const [stamp, setStamp] = useState<{ id: number; text: string; tone: StampTone } | null>(null);
  const [landPt, setLandPt] = useState({ x: 0.42, y: 0.5 });
  const [lost, setLost] = useState<LostKey | null>(null);
  const [fish, setFish] = useState<FishCatch | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);
  const [lureS, setLureS] = useState<Lure | null>(null);
  const [swayS, setSwayS] = useState<Sway | null>(null);
  const [scoopS, setScoopS] = useState<Scoop | null>(null);
  const [deepS, setDeepS] = useState<Deep | null>(null);
  const [liftS, setLiftS] = useState<Lift | null>(null);
  const [lightS, setLightS] = useState<Light | null>(null);
  /** 집어등 밤인가 — 렌더마다 시계를 읽지 않고 30초마다 다시 본다(던질 때는 nightNow 를 다시 부른다) */
  const [night, setNight] = useState(false);
  const [deepTuneS, setDeepTuneS] = useState<DeepTune | null>(null);
  const [spin, setSpin] = useState(0);
  const [dial, setDial] = useState(0);
  const [rodX, setRodX] = useState(0);
  const [tapNote, setTapNote] = useState<{ id: number; text: string; tone: TapGrade } | null>(null);
  const [holding, setHolding] = useState(false);
  const [quality, setQuality] = useState(0);
  const [perfectHook, setPerfectHook] = useState(false);
  const [result, setResult] = useState<Extract<FishResult, { ok: true }> | null>(null);
  /** 끌어올린 특별한 것을 처리할 때 쓰는 것 — 화면이 그릴 때마다 지금 값으로 갈아 끼운다 */
  const specialCtxRef = useRef<((t: number) => SpecialCtx) | null>(null);
  // 이번 판의 던지기 점수 — 보물 · 유물은 멀리 던질수록 조금 더 걸린다(fishtreasure.ts). 뽑기 줄(fishplus.test 가 잠근다)을 안 바꾸려고 ref 로 넘긴다
  const castScoreRef = useRef<number | undefined>(undefined);
  /** 어탁(fishtrophy.ts) — 이 모습의 가장 긴 기록이 되면 같은 저장에 한 장 얹는다(낚시터 · 날짜 · 잡은 사람 이름을 이때 남긴다). 화면이 그릴 때마다 지금 낚시터로 갈아 끼운다 */
  const trophyRef = useRef((r: FishResult, c: FishCatch, t: number): FishResult => { void c; void t; return r; });
  const [trophy, setTrophy] = useState<TrophyCard | null>(null);
  const [bossPick, setBossPick] = useState<string | null>(null);
  /** 주인 시트가 각성한 주인(숙련도 ★5)을 보고 있나 — bossPick 과 따로 둔다(bossPick 은 찌낚시 주인전 길이라 레이드만 쓰는 각성한 주인이 그 길을 타면 안 된다) */
  const [awakeView, setAwakeView] = useState(false);
  /** 주인 레이드(2026-11-11) — 찌낚시 대신 전용 판. 열려 있으면 그 판의 준비값 */
  /** seen = 판을 열 때 본 출현 번호(caught) — 저장할 때 바뀌었으면 상대가 먼저 잡은 것이다 */
  const [raid, setRaid] = useState<(RaidSetup & { key: string; seen: number }) | null>(null);
  const raidResult = useRef<Raid | null>(null);
  const raidRef = useRef(raid);
  raidRef.current = raid;
  /** 레이드를 여는 저장(도전 한 번 쓰기)이 도는 중 — 그동안 낚시터를 눌러 던지기가 시작되지 않게 */
  const raidOpening = useRef(false);
  /** 판이 끝나자마자 건 저장(깎기 · 토벌) — 결과 창을 닫을 때 이 결과로 알린다(닫기 전에 앱이 꺼져도 남는다) */
  const raidSave = useRef<Promise<BossSaved> | null>(null);
  const raidClosing = useRef(false);
  /** 이미 저장한 토벌 — landRound 는 이걸로 알리기만 한다(보상을 두 번 주지 않는다) */
  const bossPaid = useRef<BossSaved | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [bossNote, setBossNote] = useState<string | null>(null);
  const [fightHp, setFightHp] = useState(1);
  const [worldSheet, setWorldSheet] = useState<"boss" | "timed" | "fish" | "moon" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cheered, setCheered] = useState(false);
  const [picked, setPicked] = useState<"store" | "sell" | null>(null);
  const [serverPts, setServerPts] = useState<number | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinRef = useRef<CastSpin>(startSpin());
  const spinPending = useRef(0);
  const castAngRef = useRef(0);
  const pointsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const lastVec = useRef<{ x: number; y: number } | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const thrownId = useRef(0);
  const biteAt = useRef(0);
  const biteMs = useRef(800);
  const holdRef = useRef(false);
  const fightRef = useRef<Fight | null>(null);
  const tuneRef = useRef<FightTune | null>(null);
  const busyRef = useRef(false);
  const methodRef = useRef<MethodKey>(method);
  useEffect(() => {
    methodRef.current = method;
  }, [method]);
  const rowRef = useRef<IslandRow | null>(null);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);
  const standRef = useRef<FishStanding | null>(null);
  useEffect(() => {
    void getFishStanding().then((s) => { standRef.current = s; }).catch(() => {});
  }, []);
  const feverPlan = useRef<{ triggerDist: number } | null>(null);
  const feverQ = useRef(0);
  /** 이번 힘겨루기에 피버가 끼어드나(3%) — 거리가 절반쯤 줄었을 때 터진다 */
  /** 이번 판 피버 뽑기 — 쓰레기엔 없다. 연속으로 안 나온 판 수는 이 기기에 센다. 터지면 운영에서 확인할 수 있게 진단 기록을 남긴다. */
  const feverRoll = () => {
    if (fishRef.current?.junk || fishRef.current?.special) return false;
    const dry = readFeverDry();
    const hit = rollFever(dice(), dry);
    writeFeverDry(hit ? 0 : dry + 1);
    if (hit) void logDebug("fever_start", { method: methodRef.current, dry }).catch(() => {});
    return hit;
  };
  const planFever = () => {
    feverPlan.current = feverRoll() ? { triggerDist: 0.45 + dice() * 0.25 } : null;
    if (feverPlan.current) void preloadFishArt(feverArts(spot));
  };
  const noteStanding = useCallback(({ points, standing: s }: CatchReport) => {
    setServerPts(points);
    if (!s) return;
    setRankNote(rankLine(standRef.current, s));
    standRef.current = s;
  }, []);
  const fxRef = useRef<FishFx | null>(null);
  const gradeRef = useRef(0);
  const stampId = useRef(0);
  const fishRef = useRef<FishCatch | null>(null);
  const lureRef = useRef<Lure | null>(null);
  const lureTuneRef = useRef<LureTune | null>(null);
  const swayRef = useRef<Sway | null>(null);
  const swayTuneRef = useRef<SwayTune | null>(null);
  const scoopRef = useRef<Scoop | null>(null);
  const deepRef = useRef<Deep | null>(null);
  const deepTuneRef = useRef<DeepTune | null>(null);
  /** 뜰채 2막 — 들어올리기. netQ 는 1막(한가운데로 건졌나)의 솜씨 */
  const liftRef = useRef<Lift | null>(null);
  const liftTuneRef = useRef<LiftTune | null>(null);
  const liftCounter = useRef(0);
  const netQ = useRef(0);
  /** 집어등 — 1 · 2막 상태 · 이번 칸에 챘나(누르기 · 위로 튕기기 — 다음 칸에 한 번 쓰고 지운다) · 모으기와 챔질 솜씨(3막 끝에 힘겨루기 솜씨와 평균) */
  const lightRef = useRef<Light | null>(null);
  const lightTuneRef = useRef<LightTune | null>(null);
  const lightStrike = useRef(false);
  const lightQ = useRef({ gather: 0, hook: 0 });
  /** 33ms 루프가 렌더 밖에서 쓰는 지금 능력치 · 피버 뽑기 — 렌더마다 갈아 끼운다(루프 효과를 능력치마다 다시 걸지 않게) */
  const effRef = useRef<{ power: number; line: number }>({ power: 1, line: 1 });
  const planFeverRef = useRef<() => void>(() => {});
  const rodXRef = useRef(0);
  const spinAcc = useRef(0);
  const spinNow = useRef(0);
  const dialRef = useRef(0);
  const lastAng = useRef<number | null>(null);
  const keySpin = useRef(false);
  const plunging = useRef(false);
  const noteId = useRef(0);

  const roundBait = useRef(0);
  /** 이번 판이 끝났나 — 끝 처리(끌어올림 · 놓침)는 판마다 한 번뿐이다. 33ms 루프가 화면 갱신보다 먼저 한 번 더 돌아도 주인 보상 · 쓰레기가 두 번 들어가지 않게 */
  const roundEnded = useRef(false);
  /** 함께 끌어올리기(lib/fishcoop) — 이번 판에 부른 판 번호(한 판에 한 번) · 33ms 루프가 부르는 '부를까' · 판 끝에 접기.
   *  훅(useFishCoop)은 아래 이른 return 앞에서 부르고 여기 ref 에 지금 함수를 끼운다 — 루프 · landRound 의 의존성을 늘리지 않으려고 */
  const coopAskedRef = useRef<string | null>(null);
  const coopAskRef = useRef<(dist: number) => void>(() => {});
  const coopCloseRef = useRef<(why: "lost" | "done") => void>(() => {});
  const coopRootRef = useRef<HTMLDivElement | null>(null);
  const [coopRound, setCoopRound] = useState<string | null>(null);
  /** 담기 · 팔기를 누른 순간 도움을 받았었나 — 누르면 협동 상태를 접으므로 결과 카드는 이 값으로 배지를 단다 */
  const [coopHelped, setCoopHelped] = useState(false);
  /** 같은 계열이 몇 번 연달아 물었나 — STREAK_MAX 를 넘으면 다음 한 번은 다른 계열(쓰레기는 세지 않는다) */
  const streak = useRef<{ family: string; n: number }>({ family: "", n: 0 });
  /** 확인창이 떠 있는 동안 판을 멈춘다 — 묻는 사이에 줄이 끊기면 안 된다 */
  const pausedRef = useRef(false);
  const partnerSeen = useRef<number | null>(null);
  const fightHpRef = useRef(1);
  /** 찌낚시 주인전을 열 때 본 출현 번호(caught) · 그 판의 번호(같은 판을 두 번 저장해도 한 번만 깎게) */
  const bossSeenRef = useRef(0);
  const bossHitRef = useRef(0);
  /** 주인의 기세(0~2)와 그 판의 능력치 — 판 도중 화가 나면 같은 능력치로 더 센 힘겨루기를 다시 짠다 */
  const bossPhaseRef = useRef<0 | 1 | 2>(0);
  const bossEffRef = useRef<{ power: number; line: number }>({ power: 1, line: 1 });
  const [bossRage, setBossRage] = useState<0 | 1 | 2>(0);
  const [bossIntro, setBossIntro] = useState(0);
  /** 이번 판에 끌어오면 깎이는 몫 — 협공(오늘 상대도 겨뤘다)이면 1.5배. 판을 시작할 때 정한다 */
  const bossChunkRef = useRef(0);
  const [duoNow, setDuoNow] = useState(false);
  /** 토벌 연출 — 주인을 끌어올린 순간 화면 가득(이름 · 둘의 몫). 4초 뒤 저절로 걷힌다 */
  const [bossWin, setBossWin] = useState<{ id: number; name: string; me: number; you: number } | null>(null);
  useEffect(() => {
    if (!bossWin) return;
    const t = window.setTimeout(() => setBossWin(null), 4200);
    return () => window.clearTimeout(t);
  }, [bossWin]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(function fire() {
      if (pausedRef.current) timers.current.push(setTimeout(fire, ms));
      else fn();
    }, ms));
  }, []);
  const ask = useCallback(async (o: Parameters<typeof confirmDialog>[0]) => {
    pausedRef.current = true;
    setDialogOpen(true);
    try {
      return await confirmDialog(o);
    } finally {
      pausedRef.current = false;
      setDialogOpen(false);
    }
  }, []);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const showStamp = useCallback((text: string, tone: StampTone) => {
    stampId.current += 1;
    setStamp({ id: stampId.current, text, tone });
  }, []);

  /** 캔버스가 붙을 때 연출을 띄운다 — 탭을 옮기면 떨어지며 멈춘다(안 보이는 낚시터를 그리지 않는다) */
  const attachFx = useCallback((el: HTMLCanvasElement | null) => {
    fxRef.current?.stop();
    fxRef.current = null;
    const host = el?.parentElement;
    if (!el || !host) {
      setFx(null);
      return;
    }
    const f = new FishFx(el, host, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    f.start(host);
    fxRef.current = f;
    setFx(f);
  }, []);
  // 비 · 눈은 캔버스가 그린다 — 칩과 같은 기준(오래된 예보면 날씨를 모르는 것으로 친다)
  useEffect(() => {
    const wx = forecast && deviceClock() - forecast.fetchedAt < WEATHER_TTL_MS * 3 ? fishWxOf(wmoInfo(forecast.fc.current.weather_code).icon) : null;
    fx?.weather(wx === "rain" || wx === "snow" ? wx : null);
  }, [fx, forecast]);
  // 수조가 위에 열린 동안 낚시터는 그리지 않는다(수조는 3D 라 폰이 렌더를 둘 돌리면 프레임이 무너진다)
  useEffect(() => {
    if (!fx || (!tankOpen && !dialogOpen && phase !== "fever" && !raid)) return; // 피버 · 레이드는 전체 화면이라 뒤의 낚시터가 안 보인다
    fx.pause();
    return () => fx.resume();
  }, [fx, tankOpen, dialogOpen, phase, raid]);
  useEffect(() => {
    fx?.set({ phase, charge, holding, method });
  }, [fx, phase, charge, holding, method]);
  useEffect(() => {
    if (!fx || !row) return;
    const cur = fishingOf(row.state);
    fx.art((k) => (FISHING_IMAGE_KEYS.has(k) ? asset(`/fishing/${k}.webp`) : null), NETS[cur.net]?.key ?? NETS[0].key);
    const day = today || kstDate(clock()), place = currentSpot(cur, spotPick, day);
    fx.set({ rod: RODS[cur.rod]?.key ?? RODS[0].key, spot: place.key, bait: currentBait(cur, place, baitPick, methodOf(method).baitCost, day).bait.key });
    // 장비 꾸미기 — 이 폰의 사람이 낀 찌 · 줄 · 낚싯대 색(커플이 같이 사도 끼는 건 사람마다)
    const look = wornLooks(row.state, who);
    fx.setLook({ bobber: look.bobber.id, line: look.line.color, rodTint: look.rod.color });
  }, [fx, row, spotPick, today, baitPick, method, who]);
  // 앱을 켜 둔 채 자정을 넘겨도 오늘 값(지렁이 · 하트 한도 · 목표)이 어제에 머물지 않는다
  useEffect(() => {
    const iv = setInterval(() => setToday(kstDate(clock())), 60_000);
    return () => clearInterval(iv);
  }, []);
  // 집어등 밤 — 켜 둔 채 19시 · 5시를 넘겨도 막기 · 풀기가 따라온다(개발 빌드의 __fishNight 도 이 박자로 반영된다)
  useEffect(() => {
    const look = () => setNight(nightNow());
    look();
    const iv = setInterval(look, 30_000);
    return () => clearInterval(iv);
  }, []);

  const load = useCallback(async () => {
    const r = await loadIsland(coupleId).catch(() => null);
    setRow(r);
    setToday(kstDate(clock()));
    setLoaded(true);
  }, [coupleId]);
  useEffect(() => {
    void load();
  }, [load]);
  // 내 저장의 메아리(받은 버전 ≤ 지금 버전)는 다시 받지 않는다 — 저장할 때마다 섬 전체를 한 번 더 받았다
  useEffect(() => watchIsland(coupleId, (p) => {
    const v = (p?.new as { version?: unknown } | undefined)?.version;
    const cur = rowRef.current;
    if (typeof v === "number" && cur && v <= cur.version) return;
    void load();
  }), [coupleId, load]);

  /** 이 화면 · 공유 섬 저장소 중 더 새 행 — 저장 전에 다시 받지 않고 이걸로 먼저 해 본다 */
  const freshRow = useCallback((): IslandRow | null => {
    const a = rowRef.current, b = islandSnapshot(coupleId).row;
    if (!a) return b;
    if (!b) return a;
    return b.version > a.version ? b : a;
  }, [coupleId]);

  /** 동작 → 저장. 먼저 가진 행(버전)으로 바로 저장해 보고, 버전이 어긋나면(상대 · 수조가 그 사이 저장) 다시 읽어 두 번 더.
   *  예전엔 매번 섬 전체를 먼저 받고(GET) 저장(RPC)해서 팔기 한 번이 왕복 두 번이었다 — 겹치면 네 번. */
  const actTail = useRef<Promise<unknown>>(Promise.resolve());
  const actCount = useRef(0);
  /** queued 는 판의 저장(미끼 · 결과 · 주인) — 앞선 저장이 돌고 있어도 빠뜨리지 않고 줄 세운다. 사람이 누른 구매는 연타를 막으려고 그대로 버린다. */
  const act = useCallback(<R extends FishResult | GearResult>(make: (st: IslandState) => R, queued = false): Promise<R | null> => {
    if (!queued && busyRef.current) {
      setMsg("저장하는 중이에요. 잠시 후 다시 눌러 주세요.");
      return Promise.resolve(null);
    }
    busyRef.current = true;
    actCount.current += 1;
    setBusy(true);
    const run = async (): Promise<R | null> => {
    try {
      let cached = freshRow();
      // 실패한 저장의 표식 · 결과 — 응답만 잃고 실제로는 들어갔을 수 있다(2026-11-11 리뷰: 예전엔 모든 실패를 충돌로 보고 make 를 또 돌려 두 번 샀다)
      let lost: { mark: string; res: R } | null = null;
      for (let attempt = 0; attempt < 2; ) {
        const fromCache = cached !== null;
        const r = cached ?? (await loadIsland(coupleId).catch(() => null));
        cached = null;
        if (!fromCache) attempt++;
        if (!r) {
          setMsg("불러오지 못했어요. 잠시 후 다시 해 주세요.");
          return null;
        }
        // 다시 받은 섬에 그 저장의 표식이 있으면 들어간 것이다 — make 를 다시 돌리지 않고 성공으로(표식 링 _saves · lib/islandsync)
        const marks = (r.state as { _saves?: unknown })._saves;
        if (lost && Array.isArray(marks) && marks.includes(lost.mark)) {
          rowRef.current = r;
          setRow(r);
          setMsg(null);
          return lost.res;
        }
        lost = null;
        const res = make(r.state);
        if (!res.ok) {
          if (fromCache) continue; // 가진 행이 낡아서 안 된 걸 수도 있다 — 새로 받아 다시 판정
          setMsg(res.reason);
          setRow(r);
          return res;
        }
        const mark = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        try {
          const saved = await saveIsland(coupleId, r.version, res.state, mark);
          rowRef.current = saved; // 메아리가 오기 전에 버전을 맞춰 둔다(다시 받기 거르기)
          setRow(saved);
          setMsg(null);
          return res;
        } catch {
          /* 상대가 그 사이 섬을 바꿨다 · 가진 행이 낡았다 · 응답을 잃었다 — 다시 읽어서, 이 표식이 있으면 들어간 것 */
          lost = { mark, res };
          cached = null;
        }
      }
      // 마지막 저장도 실패했다 — 그래도 응답만 잃었을 수 있어 한 번 더 읽어 표식을 본다
      if (lost) {
        const r = await loadIsland(coupleId).catch(() => null);
        const marks = (r?.state as { _saves?: unknown } | undefined)?._saves;
        if (r && Array.isArray(marks) && marks.includes(lost.mark)) {
          rowRef.current = r;
          setRow(r);
          setMsg(null);
          return lost.res;
        }
      }
      setMsg("저장하지 못했어요. 잠시 후 다시 해 주세요.");
      return null;
    } finally {
      actCount.current -= 1;
      if (actCount.current === 0) {
        busyRef.current = false;
        setBusy(false);
      }
    }
    };
    const p = actTail.current.then(run, run);
    actTail.current = p;
    return p;
  }, [coupleId, freshRow]);

  /** 때가 되면 힘겨루기를 멈추고 피버로 넘어간다 */
  const feverNow = useCallback((dist: number, quality: number) => {
    const plan = feverPlan.current;
    if (!plan || dist > plan.triggerDist) return false;
    feverPlan.current = null;
    feverQ.current = quality;
    holdRef.current = false;
    setHolding(false);
    setStamp(null);
    setFeverSeed(Math.floor(dice() * 2 ** 31));
    setPhase("fever");
    buzz([30, 30, 30, 30, 90]);
    return true;
  }, []);

  const loseRound = useCallback((key: LostKey) => {
    if (roundEnded.current) return;
    roundEnded.current = true;
    coopCloseRef.current("lost"); // 도와주던 상대의 판을 접는다 — 늦은 결과는 묵은 판 번호라 버려진다
    const kind = LOST_FX[key];
    clearTimers();
    const lostBoss = bossOf(fishRef.current?.boss), lostFight = fightRef.current;
    if (lostBoss && lostFight) {
      // 깎은 양을 저장한다 — 저장할 때의 체력에서 뺀다(같은 때 상대가 깎은 몫이 사라지지 않게)
      const dealt = bossDealt(bossChunkRef.current || lostBoss.chunk, lostFight.dist), seen = bossSeenRef.current, hitId = bossHitRef.current;
      const left = Math.max(0.03, fightHpRef.current - dealt);
      setBossNote(left < fightHpRef.current - 0.005 ? `${lostBoss.name} 체력이 ${Math.round(left * 100)}%까지 줄었어요. 깎은 만큼 남아요` : `${lostBoss.name} 체력을 깎지 못했어요. 더 끌어와 보세요`);
      if (dealt > 0.0005) void act((s) => bossLost(s, lostBoss.key, dealt, kstDate(clock()), who, seen, hitId), true).then((r) => { if (r && !r.ok) setBossNote(r.reason); });
    }
    setLost(key);
    setHolding(false);
    holdRef.current = false;
    fxRef.current?.lost(kind);
    showStamp(LOST_STAMP[kind], "miss");
    buzz(kind === "snapped" ? [120, 40, 60] : 60);
    setPhase("lost");
  }, [showStamp, act, who]);

  /** 주인 토벌 저장 — 보상 문구는 저장이 된 뒤에(먼저 띄우면 저장이 실패해도 '받았다'고 말하게 된다).
   *  seen = 판을 열 때 본 출현 번호. 레이드는 판이 끝나자마자 부르고, 찌낚시는 끌어올릴 때(landRound) 부른다 */
  const saveBossWin = useCallback((beaten: FishBoss, seen: number): Promise<BossSaved> => {
    let pay = 0, share = "", winShare = { me: 1, you: 0 }, paid = false;
    return act((s) => {
      const rec = bossRecOf(s, beaten.key), day = kstDate(clock());
      const won = bossWon(s, beaten.key, who, day, seen);
      // 이미 저장된 내 토벌(응답을 못 받아 다시 저장)이면 그대로 돌려받는다 — 보상 문구는 그때 값으로
      paid = won.ok && won.state !== s;
      pay = bossReward(beaten, paid ? rec?.caught ?? 0 : Math.max(0, (rec?.caught ?? 1) - 1));
      // 둘이 깎은 몫 — 마지막 일격이 남은 체력을 가져간다(bossBeaten 이 last 에 남긴 값)
      const last = won.ok ? bossRecOf(won.state, beaten.key)?.last : undefined;
      share = "";
      if (last && coupleId) {
        const me = last.dmg[who] ?? 0, you = Object.entries(last.dmg).filter(([k]) => k !== who).reduce((a, [, v]) => a + v, 0);
        if (you > 0) share = ` · 둘이 함께 잡았어요(나 ${Math.round(me * 100)}% · 상대 ${Math.round(you * 100)}%)`;
        winShare = { me, you };
      }
      return won;
    }, true).then((r) => ({
      res: r,
      win: r?.ok ? { id: Date.now(), name: beaten.name, ...winShare } : null,
      note: r?.ok ? `${josa(beaten.name, "을/를")} 잡았어요! 보상 ${pay.toLocaleString()}하트${share}` : r ? r.reason : `${josa(beaten.name, "을/를")} 잡았지만 보상을 저장하지 못했어요`,
    }));
  }, [act, who, coupleId]);

  /** 끌어올렸다 — 실루엣으로 뜸을 들이고(귀할수록 길게) 그다음 공개. 쓰레기도 같은 물고기 실루엣이라 공개 순간까지 모른다. */
  const landRound = useCallback((q: number) => {
    if (roundEnded.current) return;
    roundEnded.current = true;
    const c = fishRef.current;
    const grade = gradeRef.current;
    const cur = rowRef.current;
    const beaten = bossOf(c?.boss);
    if (beaten) {
      // 레이드 토벌은 판이 끝날 때 이미 저장했다(bossPaid) — 여기선 알리기만. 찌낚시는 지금 저장한다
      const paid = bossPaid.current;
      bossPaid.current = null;
      void (paid ? Promise.resolve(paid) : saveBossWin(beaten, bossSeenRef.current)).then(({ win, note }) => {
        if (win) setBossWin(win);
        setBossNote(note);
      });
    }
    setQuality(q);
    setHolding(false);
    holdRef.current = false;
    fxRef.current?.land(grade, true);
    buzz([50, 40, 140]);
    setIsNew(!!c && !c.junk && !c.special && !!cur && !fishingOf(cur.state).seen.includes(catchArt(c)));
    setStamp(null); // 힘겨루기 때 찍힌 글자판이 실루엣을 가리면 안 된다
    setPhase("reveal");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.push(setTimeout(() => {
      setPhase("landed");
      if (!c) return;
      // 특별한 것(유리병 편지 · 보물 — fishplus.ts) — 꽝 수집함 · 순위판에 안 들어간다
      if (c.special) {
        coopCloseRef.current("done"); // 담기 판정이 없어 보너스가 쓸 데가 없다
        const t = clock();
        fxRef.current?.junked();
        showStamp(c.special.kind === "bottle" ? "유리병!" : "보물!", "gold");
        buzz([40, 30, 120]);
        const sctx = specialCtxRef.current?.(t);
        void act((s) => sctx ? landSpecial(s, c, sctx) : { ok: false, reason: "다시 던져 주세요" }, true).then((r) => {
          if (r?.ok) { setResult(r); setPhase("result"); } else setPhase("ready");
        });
        return;
      }
      if (!c.junk) {
        const fresh = !!cur && !fishingOf(cur.state).seen.includes(catchArt(c));
        fxRef.current?.reveal(grade);
        if (grade >= 3) showStamp(`${c.grade}!`, "gold");
        else if (fresh) showStamp("새 물고기!", "gold");
        buzz(grade >= 5 ? [60, 40, 60, 40, 200] : grade >= 3 ? [40, 30, 120] : 30);
        return;
      }
      const t = clock();
      coopCloseRef.current("done");
      fxRef.current?.junked();
      showStamp("꽝!", "miss");
      buzz([30, 60, 30]);
      void act((s) => haulJunk(s, c, kstDate(t)), true).then((r) => {
        if (r?.ok) {
          void reportCatch(myName, c, q, false, false).then(noteStanding);
          setResult(r);
          setPhase("result");
        } else {
          setPhase("ready");
        }
      });
    }, revealMs(grade, reduced)));
  }, [act, showStamp, myName, noteStanding, saveBossWin]);

  // 낚싯대 젖히기 · 모든 방식의 진행이 같은 박자로 돈다. 프레임이 밀려도 한 번에 0.1초까지만 센다.
  useEffect(() => {
    if (phase !== "charge" && phase !== "fight" && phase !== "lure" && phase !== "aim" && phase !== "lift" && phase !== "glow") return;
    let last = deviceClock();
    const iv = setInterval(() => {
      const now = deviceClock();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (pausedRef.current) return;
      if (roundEnded.current) return; // 끝난 판의 상태(landed · snapped …)는 그대로 남아 있다 — 다시 보면 끝 처리가 두 번 돈다
      const fxn = fxRef.current;
      if (phase === "charge") {
        const angle = keySpin.current ? dt * 2.6 * Math.PI * 2 : spinPending.current;
        spinPending.current = 0;
        if (keySpin.current) castAngRef.current += angle;
        const next = stepSpin(spinRef.current, angle, dt);
        spinRef.current = next;
        setSpinLive(next);
        setCharge(next.energy);
        fxn?.set({ castAng: castAngRef.current });
        return;
      }
      if (phase === "lure") {
        const cur = lureRef.current, tune = lureTuneRef.current, c = fishRef.current;
        if (!cur || !tune || !c) return;
        const next = stepLure(cur, dt, tune, fightLevel(c));
        lureRef.current = next;
        setLureS(next);
        fxn?.set({ beat: lureRing(next, tune), beatHot: Math.abs(next.t - next.nextBeat) <= tune.window, interest: next.interest, line: next.line });
        if (next.status === "empty") loseRound("empty");
        return;
      }
      if (phase === "glow") {
        const cur = lightRef.current, tune = lightTuneRef.current, c = fishRef.current;
        if (!cur || !tune || !c) return;
        const strike = lightStrike.current;
        lightStrike.current = false;
        const next = stepLight(cur, dt, { hold: holdRef.current, strike }, tune);
        lightRef.current = next;
        setLightS(next);
        const band = lightBand(next, tune);
        fxn?.lanternSet(next.bright, band.lo, band.hi, next.school, next.scare);
        if (cur.status !== "surge" && next.status === "surge") {
          fxn?.lanternSurge();
          buzz([30, 20, 60]);
        }
        if (cur.status === "gather" && next.status === "ready") buzz(15);
        if (next.status === "hooked") {
          // 걸렸다 — 3막(짧은 힘겨루기). 감기는 속도가 빠르고 줄은 조금 더 팽팽하다(lightFightTune)
          const h = lightHook(next, tune);
          lightQ.current = { gather: lightQuality(next), hook: h.q };
          fxn?.lanternEnd(true);
          setPerfectHook(h.perfect);
          fxn?.hook(h.perfect);
          showStamp(h.perfect ? "완벽한 챔질!" : "걸렸다!", h.perfect ? "gold" : "hit");
          buzz([25, 20, 90]);
          const ft = lightFightTune(fightLevel(c), effRef.current, c.family);
          planFeverRef.current();
          const f = startFight(Math.floor(dice() * 2 ** 31), ft);
          tuneRef.current = ft;
          fightRef.current = f;
          setFight(f);
          setPhase("fight");
          return;
        }
        const lostKey = next.status === "scared" ? "lightScare" : next.status === "gone" ? "lightGone" : next.status === "early" ? "lightEarly" : next.status === "missed" ? "lightMiss" : null;
        if (lostKey) {
          fxn?.lanternEnd(false);
          loseRound(lostKey);
        }
        return;
      }
      if (phase === "lift") {
        const cur = liftRef.current, tune = liftTuneRef.current;
        if (!cur || !tune) return;
        const next = stepLift(cur, dt, holdRef.current, liftCounter.current, tune);
        liftRef.current = next;
        setLiftS(next);
        fxn?.liftSet(next.h, next.tilt, next.kickLeft > 0);
        if (cur.warnLeft <= 0 && next.warnLeft > 0) {
          fxn?.warn("surge");
          buzz(15);
        }
        if (cur.kickLeft <= 0 && next.kickLeft > 0) buzz([25, 20, 25]);
        const q = (netQ.current + liftQuality(next)) / 2;
        if (next.status === "on" && feverNow(1 - next.h, q)) return;
        if (next.status === "landed") {
          fxn?.liftEnd(true);
          landRound(q);
        } else if (next.status === "dropped") {
          fxn?.liftEnd(false);
          loseRound("netDrop");
        }
        return;
      }
      if (phase === "aim") {
        const cur = scoopRef.current;
        if (!cur) return;
        const next = stepScoop(cur, dt);
        scoopRef.current = next;
        setScoopS(next);
        fxn?.setShoal(next.fish.filter((_, i) => i !== next.caught).map((f) => {
          const p = scoopPos(f, next.clock);
          return { id: f.id, x: p.x, y: p.y, h: p.h, z: p.z, reach: p.reach, size: shadowSize(f.haul), grade: GRADES.indexOf(f.haul.grade), junk: !!f.haul.junk };
        }));
        if (next.status === "out" && !plunging.current) {
          fxn?.setShoal([]);
          loseRound(next.shots <= 0 ? "out" : "time");
        }
        return;
      }
      const how = methodRef.current;
      if (how === "lure") {
        const cur = swayRef.current, tune = swayTuneRef.current;
        if (!cur || !tune) return;
        const next = stepSway(cur, dt, rodXRef.current, tune);
        swayRef.current = next;
        setSwayS(next);
        fxn?.set({ tension: next.tension, dist: next.dist, rodX: rodXRef.current, fishX: next.fishX });
        if (cur.warnLeft <= 0 && next.warnLeft > 0) {
          fxn?.warn("surge");
          buzz(15);
        }
        if (next.status === "on" && feverNow(next.dist, (lureQuality(lureRef.current ?? { hits: 0, beats: 0 }) + swayQuality(next)) / 2)) return;
        if (next.status === "on") coopAskRef.current(next.dist);
        if (next.status === "landed") landRound((lureQuality(lureRef.current ?? { hits: 0, beats: 0 }) + swayQuality(next)) / 2);
        else if (next.status === "snapped") loseRound("swaySnap");
        else if (next.status === "escaped") loseRound("escaped");
        return;
      }
      if (how === "deep") {
        const cur = deepRef.current, tune = deepTuneRef.current;
        if (!cur || !tune) return;
        const raw = keySpin.current ? 1.35 : spinAcc.current / (Math.PI * 2) / Math.max(0.001, dt);
        spinAcc.current = 0;
        spinNow.current += (raw - spinNow.current) * Math.min(1, dt * 7);
        const rps = spinNow.current < 0.03 ? 0 : spinNow.current;
        const next = stepDeep(cur, dt, rps, tune);
        deepRef.current = next;
        setDeepS(next);
        setSpin(rps);
        fxn?.set({ tension: next.tension, dist: next.depth, spin: rps });
        if (cur.warnLeft <= 0 && next.warnLeft > 0) {
          fxn?.warn("dive");
          buzz(15);
        }
        if (cur.diveLeft <= 0 && next.diveLeft > 0) {
          fxn?.surge("surge");
          buzz([35, 30, 35]);
        } else if (cur.diveLeft > 0 && next.diveLeft <= 0) {
          fxn?.surgeEnd();
        }
        if (next.status === "on" && feverNow(next.depth, deepQuality(next))) return;
        if (next.status === "on") coopAskRef.current(next.depth);
        if (next.status === "landed") landRound(deepQuality(next));
        else if (next.status === "snapped") loseRound("spinSnap");
        else if (next.status === "slack") loseRound("idle");
        else if (next.status === "escaped") loseRound("escaped");
        return;
      }
      const cur = fightRef.current, tune = tuneRef.current;
      if (!cur || !tune) return;
      const next = stepFight(cur, dt, holdRef.current, tune);
      fightRef.current = next;
      setFight(next);
      fxn?.set({ tension: next.tension, dist: next.dist });
      if (cur.warnLeft <= 0 && next.warnLeft > 0) {
        fxn?.warn(next.event);
        buzz(15);
      }
      if (cur.surgeLeft <= 0 && next.surgeLeft > 0) {
        fxn?.surge(next.event);
        buzz(next.event === "jump" ? 25 : [35, 30, 35]);
      } else if (cur.surgeLeft > 0 && next.surgeLeft <= 0) {
        fxn?.surgeEnd();
      }
      // 주인이 체력 3분의 2 · 3분의 1 밑으로 밀리면 화가 난다 — 그 자리에서 힘겨루기가 거칠어진다
      const fb = bossOf(fishRef.current?.boss);
      if (fb && next.status === "on") {
        const p = bossPhase(bossLeft(fightHpRef.current, bossChunkRef.current || fb.chunk, next.dist));
        if (p > bossPhaseRef.current) {
          bossPhaseRef.current = p;
          tuneRef.current = bossTune(fb, bossEffRef.current, p === 2 ? 0.2 : 0.5);
          setBossRage(p);
          fxn?.rage(p);
          showStamp(`${fb.name} ${BOSS_PHASE_NAME[p]}!`, "miss");
          buzz([60, 40, 60, 40, 160]);
        }
      }
      // 집어등은 모으기 · 챔질 솜씨도 같이 센다(점수 · 포획 확률의 quality)
      const fq = how === "light" ? lightTotalQuality(lightQ.current.gather, lightQ.current.hook, fightQuality(next)) : fightQuality(next);
      if (next.status === "on" && feverNow(next.dist, fq)) return;
      if (next.status === "on") coopAskRef.current(next.dist);
      if (next.status === "landed") {
        const b = bossOf(fishRef.current?.boss);
        if (b && bossLeft(fightHpRef.current, bossChunkRef.current || b.chunk, 0) > 0) loseRound("bossBroke");
        else landRound(fq);
      } else if (next.status === "slack") loseRound("slack");
      else if (next.status !== "on") loseRound(next.status);
    }, 33);
    return () => clearInterval(iv);
  }, [phase, loseRound, landRound, feverNow, showStamp]);

  /** 닫기 — 판이 돌아가는 중이면 먼저 묻는다. 끌어올린 물고기를 말없이 버리지 않는다. 바로 닫히면 true. */
  const requestClose = useCallback((): boolean => {
    if (phase === "reveal" || phase === "scoop") return false; // 곧 끝나는 공개 · 담기 — 결과를 보고 닫는다
    if (phase === "landed" && fish && !fish.junk) {
      const c = fish;
      void ask(c.boss ? { message: "주인을 수조에 담지 않고 닫을까요?", detail: "잡은 기록과 보상은 남아요. 물고기는 시장으로 가요.", confirmText: "닫기", cancelText: "담으러 가기" } : { message: "잡은 물고기를 팔고 닫을까요?", detail: "수조에 담으려면 '계속 낚시'를 눌러 주세요.", confirmText: "팔고 닫기", cancelText: "계속 낚시" }).then(async (ok) => {
        if (!ok) return;
        const t = clock();
        const r = await act((s) => trophyRef.current(sellCatch(s, c, kstDate(t), by), c, t), true);
        if (r?.ok) void reportCatch(myName, c, quality, perfectHook, false);
        onClose();
      });
      return false;
    }
    if (phase === "fever") return false; // 전체 화면이라 확인창이 가려진다 — 길어야 10초면 끝난다
    if (phase === "charge" || phase === "wait" || phase === "bite" || phase === "lure" || phase === "aim" || phase === "lift" || phase === "glow" || phase === "fight") {
      void ask({ message: "지금 닫으면 이번 판은 끝나요", detail: "쓴 미끼는 돌아오지 않아요. 그동안 판은 멈춰 있어요.", confirmText: "닫기", cancelText: "계속 낚시" }).then((ok) => {
        if (ok) onClose();
      });
      return false;
    }
    onClose();
    return true;
  }, [phase, fish, act, ask, myName, quality, perfectHook, onClose, by]);
  useBackClose(requestClose);
  const closePrep = useCallback(() => setSheetOpen(false), []);
  const prepRef = useDialogFocus(sheetOpen, closePrep);
  const prepBack = useBackdropClose(closePrep);
  useBackClose(() => setSheetOpen(false), sheetOpen);
  useBackClose(() => setWorldSheet(null), worldSheet !== null);
  // 상대가 낚으면 원정 게이지가 오른다 — 그때 한 번 알려 준다(내가 판을 돌리는 중엔 방해하지 않는다)
  const partnerCount = row ? Object.entries(fishingOf(row.state).exped?.by ?? {}).filter(([k]) => k !== who).reduce((n, [, v]) => n + v, 0) : null;
  useEffect(() => {
    if (partnerCount === null) return;
    const before = partnerSeen.current;
    partnerSeen.current = partnerCount;
    if (before === null || partnerCount <= before || phase !== "ready") return;
    noteId.current += 1;
    setTapNote({ id: noteId.current, text: `상대가 ${partnerCount - before}마리 낚았어요 · 원정 게이지가 올랐어요`, tone: "good" });
  }, [partnerCount, phase]);

  /* 함께 끌어올리기(2026-11-12, lib/fishcoop) — 커플 섬에서 둘이 낚시 화면에 있을 때만. 혼자 섬(coupleId 없음)엔 채널을 열지 않는다.
   * 부탁을 받을 수 있는 때: 낚시터 탭이 보이고, 판을 돌리지 않고(준비 · 놓침 · 결과), 시트 · 수조 · 확인창 · 레이드가 안 열렸을 때 */
  const coopReady = tab === "fish" && !tankOpen && !sheetOpen && worldSheet === null && !raid && !dialogOpen && !swapOpen && (phase === "ready" || phase === "lost" || phase === "result");
  const coop = useFishCoop({ coupleId, me: who, ready: coopReady, rootRef: coopRootRef });
  // 33ms 루프가 부른다 — 끝자락(남은 거리 30% 아래)에 상대가 받을 수 있으면 한 판에 한 번 "도와줘!"
  coopAskRef.current = (dist: number) => {
    const c = fishRef.current;
    if (!wantHelp({ linked: coop.partnerRef.current.present, partnerReady: coop.partnerRef.current.ready, method: methodRef.current, boss: !!c?.boss, dist, coop: coop.stateRef.current, asked: coopAskedRef.current !== null })) return;
    const round = coopRoundId(who, Date.now(), Math.random());
    coopAskedRef.current = round;
    setCoopRound(round);
    coop.ask(round);
  };
  coopCloseRef.current = (why) => coop.close(why);
  // 소식 한 줄 — 내가 부른 판(A)과 도와주던 판(B) 둘 다. 판 도중엔 글자판 대신 작은 한 줄이라 손을 방해하지 않는다
  const coopNote = coop.note;
  useEffect(() => {
    if (!coopNote) return;
    const text = { accepted: "상대가 뜰채를 들었어요", helped: "상대가 뜰채로 받쳤어요 · 담기 확률이 올라요", missed: "상대가 놓쳤어요 · 혼자 마저 끌어올려요", fallback: "상대가 오지 못했어요 · 혼자 끌어올려요", partnerLeft: "상대가 낚시 화면을 떠났어요", partnerDone: "상대가 먼저 끝냈어요" }[coopNote.note];
    noteId.current += 1;
    setTapNote({ id: noteId.current, text, tone: coopNote.note === "helped" || coopNote.note === "accepted" ? "good" : "miss" });
    if (coopNote.note === "helped") buzz([30, 30, 90]);
  }, [coopNote]);
  // "도와줘!" — 부탁을 보낸 순간 한 번(자동으로 보낸다 — 손은 낚싯대에 있다)
  const coopAsking = coop.coop.k === "askSent";
  useEffect(() => {
    if (!coopAsking) return;
    noteId.current += 1;
    setTapNote({ id: noteId.current, text: "도와줘! 상대에게 뜰채를 부탁했어요", tone: "good" });
    buzz(20);
  }, [coopAsking]);

  const shell = (children: ReactNode) => (
    <div ref={coopRootRef} className="aqua-shell fish-shell fixed inset-0 z-[90] overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-md pb-10">
        {!tankOpen && <GameHead title="낚시" coins={row?.state.coins} onClose={requestClose} />}
        {children}
      </div>
    </div>
  );

  if (!loaded) return shell(<p className="p-6 text-center text-sm">불러오는 중…</p>);
  if (!row) {
    return shell(
      <div className="p-6 text-center">
        <p className="text-sm">낚시는 섬에 기록돼요. 먼저 섬을 시작해 주세요.</p>
        <ActionButton main className="mt-4" onClick={onOpenIsland}>우리 섬으로 가기</ActionButton>
      </div>,
    );
  }

  const st = row.state;
  const fs = fishingOf(st);
  // 특별한 것(유리병 편지 · 보물) 뽑기 · 끌어올리기에 넘기는 것 — 끌어올릴 때는 그때의 낚시터 · 방식을 다시 읽는다(ref)
  // 반짝 미끼(만든 미끼)는 lure 로 특별한 것이 걸릴 확률을 올린다 — 던질 때 쓸 미끼(craft)로 본다
  const specialCtx = (seed: number, t: number): SpecialCtx => ({ who, couple: !!coupleId, spot, method, seed, now: t, today: kstDate(t), cast: castScoreRef.current, lure: craftFx.special });
  specialCtxRef.current = (t: number) => specialCtx(Math.floor(t) % 2147483647, t);
  // 수집 탭 · 장비 아래 칸이 받는 것(FishCollect 의 FishTabProps)
  const tabProps = { st, fs, who, couple: !!coupleId, busy, today, now: clock(), myName, act: (make: (s: IslandState) => FishResult | GearResult) => act(make) };
  const spot = currentSpot(fs, spotPick, today);
  // 낚시터 숙련도의 행운 덤을 여기서 한 번 얹는다 — 뽑기 · 뜰채 · 피버 · 물고기 표가 같은 값을 본다
  // 도시락 · 수조 행운(buffedStats) + 낚싯대 별 강화 · 장비 세트(lib/fishlooks) + 낚시터 숙련도 행운 — 판에 쓰는 능력치는 이 한 줄이다
  const eff = withMasteryLuck(gearStats(st, fs, clock()), st, spot.key);
  effRef.current = eff;
  const buff = st.buffs?.hunt && st.buffs.hunt.until > clock() ? st.buffs.hunt.amount : 0;
  const look = spotLookOf(st, spot.key);
  trophyRef.current = (r, c, t) => noteTrophy(r, c, { who, by: myName.trim() || readFishNick(), spot: spot.key, day: kstDate(t) });
  // 달(2026-11-12 물때 · 달) — 때와 같은 서버 시각(gameNow)의 KST 로 센다. 둘이 같은 물때 · 같은 보름달 밤을 본다
  const moment: FishMoment = { time: fishTimeOf(clock()), wx: forecast && deviceClock() - forecast.fetchedAt < WEATHER_TTL_MS * 3 ? fishWxOf(wmoInfo(forecast.fc.current.weather_code).icon) : null, moon: moonMomentOf(clock()) };
  const tide = tideOf(clock()), moonNow = moonPhase(clock());
  const guests = timedAt(spot.key, moment);
  const baseBoss = bossAt(spot.key);
  const awakeBoss = awakeBossAt(st, spot.key);
  const boss = awakeView && awakeBoss ? awakeBoss : baseBoss;
  // 각성한 주인의 기록은 fishPlus 에 있다 — 기록 · 도전 판정은 key 로 가르는 bossRecOf · bossWhyOf 한 곳
  const bossRec = boss ? bossRecOf(st, boss.key) : undefined;
  const bossWhy = boss ? bossWhyOf(st, boss, who, today) : null;
  const activeBoss = boss && bossPick === boss.key && !bossWhy ? boss : null;
  const exped = expedFor(fs, today, !!coupleId);
  // 정산한 수조 — 교체 목록의 돌려받는 하트 · 모습이 방금 자란 물고기를 반영한다(B12: 예전엔 정산 전 값이라 막 다 큰 물고기가 0 하트로 보였다)
  const aq = syncAqua(st, clock()).a;
  const how = methodOf(method);
  // 만든 미끼(fishcraft.ts) — 골랐고 여기서 던질 수 있으면 그 단계의 산 미끼로 뽑고(bait 는 늘 BAITS 안의 것), 횟수 · 덤만 만든 미끼에서. 아니면 산 미끼로 넘어간다
  const craft = craftInUse(st, fs, spot, method, craftPick, today, night);
  const craftFx = craftEffects(craft?.key, { spot, method, when: moment });
  const { shown, bait } = craft ? craftAsBait(craft) : currentBait(fs, spot, baitPick, how.baitCost, today);
  const baitLeft = craft ? craftLeft(st, craft.key) : baitStock(fs, bait.key, today);
  const shownLeft = baitStock(fs, shown.key, today);
  const blocked = craft ? castBlockCraft(st, fs, spot, method, craft.key, today, night) : castBlock(fs, spot, method, bait.key, today, night);
  const craftNote = craftPick && !craft ? CRAFT_BAITS.find((x) => x.key === craftPick) : undefined;
  // 피버를 다 맞힌 물고기는 반드시 담긴다 — 등급업이 드문 만큼 성공의 값어치를 여기서 준다
  // 함께 끌어올렸으면 +15%p(최대 95%) — 이 판 번호의 결과만(coopBonus). 저장은 이 화면(낚는 사람)만 한다.
  // 담기 · 팔기를 누르면 협동 상태를 접으므로, 저장이 실패해 다시 누를 때도 보너스가 남게 이 판 동안은 coopHelped 로 붙잡는다
  const coopHelpedNow = coopBonus(coop.coop, coopRound) || coopHelped;
  const coopWaiting = !!coopRound && (coop.coop.k === "askSent" || (coop.coop.k === "helping" && coop.coop.role === "angler"));
  const soloChance = fish ? (feverWon || fish.boss ? 1 : captureChance(eff.catch, fish.difficulty, quality, perfectHook, method, craftEffects(roundCraft, { spot, method }).capture)) : 0;
  // coopChance 는 1(피버 · 주인)을 낮추지 않는다
  const chance = fish ? coopChance(soloChance, coopHelpedNow) : 0;
  /** 상대를 돕는 중(받기 창 · 들어올리기 · 결과) — 그동안 내 낚시터 누르기는 던지기가 아니다 */
  const coopHelping = coop.coop.k === "prompt" || ((coop.coop.k === "helping" || coop.coop.k === "result") && coop.coop.role === "helper");
  const block = fish ? storeBlock(st, fish) : null;
  const playing = phase !== "ready" && phase !== "lost" && phase !== "result";

  /** 피버타임 결과 — 실패하면 무조건 놓치고, 성공하면 바로 끌어올리며 1~5% 로 등급이 오른다 */
  function endFever(won: boolean, left: number) {
    setFeverSeed(null);
    if (!won) {
      loseRound("fever");
      return;
    }
    setFeverWon(true);
    const c = fishRef.current;
    if (c && dice() < upgradeChance(left)) {
      const up = upgradeCatch(c, spot, roundBait.current, eff.luck, Math.floor(dice() * 2 ** 31), moment);
      if (up !== c) {
        fishRef.current = up;
        gradeRef.current = GRADES.indexOf(up.grade);
        setFish(up);
        setFeverNote("피버 성공! 등급이 올랐어요 · 수조에 꼭 담겨요");
      } else {
        setFeverNote("피버 성공! 수조에 꼭 담겨요");
      }
    } else {
      setFeverNote("피버 성공! 수조에 꼭 담겨요");
    }
    landRound(feverQ.current);
  }

  /** 저장이 안 된 판을 물린다 — 이유는 act 가 msg 에 남긴다 */
  function abortRound() {
    clearTimers();
    clearRound(); // 협동도 여기서 접힌다(clearRound)
    roundEnded.current = true;
    holdRef.current = false;
    setHolding(false);
    setPhase("ready");
  }

  /** 미끼 쓰기 — 화면은 기다리지 않는다. 그 사이 상대가 마지막 미끼를 썼거나 저장이 끝내 안 됐으면 판을 물린다(미끼 없이 낚는 판이 생기지 않게). */
  function payBait(castM = 0) {
    // 밤 판정은 던지는 순간 다시 본다 — 화면의 night 는 30초 박자라 19시 · 5시 경계에서 한 박자 늦을 수 있다
    const t = clock(), key = bait.key, sp = spot, m = method, ck = craft?.key ?? null, night = nightNow();
    roundBait.current = baitIndex(key);
    setRoundCraft(ck);
    // 만든 미끼는 fishPlus.craft 에서 센다(산 미끼 · 공짜 지렁이는 그대로) — 뽑기는 위에서 그 단계 산 미끼(key)로 했다
    void act((s) => ck ? spendCraft(s, sp, m, ck, kstDate(t), castM, night) : spendBait(s, sp, m, key, kstDate(t), castM, night), true).then((r) => {
      if (!r?.ok) abortRound();
    });
  }

  /** 레이드를 연다 — 도전 한 번을 먼저 쓰고(하루 3번), 저장된 체력 · 협공 · 상대가 남긴 상처로 판을 준비한다.
   *  여는 저장이 도는 동안은 낚시터 누르기를 막고(press), 돌아왔을 때 그 사이 판이 시작됐으면 도전을 돌려준다 */
  function openRaid(b: FishBoss) {
    if (raidOpening.current || raidRef.current) return;
    if (phase !== "ready" && phase !== "lost" && phase !== "result") { setMsg("지금 판을 끝낸 뒤에 도전해요"); return; }
    const day = kstDate(clock());
    raidOpening.current = true;
    // 여는 저장이 거절돼도 잠금은 풀린다(예전엔 then 안에서만 풀어, 거절되면 낚시터 누르기 · 레이드 열기가 영영 막혔다)
    void act((s) => bossOpen(s, b.key, who, day), true).catch(() => null).then((res) => {
      raidOpening.current = false;
      if (!res?.ok) return;
      const now = phaseRef.current;
      if ((now !== "ready" && now !== "lost" && now !== "result") || raidRef.current) {
        void act((s) => bossRefund(s, b.key, who, day), true);
        return;
      }
      const rec = bossRecOf(res.state, b.key);
      // 이 판 몫의 도전은 이미 썼다 — 협공은 '오늘 상대도 겨뤘나'라 연 뒤의 기록으로 본다
      const hp = bossHp(rec, day), duo = !!coupleId && bossDuo(rec, who, day);
      raidResult.current = null;
      raidSave.current = null;
      setBossNote(null);
      setRaid({ key: b.key, seen: rec?.caught ?? 0, name: b.name, species: b.species, seed: Math.floor(dice() * 2 ** 31), tune: raidTune(b.difficulty, bossPhase(hp), eff), hp, chunk: bossChunk(b, rec, who, day), wound: coupleId ? partnerWound(rec?.log, who, day) : 0, duo, triesLeft: bossTriesLeft(rec, who, day), bg: FISHING_IMAGE_KEYS.has(spotArtKey(spot)) ? asset(`/fishing/${spotArtKey(spot)}.webp`) : undefined });
    }).finally(() => {
      raidOpening.current = false;
    });
  }
  /** 판이 끝났다 — 한 번만 온다. 결과 창을 닫기 전에 바로 저장한다(토벌 · 깎은 양). 앱이 꺼져도 남게 */
  function endRaid(r: Raid) {
    const cur = raidRef.current;
    if (!cur || raidResult.current) return;
    raidResult.current = r;
    const day = kstDate(clock());
    if (r.end === "kill") {
      const b = bossOf(cur.key);
      if (b) raidSave.current = saveBossWin(b, cur.seen);
      return;
    }
    // 깎은 양(chunk × 점수)을 저장한다 — 연 때의 체력이 아니라 저장할 때의 체력에서 뺀다(둘이 같은 때 싸워도 둘 다 남는다)
    const dealt = cur.chunk * raidScore(r);
    if (dealt <= 0.0005) return;
    raidSave.current = act((s) => bossLost(s, cur.key, dealt, day, who, cur.seen, cur.seed), true).then((res) => {
      const rec = res?.ok ? bossRecOf(res.state, cur.key) : undefined;
      const left = rec ? bossHp(rec, day) : Math.max(0.03, raidLeft(cur.hp, cur.chunk, r));
      return { res, win: null, note: res?.ok ? `${cur.name} 체력을 ${Math.round(cur.hp * 100)}% → ${Math.round(left * 100)}%로 깎았어요` : res ? res.reason : "깎은 체력을 저장하지 못했어요" };
    });
  }
  /** 안내 화면에서 나갔다 — 아직 겨루지 않았으니 쓴 도전을 돌려준다 */
  function quitRaid() {
    const cur = raidRef.current;
    setRaid(null);
    if (cur) void act((s) => bossRefund(s, cur.key, who, kstDate(clock())), true);
  }
  /** 결과 창을 닫는다 — 판 끝에 건 저장이 끝난 뒤에. 토벌이면 끌어올리기(landRound — 알리기만, 보상은 이미 저장)로, 상대가 먼저 잡았으면 끌어올리지 않는다 */
  function closeRaid() {
    const cur = raidRef.current, r = raidResult.current;
    if (!cur || raidClosing.current) return;
    if (!r) { setRaid(null); return; }
    raidClosing.current = true;
    // 판 끝 저장을 기다린다 — 끝나지 않거나(끊긴 연결) 거절되면 예전엔 결과 창이 닫히지 않고 닫기도 다시 안 먹었다.
    // 시간 제한이 지나면 창을 닫고 '저장 중'이라 알린다. 그 저장은 계속 가고, 늦게 끝나면 그 결과(note)를 알린다.
    void withTimeout(raidSave.current ?? Promise.resolve(null), RAID_CLOSE_TIMEOUT_MS, (late) => {
      if (late) setMsg(late.note);
    }).then((saved) => {
      raidSave.current = null;
      setRaid(null);
      if (r.end !== "kill") {
        setMsg(saved ? saved.note : `${cur.name} 체력을 깎지 못했어요`);
        return;
      }
      const b = bossOf(cur.key);
      if (!b) return;
      if (saved?.res && !saved.res.ok) { setMsg(saved.note); return; } // 상대가 먼저 잡았다 — 이 판의 토벌은 없다
      // 끌어올리기 — 찌낚시로 잡았을 때와 같은 길(공개 · 수조에 담기 · 결과 카드). 보상은 위에서 저장했다
      clearRound();
      const c = bossCatch(b);
      gradeRef.current = GRADES.indexOf(c.grade);
      fishRef.current = c;
      setFish(c);
      roundEnded.current = false;
      bossPaid.current = saved ?? { res: null, win: null, note: `${josa(b.name, "을/를")} 잡았지만 보상을 저장하지 못했어요` };
      landRound(1);
    }, (e: unknown) => {
      // 토벌이어도 끌어올리기(landRound)는 하지 않는다 — 저장이 늦게 들어갈 수 있어 '보상을 저장하지 못했어요'라 말할 수 없다
      raidSave.current = null;
      setRaid(null);
      setMsg(e instanceof Error && e.message === "upload-timeout" ? `${cur.name} 결과를 저장 중이에요 — 끝나면 알려 드릴게요` : `${cur.name} 결과를 저장하지 못했어요`);
    }).finally(() => {
      raidClosing.current = false;
    });
  }

  function clearRound() {
    setRoundCraft(null);
    setLost(null);
    setResult(null);
    setFish(null);
    fishRef.current = null;
    setIsNew(false);
    setRankNote(null);
    setFeverNote(null);
    setFeverWon(false);
    setSwapOpen(false);
    feverPlan.current = null;
    setStamp(null);
    setTapNote(null);
    setFight(null);
    setLureS(null);
    setSwayS(null);
    setScoopS(null);
    setDeepS(null);
    setLiftS(null);
    liftRef.current = null;
    setLightS(null);
    lightRef.current = null;
    lightStrike.current = false;
    lightQ.current = { gather: 0, hook: 0 };
    fightRef.current = null;
    setPicked(null);
    setBossNote(null);
    setServerPts(null);
    // 함께 끌어올리기 — 지난 판의 부탁을 접는다(진행 중이면 상대에게 알린다). 새 판은 새 번호로 다시 부를 수 있다
    if (coopAskedRef.current) coop.close("done");
    coopAskedRef.current = null;
    setCoopRound(null);
    setCoopHelped(false);
    roundEnded.current = false;
    fx?.reset();
  }

  function beginScoop() {
    const seed = Math.floor(dice() * 2 ** 31);
    payBait();
    const sc = startScoop(spot, eff.luck, baitIndex(bait.key), seed, moment);
    scoopRef.current = sc;
    plunging.current = false;
    setScoopS(sc);
    setPhase("aim");
  }

  function netDown(x: number, y: number) {
    if (plunging.current) return;
    plunging.current = true;
    const r = netRadius(fs.net);
    fx?.plunge(x, y, r, PLUNGE_S);
    buzz(12);
    timers.current.push(setTimeout(() => {
      plunging.current = false;
      const cur = scoopRef.current;
      if (!cur || cur.status !== "on") return;
      const next = plunge(cur, x, y, r);
      scoopRef.current = next;
      setScoopS(next);
      if (next.status === "caught") {
        const c = next.fish[next.caught].haul;
        fishRef.current = c;
        gradeRef.current = GRADES.indexOf(c.grade);
        setFish(c);
        setPerfectHook(next.quality >= 0.6);
        fx?.netLand(true, gradeRef.current);
        showStamp(next.quality >= 0.6 ? "한가운데!" : "건졌다!", next.quality >= 0.6 ? "gold" : "hit");
        buzz([30, 30, 110]);
        // 건졌다고 끝이 아니다 — 그물 안에서 몸부림치는 놈을 기울지 않게 들어 올린다(2026-11-05 [사용자: "뜰채 낚시는 너무 빠르게 끝나는 것 같아"] 실측 한 판 1.2초 → 7~9초)
        timers.current.push(setTimeout(() => {
          fx?.setShoal([]);
          const tune = liftTune(fightLevel(c), eff);
          liftTuneRef.current = tune;
          const l = startLift(Math.floor(dice() * 2 ** 31), tune);
          liftRef.current = l;
          setLiftS(l);
          netQ.current = next.quality;
          liftCounter.current = 0;
          planFever();
          fx?.liftStart(gradeRef.current);
          setPhase("lift");
        }, 650));
      } else {
        fx?.netLand(false, 0);
        noteId.current += 1;
        setTapNote({ id: noteId.current, text: next.shots > 0 ? `헛손질! ${next.shots}번 남았어요` : "헛손질!", tone: "miss" });
        buzz(40);
      }
    }, PLUNGE_S * 1000));
  }

  function aimTarget() {
    const cur = scoopRef.current;
    if (!cur) return { x: 0.5, y: 0.66 };
    const f = cur.fish.find((x) => scoopPos(x, cur.clock + PLUNGE_S).reach) ?? cur.fish[0];
    const p = scoopPos(f, cur.clock + PLUNGE_S);
    return { x: p.x, y: p.y };
  }

  function press(x?: number, y?: number) {
    if (raidOpening.current || raidRef.current) return; // 레이드를 여는 중 · 연 채 — 낚시터를 눌러도 던지지 않는다(미끼 · 도전이 함께 쓰였다)
    if (coopHelping) return; // 상대를 돕는 창(받기 · 들어올리기 · 결과)이 떠 있다 — 내 판을 시작하지 않는다
    if (phase === "glow") {
      // 누르면 불이 밝아질 뿐이다 — 채기는 위로 튕기기(drag) · ↑ 키로만. 누르기로도 채게 하면 톡톡 두드려 불을 지키던 손이
      // 터지는 순간의 다음 톡으로 저절로 걸어 버려(반응 없이 공짜 챔질) '터지는 순간'을 노리는 맛이 없어진다
      holdRef.current = true;
      setHolding(true);
      pointsRef.current = [];
      return;
    }
    if (phase === "ready" || phase === "lost" || phase === "result") {
      // 집어등 밤은 누르는 순간 다시 본다 — 화면의 night 는 30초 박자라 경계에서 늦을 수 있다
      const why = method === "light" ? (craft ? castBlockCraft(st, fs, spot, method, craft.key, today, nightNow()) : castBlock(fs, spot, method, bait.key, today, nightNow())) : blocked;
      if (why) {
        setNight(nightNow());
        setSheetOpen(true); // 왜 못 던지는지와 고칠 곳이 시트에 함께 있다
        return;
      }
      setMsg(null);
      clearRound();
      setSpotPick(spot.key); // 판 도중 레벨이 오르거나 미끼가 떨어져도 낚시터가 저절로 바뀌지 않게
      savePrefs({ spot: spot.key }); // 다음에 열어도 그대로 — 새 낚시터가 열려도 저절로 옮기지 않는다(옮기면 물고기가 단조로운 곳으로 끌려갔다). 열렸다는 소식만 결과 카드에
      if (method === "scoop") {
        beginScoop();
        return;
      }
      spinRef.current = startSpin();
      spinPending.current = 0;
      pointsRef.current = [];
      lastVec.current = null;
      lastPt.current = null;
      setSpinLive(spinRef.current);
      setCharge(0);
      setPhase("charge");
    } else if (phase === "wait") {
      loseRound("early");
    } else if (phase === "bite" && fish) {
      clearTimers();
      const good = deviceClock() - biteAt.current <= biteMs.current * PERFECT_HOOK;
      setPerfectHook(good);
      fx?.hook(good);
      showStamp(good ? "완벽한 챔질!" : "걸렸다!", good ? "gold" : "hit");
      buzz([25, 20, 90]);
      const fightBoss = bossOf(fish.boss);
      if (fightBoss) {
        const hp = bossHp(bossRec, today);
        const tune = bossTune(fightBoss, eff, hp);
        bossPhaseRef.current = bossPhase(hp);
        bossChunkRef.current = bossChunk(fightBoss, bossRec, who, today);
        setDuoNow(bossDuo(bossRec, who, today));
        bossEffRef.current = { power: eff.power, line: eff.line };
        setBossRage(bossPhaseRef.current);
        const fightSeed = Math.floor(dice() * 2 ** 31);
        const f = startFight(fightSeed, tune);
        fightHpRef.current = hp;
        bossSeenRef.current = bossRec?.caught ?? 0;
        bossHitRef.current = fightSeed;
        setFightHp(hp);
        feverPlan.current = null;
        tuneRef.current = tune;
        fightRef.current = f;
        holdRef.current = true;
        setHolding(true);
        setFight(f);
        setPhase("fight");
        // 도전 횟수를 못 썼으면(상대가 마지막 횟수를 썼거나 저장 실패) 싸움을 물린다 — 하루 3번 제한을 지킨다
        void act((s) => bossOpen(s, fightBoss.key, who, kstDate(clock())), true).then((r) => {
          if (!r?.ok) abortRound();
          else bossSeenRef.current = bossRecOf(r.state, fightBoss.key)?.caught ?? 0;
        });
        return;
      }
      if (method === "deep") {
        const tune = deepTune(fightLevel(fish), eff);
        deepTuneRef.current = tune;
        setDeepTuneS(tune);
        planFever();
        const d = startDeep(Math.floor(dice() * 2 ** 31), tune);
        deepRef.current = d;
        setDeepS(d);
        spinNow.current = 0;
        spinAcc.current = 0;
        lastAng.current = null;
        holdRef.current = true; // 챔질한 손가락 그대로 돌리기 시작할 수 있다
        setPhase("fight");
        return;
      }
      const tune = fightTune(fightLevel(fish), eff, fish.family);
      planFever();
      const f = startFight(Math.floor(dice() * 2 ** 31), tune);
      tuneRef.current = tune;
      fightRef.current = f;
      holdRef.current = true;
      setHolding(true);
      setFight(f);
      setPhase("fight");
    } else if (phase === "lure") {
      const cur = lureRef.current, tune = lureTuneRef.current;
      if (!cur || !tune || !fish) return;
      const { lure, grade } = tapLure(cur, tune, fightLevel(fish));
      lureRef.current = lure;
      setLureS(lure);
      fx?.twitch(grade);
      noteId.current += 1;
      setTapNote({ id: noteId.current, text: TAP_NOTE[grade], tone: grade });
      buzz(grade === "miss" ? 40 : 14);
      if (lure.status === "strike") {
        fx?.strike();
        setPerfectHook(lure.combo >= 3);
        showStamp("덥석!", "hit");
        buzz([25, 20, 90]);
        const st2 = swayTune(fightLevel(fish), eff);
        swayTuneRef.current = st2;
        planFever();
        const sw = startSway(Math.floor(dice() * 2 ** 31), st2);
        swayRef.current = sw;
        setSwayS(sw);
        rodXRef.current = 0;
        setRodX(0);
        holdRef.current = true; // 친 손가락 그대로 끌 수 있다
        setPhase("fight");
      } else if (lure.status === "empty") {
        loseRound("empty");
      }
    } else if (phase === "aim") {
      if (x === undefined || y === undefined) {
        const t = aimTarget();
        netDown(t.x, t.y);
      } else netDown(x, y);
    } else if (phase === "fight" || phase === "lift") {
      holdRef.current = true;
      setHolding(true);
      lastAng.current = null;
    }
  }

  /** 놓았다 — 돌린 힘과 튕김으로 거리가 정해진다 */
  function castNow(flick: number) {
      const spin = spinRef.current;
      const score = castScore(spin, flick);
      // 가득 찬 순간에 세게 튕기면 낚싯대 끝보다 더 멀리(최대 +25%) — 늦게 놓으면(과열 직전) · 약하게 튕기면 없다
      const boost = castBoost(spin, flick);
      const meters = castMeters(score, castRange(fs.rod, fs.stats.power), boost);
      const rating = castRating(score, spin.turns, boost);
      // 휘는 힘은 돌린 솜씨로 — 그냥 누르면 곧게, 오래 고르게 돌리면 크게 휜다(연출 전용, 거리 · 뽑기와 무관)
      const curve = castCurve(spin);
      const banana: 0 | 1 | 2 | 3 = rating.startsWith("퍼펙트") ? 3 : rating.startsWith("슈퍼") ? 2 : rating === "바나나킥!" ? 1 : 0;
      thrownId.current += 1;
      setThrown({ id: thrownId.current, m: meters, rating, record: meters > fs.bestCast && fs.bestCast > 0, banana });
      buzz(banana >= 3 ? [30, 30, 40, 30, 60, 30, 140] : banana ? [20, 30, 40, 30, 90] : score >= 0.6 ? [20, 30, 60] : 20);
      const seed = Math.floor(dice() * 2 ** 31);
      castScoreRef.current = score;
      const avoid = streak.current.n >= STREAK_MAX ? streak.current.family : undefined;
      const base = activeBoss ? bossCatch(activeBoss) : rollCatch(spot, eff.luck, score, seed, { bait: baitIndex(bait.key), method, junk: true, when: moment, avoid, size: craftFx.size });
      // 특별한 것(유리병 편지 · 보물)은 물고기 뽑기와 따로 뽑는다 — 물고기 뽑기 순서는 그대로다. 주인전엔 없다
      const c = activeBoss ? base : rollSpecial(st, specialCtx(seed, clock())) ?? base;
      if (!c.junk && !c.boss && !c.special) streak.current = c.family === streak.current.family ? { family: c.family, n: streak.current.n + 1 } : { family: c.family, n: 1 };
      // 물때 — 바다에서 사리면 입질이 빠르고 조금이면 느리다(강 · 호수는 1배). 만든 '향 미끼'의 배율을 곱한다
      const plan = waitPlan(seed, tideEffect(spot.water, moment.moon).wait * craftFx.wait);
      const land = landingPoint(score * boost, dice());
      gradeRef.current = GRADES.indexOf(c.grade);
      fishRef.current = c;
      setFish(c);
      setLandPt(land);
      payBait(meters);
      // 물 밑 그림자는 물렸을 물고기의 실루엣 — 꽝도 진짜 물고기 모습(...real)이라 공개 전까지 모른다
      { const sk = fishArtKey(c); fx?.shape(sk, FISH_IMAGE_KEYS.has(sk) ? asset(`/aqua/fish/sm/${sk}.webp`) : null); }
      // 입질 · 간 보기는 찌가 내려앉은 뒤부터 — 던진 순간부터 세면 휘어 오래 나는 찌가 공중에서 입질했다(물때 · 향 미끼로 기다림이 짧아지면 더 잦다)
      const flyMs = fx?.cast(land, method === "light" ? 40_000 : plan.waitMs, shadowSize(c), gradeRef.current, score, curve, boost) ?? 0;
      fx?.boss(!!c.boss, c.boss ? bossPhase(bossHp(bossRec, today)) : 0);
      if (c.boss) {
        setBossRage(bossPhase(bossHp(bossRec, today)));
        setBossIntro((n) => n + 1);
        buzz([40, 60, 40, 60, 120]);
      }
      if (method === "light" && !c.boss) {
        // 집어등 — 입질을 기다리지 않는다. 찌에 등불을 켜고 1막(모으기)부터. 주인전엔 없다(주인은 레이드)
        const tune = lightTune(fightLevel(c), eff);
        lightTuneRef.current = tune;
        const l = startLight(seed, tune);
        lightRef.current = l;
        setLightS(l);
        lightStrike.current = false;
        holdRef.current = false;
        setHolding(false);
        planFeverRef.current = planFever;
        fx?.lanternStart();
        setPhase("glow");
        return;
      }
      if (method === "lure") {
        const tune = lureTune(fightLevel(c), eff);
        lureTuneRef.current = tune;
        const l = startLure(seed, tune);
        lureRef.current = l;
        setLureS(l);
        setPhase("lure");
        return;
      }
      setPhase("wait");
      for (const at of plan.nibbles) {
        later(() => {
          fx?.nibble();
          buzz(12);
        }, flyMs + at);
      }
      later(() => {
        biteAt.current = deviceClock();
        biteMs.current = hookWindowMs(fightLevel(c), eff.line);
        setPhase("bite");
        fx?.bite(biteMs.current);
        buzz(80);
        later(() => loseRound("late"), biteMs.current);
      }, flyMs + plan.waitMs);
  }

  function release() {
    if (phase === "charge") {
      const pts = pointsRef.current, end = pts[pts.length - 1];
      const from = end && (pts.find((p) => end.t - p.t <= FLICK_WINDOW_MS) ?? end);
      const ms = end && from ? end.t - from.t : 0;
      // 위로 튕길수록 잘 나간다 · 옆으로 튕긴 건 조금만 친다
      const flick = ms > 0 ? (Math.max(0, from.y - end.y) + Math.abs(end.x - from.x) * 0.35) / ms : 0;
      castNow(keySpin.current ? FLICK_FULL * 0.9 : flick); // 키보드는 튕길 수 없어 거의 다 쳐 준다 — 가득 찬 순간에 놓는 솜씨만 본다
      keySpin.current = false;
      return;
    }
    if (phase === "fight" || phase === "lift" || phase === "glow") {
      holdRef.current = false;
      setHolding(false);
      lastAng.current = null;
    }
  }

  /** 끌기 — 루어는 좌우 위치, 심해는 다이얼 둘레를 도는 각도 */
  function drag(x: number, y: number, w: number, h: number) {
    if (phase === "charge") {
      const pts = pointsRef.current;
      pts.push({ x, y, t: deviceClock() });
      if (pts.length > 24) pts.shift();
      const last = lastPt.current;
      if (!last) {
        lastPt.current = { x, y };
        return;
      }
      const vx = x - last.x, vy = y - last.y;
      if (Math.hypot(vx, vy) < MIN_MOVE_PX) return;
      lastPt.current = { x, y };
      if (lastVec.current) {
        const d = headingDelta(lastVec.current.x, lastVec.current.y, vx, vy);
        spinPending.current += d;
        castAngRef.current += d;
      }
      lastVec.current = { x: vx, y: vy };
      return;
    }
    if (phase === "glow") {
      // 위로 휙 — 채기. 누르고 있던 손 그대로 챌 수 있다. 무리가 터지기 전에 튕기면 일찍 챈 것이다(stepLight 가 가른다)
      if (!holdRef.current) return;
      const pts = pointsRef.current, now = deviceClock();
      pts.push({ x, y, t: now });
      while (pts.length && now - pts[0].t > LIGHT_FLICK_MS) pts.shift();
      if (pts.length >= 2 && pts[0].y - y >= LIGHT_FLICK_PX) {
        lightStrike.current = true;
        pointsRef.current = [];
      }
      return;
    }
    if (phase === "lift") {
      // 손가락이 가운데에서 벗어난 만큼 그물을 그쪽으로 기울인다 — 기울어진 반대쪽으로 끌어 버틴다
      liftCounter.current = Math.max(-1, Math.min(1, (x / w - 0.5) * 2.4));
      return;
    }
    if (phase !== "fight" || !holdRef.current) return;
    if (method === "lure") {
      const v = Math.max(-1, Math.min(1, (x / w - 0.5) * 2.6));
      rodXRef.current = v;
      setRodX(v);
    } else if (method === "deep") {
      const dx = x - w * 0.5, dy = y - h * DIAL_Y;
      if (Math.hypot(dx, dy) < 14) return;
      const ang = Math.atan2(dy, dx);
      if (lastAng.current !== null) {
        let d = ang - lastAng.current;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        spinAcc.current += Math.abs(d);
        dialRef.current += d;
        setDial(dialRef.current);
      }
      lastAng.current = ang;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return; // 결과 카드의 버튼을 Enter 로 눌렀을 때 낚시 입력으로 삼키지 않는다
    if (phase === "glow" && e.key === "ArrowUp") {
      e.preventDefault();
      if (e.type === "keydown" && !e.repeat) lightStrike.current = true;
      return;
    }
    if (phase === "lift" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      liftCounter.current = e.type === "keyup" ? 0 : e.key === "ArrowLeft" ? -0.9 : 0.9;
      return;
    }
    if (phase === "fight" && method === "lure" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      rodXRef.current = e.key === "ArrowLeft" ? -0.9 : 0.9;
      setRodX(rodXRef.current);
      return;
    }
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (e.type === "keydown" && !e.repeat) {
      press();
      if (method !== "scoop" && phase !== "glow" && (method === "deep" ? phase !== "wait" && phase !== "bite" && phase !== "lure" : phase !== "fight" && phase !== "wait" && phase !== "bite" && phase !== "lure")) keySpin.current = true;
    }
    if (e.type === "keyup") {
      if (phase !== "charge") keySpin.current = false;
      release();
    }
  }

  /** 담기 — releaseId 가 있으면 한 마리 보내고 담고, net 이면 대기 그물에 둔다(가득 찼을 때) */
  async function store(releaseId?: number, net = false) {
    if (!fish || fish.junk) return;
    const roll = dice(), c = fish, p = chance, t = clock();
    // 누르는 순간의 확률로 판정한다 — 그 뒤에 온 도움 결과는 받지 않는다(상대 창도 여기서 접힌다)
    setCoopHelped(coopHelpedNow);
    if (coopRound) coop.close("done");
    setPicked("store");
    setSwapOpen(false);
    setPhase("scoop");
    buzz(20);
    const [r] = await Promise.all([act((s) => trophyRef.current(net ? tryNet(s, c, p, roll, t, kstDate(t), by) : releaseId === undefined ? tryStore(s, c, p, roll, t, kstDate(t), by) : tryStoreSwap(s, c, releaseId, p, roll, t, kstDate(t), by), c, t), true), pause(SCOOP_MS)]);
    if (!r?.ok) {
      setPicked(null);
      setPhase("landed");
      return;
    }
    void reportCatch(myName, c, quality, perfectHook, r.outcome === "stored" || r.outcome === "netted").then(noteStanding);
    setResult(r);
    setPhase("result");
    if (r.outcome === "stored" || r.outcome === "netted") {
      fx?.stored(GRADES.indexOf(c.grade));
      showStamp("포획 성공!", "gold");
      buzz([40, 40, 40, 40, 160]);
    } else {
      showStamp("놓쳤다…", "miss");
      buzz(90);
      timers.current.push(setTimeout(() => fx?.slipped(), 430)); // 물고기가 떨어지는 때에 맞춘다
    }
  }
  /** 팔기는 실패할 일이 거의 없다(담기처럼 확률이 없다) — 가진 행으로 먼저 결과를 보여 주고 저장은 뒤에서.
   *  예전엔 저장 왕복(최대 네 번)이 끝날 때까지 버튼만 눌린 채 멈춰 있었다[사용자: "팔기 누르면 반응이 가끔 느릴 때가 있어"].
   *  저장이 끝내 안 되면 결과를 거두고 끌어올린 물고기로 되돌린다(하트는 저장된 값만 보인다). */
  async function sell() {
    if (!fish || fish.junk || picked) return;
    const c = fish, t = clock();
    setCoopHelped(coopHelpedNow);
    if (coopRound) coop.close("done");
    setPicked("sell");
    const base = freshRow();
    const guess = base ? sellCatch(base.state, c, kstDate(t), by) : null;
    if (guess?.ok) {
      setResult(guess);
      setPhase("result");
      fx?.sold();
      showStamp("팔았어요!", "gold");
      buzz(30);
    }
    const r = await act((s) => trophyRef.current(sellCatch(s, c, kstDate(t), by), c, t), true);
    if (r?.ok) {
      void reportCatch(myName, c, quality, perfectHook, false).then(noteStanding);
      setResult(r);
      if (!guess?.ok) {
        setPhase("result");
        fx?.sold();
        showStamp("팔았어요!", "gold");
        buzz(30);
      }
      return;
    }
    if (fishRef.current !== c) return; // 그 사이 다음 판을 시작했다 — 새 판을 건드리지 않는다(실패 문구는 act 가 띄웠다)
    setPicked(null);
    if (guess?.ok) {
      setResult(null);
      setStamp(null);
      setPhase("landed");
    }
  }

  /** 찌 · 집어등은 같은 힘겨루기(stepFight)다 — 예고 · 사건 · 초록 칸을 같이 보여 준다 */
  const floatFight = method === "float" || method === "light";
  const fightEvent = phase === "fight" && floatFight && fight ? (fight.surgeLeft > 0 ? fight.event : null) : null;
  const fightWarn = phase === "fight" && floatFight && fight && fight.warnLeft > 0 ? fight.event : null;
  const surge = fightEvent === "surge";
  const leaping = fightEvent === "jump";
  const tension = method === "lure" ? swayS?.tension ?? 0 : method === "deep" ? deepS?.tension ?? 0 : fight?.tension ?? 0;
  const hotTension = phase === "fight" && tension > 0.82;
  const distNow = method === "lure" ? swayS?.dist ?? 1 : method === "deep" ? deepS?.depth ?? 1 : fight?.dist ?? 1;
  const band = deepS && deepTuneS ? deepBand(deepS, deepTuneS) : null;
  const diving = (deepS?.diveLeft ?? 0) > 0;
  const swayOk = swayS ? -rodX * swayS.fishX > 0.1 : false;
  const fightHint = method === "lure"
    ? (swayS && swayS.warnLeft > 0 ? (swayS.nextSide < 0 ? "곧 왼쪽으로 튀어요!" : "곧 오른쪽으로 튀어요!") : swayOk ? "좋아요! 그대로 버티세요" : "물고기 반대쪽으로 끌어요")
    : method === "deep"
      ? (diving ? "파고들어요! 멈추세요!" : (deepS?.warnLeft ?? 0) > 0 ? "곧 파고들어요! 멈출 준비" : band && spin > band.hi ? "너무 빨라요! 늦추세요" : band && spin < band.lo ? "더 빠르게 돌리세요" : "좋아요! 그 속도로")
      : surge ? "차고 나가요! 손을 떼세요!" : leaping ? "뛰어올라요! 지금 감으면 빨라요" : fightWarn === "surge" ? "곧 차고 나가요!" : fightWarn === "jump" ? "곧 뛰어올라요!" : holding ? "감는 중 — 빨간 칸 전에 떼세요" : "누르면 감겨요";
  const lightBandNow = lightS && lightTuneRef.current ? lightBand(lightS, lightTuneRef.current) : null;
  const lightHint = !lightS || !lightBandNow ? ""
    : lightS.status === "surge" ? "지금! 위로 휙 채세요!"
    : lightS.status === "ready" ? "다 모였어요! 불을 지키며 터지길 기다려요"
    : lightS.bright > lightBandNow.hi ? "너무 밝아요! 손을 떼세요"
    : lightS.bright < lightBandNow.lo ? "어두워요 — 눌러서 불을 밝혀요"
    : "좋아요! 그 밝기로 모아요";
  const hint = phase === "ready" ? (blocked ?? (activeBoss ? `${activeBoss.name}에게 던지기` : method === "scoop" ? "눌러서 시작" : "눌러서 던지기 · 돌리면 더 멀리"))
    : phase === "charge" ? (spinLive && spinLive.turns > 0.5 ? (castTiming(spinLive) > 0 ? "지금! 위로 휙!" : (spinLive.burns ?? 0) > 0 && (spinLive.heat ?? 0) === 0 && spinLive.energy < 0.6 ? "과열! 힘이 빠졌어요" : spinLive.rate * spinLive.dir > SPIN_HI ? "너무 빨라요! 힘이 빠져요" : spinGain(spinLive.rate) >= 0.9 ? "좋아요! 고르게 계속" : "조금 더 빠르게") : "")
    : phase === "wait" ? (method === "deep" ? "줄이 크게 당겨질 때까지 기다려요" : "찌가 크게 잠길 때까지 기다려요")
    : phase === "bite" ? "지금! 누르세요!"
    : phase === "lure" ? "고리가 겹칠 때 톡! 치세요"
    : phase === "aim" ? "그림자가 떠올라 빛 고리가 밝을 때 앞서 누르세요"
    : phase === "glow" ? lightHint
    : phase === "lift" ? (liftS && liftS.warnLeft > 0 ? (liftS.side < 0 ? "곧 왼쪽으로 몸부림쳐요! 오른쪽으로 버틸 준비" : "곧 오른쪽으로 몸부림쳐요! 왼쪽으로 버틸 준비") : liftS && liftS.slip > 0 ? "떨어지기 직전이에요! 반대쪽으로 끌어요" : liftS && liftS.kickLeft > 0 && Math.abs(liftS.tilt) > LIFT_SAFE ? "끌려 내려가요! 반대쪽으로 버텨요" : holding ? "기울면 반대쪽으로 끌어요" : "누르고 있어 들어 올려요")
    : phase === "fight" ? fightHint
    : phase === "lost" || phase === "result" ? (blocked ?? (activeBoss ? `${activeBoss.name}에게 다시 던지기 · 오늘 ${bossTriesLeft(bossRec, who, today)}번 남음` : "눌러서 다시 던지기")) : "";
  const loudHint = phase === "bite" || surge || leaping || diving || (phase === "glow" && lightS?.status === "surge");
  /** 이번 결과로 새로 열린 낚시터 — 저절로 옮기지 않고 알려만 준다 */
  const openedSpots = result && result.levelUp > 0 ? (() => {
    const now = fishingOf(result.state).level;
    return SPOTS.filter((x) => x.minLevel > now - result.levelUp && x.minLevel <= now);
  })() : [];
  /** 서버가 준 점수가 오면 그 값을 — 연속 2초 · 하루 300마리 제한이면 0 이 온다. 오기 전 · 로컬은 같은 공식의 어림값 */
  const pointsText = (estimate: number) => (serverPts === 0 ? "랭킹 점수 없음 · 너무 빨리 올렸거나 오늘 300마리를 넘겼어요" : `랭킹 +${serverPts ?? estimate}점`);
  const goalCount = fs.points + claimableGoals(fs, today);
  const catchable = catchableCount(spot, baitIndex(bait.key), moment);
  /** 결과 카드의 소식 — 길이 · 기록 · 원정. 없으면 그리지 않는다 */
  const sizeLine = fish?.cm ? `${fmtCm(fish.cm)}${result?.sizeNote === "top" ? " · 상대 기록을 넘었어요!" : result?.sizeNote === "mine" ? " · 내 최고 기록!" : ""}${result?.sizeCoins ? ` +${result.sizeCoins.toLocaleString()}하트 · 경험치 1.5배` : ""}` : null;
  const expedLine = result?.exped?.length ? `원정 달성! ${result.exped.map((k: ExpedKey) => `${EXPED_NAME[k]} ${expedText(k, exped.need[k])}`).join(" · ")} +${(result.expedCoins ?? 0).toLocaleString()}하트` : null;
  async function cheer() {
    if (!coupleId || cheered) return;
    const text = `이번 주 낚시 원정 같이 가자! 지금 ${exped.count}/${exped.need.count}마리야`;
    setCheered(true);
    try {
      await sendPoke(coupleId, "custom", text);
      sendPokePush(coupleId, text);
      setMsg("쿡! 원정 응원을 보냈어요");
    } catch (e) {
      setCheered(false);
      setMsg(e instanceof Error ? e.message : "보내지 못했어요");
    }
  }

  return shell(
    <div className="px-4">
      <div className="aqua-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tap disabled:opacity-50 ${tab === k ? "is-on" : ""}`} disabled={playing} onClick={() => { setTab(k); setMsg(null); }}>
            {label}{k === "stat" && goalCount > 0 ? ` (${goalCount})` : ""}
          </button>
        ))}
        <button type="button" className="tap disabled:opacity-50" disabled={playing} onClick={() => setTankOpen(true)}>내 수조</button>
      </div>
      {msg && <p className="aqua-msg" aria-live="polite">{msg}</p>}

      {tab === "fish" && (
        <>
          <div
            className={`fish-scene s-${spot.key}`}
            role="application"
            aria-roledescription="낚시터"
            tabIndex={0}
            aria-label={hint || "낚시터"}
            onPointerDown={(e) => {
              if (phase === "fever" || phase === "reveal" || phase === "landed" || phase === "scoop") return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              const box = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - box.left, y = e.clientY - box.top;
              press(x / box.width, y / box.height);
              drag(x, y, box.width, box.height);
            }}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              drag(e.clientX - box.left, e.clientY - box.top, box.width, box.height);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onKeyDown={onKey}
            onKeyUp={onKey}
          >
            <i className="fish-water" aria-hidden />
            {FISHING_IMAGE_KEYS.has(spotArtKey(spot)) && <i key={spot.key} className="fish-bg" aria-hidden style={{ backgroundImage: `url(${asset(`/fishing/${spotArtKey(spot)}.webp`)})` }} />}
            {/* 숙련도 배경(노을 · 밤)은 하늘빛만 갈아 끼운다 — 겹쳐 얹으면 진짜 밤 위의 밤이 화면을 덮는다. 때 손님 · 뽑기의 moment 는 그대로 */}
            <i className={`fish-sky t-${look ?? moment.time} ${moment.wx ? `w-${moment.wx}` : ""}`} aria-hidden />
            <canvas ref={attachFx} className="fish-fx" aria-hidden />
            {(phase === "ready" || phase === "lost") && !coopHelping && (
              <div className="fish-chips" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                <div className="fish-chips-left">
                  <button type="button" className="tap fish-chip" aria-label={`잡을 수 있는 물고기 ${catchable}종 보기`} onClick={() => setWorldSheet("fish")}>
                    <span aria-hidden>🐟</span><b>{catchable}</b>
                  </button>
                  <button type="button" className={`tap fish-chip ${guests.length ? "is-hot" : ""}`} aria-label={`지금 ${TIME_NAME[moment.time]}${moment.wx ? ` · ${WX_NAME[moment.wx]}` : ""}${guests.length ? " · 때 손님이 왔어요" : ""}`} onClick={() => setWorldSheet("timed")}>
                    {/* 낮에 비 · 눈이 오면 해와 비구름을 나란히 두지 않는다 */}
                    {!(moment.time === "day" && (moment.wx === "rain" || moment.wx === "snow")) && <span aria-hidden>{TIME_ICON[moment.time]}</span>}
                    {moment.wx && moment.wx !== "clear" && <span aria-hidden>{WX_ICON[moment.wx]}</span>}
                    {guests.length > 0 && <span aria-hidden>✨</span>}
                  </button>
                  {/* 물때 · 달 — 바다에서만 물때 글자(강 · 호수엔 물때가 없다), 달 모양은 어디서나. 테두리는 이 낚시터에 보름달 손님이 왔을 때만 */}
                  <button type="button" className={`tap fish-chip fish-moon-chip ${guests.some((g) => g.moon) ? "is-hot" : ""}`} aria-label={`오늘의 달 ${moonNow.name}${spot.water === "sea" ? ` · 물때 ${tide.label}` : ""} · 물때와 달 보기`} onClick={() => setWorldSheet("moon")}>
                    <MoonIcon frac={moonNow.frac} />
                    {spot.water === "sea" && <b>{tide.label}</b>}
                  </button>
                  {coop.partner.present && <span className="fish-chip is-coop" role="status">상대도 낚시 중</span>}
                </div>
                {boss && fs.level >= boss.level && (
                  <button type="button" className={`tap fish-chip ${activeBoss ? "is-on" : ""}`} aria-label={`낚시터의 주인 ${boss.name} ${bossRec?.until && bossWhy && !bossWhy.startsWith("오늘") ? "쉬는 중" : `체력 ${Math.round(bossHp(bossRec, today) * 100)}%`}`} onClick={() => { setAwakeView(false); setWorldSheet("boss"); }}>
                    <span aria-hidden>👑</span>{bossRec?.until && bossWhy && !bossWhy.startsWith("오늘") ? <span aria-hidden>💤</span> : <b>{Math.round(bossHp(bossRec, today) * 100)}%</b>}
                  </button>
                )}
                {awakeBoss && fs.level >= awakeBoss.level && (
                  <button type="button" className="tap fish-chip is-awake" aria-label={`각성한 주인 ${awakeBoss.name}`} onClick={() => { setAwakeView(true); setWorldSheet("boss"); }}>
                    <b>각성</b>
                  </button>
                )}
              </div>
            )}
            {(phase === "wait" || phase === "bite" || phase === "fight") && fish?.boss && (() => {
              const fb = bossOf(fish.boss);
              if (!fb) return null;
              const start = phase === "fight" ? fightHp : bossHp(bossRec, today);
              const left = phase === "fight" ? bossLeft(fightHp, fb.chunk * (duoNow ? BOSS_DUO : 1), distNow) : start;
              return (
                <div className="fish-boss-bar" data-rage={bossRage} role="meter" aria-label={`주인 ${fb.name} 체력`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(left * 100)}>
                  <p><span aria-hidden>👑</span><b>{fb.name}</b>{bossRage > 0 && <em>{BOSS_PHASE_NAME[bossRage]}</em>}{(phase === "fight" ? duoNow : bossDuo(bossRec, who, today)) && <em className="is-duo">협공 ×{BOSS_DUO}</em>}<small>{Math.round(left * 100)}%</small></p>
                  <i aria-hidden>
                    <s style={{ left: `${left * 100}%`, width: `${Math.max(0, start - left) * 100}%` }} />
                    <b style={{ width: `${left * 100}%` }} />
                    <u style={{ left: "33%" }} />
                    <u style={{ left: "66%" }} />
                  </i>
                </div>
              );
            })()}
            {(phase === "wait" || phase === "bite") && fish?.boss && bossIntro > 0 && (
              <div key={`boss-intro-${bossIntro}`} className="fish-boss-intro" aria-hidden>
                <small>낚시터의 주인</small>
                <b>{bossOf(fish.boss)?.name}</b>
                <span>{bossOf(fish.boss)?.story.split(".")[0]}.</span>
              </div>
            )}

            {bossWin && (
              <div key={`boss-win-${bossWin.id}`} className="fish-boss-win" aria-live="polite">
                <i className="fish-boss-win-rays" aria-hidden />
                <small>낚시터의 주인</small>
                <b><span aria-hidden>👑</span> {bossWin.name} 토벌!</b>
                {bossWin.you > 0 ? (
                  <>
                    <span className="fish-boss-win-share" aria-hidden><i className="is-me" style={{ width: `${bossWin.me * 100}%` }} /><i className="is-you" style={{ width: `${bossWin.you * 100}%` }} /></span>
                    <em>둘이 함께 — 나 {Math.round(bossWin.me * 100)}% · 상대 {Math.round(bossWin.you * 100)}%</em>
                  </>
                ) : <em>왕관을 쓰고 수조로 갈 수 있어요</em>}
              </div>
            )}
            {phase === "charge" && spinLive && spinLive.turns > 0.5 && (
              <div className="fish-spin" aria-hidden>
                <b>{castMeters(castScore(spinLive, FLICK_FULL), castRange(fs.rod, fs.stats.power), castBoost(spinLive, FLICK_FULL)).toFixed(1)}<i>m</i></b>
                {/* 힘 막대 — 가득 차면 금빛으로 깜빡이고 과열까지 남은 시간이 줄어든다(그때 놓아야 퍼펙트) · 너무 빠르면 붉게 */}
                <span className={`${castTiming(spinLive) > 0 ? "is-full" : ""} ${spinLive.rate * spinLive.dir > SPIN_HI ? "is-fast" : ""}`}><u style={{ width: `${spinLive.energy * 100}%` }} />{castTiming(spinLive) > 0 && <s style={{ width: `${castTiming(spinLive) * 100}%` }} />}</span>
              </div>
            )}
            {thrown && (phase === "wait" || phase === "lure" || phase === "bite") && (
              <p key={`throw-${thrown.id}`} className={`fish-throw ${phase === "lure" ? "is-low" : ""} ${thrown.banana ? `is-banana${thrown.banana > 1 ? " is-super" : ""}${thrown.banana > 2 ? " is-perfect" : ""}` : ""}`} aria-live="polite">
                <b>{thrown.m.toFixed(1)}m</b> {thrown.rating}{thrown.record && <em>새 기록!</em>}
              </p>
            )}

            {coopWaiting && (phase === "fight" || phase === "lift" || phase === "reveal") && (
              <p className="fish-coop-chip" aria-live="polite">{coop.coop.k === "askSent" ? "도와줘! 상대를 기다리는 중" : "상대가 뜰채를 드는 중"}</p>
            )}
            <FishCoopHelp coop={coop.coop} onAccept={coop.accept} onDecline={coop.decline} onFinish={coop.finish} />
            {phase === "fever" && feverSeed !== null && <FishFever spot={spot} seed={feverSeed} onDone={endFever} />}
            {raid && <BossRaidGame setup={raid} onEnd={endRaid} onClose={closeRaid} onQuit={quitRaid} />}
            {phase === "ready" && !coachSeen(`fish_${method}`) && <GameCoach key={`${method}${coachTick}`} id={`fish_${method}`} title={`${how.name} 하는 법`} steps={COACH[method]} onDone={() => setCoachTick((n) => n + 1)} />}

            {phase === "bite" && (
              <div className="fish-alert" aria-hidden style={{ left: `${landPt.x * 100}%`, top: `${landPt.y * 100 - 15}%` }}>
                <svg viewBox="0 0 200 100"><polygon points={BURST} /></svg>
                <b>!</b>
              </div>
            )}

            {phase === "fight" && (
              <>
                <div className="fish-dist" aria-hidden>
                  <b style={{ width: `${Math.max(0, Math.min(1, 1 - distNow)) * 100}%` }} />
                  <em>{method === "deep" ? `수심 ${Math.max(1, Math.round(distNow * DEEP_METERS))}m` : `${Math.max(1, Math.round(distNow * 40))}m`}</em>
                </div>
                <div className={`fish-tension ${hotTension ? "is-hot" : ""} ${floatFight ? "" : "is-plain"}`} aria-hidden>
                  <em>장력</em>
                  <span>
                    {floatFight && <i className="fish-tension-green" style={{ bottom: `${GREEN_LOW * 100}%`, height: `${(GREEN_HIGH - GREEN_LOW) * 100}%` }} />}
                    <b style={{ bottom: `${Math.min(1, tension) * 100}%` }} />
                  </span>
                </div>
              </>
            )}

            {phase === "glow" && lightS && lightBandNow && (
              <>
                {/* 불 밝기 — 찌낚시 장력 막대와 같은 틀(초록 칸 = 물고기가 좋아하는 밝기). 새 CSS 없이 */}
                <div className={`fish-tension ${lightS.scare > 0.6 ? "is-hot" : ""}`} aria-hidden>
                  <em>불빛</em>
                  <span>
                    <i className="fish-tension-green" style={{ bottom: `${lightBandNow.lo * 100}%`, height: `${(lightBandNow.hi - lightBandNow.lo) * 100}%` }} />
                    <b style={{ bottom: `${Math.min(1, lightS.bright) * 100}%` }} />
                  </span>
                </div>
                <div className="fish-lure-hud" aria-hidden>
                  <div className="fish-meter is-interest"><em>무리</em><span><b style={{ width: `${Math.min(1, lightS.school) * 100}%` }} /></span></div>
                  <div className="fish-meter is-scare"><em>놀람</em><span><b style={{ width: `${Math.min(1, lightS.scare) * 100}%` }} /></span></div>
                </div>
              </>
            )}
            {phase === "lure" && lureS && (
              <div className="fish-lure-hud" aria-hidden>
                <div className="fish-meter is-interest"><em>관심</em><span><b style={{ width: `${Math.min(1, lureS.interest) * 100}%` }} /></span></div>
                <div className="fish-meter is-line"><em>남은 줄</em><span><b style={{ width: `${Math.max(0, lureS.line) * 100}%` }} /></span></div>
                {lureS.combo >= 2 && <p className="fish-combo" key={lureS.combo}>{lureS.combo}연속!</p>}
              </div>
            )}
            {phase === "fight" && method === "lure" && swayS && (
              <div className={`fish-sway ${swayOk ? "is-ok" : "is-bad"}`} aria-hidden>
                <i className="fish-sway-mid" />
                <b className="fish-sway-fish" style={{ left: `${50 + swayS.fishX * 46}%` }}><MethodIcon k="lure" /></b>
                {swayS.warnLeft > 0 && <u className="fish-sway-next" style={{ left: `${50 + swayS.nextSide * 46}%` }} />}
                <b className="fish-sway-rod" style={{ left: `${50 + rodX * 46}%` }} />
              </div>
            )}
            {phase === "lift" && liftS && (
              <>
                <div className="fish-dist" aria-hidden>
                  <b style={{ width: `${Math.max(0, Math.min(1, liftS.h)) * 100}%` }} />
                  <em>들어 올리는 중</em>
                </div>
                <div className={`fish-sway fish-lift ${Math.abs(liftS.tilt) < LIFT_EDGE ? "is-ok" : "is-bad"}`} aria-hidden>
                  <i className="fish-sway-mid" />
                  {liftS.warnLeft > 0 && <u className="fish-sway-next" style={{ left: `${50 + liftS.side * 40}%` }} />}
                  <b className="fish-sway-rod" style={{ left: `${50 + Math.max(-1.1, Math.min(1.1, liftS.tilt)) * 42}%` }} />
                  {liftS.slip > 0 && <em className="fish-lift-slip" style={{ width: `${Math.min(1, liftS.slip / LIFT_SLIP_S) * 100}%` }} />}
                </div>
              </>
            )}
            {phase === "aim" && scoopS && (
              <div className="fish-lure-hud" aria-hidden>
                <div className="fish-meter is-time"><em>시간</em><span><b style={{ width: `${Math.max(0, scoopS.left / SCOOP_TIME_S) * 100}%` }} /></span></div>
                <div className="fish-shots">{Array.from({ length: SCOOP_SHOTS }, (_, i) => <i key={i} className={i < scoopS.shots ? "is-on" : ""} />)}</div>
              </div>
            )}
            {phase === "fight" && method === "deep" && band && (
              <div className={`fish-dial ${diving ? "is-dive" : ""}`} aria-hidden>
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" className="fish-dial-track" pathLength={100} strokeDasharray="75 100" transform="rotate(135 60 60)" />
                  <circle cx="60" cy="60" r="54" className="fish-dial-band" pathLength={100} strokeDasharray={`${((band.hi - band.lo) / 3) * 75} 100`} strokeDashoffset={-(band.lo / 3) * 75} transform="rotate(135 60 60)" />
                  <line x1="60" y1="60" x2="60" y2="10" className="fish-dial-needle" transform={`rotate(${-135 + (Math.min(3, spin) / 3) * 270} 60 60)`} />
                  <g transform={`rotate(${(dial * 180) / Math.PI} 60 60)`}>
                    <circle cx="60" cy="60" r="36" className="fish-dial-spool" />
                    <circle cx="60" cy="60" r="8" className="fish-dial-hub" />
                    <line x1="60" y1="60" x2="60" y2="30" className="fish-dial-arm" />
                    <circle cx="60" cy="28" r="9" className="fish-dial-knob" />
                  </g>
                </svg>
              </div>
            )}
            {tapNote && <p key={tapNote.id} className={`fish-tapnote is-${tapNote.tone}`} aria-live="polite">{tapNote.text}</p>}
            {hint && !coopHelping && <p className={`fish-hint ${loudHint ? "is-loud" : ""} ${leaping ? "is-jump" : ""}`}>{hint}</p>}
            {phase === "lost" && lost && <p className="fish-lost" aria-live="polite">{LOST_TEXT[lost]}{bossNote && <small>{bossNote}</small>}</p>}

            {(phase === "reveal" || phase === "landed" || phase === "scoop" || phase === "result") && fish && (
              <div
                className={`fish-card g${GRADES.indexOf(fish.grade)} is-${phase === "result" ? result?.outcome : phase} ${!fish.junk && GRADES.indexOf(fish.grade) >= 3 ? "is-rare" : ""}`}
                style={{ "--gc": FX_GRADE_LIGHT[GRADES.indexOf(fish.grade)], "--rv": `${revealMs(GRADES.indexOf(fish.grade), false)}ms` } as CSSProperties}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="fish-card-pic" style={fish.junk || fish.special ? undefined : { width: `${50 + shadowSize(fish) * 28}%`, left: `${25 - shadowSize(fish) * 14}%` }}>{fish.special ? (phase === "reveal" ? null : <SpecialPic kind={fish.special.kind} id={fish.special.id} />) : fish.junk && phase !== "reveal" ? <JunkIcon k={fish.junk} /> : <FishArt artKey={catchArt(fish)} />}</span>
                {phase === "reveal" && <b className="fish-reveal-q" aria-live="polite">?</b>}
                {phase === "scoop" && <span className="fish-net" aria-hidden><GearPic k={NETS[fs.net].key} label={NETS[fs.net].name} /></span>}
                {phase === "result" && result?.outcome === "sold" && Array.from({ length: 12 }, (_, k) => (
                  <i key={k} className="fish-coin" aria-hidden style={{ "--x": `${Math.cos(k * 0.52) * (70 + (k % 3) * 34)}px`, "--y": `${-Math.abs(Math.sin(k * 0.52)) * (60 + (k % 4) * 26) - 20}px`, "--d": `${(k % 5) * 45}ms` } as CSSProperties}><Coin /></i>
                ))}
                {phase !== "reveal" && <div className="fish-panel" key={phase === "result" ? "result" : "catch"}>
                  {feverNote && phase !== "result" && <b className="fish-fever-note">{feverNote}</b>}
                  {fish.boss && bossNote && phase !== "result" && <b className="fish-fever-note">{bossNote}</b>}
                  {isNew && phase !== "result" && <b className="fish-new">NEW · 처음 만난 물고기</b>}
                  {fish.special ? (
                    <SpecialPanel title={fish.special.title} kind={fish.special.kind} id={fish.special.id} card={phase === "result" ? result?.special : undefined} onAgain={() => { clearRound(); setBossPick(null); setPhase("ready"); }} />
                  ) : <>
                  <strong className="fish-name">{fish.junk ? junkOf(fish.junk)?.name : catchName(fish)}</strong>
                  {fish.junk ? <span className="aqua-grade fish-junk-tag">꽝</span> : <span className={gradeClass(fish.grade)}>{fish.grade}</span>}
                  {sizeLine && <p className={`fish-size ${result?.sizeNote ? "is-record" : ""}`}>{sizeLine}</p>}
                  {phase === "result" && result?.sizeNote && fish.cm && !fish.boss && <ActionButton className="fish-trophy-make" onClick={() => setTrophy(trophyCard({ key: catchArt(fish), cm: fish.cm ?? 0, spot: spot.key, day: kstDate(clock()), by: myName.trim() || readFishNick() }, false))}>어탁 만들기</ActionButton>}
                  {fish.junk ? (
                    <>
                      <p className="fish-junk-line">{junkOf(fish.junk)?.line}</p>
                      {result?.firstJunk && <p className="fish-levelup">수집함에 새로 올랐어요!</p>}
                      {result && result.coins > 0 && <p className="aqua-price">분리수거 <Coin /> +{result.coins.toLocaleString()}</p>}
                      {result && <p className="fish-points">{pointsText(catchPoints(fish, quality, perfectHook, false))}{rankNote && <small>{rankNote}</small>}</p>}
                      {result && <ActionButton main wide onClick={() => { clearRound(); setBossPick(null); setPhase("ready"); }}>다시 던지기</ActionButton>}
                    </>
                  ) : phase === "scoop" ? (
                    <p className="fish-scoop-note">뜰채로 건지는 중<i /><i /><i /> <small>성공 확률 {pct(chance)}</small></p>
                  ) : phase === "landed" ? (
                    <>
                      <p className="aqua-note">
                        {method === "scoop" ? `${perfectHook ? "한가운데로 건졌어요! " : ""}수평 유지 ${pct(quality)}` : method === "light" ? `${perfectHook ? "정확한 챔질! " : ""}불빛 · 챔질 · 줄 다루기 ${pct(quality)}` : `${perfectHook ? "정확한 챔질! " : ""}줄 다루기 ${pct(quality)}`} · 경험치 +{xpValue(fish.difficulty)}
                      </p>
                      {coopHelpedNow && <b className="fish-coop-badge">함께 끌어올렸어요 · 담기 확률 +15%p</b>}
                      {coopWaiting && <p className="fish-coop-wait" aria-live="polite">상대가 뜰채를 드는 중이에요 · 건지면 확률이 올라가요</p>}
                      <div className={`fish-choice ${picked ? `picked-${picked}` : ""}`}>
                      {block === TANK_FULL ? (
                        <>
                          <ActionButton main wide className="fish-choice-store" disabled={busy || !!picked} onClick={() => setSwapOpen(true)}>한 마리 보내고 담기 · 성공 확률 {pct(chance)}</ActionButton>
                          {(aq.net?.length ?? 0) < NET_MAX && <ActionButton wide className="fish-choice-net" disabled={busy || !!picked} onClick={() => void store(undefined, true)}>대기 그물에 두기 {aq.net?.length ?? 0}/{NET_MAX} · 24시간</ActionButton>}
                        </>
                      ) : block ? <p className="fish-block">{block} — 수조에 담을 수 없어요</p> : (
                        <ActionButton main wide className="fish-choice-store" disabled={busy || !!picked} onClick={() => void store()}>
                          수조에 담기 · 성공 확률 {pct(chance)}
                        </ActionButton>
                      )}
                      <ActionButton wide className="fish-choice-sell" disabled={busy || !!picked} onClick={() => void sell()}>
                        {fish.boss ? "보내 주기" : block && block !== TANK_FULL ? "팔기" : "그냥 팔기"} <span className="aqua-price"><Coin /> {Math.round(coinValue(fish.difficulty) * (1 + masterySaleBonus(st, fish.at))).toLocaleString()}</span>
                      </ActionButton>
                      </div>
                    </>
                  ) : result && (
                    <>
                      <p className="fish-outcome">
                        {result.outcome === "stored" ? "수조에 담았어요!" : result.outcome === "netted" ? "대기 그물에 두었어요 — 24시간 안에 수조로 옮겨 주세요" : result.outcome === "slipped" ? "손에서 미끄러져 빠져나갔어요…" : "시장에 팔았어요"}
                      </p>
                      {coopHelped && result.outcome !== "slipped" && <b className="fish-coop-badge">함께 잡았어요</b>}
                      {result.grown?.map((g) => <p key={g.n} className="fish-levelup fish-grown">수조 소식 · {g.egg ? `${familyOf(g.family)?.name ?? "물고기"} 알에서 치어가 나왔어요` : g.stage === 2 ? `${josa(fishName(g), "으로/로")} 다 자랐어요!` : `${josa(fishName(g), "으로/로")} 자랐어요`}</p>)}
                      {result.coins > 0 && <p className="aqua-price"><Coin /> +{result.coins.toLocaleString()}</p>}
                      <p className="fish-points">{pointsText(catchPoints(fish, quality, perfectHook, result.outcome === "stored"))}{rankNote && <small>{rankNote}</small>}</p>
                      {result.levelUp > 0 && <p className="fish-levelup">낚시 레벨 업! 능력치 점수를 쓸 수 있어요</p>}
                      {openedSpots.length > 0 && <p className="fish-levelup">새 낚시터 {josa(openedSpots.map((x) => x.name).join(" · "), "이/가")} 열렸어요 · 낚시 준비에서 옮길 수 있어요</p>}
                      {expedLine && <p className="fish-levelup">{expedLine}</p>}
                      <ActionButton main wide onClick={() => { clearRound(); setBossPick(null); setPhase("ready"); }}>다시 던지기</ActionButton>
                      {(result.outcome === "stored" || result.outcome === "netted" || !!result.grown?.length) && <ActionButton wide onClick={() => setTankOpen(true)}>수조에서 보기</ActionButton>}
                    </>
                  )}
                  </>}
                </div>}
                {swapOpen && phase === "landed" && (
                  <div className="fish-swap" role="dialog" aria-label="보낼 물고기 고르기">
                    <header><strong>어느 물고기를 보낼까요?</strong><CloseButton onClose={() => setSwapOpen(false)} label="취소" /></header>
                    <p className="aqua-note">담기에 실패하면 아무도 떠나지 않아요</p>
                    <ul>
                      {[...aq.fish].sort((a, b) => GRADES.indexOf(familyOf(a.family)?.finals[0].grade ?? "흔함") - GRADES.indexOf(familyOf(b.family)?.finals[0].grade ?? "흔함") || a.stage - b.stage).filter((f) => !f.crown).map((f) => (
                        <li key={f.id}>
                          <button type="button" className="tap" disabled={busy} onClick={() => void store(f.id)}>
                            <span className="fish-swap-pic"><FishArt artKey={catchArt(f)} /></span>
                            <span className="min-w-0 flex-1"><strong>{fishName(f)}</strong>{releaseReward(f) > 0 && <small><Coin /> {releaseReward(f).toLocaleString()} 돌려받아요</small>}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {stamp && <Stamp key={`stamp-${stamp.id}`} text={stamp.text} tone={stamp.tone} high={phase === "fight" || phase === "aim" || phase === "lift" || phase === "glow"} />}
          </div>

          <button type="button" className="tap fish-loadout" aria-haspopup="dialog" disabled={playing} onClick={() => setSheetOpen(true)}>
            <span className="fish-loadout-icon"><BaitIcon k={bait.key} /></span>
            <span className="min-w-0 flex-1">
              <strong>{spot.name} <em className="whitespace-nowrap">원정 {exped.count}/{exped.need.count}</em></strong>
              <small>{how.name} · {craft ? craft.name : bait.name} {baitLeft}회</small>
            </span>
            <span className="fish-loadout-lv">Lv.{fs.level}<i aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></i></span>
            <span aria-hidden className="fish-loadout-more">▾</span>
          </button>

          {worldSheet === "fish" && <FishListSheet spot={spot} baitIdx={baitIndex(bait.key)} method={method} luck={eff.luck} moment={moment} level={fs.level} seen={formsSeen(st)} onClose={() => setWorldSheet(null)} />}
          {worldSheet === "moon" && <MoonSheet spot={spot} now={clock()} moment={moment} baitGrade={bait.maxGrade} onClose={() => setWorldSheet(null)} />}
          {worldSheet === "timed" && <TimedSheet spot={spot} moment={moment} baitGrade={bait.maxGrade} onClose={() => setWorldSheet(null)} />}
          {worldSheet === "boss" && boss && (
            <BossSheet boss={boss} rec={bossRec} today={today} who={who} why={bossWhy} tries={BOSS_TRIES} couple={!!coupleId} all={fs.bosses} level={fs.level} onClose={() => { setWorldSheet(null); setAwakeView(false); }} onStart={() => {
              // 주인과는 레이드로 겨룬다(2026-11-11) — 찌낚시 주인전(bossPick)은 화면에서 들어갈 길을 뺐다. 엔진은 옛 앱이 부르므로 남긴다
              setBossPick(null);
              setWorldSheet(null);
              setAwakeView(false);
              openRaid(boss);
            }} />
          )}
          {sheetOpen && (
            <div className="fish-sheet-back" {...prepBack}>
              <div ref={prepRef} tabIndex={-1} className="fish-sheet" role="dialog" aria-modal="true" aria-label="낚시 준비">
                <header className="fish-sheet-head"><strong>낚시 준비</strong><CloseButton onClose={() => setSheetOpen(false)} label="완료" /></header>
                {blocked && <p className="aqua-msg" aria-live="polite">{blocked}</p>}

                <h3 className="fish-sheet-title">방식</h3>
                <div className="fish-methods" role="radiogroup" aria-label="낚시 방식">
                  {METHODS.map((m) => {
                    const off = fs.level < m.minLevel;
                    // 집어등 — 레벨이 되면 고를 수는 있다(왜 지금 못 켜는지 위 칸에 뜬다). 밤 · 바다가 아니면 작은 글씨로 미리 알린다
                    const shut = !off && m.night ? (spot.water !== "sea" ? "바다에서만" : !night ? "밤에만 · 19~5시" : null) : null;
                    return (
                      <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`tap ${method === m.key ? "is-on" : ""} ${m.night ? "is-night" : ""}`} disabled={off} onClick={() => { setMethod(m.key); savePrefs(prefMethodWrite(m.key)); setBossPick(null); clearRound(); setPhase("ready"); }}>
                        <MethodIcon k={m.key} />
                        <strong>{m.name}</strong>
                        <small>{off ? `Lv.${m.minLevel}` : shut ?? m.good}</small>
                      </button>
                    );
                  })}
                </div>
                <p className="fish-how">{how.how}</p>

                <h3 className="fish-sheet-title">미끼 <small>높을수록 귀한 물고기가 물고, 횟수도 많아요</small></h3>
                <div className="fish-baits">
                  {BAITS.map((b) => {
                    const left = baitStock(fs, b.key, today);
                    const fits = poolFor(spot, b.maxGrade).length > 0;
                    return (
                      <button key={b.key} type="button" aria-pressed={!craft && shown.key === b.key} className={`tap ${!craft && shown.key === b.key ? "is-on" : ""} ${fits ? "" : "is-off"}`} disabled={!fits} onClick={() => { setBaitPick(b.key); setCraftPick(null); savePrefs({ bait: b.key, craft: null }); }}>
                        <span className="fish-bait-pic"><BaitIcon k={b.key} /></span>
                        <strong>{b.name}</strong>
                        <small>{GRADES[b.maxGrade]}까지 · {left}회</small>
                      </button>
                    );
                  })}
                </div>
                {CRAFT_BAITS.some((c) => craftLeft(st, c.key) > 0) && (
                  <>
                    <h3 className="fish-sheet-title">만든 미끼 <small>같은 단계 미끼처럼 물고, 덤이 붙어요 · 장비 탭에서 만들어요</small></h3>
                    <div className="fish-baits">
                      {CRAFT_BAITS.filter((c) => craftLeft(st, c.key) > 0).map((c) => {
                        const left = craftLeft(st, c.key), tier = craftTier(c);
                        const fits = poolFor(spot, tier.maxGrade).length > 0;
                        const on = craft?.key === c.key;
                        return (
                          <button key={c.key} type="button" aria-pressed={on} className={`tap ${on ? "is-on" : ""} ${fits ? "" : "is-off"}`} disabled={!fits} onClick={() => { const next = on ? null : c.key; setCraftPick(next); savePrefs({ craft: next }); }}>
                            <span className="fish-bait-pic"><CraftBaitIcon k={c.key} /></span>
                            <strong>{c.name}</strong>
                            <small>{GRADES[tier.maxGrade]}까지 · {left}회</small>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {craft ? (
                  <div className="fish-bait-now">
                    <p>{craft.name} {baitLeft}회 남음 <small>{craft.effect}{method === "lure" && craft.key === "craft_scent" ? " · 루어는 기다림이 없어 덤이 없어요" : ""}{method === "scoop" && craft.key !== "craft_sticky" ? " · 뜰채엔 이 덤이 없어요" : ""}{craft.key === "craft_shine" && !coupleId ? " · 혼자 하는 섬엔 상대의 병이 없어요" : ""}</small></p>
                  </div>
                ) : (
                  <div className="fish-bait-now">
                    <p>{shown.name} {shownLeft}회 남음 <small>{craftNote ? `${josa(craftNote.name, "이/가")} ${craftLeft(st, craftNote.key) > 0 ? "여기서는 안 맞아서" : "다 떨어져서"} 지금은 ${bait.name} 사용` : bait.key !== shown.key ? `떨어져서 지금은 ${bait.name} 사용` : shown.desc}</small></p>
                    <ActionButton disabled={busy || st.coins < shown.price} onClick={() => void act((s) => buyBait(s, shown.key, kstDate(clock())))}>
                      +{shown.uses}회 <span className="aqua-price"><Coin /> {shown.price.toLocaleString()}</span>
                    </ActionButton>
                  </div>
                )}

                <h3 className="fish-sheet-title">낚시터</h3>
                <div className="fish-spots">
                  {SPOTS.map((x) => {
                    const locked = x.minLevel > fs.level, stars = locked ? 0 : spotStars(st, x.key);
                    return (
                      <button key={x.key} type="button" className={`tap ${x.key === spot.key ? "is-on" : ""}`} disabled={locked} aria-label={stars ? `${x.name} 숙련도 별 ${stars}개` : undefined} onClick={() => { setSpotPick(x.key); savePrefs({ spot: x.key }); setBossPick(null); setAwakeView(false); }}>
                        {x.name} <small>{locked ? `Lv.${x.minLevel}` : stars ? `★${stars} · ${WATER_NAME[x.water]}` : WATER_NAME[x.water]}</small>
                      </button>
                    );
                  })}
                </div>

                <h3 className="fish-sheet-title">낚시 Lv.{fs.level} <small>수조 {fishCount(aq)}/{tankOf(aq).fish}</small></h3>
                <div className="fish-xp" aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></div>
                <p className="aqua-note mt-2">포획 {eff.catch} · 힘 {eff.power}{buff > 0 ? ` (도시락 힘 +${buff}%)` : ""} · 줄 다루기 {eff.line} · 행운 {eff.luck}</p>
                <p className="aqua-note">캐스팅 최대 {Math.round(castRange(fs.rod, fs.stats.power))}m · 내 기록 {fs.bestCast.toFixed(1)}m — 좋은 낚싯대 · 힘을 올리면 더 멀리 가요</p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "gear" && <FishGear fs={fs} coins={st.coins} busy={busy} today={today} onBuyRod={() => void act(buyRod)} onBuyNet={() => void act(buyNet)} onBuyBait={(key) => { void act((s) => buyBait(s, key, kstDate(clock()))); }} />}
      {tab === "gear" && <FishGearPlus {...tabProps} />}
      {tab === "stat" && <FishStats fs={fs} eff={eff} busy={busy} today={today} who={who} exped={exped} couple={!!coupleId} cheered={cheered} onCheer={() => void cheer()} onSpend={(k) => void act((s) => spendPoint(s, k))} onClaim={(id) => { void act((s) => claimFishGoal(s, id, kstDate(clock()))); }} />}

      {tab === "more" && <FishCollect {...tabProps} />}
      {tab === "rank" && <FishRank myName={myName} onContest={() => { setTab("more"); setMsg(null); }} />}

      {trophy && <TrophySheet card={trophy} onClose={() => setTrophy(null)} />}
      {tankOpen && <AquariumGame coupleId={coupleId} myUserId={myUserId} onClose={() => { setTankOpen(false); void load(); }} onOpenIsland={onOpenIsland} onFish={() => { setTankOpen(false); void load(); }} />}
    </div>,
  );
}
