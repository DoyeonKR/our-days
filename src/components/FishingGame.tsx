"use client";

/* 낚시 화면 — 규칙은 전부 lib/fishing(순수), 찌 · 줄 · 물보라는 lib/fishingfx(캔버스). 여기는 입력 · 타이머 · 글자판과 저장뿐이다.
 * 한 손가락으로 다 한다. 방식마다 손이 다르다: 찌(누르고 떼기) · 루어(박자 맞춰 치기 → 좌우로 끌기) · 뜰채(앞서 겨눠 누르기) · 심해(릴 돌리기). 규칙은 lib/fishingmodes.
 * 저장은 던질 때(미끼) · 끌어올린 뒤 · 장비를 바꿀 때만(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더). 힘겨루기 중엔 쓰지 않는다. */
import { ActionButton, CloseButton } from "@/components/AppButtons";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import AquariumGame from "@/components/AquariumGame";
import { FishArt } from "@/components/AquaArt";
import { BaitIcon, JunkIcon, MethodIcon } from "@/components/FishingIcons";
import FishRank, { readFishNick } from "@/components/FishRank";
import { Coin } from "@/components/island/UiIcon";
import { asset } from "@/lib/base";
import { GRADES, aquaOf, tankOf, type Grade } from "@/lib/aquarium";
import { getFishStanding, loadIsland, saveIsland, submitFishCatch, watchIsland, type IslandRow } from "@/lib/couple";
import { FX_GRADE_LIGHT, FishFx, landingPoint, type FxLost } from "@/lib/fishingfx";
import {
  DEEP_METERS, PLUNGE_S, SCOOP_SHOTS, SCOOP_TIME_S, deepBand, deepQuality, deepTune, lureQuality, lureRing, lureTune, netRadius, plunge, scoopPos, startDeep, startLure, startScoop, startSway, stepDeep, stepLure, stepScoop, stepSway, swayQuality, swayTune, tapLure,
  type Deep, type DeepTune, type Lure, type LureTune, type Scoop, type Sway, type SwayTune, type TapGrade,
} from "@/lib/fishingmodes";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import {
  BAITS, FLICK_FULL, DAILY_FISH_COINS, GREEN_HIGH, GREEN_LOW, JUNKS, MAX_LEVEL, METHODS, NETS, PERFECT_HOOK, RODS, SPOTS, STAT_CAP, STAT_INFO, STAT_KEYS,
  baitIndex, baitStock, buyBait, buyNet, buyRod, captureChance, castBlock, castMeters, castRange, castRating, castScore, catchArt, catchName, catchPoints, coinValue, effectiveStats, fightQuality, fightTune, fishingOf, haulJunk, headingDelta, hookWindowMs, junkOf, methodOf, poolFor,
  rankLine, revealMs, rollCatch, sellCatch, shadowSize, spendBait, spendPoint, spinGain, spotMinBait, startFight, startSpin, stepFight, stepSpin, storeBlock, tryStore, waitPlan, xpNeed, xpValue,
  type CastSpin, type Fight, type FightTune, type FishCatch, type FishResult, type FishStanding, type FishStat, type GearResult, type MethodKey,
} from "@/lib/fishing";
import type { IslandState } from "@/lib/island";
import { kstDate } from "@/lib/kst";

type Tab = "fish" | "gear" | "stat" | "rank";
type Phase = "ready" | "charge" | "wait" | "bite" | "lure" | "aim" | "fight" | "reveal" | "landed" | "scoop" | "result" | "lost";
type StampTone = "hit" | "gold" | "miss";
/** 시각 · 주사위 — 눌렀을 때만 부른다(렌더 중에 부르지 않는다) */
const clock = () => Date.now();
const dice = () => Math.random();
const TABS: readonly (readonly [Tab, string])[] = [["fish", "낚시터"], ["gear", "장비"], ["stat", "능력치"], ["rank", "랭킹"]];
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
function readPrefs(): { method?: MethodKey; bait?: string } {
  try {
    return JSON.parse(localStorage.getItem(PREFS) ?? "{}");
  } catch {
    return {};
  }
}
function savePrefs(v: { method?: MethodKey; bait?: string }) {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ ...readPrefs(), ...v }));
  } catch {
    /* 저장 못 해도 이번 판은 된다 */
  }
}

