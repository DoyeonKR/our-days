"use client";

/* 낚시 화면 — 규칙은 전부 lib/fishing(순수), 찌 · 줄 · 물보라는 lib/fishingfx(캔버스). 여기는 입력 · 타이머 · 글자판과 저장뿐이다.
 * 한 손가락으로 다 한다. 방식마다 손이 다르다: 찌(누르고 떼기) · 루어(박자 맞춰 치기 → 좌우로 끌기) · 뜰채(앞서 겨눠 누르기) · 심해(릴 돌리기). 규칙은 lib/fishingmodes.
 * 저장은 던질 때(미끼) · 끌어올린 뒤 · 장비를 바꿀 때만(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더). 힘겨루기 중엔 쓰지 않는다. */
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { GameCoach, GameHead, coachSeen } from "@/components/GameHead";
import { BossSheet, FishGear, FishListSheet, FishStats, GearPic, TimedSheet } from "@/components/FishingPanels";
import { confirmDialog } from "@/lib/confirm";
import { logDebug } from "@/lib/debug";
import { claimableGoals } from "@/lib/fishinggoals";
import { useBackClose } from "@/lib/useBackClose";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import AquariumGame from "@/components/AquariumGame";
import { FishArt, preloadFishArt } from "@/components/AquaArt";
import { BaitIcon, JunkIcon, MethodIcon } from "@/components/FishingIcons";
import FishFever from "@/components/FishFever";
import FishRank, { readFishNick } from "@/components/FishRank";
import { feverArts, rollFever, upgradeCatch, upgradeChance } from "@/lib/fishingfever";
import { Coin } from "@/components/island/UiIcon";
import { familyOf, fishName, releaseReward } from "@/lib/aquarium";
import { TANK_FULL, buffedStats, claimFishGoal, tryStoreSwap } from "@/lib/fishing";
import { asset } from "@/lib/base";
import { GRADES, aquaOf, tankOf, type Grade } from "@/lib/aquarium";
import { getFishStanding, loadIsland, saveIsland, sendPoke, submitFishCatch, watchIsland, type IslandRow } from "@/lib/couple";
import { sendPokePush } from "@/lib/push";
import { BOSS_TRIES, EXPED_NAME, TIME_NAME, WX_NAME, bossAt, bossHp, bossLeft, bossOf, bossReward, bossTriesLeft, expedText, fishTimeOf, fishWxOf, fmtCm, timedAt, type ExpedKey, type FishMoment } from "@/lib/fishingworld";
import { useForecast } from "@/lib/useforecast";
import { useWeatherPlace } from "@/lib/weatherplace";
import { WEATHER_TTL_MS, wmoInfo } from "@/lib/weather";
import { FX_GRADE_LIGHT, FishFx, landingPoint, type FxLost } from "@/lib/fishingfx";
import {
  DEEP_METERS, PLUNGE_S, SCOOP_SHOTS, SCOOP_TIME_S, deepBand, deepQuality, deepTune, lureQuality, lureRing, lureTune, netRadius, plunge, scoopPos, startDeep, startLure, startScoop, startSway, stepDeep, stepLure, stepScoop, stepSway, swayQuality, swayTune, tapLure,
  type Deep, type DeepTune, type Lure, type LureTune, type Scoop, type Sway, type SwayTune, type TapGrade,
} from "@/lib/fishingmodes";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import {
  WATER_NAME, spotArtKey, BAITS, FLICK_FULL, GREEN_HIGH, GREEN_LOW, MAX_LEVEL, METHODS, NETS, PERFECT_HOOK, RODS, SPOTS,
  baitIndex, baitStock, bossBlockOf, bossCatch, bossLost, bossOpen, bossTune, bossWon, buyBait, buyNet, buyRod, captureChance, castBlock, castMeters, castRange, castRating, castScore, catchArt, catchName, catchPoints, catchableCount, coinValue, currentBait, formsSeen, currentSpot, expedFor, fightQuality, fightTune, fishingOf, haulJunk, headingDelta, hookWindowMs, junkOf, methodOf, poolFor,
  rankLine, revealMs, rollCatch, sellCatch, shadowSize, spendBait, spendPoint, spinGain, startFight, startSpin, stepFight, stepSpin, storeBlock, tryStore, waitPlan, xpNeed, xpValue,
  type CastSpin, type Fight, type FightTune, type FishCatch, type FishResult, type FishStanding, type GearResult, type MethodKey,
} from "@/lib/fishing";
import type { IslandState } from "@/lib/island";
import { kstDate } from "@/lib/kst";

type Tab = "fish" | "gear" | "stat" | "rank";
type Phase = "ready" | "charge" | "wait" | "bite" | "lure" | "aim" | "fight" | "fever" | "reveal" | "landed" | "scoop" | "result" | "lost";
type StampTone = "hit" | "gold" | "miss";
/** 시각 · 주사위 — 눌렀을 때만 부른다(렌더 중에 부르지 않는다) */
const clock = () => Date.now();
const dice = () => Math.random();
const TABS: readonly (readonly [Tab, string])[] = [["fish", "낚시터"], ["gear", "장비"], ["stat", "목표"], ["rank", "랭킹"]];
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
function readPrefs(): { method?: MethodKey; bait?: string; spot?: string } {
  try {
    return JSON.parse(localStorage.getItem(PREFS) ?? "{}");
  } catch {
    return {};
  }
}
function savePrefs(v: { method?: MethodKey; bait?: string; spot?: string }) {
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
  fever: "피버타임 실패! 물고기가 달아났어요",
  bossBroke: "거의 다 왔는데 주인이 마지막 힘으로 뿌리쳤어요",
} as const;
type LostKey = keyof typeof LOST_TEXT;
const LOST_FX: Record<LostKey, FxLost> = { early: "early", late: "late", snapped: "snapped", slack: "slack", escaped: "escaped", swaySnap: "snapped", spinSnap: "snapped", idle: "slack", empty: "escaped", out: "escaped", time: "escaped", fever: "escaped", bossBroke: "escaped" };
const LOST_STAMP: Record<FxLost, string> = { early: "앗, 일렀다!", late: "늦었다!", snapped: "툭! 끊어졌다", slack: "바늘이 빠졌다", escaped: "도망쳤다!" };
const TAP_NOTE: Record<TapGrade, string> = { great: "완벽!", good: "좋아!", miss: "엇박!" };
/** 만화 효과선 판 — 뾰족한 칸의 길이를 일부러 들쭉날쭉하게 */
const BURST = Array.from({ length: 34 }, (_, i) => {
  const a = (i / 34) * Math.PI * 2;
  const r = i % 2 === 0 ? 1 - ((i * 7) % 5) * 0.045 : 0.68;
  return `${(100 + Math.cos(a) * 98 * r).toFixed(1)},${(50 + Math.sin(a) * 48 * r).toFixed(1)}`;
}).join(" ");