const LOST_TEXT = {
  early: "너무 일찍 챘어요! 물고기가 놀라 달아났어요",
  late: "늦었어요! 미끼만 먹고 뱉어 버렸어요",
  snapped: "줄이 끊어졌어요! 팽팽해지면 손을 떼세요",
  slack: "줄이 너무 느슨해 바늘이 빠졌어요",
  thrown: "뛰어오를 때 줄이 늘어져 바늘이 털렸어요. 뛰면 계속 감으세요",
  escaped: "물고기가 멀리 달아났어요",
  swaySnap: "줄이 끊어졌어요! 물고기 반대쪽으로 끌어야 해요",
  spinSnap: "줄이 끊어졌어요! 파고들 땐 릴을 멈추고, 빠르면 늦추세요",
  idle: "릴을 멈춘 사이 물고기가 빠져나갔어요. 파고들 때만 멈추세요",
  empty: "루어를 다 감았어요. 박자에 맞춰 쳐야 관심을 가져요",
  out: "그물이 다 빗나갔어요. 그림자가 갈 곳을 앞서 노리세요",
  time: "물고기들이 다 흩어졌어요",
} as const;
type LostKey = keyof typeof LOST_TEXT;
const LOST_FX: Record<LostKey, FxLost> = { early: "early", late: "late", snapped: "snapped", slack: "slack", thrown: "slack", escaped: "escaped", swaySnap: "snapped", spinSnap: "snapped", idle: "slack", empty: "escaped", out: "escaped", time: "escaped" };
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
  return submitFishCatch(myName.trim() || readFishNick(), name, GRADES.indexOf(c.grade), c.stage, quality, perfect, stored, !!c.junk)
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

function GearPic({ k, label }: { k: string; label: string }) {
  if (FISHING_IMAGE_KEYS.has(k)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/fishing/${k}.webp`)} alt="" className="aqua-img fish-gear-img" draggable={false} decoding="async" />;
  }
  return <span className="aqua-decor-temp" aria-hidden>{label.slice(0, 3)}</span>;
}

export default function FishingGame({ coupleId, myName = "", onClose, onOpenIsland }: { coupleId: string | null; myName?: string; onClose: () => void; onOpenIsland: () => void }) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("fish");
  const [tankOpen, setTankOpen] = useState(false);
  const [spotPick, setSpotPick] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<MethodKey>(() => readPrefs().method ?? "float");
  const [baitPick, setBaitPick] = useState<string | null>(() => readPrefs().bait ?? null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [charge, setCharge] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    if (!fx || !tankOpen) return;
    fx.pause();
    return () => fx.resume();
  }, [fx, tankOpen]);
  useEffect(() => {
    fx?.set({ phase, charge, holding, method });
  }, [fx, phase, charge, holding, method]);
  useEffect(() => {
    if (!fx || !row) return;
    const cur = fishingOf(row.state);
    const list = SPOTS.filter((x) => x.minLevel <= cur.level);
    fx.art((k) => (FISHING_IMAGE_KEYS.has(k) ? asset(`/fishing/${k}.webp`) : null), NETS[cur.net]?.key ?? NETS[0].key);
    fx.set({ rod: RODS[cur.rod]?.key ?? RODS[0].key, spot: (list.find((x) => x.key === spotPick) ?? list[list.length - 1]).key });
  }, [fx, row, spotPick]);

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
  const act = useCallback(async <R extends FishResult | GearResult>(make: (st: IslandState) => R): Promise<R | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
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
      busyRef.current = false;
      setBusy(false);
    }
  }, [coupleId]);

  const loseRound = useCallback((key: LostKey) => {
    const kind = LOST_FX[key];
    clearTimers();
    setLost(key);
    setHolding(false);
    holdRef.current = false;
    fxRef.current?.lost(kind);
    showStamp(LOST_STAMP[kind], "miss");
    buzz(kind === "snapped" ? [120, 40, 60] : 60);
    setPhase("lost");
  }, [showStamp]);

  /** 끌어올렸다 — 실루엣으로 뜸을 들이고(귀할수록 길게) 그다음 공개. 쓰레기도 같은 물고기 실루엣이라 공개 순간까지 모른다. */
  const landRound = useCallback((q: number) => {
    const c = fishRef.current;
    const grade = gradeRef.current;
    const cur = rowRef.current;
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
      void act((s) => haulJunk(s, c, kstDate(t))).then((r) => {
        if (r?.ok) {
          void reportCatch(myName, c, q, false, false).then(noteStanding);
          setResult(r);
          setPhase("result");
        } else {
          setPhase("ready");
        }
      });
    }, revealMs(grade, reduced)));
  }, [act, showStamp, myName, noteStanding]);

  // 낚싯대 젖히기 · 모든 방식의 진행이 같은 박자로 돈다. 프레임이 밀려도 한 번에 0.1초까지만 센다.
  useEffect(() => {
    if (phase !== "charge" && phase !== "fight" && phase !== "lure" && phase !== "aim") return;
    let last = clock();
    const iv = setInterval(() => {
      const now = clock();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
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
      if (next.status === "landed") landRound(fightQuality(next));
      else if (next.status === "slack") loseRound(next.thrown > 0 ? "thrown" : "slack");
      else if (next.status !== "on") loseRound(next.status);
    }, 33);
    return () => clearInterval(iv);
  }, [phase, loseRound, landRound]);

  const shell = (children: ReactNode) => (
    <div className="aqua-shell fish-shell fixed inset-0 z-[90] overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-md pb-10">
        <div className="aqua-head sticky top-0 z-[500] flex items-center gap-2 px-4 py-3">
          <p className="text-base font-extrabold">낚시</p>
          {row && <p className="aqua-wallet"><Coin /> {row.state.coins.toLocaleString()}</p>}
          <CloseButton onClose={onClose} />
        </div>
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
  const eff = effectiveStats(fs);
  const open = SPOTS.filter((x) => x.minLevel <= fs.level);
  const stocked = open.filter((x) => BAITS.some((b) => poolFor(x, b.maxGrade).length > 0 && baitStock(fs, b.key, today) > 0));
  const spot = open.find((x) => x.key === spotPick) ?? stocked[stocked.length - 1] ?? open[0];
  const coinsLeft = Math.max(0, DAILY_FISH_COINS - (fs.day === today ? fs.dayCoins : 0));
  const aq = aquaOf(st);
  const how = methodOf(method);
  const pickIdx = baitPick ? baitIndex(baitPick) : -1;
  // 고른 미끼가 이 낚시터에선 안 물면 물기 시작하는 미끼로, 떨어졌으면 남은 미끼 중 가장 싼 것으로 저절로 넘어간다 — 미끼 때문에 판이 막히지 않게
  const fitting = BAITS.filter((b) => poolFor(spot, b.maxGrade).length > 0);
  const shown = pickIdx >= 0 && fitting.includes(BAITS[pickIdx]) ? BAITS[pickIdx] : spotMinBait(spot);
  const bait = baitStock(fs, shown.key, today) >= how.baitCost ? shown : fitting.find((b) => baitStock(fs, b.key, today) >= how.baitCost) ?? shown;
  const baitLeft = baitStock(fs, bait.key, today);
  const shownLeft = baitStock(fs, shown.key, today);
  const blocked = castBlock(fs, spot, method, bait.key, today);
  const chance = fish ? captureChance(eff.catch, fish.difficulty, quality, perfectHook, method) : 0;
  const block = fish ? storeBlock(st, fish) : null;
  const playing = phase !== "ready" && phase !== "lost" && phase !== "result";

  /** 미끼 쓰기 — 화면은 기다리지 않는다. 그 사이 상대가 마지막 미끼를 썼으면 판을 물린다. */
  function payBait(castM = 0) {
    const t = clock(), key = bait.key, sp = spot, m = method;
    void act((s) => spendBait(s, sp, m, key, kstDate(t), castM)).then((r) => {
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
    setStamp(null);
    setTapNote(null);
    setFight(null);
    setLureS(null);
    setSwayS(null);
    setScoopS(null);
    setDeepS(null);
    fx?.reset();
  }

  function beginScoop() {
    const seed = Math.floor(dice() * 2 ** 31);
    payBait();
    const sc = startScoop(spot, eff.luck, baitIndex(bait.key), seed);
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
          landRound(next.quality);
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
      if (method === "deep") {
        const tune = deepTune(fish.difficulty, eff);
        deepTuneRef.current = tune;
        setDeepTuneS(tune);
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
      if (score >= 0.85 && spin.turns >= 2) showStamp("바나나킥!", "gold");
      buzz(score >= 0.6 ? [20, 30, 60] : 20);
      const seed = Math.floor(dice() * 2 ** 31);
      const c = rollCatch(spot, eff.luck, score, seed, { bait: baitIndex(bait.key), method, junk: true });
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
        timers.current.push(setTimeout(() => {
          fx?.nibble();
          buzz(12);
        }, at));
      }
      timers.current.push(setTimeout(() => {
        biteAt.current = clock();
        biteMs.current = hookWindowMs(c.difficulty, eff.line);
        setPhase("bite");
        fx?.bite(biteMs.current);
        buzz(80);
        timers.current.push(setTimeout(() => loseRound("late"), biteMs.current));
      }, plan.waitMs));
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

  async function store() {
    if (!fish || fish.junk) return;
    const roll = dice(), c = fish, p = chance, t = clock();
    setPhase("scoop");
    buzz(20);
    const [r] = await Promise.all([act((s) => tryStore(s, c, p, roll, t, kstDate(t))), pause(SCOOP_MS)]);
    if (!r?.ok) {
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
    const r = await act((s) => sellCatch(s, c, kstDate(t)));
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
      : surge ? "차고 나가요! 손을 떼세요!" : leaping ? "뛰어올라요! 계속 감으세요!" : fightWarn === "surge" ? "곧 차고 나가요!" : fightWarn === "jump" ? "곧 뛰어올라요!" : holding ? "감는 중 — 빨간 칸 전에 떼세요" : "누르면 감겨요";
  const hint = phase === "ready" ? (blocked ?? (method === "scoop" ? "눌러서 시작" : "눌러서 던지기 · 돌리면 더 멀리"))
    : phase === "charge" ? (spinLive && spinLive.turns > 0.5 ? (spinLive.rate * spinLive.dir > 4 ? "너무 빨라요! 조금 천천히" : spinGain(spinLive.rate) >= 0.9 ? "좋아요! 위로 휙!" : "더 빠르게 돌려요") : "")
    : phase === "wait" ? "찌가 크게 잠길 때까지 기다려요"
    : phase === "bite" ? "지금! 누르세요!"
    : phase === "lure" ? "고리가 겹칠 때 톡! 치세요"
    : phase === "aim" ? "그림자가 갈 곳을 앞서 누르세요"
    : phase === "fight" ? fightHint
    : phase === "lost" || phase === "result" ? (blocked ?? "눌러서 다시 던지기") : "";
  const loudHint = phase === "bite" || surge || leaping || diving;

  return shell(
    <div className="px-4">
      <div className="aqua-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tap disabled:opacity-50 ${tab === k ? "is-on" : ""}`} disabled={playing} onClick={() => { setTab(k); setMsg(null); }}>
            {label}{k === "stat" && fs.points > 0 ? ` (${fs.points})` : ""}
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
              if (phase === "reveal" || phase === "landed" || phase === "scoop") return;
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
            {FISHING_IMAGE_KEYS.has(`spot_${spot.key}`) && <i key={spot.key} className="fish-bg" aria-hidden style={{ backgroundImage: `url(${asset(`/fishing/spot_${spot.key}.webp`)})` }} />}
            <canvas ref={attachFx} className="fish-fx" aria-hidden />

            {phase === "charge" && spinLive && spinLive.turns > 0.5 && (
              <div className="fish-spin" aria-hidden>
                <b>{castMeters(castScore(spinLive, FLICK_FULL), castRange(fs.rod, fs.stats.power)).toFixed(1)}<i>m</i></b>
                <span><u style={{ width: `${spinLive.energy * 100}%` }} /></span>
              </div>
            )}
            {thrown && (phase === "wait" || phase === "lure" || phase === "bite") && (
              <p key={thrown.id} className="fish-throw" aria-live="polite">
                <b>{thrown.m.toFixed(1)}m</b> {thrown.rating}{thrown.record && <em>새 기록!</em>}
              </p>
            )}

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
            {phase === "lost" && lost && <p className="fish-lost" aria-live="polite">{LOST_TEXT[lost]}</p>}

            {(phase === "reveal" || phase === "landed" || phase === "scoop" || phase === "result") && fish && (
              <div
                className={`fish-card g${GRADES.indexOf(fish.grade)} is-${phase === "result" ? result?.outcome : phase} ${!fish.junk && GRADES.indexOf(fish.grade) >= 3 ? "is-rare" : ""}`}
                style={{ "--gc": FX_GRADE_LIGHT[GRADES.indexOf(fish.grade)], "--rv": `${revealMs(GRADES.indexOf(fish.grade), false)}ms` } as CSSProperties}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="fish-card-pic">{fish.junk && phase !== "reveal" ? <JunkIcon k={fish.junk} /> : <FishArt artKey={catchArt(fish)} />}</span>
                {phase === "reveal" && <b className="fish-reveal-q" aria-live="polite">?</b>}
                {phase === "scoop" && <span className="fish-net" aria-hidden><GearPic k={NETS[fs.net].key} label={NETS[fs.net].name} /></span>}
                {phase === "result" && result?.outcome === "sold" && Array.from({ length: 12 }, (_, k) => (
                  <i key={k} className="fish-coin" aria-hidden style={{ "--x": `${Math.cos(k * 0.52) * (70 + (k % 3) * 34)}px`, "--y": `${-Math.abs(Math.sin(k * 0.52)) * (60 + (k % 4) * 26) - 20}px`, "--d": `${(k % 5) * 45}ms` } as CSSProperties}><Coin /></i>
                ))}
                {phase !== "reveal" && <div className="fish-panel" key={phase === "result" ? "result" : "catch"}>
                  {isNew && <b className="fish-new">NEW · 처음 만난 물고기</b>}
                  <strong className="fish-name">{fish.junk ? junkOf(fish.junk)?.name : catchName(fish)}</strong>
                  {fish.junk ? <span className="aqua-grade fish-junk-tag">꽝</span> : <span className={gradeClass(fish.grade)}>{fish.grade}</span>}
                  {fish.junk ? (
                    <>
                      <p className="fish-junk-line">{junkOf(fish.junk)?.line}</p>
                      {result?.firstJunk && <p className="fish-levelup">수집함에 새로 올랐어요!</p>}
                      {result && result.coins > 0 && <p className="aqua-price">분리수거 <Coin /> +{result.coins.toLocaleString()}</p>}
                      {result && <p className="fish-points">랭킹 +{catchPoints(fish, quality, perfectHook, false)}점{rankNote && <small>{rankNote}</small>}</p>}
                      {result && <ActionButton main wide onClick={() => { clearRound(); setPhase("ready"); }}>다시 던지기</ActionButton>}
                    </>
                  ) : phase === "scoop" ? (
                    <p className="fish-scoop-note">뜰채로 건지는 중<i /><i /><i /> <small>성공 확률 {pct(chance)}</small></p>
                  ) : phase === "landed" ? (
                    <>
                      <p className="aqua-note">
                        {perfectHook ? "정확한 챔질! " : ""}줄 다루기 {pct(quality)} · 경험치 +{xpValue(fish.difficulty)}
                      </p>
                      {block ? <p className="fish-block">{block} — 수조에 담을 수 없어요</p> : (
                        <ActionButton main wide disabled={busy} onClick={() => void store()}>
                          수조에 담기 · 성공 확률 {pct(chance)}
                        </ActionButton>
                      )}
                      <button type="button" className={`tap ${block ? "aqua-btn is-main is-wide" : "fish-sell-link"}`} disabled={busy} onClick={() => void sell()}>
                        {block ? "팔기" : "그냥 팔기"} <span className="aqua-price"><Coin /> {Math.min(coinValue(fish.difficulty), coinsLeft).toLocaleString()}</span>
                      </button>
                    </>
                  ) : result && (
                    <>
                      <p className="fish-outcome">
                        {result.outcome === "stored" ? "수조에 담았어요!" : result.outcome === "slipped" ? "손에서 미끄러져 빠져나갔어요…" : "시장에 팔았어요"}
                      </p>
                      {result.coins > 0 && <p className="aqua-price"><Coin /> +{result.coins.toLocaleString()}</p>}
                      <p className="fish-points">랭킹 +{catchPoints(fish, quality, perfectHook, result.outcome === "stored")}점{rankNote && <small>{rankNote}</small>}</p>
                      {result.levelUp > 0 && <p className="fish-levelup">낚시 레벨 업! 능력치 점수를 쓸 수 있어요</p>}
                      <ActionButton main wide onClick={() => { clearRound(); setPhase("ready"); }}>다시 던지기</ActionButton>
                      {result.outcome === "stored" && <ActionButton wide onClick={() => setTankOpen(true)}>수조에서 보기</ActionButton>}
                    </>
                  )}
                </div>}
              </div>
            )}
            {stamp && <Stamp key={stamp.id} text={stamp.text} tone={stamp.tone} high={phase === "fight" || phase === "aim"} />}
          </div>

          <button type="button" className="tap fish-loadout" aria-haspopup="dialog" disabled={playing} onClick={() => setSheetOpen(true)}>
            <span className="fish-loadout-icon"><MethodIcon k={method} /></span>
            <span className="min-w-0 flex-1">
              <strong>{spot.name}</strong>
              <small>{how.name} · {bait.name} {baitLeft}회</small>
            </span>
            <span className="fish-loadout-lv">Lv.{fs.level}<i aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></i></span>
            <span aria-hidden className="fish-loadout-more">▾</span>
          </button>

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
                      <button key={x.key} type="button" className={`tap ${x.key === spot.key ? "is-on" : ""}`} disabled={locked} onClick={() => setSpotPick(x.key)}>
                        {x.name}{locked && <small>Lv.{x.minLevel}</small>}
                      </button>
                    );
                  })}
                </div>

                <h3 className="fish-sheet-title">방식</h3>
                <div className="fish-methods" role="radiogroup" aria-label="낚시 방식">
                  {METHODS.map((m) => {
                    const off = fs.level < m.minLevel;
                    return (
                      <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`tap ${method === m.key ? "is-on" : ""}`} disabled={off} onClick={() => { setMethod(m.key); savePrefs({ method: m.key }); clearRound(); setPhase("ready"); }}>
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

                <h3 className="fish-sheet-title">낚시 Lv.{fs.level} <small>수조 {aq.fish.length}/{tankOf(aq).fish} · 오늘 하트 {coinsLeft.toLocaleString()} 남음</small></h3>
                <div className="fish-xp" aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></div>
                <p className="aqua-note mt-2">포획 {eff.catch} · 힘 {eff.power} · 줄 다루기 {eff.line} · 행운 {eff.luck}</p>
                <p className="aqua-note">캐스팅 최대 {Math.round(castRange(fs.rod, fs.stats.power))}m · 내 기록 {fs.bestCast.toFixed(1)}m — 좋은 낚싯대 · 힘을 올리면 더 멀리 가요</p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "gear" && (
        <>
          <GearList title="낚싯대" desc="힘과 줄 다루기가 올라요" list={RODS} cur={fs.rod} coins={st.coins} busy={busy} stat={(x) => `힘 +${x.power} · 줄 다루기 +${x.line} · 최대 ${Math.round(castRange(RODS.indexOf(x), fs.stats.power))}m`} onBuy={() => void act(buyRod)} />
          <GearList title="뜰채" desc="포획 확률이 올라요 · 뜰채 낚시에서 그물이 넓어져요" list={NETS} cur={fs.net} coins={st.coins} busy={busy} stat={(x) => `포획 +${x.catch}`} onBuy={() => void act(buyNet)} />
          <section className="aqua-card">
            <header><strong>미끼</strong><small>한 번 던질 때마다 1회(심해는 2회)</small></header>
            <ul className="aqua-shop is-flat">
              {BAITS.map((b) => (
                <li key={b.key}>
                  <span className="aqua-shop-pic"><BaitIcon k={b.key} /></span>
                  <span className="min-w-0 flex-1">
                    <strong>{b.name}</strong>
                    <small>{GRADES[b.maxGrade]} 등급까지 · 묶음 {b.uses}회 · 남은 {baitStock(fs, b.key, today)}회</small>
                  </span>
                  <ActionButton disabled={busy || st.coins < b.price} onClick={() => void act((s) => buyBait(s, b.key, kstDate(clock())))}>
                    <span className="aqua-price"><Coin /> {b.price.toLocaleString()}</span>
                  </ActionButton>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === "stat" && (
        <section className="aqua-card">
          <header><strong>능력치</strong><small>남은 점수 {fs.points} · 레벨마다 2점</small></header>
          <ul className="fish-stats">
            {STAT_KEYS.map((k: FishStat) => (
              <li key={k}>
                <span className="min-w-0 flex-1">
                  <strong>{STAT_INFO[k].name} {fs.stats[k]}{eff[k] !== fs.stats[k] ? ` (장비 포함 ${eff[k]})` : ""}</strong>
                  <small>{STAT_INFO[k].desc}</small>
                </span>
                <ActionButton disabled={busy || fs.points <= 0 || fs.stats[k] >= STAT_CAP} aria-label={`${STAT_INFO[k].name} 올리기`} onClick={() => void act((s) => spendPoint(s, k))}>+1</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === "stat" && (
        <section className="aqua-card">
          <header><strong>쓰레기 수집함</strong><small>{JUNKS.filter((j) => (fs.junk[j.key] ?? 0) > 0).length}/{JUNKS.length}종 · 바다를 {Object.values(fs.junk).reduce((n, v) => n + v, 0)}번 치웠어요</small></header>
          <ul className="fish-junkbox">
            {JUNKS.map((j) => {
              const n = fs.junk[j.key] ?? 0;
              return (
                <li key={j.key} className={n > 0 ? "" : "is-unseen"}>
                  <span><JunkIcon k={j.key} /></span>
                  <strong>{n > 0 ? j.name : "???"}</strong>
                  <small>{n > 0 ? `${n}개` : j.spot ? SPOTS.find((x) => x.key === j.spot)?.name : "어디서나"}</small>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === "rank" && <FishRank coupleId={coupleId} myName={myName} />}

      {tankOpen && <AquariumGame coupleId={coupleId} onClose={() => { setTankOpen(false); void load(); }} onOpenIsland={onOpenIsland} onFish={() => { setTankOpen(false); void load(); }} />}
    </div>,
  );
}

function GearList<T extends { key: string; name: string; price: number }>({ title, desc, list, cur, coins, busy, stat, onBuy }: {
  title: string; desc: string; list: readonly T[]; cur: number; coins: number; busy: boolean; stat: (x: T) => string; onBuy: () => void;
}) {
  return (
    <section className="aqua-card">
      <header><strong>{title}</strong><small>{desc}</small></header>
      <ul className="aqua-shop is-flat">
        {list.map((x, i) => (
          <li key={x.key} className={i > cur + 1 ? "is-locked" : ""}>
            <span className="aqua-shop-pic"><GearPic k={x.key} label={x.name} /></span>
            <span className="min-w-0 flex-1">
              <strong>{x.name}</strong>
              <small>{stat(x)}</small>
            </span>
            {i <= cur ? <small>{i === cur ? "쓰는 중" : "지나옴"}</small> : i === cur + 1 ? (
              <ActionButton disabled={busy || coins < x.price} onClick={onBuy}>
                <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
              </ActionButton>
            ) : <small>앞 단계 먼저</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