/** 끌어올린 결과를 순위판에 올린다 — 게임을 기다리게 하지 않고, 실패해도 판에는 영향이 없다(점수 한 줄만 빠진다) */
function reportCatch(myName: string, c: FishCatch, quality: number, perfect: boolean, stored: boolean): Promise<FishStanding | null> {
  const name = c.junk ? junkOf(c.junk)?.name ?? "쓰레기" : catchName(c);
  return submitFishCatch(myName.trim() || readFishNick(), name, GRADES.indexOf(c.grade), c.stage, quality, perfect, stored, !!c.junk, c.boss || c.junk ? null : c.family, c.boss || c.junk ? null : c.cm ?? null)
    .then(getFishStanding)
    .catch(() => null);
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
  scoop: ["그림자가 갈 곳을 앞서 눌러 건져요. 기회는 세 번이에요", "빛 고리가 있는 그림자가 물고기예요. 없으면 쓰레기예요"],
  deep: ["입질에 챔질한 뒤 손가락으로 릴을 돌려요", "바늘이 초록 칸에 있게 속도를 맞춰요", "물고기가 파고들면 잠깐 멈춰요. 미끼는 2개 써요"],
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

  const [method, setMethod] = useState<MethodKey>(() => readPrefs().method ?? "float");
  const [baitPick, setBaitPick] = useState<string | null>(() => readPrefs().bait ?? null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [charge, setCharge] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feverSeed, setFeverSeed] = useState<number | null>(null);
  const [feverNote, setFeverNote] = useState<string | null>(null);
  const [feverWon, setFeverWon] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [coachTick, setCoachTick] = useState(0);
  const [spinLive, setSpinLive] = useState<CastSpin | null>(null);
  const [thrown, setThrown] = useState<{ id: number; m: number; rating: string; record: boolean } | null>(null);
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
  const [deepTuneS, setDeepTuneS] = useState<DeepTune | null>(null);
  const [spin, setSpin] = useState(0);
  const [dial, setDial] = useState(0);
  const [rodX, setRodX] = useState(0);
  const [tapNote, setTapNote] = useState<{ id: number; text: string; tone: TapGrade } | null>(null);
  const [holding, setHolding] = useState(false);
  const [quality, setQuality] = useState(0);
  const [perfectHook, setPerfectHook] = useState(false);
  const [result, setResult] = useState<Extract<FishResult, { ok: true }> | null>(null);
  const [bossPick, setBossPick] = useState<string | null>(null);
  const [bossNote, setBossNote] = useState<string | null>(null);
  const [fightHp, setFightHp] = useState(1);
  const [worldSheet, setWorldSheet] = useState<"boss" | "timed" | "fish" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cheered, setCheered] = useState(false);
  const [picked, setPicked] = useState<"store" | "sell" | null>(null);

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
    if (fishRef.current?.junk) return false;
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
  const noteStanding = useCallback((s: FishStanding | null) => {
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
  const rodXRef = useRef(0);
  const spinAcc = useRef(0);
  const spinNow = useRef(0);
  const dialRef = useRef(0);
  const lastAng = useRef<number | null>(null);
  const keySpin = useRef(false);
  const plunging = useRef(false);
  const noteId = useRef(0);

  const roundBait = useRef(0);
  /** 확인창이 떠 있는 동안 판을 멈춘다 — 묻는 사이에 줄이 끊기면 안 된다 */
  const pausedRef = useRef(false);
  const partnerSeen = useRef<number | null>(null);
  const fightHpRef = useRef(1);
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
  // 수조가 위에 열린 동안 낚시터는 그리지 않는다(수조는 3D 라 폰이 렌더를 둘 돌리면 프레임이 무너진다)
  useEffect(() => {
    if (!fx || (!tankOpen && !dialogOpen && phase !== "fever")) return; // 피버는 전체 화면이라 뒤의 낚시터가 안 보인다
    fx.pause();
    return () => fx.resume();
  }, [fx, tankOpen, dialogOpen, phase]);
  useEffect(() => {
    fx?.set({ phase, charge, holding, method });
  }, [fx, phase, charge, holding, method]);
  useEffect(() => {
    if (!fx || !row) return;
    const cur = fishingOf(row.state);
    fx.art((k) => (FISHING_IMAGE_KEYS.has(k) ? asset(`/fishing/${k}.webp`) : null), NETS[cur.net]?.key ?? NETS[0].key);
    const day = today || kstDate(clock()), place = currentSpot(cur, spotPick, day);
    fx.set({ rod: RODS[cur.rod]?.key ?? RODS[0].key, spot: place.key, bait: currentBait(cur, place, baitPick, methodOf(method).baitCost, day).bait.key });
  }, [fx, row, spotPick, today, baitPick, method]);
  // 앱을 켜 둔 채 자정을 넘겨도 오늘 값(지렁이 · 하트 한도 · 목표)이 어제에 머물지 않는다
  useEffect(() => {
    const iv = setInterval(() => setToday(kstDate(clock())), 60_000);
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
  useEffect(() => watchIsland(coupleId, () => void load()), [coupleId, load]);

  /** 최신 상태를 읽어 동작 → 저장. 충돌이면 다시 읽어 한 번 더. */
  const actTail = useRef<Promise<unknown>>(Promise.resolve());
  const actCount = useRef(0);
  /** queued 는 판의 저장(미끼 · 결과 · 주인) — 앞선 저장이 돌고 있어도 빠뜨리지 않고 줄 세운다. 사람이 누른 구매는 연타를 막으려고 그대로 버린다. */
  const act = useCallback(<R extends FishResult | GearResult>(make: (st: IslandState) => R, queued = false): Promise<R | null> => {
    if (!queued && busyRef.current) return Promise.resolve(null);
    busyRef.current = true;
    actCount.current += 1;
    setBusy(true);
    const run = async (): Promise<R | null> => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await loadIsland(coupleId).catch(() => null);
        if (!r) {
          setMsg("불러오지 못했어요. 잠시 후 다시 해 주세요.");
          return null;
        }
        const res = make(r.state);
        if (!res.ok) {
          setMsg(res.reason);
          setRow(r);
          return res;
        }
        try {
          setRow(await saveIsland(coupleId, r.version, res.state));
          setMsg(null);
          return res;
        } catch {
          /* 상대가 그 사이 섬을 바꿨다 — 다시 읽어서 한 번 더 */
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
  }, [coupleId]);

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
    const kind = LOST_FX[key];
    clearTimers();
    const lostBoss = bossOf(fishRef.current?.boss), lostFight = fightRef.current;
    if (lostBoss && lostFight) {
      const left = Math.max(0.03, bossLeft(fightHpRef.current, lostBoss.chunk, lostFight.dist));
      setBossNote(left < fightHpRef.current - 0.005 ? `${lostBoss.name} 체력이 ${Math.round(left * 100)}%까지 줄었어요. 깎은 만큼 남아요` : `${lostBoss.name} 체력을 깎지 못했어요. 더 끌어와 보세요`);
      void act((s) => bossLost(s, lostBoss.key, left, kstDate(clock())), true);
    }
    setLost(key);
    setHolding(false);
    holdRef.current = false;
    fxRef.current?.lost(kind);
    showStamp(LOST_STAMP[kind], "miss");
    buzz(kind === "snapped" ? [120, 40, 60] : 60);
    setPhase("lost");
  }, [showStamp, act]);

  /** 끌어올렸다 — 실루엣으로 뜸을 들이고(귀할수록 길게) 그다음 공개. 쓰레기도 같은 물고기 실루엣이라 공개 순간까지 모른다. */
  const landRound = useCallback((q: number) => {
    const c = fishRef.current;
    const grade = gradeRef.current;
    const cur = rowRef.current;
    const beaten = bossOf(c?.boss);
    if (beaten) {
      const pay = bossReward(beaten, cur ? fishingOf(cur.state).bosses[beaten.key]?.caught ?? 0 : 0);
      setBossNote(`${beaten.name}를 잡았어요! 보상 ${pay.toLocaleString()}하트`);
      void act((s) => bossWon(s, beaten.key, who, kstDate(clock())), true);
    }
    setQuality(q);
    setHolding(false);
    holdRef.current = false;
    fxRef.current?.land(grade, true);
    buzz([50, 40, 140]);
    setIsNew(!!c && !c.junk && !!cur && !fishingOf(cur.state).seen.includes(catchArt(c)));
    setStamp(null); // 힘겨루기 때 찍힌 글자판이 실루엣을 가리면 안 된다
    setPhase("reveal");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.push(setTimeout(() => {
      setPhase("landed");
      if (!c) return;
      if (!c.junk) {
        const fresh = !!cur && !fishingOf(cur.state).seen.includes(catchArt(c));
        fxRef.current?.reveal(grade);
        if (grade >= 3) showStamp(`${c.grade}!`, "gold");
        else if (fresh) showStamp("새 물고기!", "gold");
        buzz(grade >= 5 ? [60, 40, 60, 40, 200] : grade >= 3 ? [40, 30, 120] : 30);
        return;
      }
      const t = clock();
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
  }, [act, showStamp, myName, noteStanding, who]);

  // 낚싯대 젖히기 · 모든 방식의 진행이 같은 박자로 돈다. 프레임이 밀려도 한 번에 0.1초까지만 센다.
  useEffect(() => {
    if (phase !== "charge" && phase !== "fight" && phase !== "lure" && phase !== "aim") return;
    let last = clock();
    const iv = setInterval(() => {
      const now = clock();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (pausedRef.current) return;
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
        const next = stepLure(cur, dt, tune, c.difficulty);
        lureRef.current = next;
        setLureS(next);
        fxn?.set({ beat: lureRing(next, tune), beatHot: Math.abs(next.t - next.nextBeat) <= tune.window, interest: next.interest, line: next.line });
        if (next.status === "empty") loseRound("empty");
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
      if (next.status === "on" && feverNow(next.dist, fightQuality(next))) return;
      if (next.status === "landed") {
        const b = bossOf(fishRef.current?.boss);
        if (b && bossLeft(fightHpRef.current, b.chunk, 0) > 0) loseRound("bossBroke");
        else landRound(fightQuality(next));
      } else if (next.status === "slack") loseRound("slack");
      else if (next.status !== "on") loseRound(next.status);
    }, 33);
    return () => clearInterval(iv);
  }, [phase, loseRound, landRound, feverNow]);

  /** 닫기 — 판이 돌아가는 중이면 먼저 묻는다. 끌어올린 물고기를 말없이 버리지 않는다. 바로 닫히면 true. */
  const requestClose = useCallback((): boolean => {
    if (phase === "reveal" || phase === "scoop") return false; // 곧 끝나는 공개 · 담기 — 결과를 보고 닫는다
    if (phase === "landed" && fish && !fish.junk) {
      const c = fish;
      void ask(c.boss ? { message: "주인을 수조에 담지 않고 닫을까요?", detail: "잡은 기록과 보상은 남아요. 물고기는 시장으로 가요.", confirmText: "닫기", cancelText: "담으러 가기" } : { message: "잡은 물고기를 팔고 닫을까요?", detail: "수조에 담으려면 '계속 낚시'를 눌러 주세요.", confirmText: "팔고 닫기", cancelText: "계속 낚시" }).then(async (ok) => {
        if (!ok) return;
        const t = clock();
        const r = await act((s) => sellCatch(s, c, kstDate(t), by), true);
        if (r?.ok) void reportCatch(myName, c, quality, perfectHook, false);
        onClose();
      });
      return false;
    }
    if (phase === "fever") return false; // 전체 화면이라 확인창이 가려진다 — 길어야 10초면 끝난다
    if (phase === "charge" || phase === "wait" || phase === "bite" || phase === "lure" || phase === "aim" || phase === "fight") {
      void ask({ message: "지금 닫으면 이번 판은 끝나요", detail: "쓴 미끼는 돌아오지 않아요. 그동안 판은 멈춰 있어요.", confirmText: "닫기", cancelText: "계속 낚시" }).then((ok) => {
        if (ok) onClose();
      });
      return false;
    }
    onClose();
    return true;
  }, [phase, fish, act, ask, myName, quality, perfectHook, onClose, by]);
  useBackClose(requestClose);
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

  const shell = (children: ReactNode) => (
    <div className="aqua-shell fish-shell fixed inset-0 z-[90] overflow-y-auto">
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
  const eff = buffedStats(st, fs, clock());
  const buff = st.buffs?.hunt && st.buffs.hunt.until > clock() ? st.buffs.hunt.amount : 0;
  const spot = currentSpot(fs, spotPick, today);
  const moment: FishMoment = { time: fishTimeOf(clock()), wx: forecast && clock() - forecast.fetchedAt < WEATHER_TTL_MS * 3 ? fishWxOf(wmoInfo(forecast.fc.current.weather_code).icon) : null };
  const guests = timedAt(spot.key, moment);
  const boss = bossAt(spot.key);
  const bossRec = boss ? fs.bosses[boss.key] : undefined;
  const bossWhy = boss ? bossBlockOf(fs, boss, who, today) : null;
  const activeBoss = boss && bossPick === boss.key && !bossWhy ? boss : null;
  const exped = expedFor(fs, today, !!coupleId);
  const aq = aquaOf(st);
  const how = methodOf(method);
  const { shown, bait } = currentBait(fs, spot, baitPick, how.baitCost, today);
  const baitLeft = baitStock(fs, bait.key, today);
  const shownLeft = baitStock(fs, shown.key, today);
  const blocked = castBlock(fs, spot, method, bait.key, today);
  // 피버를 다 맞힌 물고기는 반드시 담긴다 — 등급업이 드문 만큼 성공의 값어치를 여기서 준다
  const chance = fish ? (feverWon || fish.boss ? 1 : captureChance(eff.catch, fish.difficulty, quality, perfectHook, method)) : 0;
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
      const up = upgradeCatch(c, spot, roundBait.current, eff.luck, Math.floor(dice() * 2 ** 31));
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

  /** 미끼 쓰기 — 화면은 기다리지 않는다. 그 사이 상대가 마지막 미끼를 썼으면 판을 물린다. */
  function payBait(castM = 0) {
    const t = clock(), key = bait.key, sp = spot, m = method;
    roundBait.current = baitIndex(key);
    void act((s) => spendBait(s, sp, m, key, kstDate(t), castM), true).then((r) => {
      if (r && !r.ok) {
        clearTimers();
        fx?.reset();
        setPhase("ready");
      }
    });
  }

  function clearRound() {
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
    fightRef.current = null;
    setPicked(null);
    setBossNote(null);
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
        timers.current.push(setTimeout(() => {
          fx?.setShoal([]);
          if (feverRoll()) {
            feverPlan.current = { triggerDist: 1 };
            feverNow(0, next.quality);
          } else {
            landRound(next.quality);
          }
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
    if (phase === "ready" || phase === "lost" || phase === "result") {
      if (blocked) {
        setSheetOpen(true); // 왜 못 던지는지와 고칠 곳이 시트에 함께 있다
        return;
      }
      setMsg(null);
      clearRound();
      setSpotPick(spot.key); // 판 도중 레벨이 오르거나 미끼가 떨어져도 낚시터가 저절로 바뀌지 않게
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
      const good = clock() - biteAt.current <= biteMs.current * PERFECT_HOOK;
      setPerfectHook(good);
      fx?.hook(good);
      showStamp(good ? "완벽한 챔질!" : "걸렸다!", good ? "gold" : "hit");
      buzz([25, 20, 90]);
      const fightBoss = bossOf(fish.boss);
      if (fightBoss) {
        const hp = bossHp(bossRec, today);
        const tune = bossTune(fightBoss, eff);
        const f = startFight(Math.floor(dice() * 2 ** 31), tune);
        fightHpRef.current = hp;
        setFightHp(hp);
        feverPlan.current = null;
        tuneRef.current = tune;
        fightRef.current = f;
        holdRef.current = true;
        setHolding(true);
        setFight(f);
        setPhase("fight");
        void act((s) => bossOpen(s, fightBoss.key, who, kstDate(clock())), true);
        return;
      }
      if (method === "deep") {
        const tune = deepTune(fish.difficulty, eff);
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
      const tune = fightTune(fish.difficulty, eff, fish.family);
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
      const { lure, grade } = tapLure(cur, tune, fish.difficulty);
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
        const st2 = swayTune(fish.difficulty, eff);
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
    } else if (phase === "fight") {
      holdRef.current = true;
      setHolding(true);
      lastAng.current = null;
    }
  }

  /** 놓았다 — 돌린 힘과 튕김으로 거리가 정해진다 */
  function castNow(flick: number) {
      const spin = spinRef.current;
      const score = castScore(spin, flick);
      const meters = castMeters(score, castRange(fs.rod, fs.stats.power));
      const rating = castRating(score, spin.turns);
      thrownId.current += 1;
      setThrown({ id: thrownId.current, m: meters, rating, record: meters > fs.bestCast && fs.bestCast > 0 });
      buzz(score >= 0.6 ? [20, 30, 60] : 20);
      const seed = Math.floor(dice() * 2 ** 31);
      const c = activeBoss ? bossCatch(activeBoss) : rollCatch(spot, eff.luck, score, seed, { bait: baitIndex(bait.key), method, junk: true, when: moment });
      const plan = waitPlan(seed);
      const land = landingPoint(score, dice());
      gradeRef.current = GRADES.indexOf(c.grade);
      fishRef.current = c;
      setFish(c);
      setLandPt(land);
      payBait(meters);
      fx?.cast(land, plan.waitMs, shadowSize(c), gradeRef.current, score, spin.dir);
      if (method === "lure") {
        const tune = lureTune(c.difficulty, eff);
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
        }, at);
      }
      later(() => {
        biteAt.current = clock();
        biteMs.current = hookWindowMs(c.difficulty, eff.line);
        setPhase("bite");
        fx?.bite(biteMs.current);
        buzz(80);
        later(() => loseRound("late"), biteMs.current);
      }, plan.waitMs);
  }

  function release() {
    if (phase === "charge") {
      const pts = pointsRef.current, end = pts[pts.length - 1];
      const from = end && (pts.find((p) => end.t - p.t <= FLICK_WINDOW_MS) ?? end);
      const ms = end && from ? end.t - from.t : 0;
      // 위로 튕길수록 잘 나간다 · 옆으로 튕긴 건 조금만 친다
      const flick = ms > 0 ? (Math.max(0, from.y - end.y) + Math.abs(end.x - from.x) * 0.35) / ms : 0;
      castNow(keySpin.current ? FLICK_FULL * 0.7 : flick);
      keySpin.current = false;
      return;
    }
    if (phase === "fight") {
      holdRef.current = false;
      setHolding(false);
      lastAng.current = null;
    }
  }

  /** 끌기 — 루어는 좌우 위치, 심해는 다이얼 둘레를 도는 각도 */
  function drag(x: number, y: number, w: number, h: number) {
    if (phase === "charge") {
      const pts = pointsRef.current;
      pts.push({ x, y, t: clock() });
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
      if (method !== "scoop" && (method === "deep" ? phase !== "wait" && phase !== "bite" && phase !== "lure" : phase !== "fight" && phase !== "wait" && phase !== "bite" && phase !== "lure")) keySpin.current = true;
    }
    if (e.type === "keyup") {
      if (phase !== "charge") keySpin.current = false;
      release();
    }
  }

  async function store(releaseId?: number) {
    if (!fish || fish.junk) return;
    const roll = dice(), c = fish, p = chance, t = clock();
    setPicked("store");
    setSwapOpen(false);
    setPhase("scoop");
    buzz(20);
    const [r] = await Promise.all([act((s) => (releaseId === undefined ? tryStore(s, c, p, roll, t, kstDate(t), by) : tryStoreSwap(s, c, releaseId, p, roll, t, kstDate(t), by)), true), pause(SCOOP_MS)]);
    if (!r?.ok) {
      setPicked(null);
      setPhase("landed");
      return;
    }
    void reportCatch(myName, c, quality, perfectHook, r.outcome === "stored").then(noteStanding);
    setResult(r);
    setPhase("result");
    if (r.outcome === "stored") {
      fx?.stored(GRADES.indexOf(c.grade));
      showStamp("포획 성공!", "gold");
      buzz([40, 40, 40, 40, 160]);
    } else {
      showStamp("놓쳤다…", "miss");
      buzz(90);
      timers.current.push(setTimeout(() => fx?.slipped(), 430)); // 물고기가 떨어지는 때에 맞춘다
    }
  }
  async function sell() {
    if (!fish || fish.junk) return;
    const c = fish, t = clock();
    setPicked("sell");
    const r = await act((s) => sellCatch(s, c, kstDate(t), by), true);
    if (!r?.ok) setPicked(null);
    if (r?.ok) {
      void reportCatch(myName, c, quality, perfectHook, false).then(noteStanding);
      setResult(r);
      setPhase("result");
      fx?.sold();
      showStamp("팔았어요!", "gold");
      buzz(30);
    }
  }

  const fightEvent = phase === "fight" && method === "float" && fight ? (fight.surgeLeft > 0 ? fight.event : null) : null;
  const fightWarn = phase === "fight" && method === "float" && fight && fight.warnLeft > 0 ? fight.event : null;
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
  const hint = phase === "ready" ? (blocked ?? (activeBoss ? `${activeBoss.name}에게 던지기` : method === "scoop" ? "눌러서 시작" : "눌러서 던지기 · 돌리면 더 멀리"))
    : phase === "charge" ? (spinLive && spinLive.turns > 0.5 ? (spinLive.rate * spinLive.dir > 4 ? "너무 빨라요! 조금 천천히" : spinGain(spinLive.rate) >= 0.9 ? "좋아요! 위로 휙!" : "더 빠르게 돌려요") : "")
    : phase === "wait" ? "찌가 크게 잠길 때까지 기다려요"
    : phase === "bite" ? "지금! 누르세요!"
    : phase === "lure" ? "고리가 겹칠 때 톡! 치세요"
    : phase === "aim" ? "그림자가 갈 곳을 앞서 누르세요"
    : phase === "fight" ? fightHint
    : phase === "lost" || phase === "result" ? (blocked ?? (activeBoss ? `${activeBoss.name}에게 다시 던지기 · 오늘 ${bossTriesLeft(bossRec, who, today)}번 남음` : "눌러서 다시 던지기")) : "";
  const loudHint = phase === "bite" || surge || leaping || diving;
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
            {label}{k === "stat" && fs.points + claimableGoals(fs, today) > 0 ? ` (${fs.points + claimableGoals(fs, today)})` : ""}
          </button>
        ))}
        <button type="button" className="tap disabled:opacity-50" disabled={playing} onClick={() => setTankOpen(true)}>내 수조</button>
      </div>
      {msg && <p className="aqua-msg" aria-live="polite">{msg}</p>}

      {tab === "fish" && (
        <>
          <div
            className={`fish-scene s-${spot.key}`}
            role="button"
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
            <i className={`fish-sky t-${moment.time} ${moment.wx ? `w-${moment.wx}` : ""}`} aria-hidden />
            <canvas ref={attachFx} className="fish-fx" aria-hidden />
            {(phase === "ready" || phase === "lost") && (
              <div className="fish-chips" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                <div className="fish-chips-left">
                  <button type="button" className="tap fish-chip is-list" onClick={() => setWorldSheet("fish")}>물고기 {catchableCount(spot, baitIndex(bait.key), moment)}종 보기</button>
                  <button type="button" className={`tap fish-chip ${guests.length ? "is-hot" : ""}`} onClick={() => setWorldSheet("timed")}>
                    {TIME_NAME[moment.time]}{moment.wx ? ` · ${WX_NAME[moment.wx]}` : ""}{guests.length ? " · 때 손님!" : ""}
                  </button>
                </div>
                {boss && fs.level >= boss.level && (
                  <button type="button" className={`tap fish-chip is-boss ${activeBoss ? "is-on" : ""}`} onClick={() => setWorldSheet("boss")}>
                    주인 {boss.name} {bossRec?.until && bossWhy && !bossWhy.startsWith("오늘") ? "쉬는 중" : `${Math.round(bossHp(bossRec, today) * 100)}%`}
                  </button>
                )}
              </div>
            )}
            {(phase === "wait" || phase === "bite" || phase === "fight") && fish?.boss && <p className="fish-boss-tag">주인 {bossOf(fish.boss)?.name}{phase === "fight" ? ` · 체력 ${Math.round(bossLeft(fightHp, bossOf(fish.boss)?.chunk ?? 0, distNow) * 100)}%` : ""}</p>}

            {phase === "charge" && spinLive && spinLive.turns > 0.5 && (
              <div className="fish-spin" aria-hidden>
                <b>{castMeters(castScore(spinLive, FLICK_FULL), castRange(fs.rod, fs.stats.power)).toFixed(1)}<i>m</i></b>
                <span><u style={{ width: `${spinLive.energy * 100}%` }} /></span>
              </div>
            )}
            {thrown && (phase === "wait" || phase === "lure" || phase === "bite") && (
              <p key={thrown.id} className={`fish-throw ${phase === "lure" ? "is-low" : ""}`} aria-live="polite">
                <b>{thrown.m.toFixed(1)}m</b> {thrown.rating}{thrown.record && <em>새 기록!</em>}
              </p>
            )}

            {phase === "fever" && feverSeed !== null && <FishFever spot={spot} seed={feverSeed} onDone={endFever} />}
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
                <div className={`fish-tension ${hotTension ? "is-hot" : ""} ${method === "float" ? "" : "is-plain"}`} aria-hidden>
                  <em>장력</em>
                  <span>
                    {method === "float" && <i className="fish-tension-green" style={{ bottom: `${GREEN_LOW * 100}%`, height: `${(GREEN_HIGH - GREEN_LOW) * 100}%` }} />}
                    <b style={{ bottom: `${Math.min(1, tension) * 100}%` }} />
                  </span>
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
            {hint && <p className={`fish-hint ${loudHint ? "is-loud" : ""} ${leaping ? "is-jump" : ""}`}>{hint}</p>}
            {phase === "lost" && lost && <p className="fish-lost" aria-live="polite">{LOST_TEXT[lost]}{bossNote && <small>{bossNote}</small>}</p>}

            {(phase === "reveal" || phase === "landed" || phase === "scoop" || phase === "result") && fish && (
              <div
                className={`fish-card g${GRADES.indexOf(fish.grade)} is-${phase === "result" ? result?.outcome : phase} ${!fish.junk && GRADES.indexOf(fish.grade) >= 3 ? "is-rare" : ""}`}
                style={{ "--gc": FX_GRADE_LIGHT[GRADES.indexOf(fish.grade)], "--rv": `${revealMs(GRADES.indexOf(fish.grade), false)}ms` } as CSSProperties}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="fish-card-pic" style={fish.junk ? undefined : { width: `${36 + shadowSize(fish) * 28}%`, left: `${32 - shadowSize(fish) * 14}%` }}>{fish.junk && phase !== "reveal" ? <JunkIcon k={fish.junk} /> : <FishArt artKey={catchArt(fish)} />}</span>
                {phase === "reveal" && <b className="fish-reveal-q" aria-live="polite">?</b>}
                {phase === "scoop" && <span className="fish-net" aria-hidden><GearPic k={NETS[fs.net].key} label={NETS[fs.net].name} /></span>}
                {phase === "result" && result?.outcome === "sold" && Array.from({ length: 12 }, (_, k) => (
                  <i key={k} className="fish-coin" aria-hidden style={{ "--x": `${Math.cos(k * 0.52) * (70 + (k % 3) * 34)}px`, "--y": `${-Math.abs(Math.sin(k * 0.52)) * (60 + (k % 4) * 26) - 20}px`, "--d": `${(k % 5) * 45}ms` } as CSSProperties}><Coin /></i>
                ))}
                {phase !== "reveal" && <div className="fish-panel" key={phase === "result" ? "result" : "catch"}>
                  {feverNote && phase !== "result" && <b className="fish-fever-note">{feverNote}</b>}
                  {fish.boss && bossNote && phase !== "result" && <b className="fish-fever-note">{bossNote}</b>}
                  {isNew && phase !== "result" && <b className="fish-new">NEW · 처음 만난 물고기</b>}
                  <strong className="fish-name">{fish.junk ? junkOf(fish.junk)?.name : catchName(fish)}</strong>
                  {fish.junk ? <span className="aqua-grade fish-junk-tag">꽝</span> : <span className={gradeClass(fish.grade)}>{fish.grade}</span>}
                  {sizeLine && <p className={`fish-size ${result?.sizeNote ? "is-record" : ""}`}>{sizeLine}</p>}
                  {fish.junk ? (
                    <>
                      <p className="fish-junk-line">{junkOf(fish.junk)?.line}</p>
                      {result?.firstJunk && <p className="fish-levelup">수집함에 새로 올랐어요!</p>}
                      {result && result.coins > 0 && <p className="aqua-price">분리수거 <Coin /> +{result.coins.toLocaleString()}</p>}
                      {result && <p className="fish-points">랭킹 +{catchPoints(fish, quality, perfectHook, false)}점{rankNote && <small>{rankNote}</small>}</p>}
                      {result && <ActionButton main wide onClick={() => { clearRound(); setBossPick(null); setPhase("ready"); }}>다시 던지기</ActionButton>}
                    </>
                  ) : phase === "scoop" ? (
                    <p className="fish-scoop-note">뜰채로 건지는 중<i /><i /><i /> <small>성공 확률 {pct(chance)}</small></p>
                  ) : phase === "landed" ? (
                    <>
                      <p className="aqua-note">
                        {perfectHook ? "정확한 챔질! " : ""}줄 다루기 {pct(quality)} · 경험치 +{xpValue(fish.difficulty)}
                      </p>
                      <div className={`fish-choice ${picked ? `picked-${picked}` : ""}`}>
                      {block === TANK_FULL ? (
                        <ActionButton main wide className="fish-choice-store" disabled={busy || !!picked} onClick={() => setSwapOpen(true)}>한 마리 보내고 담기 · 성공 확률 {pct(chance)}</ActionButton>
                      ) : block ? <p className="fish-block">{block} — 수조에 담을 수 없어요</p> : (
                        <ActionButton main wide className="fish-choice-store" disabled={busy || !!picked} onClick={() => void store()}>
                          수조에 담기 · 성공 확률 {pct(chance)}
                        </ActionButton>
                      )}
                      <ActionButton wide className="fish-choice-sell" disabled={busy || !!picked} onClick={() => void sell()}>
                        {fish.boss ? "보내 주기" : block && block !== TANK_FULL ? "팔기" : "그냥 팔기"} <span className="aqua-price"><Coin /> {coinValue(fish.difficulty).toLocaleString()}</span>
                      </ActionButton>
                      </div>
                    </>
                  ) : result && (
                    <>
                      <p className="fish-outcome">
                        {result.outcome === "stored" ? "수조에 담았어요!" : result.outcome === "slipped" ? "손에서 미끄러져 빠져나갔어요…" : "시장에 팔았어요"}
                      </p>
                      {result.coins > 0 && <p className="aqua-price"><Coin /> +{result.coins.toLocaleString()}</p>}
                      <p className="fish-points">랭킹 +{catchPoints(fish, quality, perfectHook, result.outcome === "stored")}점{rankNote && <small>{rankNote}</small>}</p>
                      {result.levelUp > 0 && <p className="fish-levelup">낚시 레벨 업! 능력치 점수를 쓸 수 있어요</p>}
                      {expedLine && <p className="fish-levelup">{expedLine}</p>}
                      <ActionButton main wide onClick={() => { clearRound(); setBossPick(null); setPhase("ready"); }}>다시 던지기</ActionButton>
                      {result.outcome === "stored" && <ActionButton wide onClick={() => setTankOpen(true)}>수조에서 보기</ActionButton>}
                    </>
                  )}
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
            {stamp && <Stamp key={stamp.id} text={stamp.text} tone={stamp.tone} high={phase === "fight" || phase === "aim"} />}
          </div>

          <button type="button" className="tap fish-loadout" aria-haspopup="dialog" disabled={playing} onClick={() => setSheetOpen(true)}>
            <span className="fish-loadout-icon"><BaitIcon k={bait.key} /></span>
            <span className="min-w-0 flex-1">
              <strong>{spot.name} <em className="whitespace-nowrap">원정 {exped.count}/{exped.need.count}</em></strong>
              <small>{how.name} · {bait.name} {baitLeft}회</small>
            </span>
            <span className="fish-loadout-lv">Lv.{fs.level}<i aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></i></span>
            <span aria-hidden className="fish-loadout-more">▾</span>
          </button>

          {worldSheet === "fish" && <FishListSheet spot={spot} baitIdx={baitIndex(bait.key)} method={method} luck={eff.luck} moment={moment} level={fs.level} seen={formsSeen(st)} onClose={() => setWorldSheet(null)} />}
          {worldSheet === "timed" && <TimedSheet spot={spot} moment={moment} baitGrade={bait.maxGrade} onClose={() => setWorldSheet(null)} />}
          {worldSheet === "boss" && boss && (
            <BossSheet boss={boss} rec={bossRec} today={today} who={who} why={bossWhy} on={!!activeBoss} tries={BOSS_TRIES} onClose={() => setWorldSheet(null)} onToggle={() => {
              if (activeBoss) setBossPick(null);
              else {
                setBossPick(boss.key);
                setMethod("float"); // 주인과는 찌낚시로 겨룬다. 저장하지 않아 다음 판엔 고른 방식으로 돌아온다
                clearRound();
                setPhase("ready");
              }
              setWorldSheet(null);
            }} />
          )}
          {sheetOpen && (
            <div className="fish-sheet-back" onClick={() => setSheetOpen(false)}>
              <div className="fish-sheet" role="dialog" aria-modal="true" aria-label="낚시 준비" onClick={(e) => e.stopPropagation()}>
                <header className="fish-sheet-head"><strong>낚시 준비</strong><CloseButton onClose={() => setSheetOpen(false)} label="완료" /></header>
                {blocked && <p className="aqua-msg" aria-live="polite">{blocked}</p>}

                <h3 className="fish-sheet-title">낚시터</h3>
                <div className="fish-spots">
                  {SPOTS.map((x) => {
                    const locked = x.minLevel > fs.level;
                    return (
                      <button key={x.key} type="button" className={`tap ${x.key === spot.key ? "is-on" : ""}`} disabled={locked} onClick={() => { setSpotPick(x.key); savePrefs({ spot: x.key }); setBossPick(null); }}>
                        {x.name} <small>{locked ? `Lv.${x.minLevel}` : WATER_NAME[x.water]}</small>
                      </button>
                    );
                  })}
                </div>

                <h3 className="fish-sheet-title">방식</h3>
                <div className="fish-methods" role="radiogroup" aria-label="낚시 방식">
                  {METHODS.map((m) => {
                    const off = fs.level < m.minLevel;
                    return (
                      <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`tap ${method === m.key ? "is-on" : ""}`} disabled={off} onClick={() => { setMethod(m.key); savePrefs({ method: m.key }); setBossPick(null); clearRound(); setPhase("ready"); }}>
                        <MethodIcon k={m.key} />
                        <strong>{m.name}</strong>
                        <small>{off ? `Lv.${m.minLevel}` : m.good}</small>
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
                      <button key={b.key} type="button" aria-pressed={shown.key === b.key} className={`tap ${shown.key === b.key ? "is-on" : ""} ${fits ? "" : "is-off"}`} disabled={!fits} onClick={() => { setBaitPick(b.key); savePrefs({ bait: b.key }); }}>
                        <span className="fish-bait-pic"><BaitIcon k={b.key} /></span>
                        <strong>{b.name}</strong>
                        <small>{GRADES[b.maxGrade]}까지 · {left}회</small>
                      </button>
                    );
                  })}
                </div>
                <div className="fish-bait-now">
                  <p>{shown.name} {shownLeft}회 남음 <small>{bait.key !== shown.key ? `떨어져서 지금은 ${bait.name} 사용` : shown.desc}</small></p>
                  <ActionButton disabled={busy || st.coins < shown.price} onClick={() => void act((s) => buyBait(s, shown.key, kstDate(clock())))}>
                    +{shown.uses}회 <span className="aqua-price"><Coin /> {shown.price.toLocaleString()}</span>
                  </ActionButton>
                </div>

                <h3 className="fish-sheet-title">낚시 Lv.{fs.level} <small>수조 {aq.fish.length}/{tankOf(aq).fish}</small></h3>
                <div className="fish-xp" aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></div>
                <p className="aqua-note mt-2">포획 {eff.catch} · 힘 {eff.power}{buff > 0 ? ` (도시락 힘 +${buff}%)` : ""} · 줄 다루기 {eff.line} · 행운 {eff.luck}</p>
                <p className="aqua-note">캐스팅 최대 {Math.round(castRange(fs.rod, fs.stats.power))}m · 내 기록 {fs.bestCast.toFixed(1)}m — 좋은 낚싯대 · 힘을 올리면 더 멀리 가요</p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "gear" && <FishGear fs={fs} coins={st.coins} busy={busy} today={today} onBuyRod={() => void act(buyRod)} onBuyNet={() => void act(buyNet)} onBuyBait={(key) => { void act((s) => buyBait(s, key, kstDate(clock()))); }} />}
      {tab === "stat" && <FishStats fs={fs} eff={eff} busy={busy} today={today} who={who} exped={exped} couple={!!coupleId} cheered={cheered} onCheer={() => void cheer()} onSpend={(k) => void act((s) => spendPoint(s, k))} onClaim={(id) => { void act((s) => claimFishGoal(s, id, kstDate(clock()))); }} />}

      {tab === "rank" && <FishRank myName={myName} />}

      {tankOpen && <AquariumGame coupleId={coupleId} onClose={() => { setTankOpen(false); void load(); }} onOpenIsland={onOpenIsland} onFish={() => { setTankOpen(false); void load(); }} />}
    </div>,
  );
}
