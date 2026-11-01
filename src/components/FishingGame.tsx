"use client";

/* 낚시 화면 — 규칙은 전부 lib/fishing(순수), 찌 · 줄 · 물보라는 lib/fishingfx(캔버스). 여기는 입력 · 타이머 · 글자판과 저장뿐이다.
 * 한 손가락으로 다 한다: 누르고 놓아 던지기 → 크게 잠길 때 눌러 챔질 → 누르고 놓으며 줄 감기.
 * 저장은 물고기를 끌어올린 뒤와 장비 · 능력치를 바꿀 때만(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더). 놓친 판은 쓰지 않는다. */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import AquariumGame from "@/components/AquariumGame";
import { FishArt } from "@/components/AquaArt";
import { Coin } from "@/components/island/UiIcon";
import { asset } from "@/lib/base";
import { GRADES, aquaOf, tankOf, type Grade } from "@/lib/aquarium";
import { loadIsland, saveIsland, watchIsland, type IslandRow } from "@/lib/couple";
import { FishFx, landingPoint, type FxLost } from "@/lib/fishingfx";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import {
  DAILY_FISH_COINS, GREEN_HIGH, GREEN_LOW, MAX_LEVEL, NETS, RODS, SPOTS, STAT_CAP, STAT_INFO, STAT_KEYS,
  buyNet, buyRod, captureChance, castBonus, catchArt, catchName, coinValue, effectiveStats, fightQuality, fightTune, fishingOf, hookWindowMs,
  rollCatch, sellCatch, shadowSize, spendPoint, startFight, stepFight, storeBlock, tryStore, waitPlan, xpNeed, xpValue,
  type Fight, type FightTune, type FishCatch, type FishResult, type FishStat, type GearResult,
} from "@/lib/fishing";
import type { IslandState } from "@/lib/island";
import { kstDate } from "@/lib/kst";

type Tab = "fish" | "gear" | "stat";
type Phase = "ready" | "charge" | "wait" | "bite" | "fight" | "landed" | "scoop" | "result" | "lost";
type StampTone = "hit" | "gold" | "miss";
/** 시각 · 주사위 — 눌렀을 때만 부른다(렌더 중에 부르지 않는다) */
const clock = () => Date.now();
const dice = () => Math.random();
const TABS: readonly (readonly [Tab, string])[] = [["fish", "낚시터"], ["gear", "장비"], ["stat", "능력치"]];
const gradeClass = (g: Grade) => `aqua-grade g-${GRADES.indexOf(g)}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const buzz = (p: number | number[]) => navigator.vibrate?.(p);
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
/** 뜰채로 건지는 시간 — 판정은 바로 나도 이만큼은 조마조마해야 한다 */
const SCOOP_MS = 1500;

const LOST_TEXT = {
  early: "너무 일찍 챘어요! 물고기가 놀라 달아났어요",
  late: "늦었어요! 미끼만 먹고 뱉어 버렸어요",
  snapped: "줄이 끊어졌어요! 팽팽해지면 손을 떼세요",
  slack: "줄이 너무 느슨해 바늘이 빠졌어요",
  escaped: "물고기가 멀리 달아났어요",
} as const;

const LOST_STAMP: Record<FxLost, string> = { early: "앗, 일렀다!", late: "늦었다!", snapped: "툭! 끊어졌다", slack: "바늘이 빠졌다", escaped: "도망쳤다!" };
/** 만화 효과선 판 — 뾰족한 칸의 길이를 일부러 들쭉날쭉하게 */
const BURST = Array.from({ length: 34 }, (_, i) => {
  const a = (i / 34) * Math.PI * 2;
  const r = i % 2 === 0 ? 1 - ((i * 7) % 5) * 0.045 : 0.68;
  return `${(100 + Math.cos(a) * 98 * r).toFixed(1)},${(50 + Math.sin(a) * 48 * r).toFixed(1)}`;
}).join(" ");

function Stamp({ text, tone }: { text: string; tone: StampTone }) {
  return (
    <div className={`fish-stamp is-${tone}`} aria-live="polite">
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

export default function FishingGame({ coupleId, onClose, onOpenIsland }: { coupleId: string | null; onClose: () => void; onOpenIsland: () => void }) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("fish");
  const [tankOpen, setTankOpen] = useState(false);
  const [spotPick, setSpotPick] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);

  const [phase, setPhase] = useState<Phase>("ready");
  const [charge, setCharge] = useState(0);
  const [castNote, setCastNote] = useState<string | null>(null);
  const [fx, setFx] = useState<FishFx | null>(null);
  const [stamp, setStamp] = useState<{ id: number; text: string; tone: StampTone } | null>(null);
  const [landPt, setLandPt] = useState({ x: 0.42, y: 0.5 });
  const [lost, setLost] = useState<keyof typeof LOST_TEXT | null>(null);
  const [fish, setFish] = useState<FishCatch | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);
  const [holding, setHolding] = useState(false);
  const [quality, setQuality] = useState(0);
  const [perfectHook, setPerfectHook] = useState(false);
  const [result, setResult] = useState<Extract<FishResult, { ok: true }> | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chargeAt = useRef(0);
  const biteAt = useRef(0);
  const biteMs = useRef(800);
  const holdRef = useRef(false);
  const fightRef = useRef<Fight | null>(null);
  const tuneRef = useRef<FightTune | null>(null);
  const busyRef = useRef(false);
  const fxRef = useRef<FishFx | null>(null);
  const gradeRef = useRef(0);
  const stampId = useRef(0);

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
  useEffect(() => {
    fx?.set({ phase, charge, holding, tension: fight?.tension ?? 0.3, dist: fight?.dist ?? 1 });
  }, [fx, phase, charge, holding, fight]);
  useEffect(() => {
    if (!fx || !row) return;
    const cur = fishingOf(row.state);
    const list = SPOTS.filter((x) => x.minLevel <= cur.level);
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

  // 던질 힘 게이지 · 힘겨루기는 같은 박자로 돈다. 프레임이 밀려도 한 번에 0.1초까지만 센다.
  useEffect(() => {
    if (phase !== "charge" && phase !== "fight") return;
    let last = clock();
    const iv = setInterval(() => {
      const now = clock();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (phase === "charge") {
        const t = ((now - chargeAt.current) / 1400) % 2;
        setCharge(t < 1 ? t : 2 - t);
        return;
      }
      const cur = fightRef.current, tune = tuneRef.current;
      if (!cur || !tune) return;
      const next = stepFight(cur, dt, holdRef.current, tune);
      fightRef.current = next;
      setFight(next);
      if (cur.surgeLeft <= 0 && next.surgeLeft > 0) {
        fxRef.current?.surge();
        buzz([35, 30, 35]);
      } else if (cur.surgeLeft > 0 && next.surgeLeft <= 0) {
        fxRef.current?.surgeEnd();
      }
      if (next.status === "landed") {
        setQuality(fightQuality(next));
        setHolding(false);
        holdRef.current = false;
        fxRef.current?.land(gradeRef.current);
        buzz([50, 40, 140]);
        setPhase("landed");
      } else if (next.status !== "on") {
        setLost(next.status);
        setHolding(false);
        holdRef.current = false;
        fxRef.current?.lost(next.status);
        showStamp(LOST_STAMP[next.status], "miss");
        buzz(next.status === "snapped" ? [120, 40, 60] : 60);
        setPhase("lost");
      }
    }, 33);
    return () => clearInterval(iv);
  }, [phase, showStamp]);

  const shell = (children: ReactNode) => (
    <div className="aqua-shell fish-shell fixed inset-0 z-[90] overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-md pb-10">
        <div className="aqua-head sticky top-0 z-[500] flex items-center gap-2 px-4 py-3">
          <p className="text-base font-extrabold">낚시</p>
          {row && <p className="aqua-wallet"><Coin /> {row.state.coins.toLocaleString()}</p>}
          <button type="button" onClick={onClose} className="tap aqua-close">닫기</button>
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
        <button type="button" className="tap aqua-btn is-main mt-4" onClick={onOpenIsland}>우리 섬으로 가기</button>
      </div>,
    );
  }

  const st = row.state;
  const fs = fishingOf(st);
  const eff = effectiveStats(fs);
  const open = SPOTS.filter((x) => x.minLevel <= fs.level);
  const spot = open.find((x) => x.key === spotPick) ?? open[open.length - 1];
  const coinsLeft = Math.max(0, DAILY_FISH_COINS - (fs.day === today ? fs.dayCoins : 0));
  const aq = aquaOf(st);
  const chance = fish ? captureChance(eff.catch, fish.difficulty, quality, perfectHook) : 0;
  const block = fish ? storeBlock(st, fish) : null;

  function press() {
    if (phase === "ready" || phase === "lost" || phase === "result") {
      setLost(null);
      setResult(null);
      setFish(null);
      setCastNote(null);
      setStamp(null);
      fx?.reset();
      chargeAt.current = clock();
      setCharge(0);
      setPhase("charge");
    } else if (phase === "wait") {
      clearTimers();
      setLost("early");
      fx?.lost("early");
      showStamp(LOST_STAMP.early, "miss");
      setPhase("lost");
    } else if (phase === "bite" && fish) {
      clearTimers();
      const good = clock() - biteAt.current <= biteMs.current * 0.45;
      setPerfectHook(good);
      fx?.hook(good);
      showStamp(good ? "완벽한 챔질!" : "걸렸다!", good ? "gold" : "hit");
      buzz([25, 20, 90]);
      const tune = fightTune(fish.difficulty, eff);
      const f = startFight(Math.floor(dice() * 2 ** 31), tune);
      tuneRef.current = tune;
      fightRef.current = f;
      holdRef.current = true;
      setHolding(true);
      setFight(f);
      setPhase("fight");
    } else if (phase === "fight") {
      holdRef.current = true;
      setHolding(true);
    }
  }

  function release() {
    if (phase === "charge") {
      const t = ((clock() - chargeAt.current) / 1400) % 2;
      const power = t < 1 ? t : 2 - t;
      const bonus = castBonus(power);
      setCastNote(bonus === 0 ? "조금 짧았어요" : null);
      if (bonus === 1) showStamp("완벽한 캐스팅!", "gold");
      const seed = Math.floor(dice() * 2 ** 31);
      const c = rollCatch(spot, eff.luck, bonus, seed);
      const plan = waitPlan(seed);
      const land = landingPoint(bonus, dice());
      gradeRef.current = GRADES.indexOf(c.grade);
      setFish(c);
      setLandPt(land);
      fx?.cast(land, plan.waitMs, shadowSize(c), gradeRef.current, bonus);
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
        timers.current.push(setTimeout(() => {
          setLost("late");
          fx?.lost("late");
          showStamp(LOST_STAMP.late, "miss");
          setPhase("lost");
        }, biteMs.current));
      }, plan.waitMs));
    } else if (phase === "fight") {
      holdRef.current = false;
      setHolding(false);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (e.type === "keydown" && !e.repeat) press();
    if (e.type === "keyup") release();
  }

  async function store() {
    if (!fish) return;
    const roll = dice(), c = fish, p = chance, t = clock();
    setPhase("scoop");
    buzz(20);
    const [r] = await Promise.all([act((s) => tryStore(s, c, p, roll, t, kstDate(t))), pause(SCOOP_MS)]);
    if (!r?.ok) {
      setPhase("landed");
      return;
    }
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
    if (!fish) return;
    const c = fish, t = clock();
    const r = await act((s) => sellCatch(s, c, kstDate(t)));
    if (r?.ok) {
      setResult(r);
      setPhase("result");
      fx?.sold();
      showStamp("팔았어요!", "gold");
      buzz(30);
    }
  }

  const inScene = phase === "wait" || phase === "bite" || phase === "fight";
  const surge = phase === "fight" && (fight?.surgeLeft ?? 0) > 0;
  const hotTension = phase === "fight" && (fight?.tension ?? 0) > 0.82;
  const hint = phase === "ready" ? "누르고 있다가 놓아서 던지세요"
    : phase === "charge" ? "좋은 자리에서 손을 떼세요"
    : phase === "wait" ? "찌가 크게 잠길 때까지 기다려요"
    : phase === "bite" ? "지금! 누르세요!"
    : phase === "fight" ? (surge ? "차고 나가요! 손을 떼세요!" : holding ? "감는 중 — 빨간 칸 전에 떼세요" : "누르면 감겨요")
    : phase === "lost" ? "눌러서 다시 던지기" : phase === "result" ? "눌러서 다시 던지기" : "";

  return shell(
    <div className="px-4">
      <div className="aqua-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tap ${tab === k ? "is-on" : ""}`} onClick={() => { setTab(k); setMsg(null); }}>
            {label}{k === "stat" && fs.points > 0 ? ` (${fs.points})` : ""}
          </button>
        ))}
        <button type="button" className="tap" onClick={() => setTankOpen(true)}>내 수조</button>
      </div>
      {msg && <p className="aqua-msg" aria-live="polite">{msg}</p>}

      {tab === "fish" && (
        <>
          <div className="fish-spots">
            {SPOTS.map((x) => {
              const locked = x.minLevel > fs.level;
              return (
                <button key={x.key} type="button" className={`tap ${x.key === spot.key ? "is-on" : ""}`} disabled={locked || inScene || phase === "charge" || phase === "landed" || phase === "scoop"} onClick={() => setSpotPick(x.key)}>
                  {x.name}{locked && <small>Lv.{x.minLevel}</small>}
                </button>
              );
            })}
          </div>

          <div
            className={`fish-scene s-${spot.key}`}
            role="button"
            tabIndex={0}
            aria-label={hint || "낚시터"}
            onPointerDown={(e) => {
              if (phase === "landed" || phase === "scoop") return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              press();
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onKeyDown={onKey}
            onKeyUp={onKey}
          >
            <i className="fish-water" aria-hidden />
            {FISHING_IMAGE_KEYS.has(`spot_${spot.key}`) && <i key={spot.key} className="fish-bg" aria-hidden style={{ backgroundImage: `url(${asset(`/fishing/spot_${spot.key}.webp`)})` }} />}
            <canvas ref={attachFx} className="fish-fx" aria-hidden />

            {phase === "bite" && (
              <div className="fish-alert" aria-hidden style={{ left: `${landPt.x * 100}%`, top: `${landPt.y * 100 - 15}%` }}>
                <svg viewBox="0 0 200 100"><polygon points={BURST} /></svg>
                <b>!</b>
              </div>
            )}

            {phase === "charge" && (
              <div className={`fish-cast ${charge >= 0.78 && charge <= 0.95 ? "is-sweet" : ""}`} aria-hidden>
                <i className="fish-cast-fill" style={{ width: `${charge * 100}%` }} />
                <i className="fish-cast-sweet" />
                <b style={{ left: `${charge * 100}%` }} />
              </div>
            )}
            {castNote && phase === "wait" && <p className="fish-note" aria-live="polite">{castNote}</p>}

            {phase === "fight" && fight && (
              <>
                <div className="fish-dist" aria-hidden>
                  <b style={{ width: `${Math.max(0, Math.min(1, 1 - fight.dist)) * 100}%` }} />
                  <em>{Math.max(1, Math.round(fight.dist * 40))}m</em>
                </div>
                <div className={`fish-tension ${hotTension ? "is-hot" : ""}`} aria-hidden>
                  <em>장력</em>
                  <span>
                    <i className="fish-tension-green" style={{ bottom: `${GREEN_LOW * 100}%`, height: `${(GREEN_HIGH - GREEN_LOW) * 100}%` }} />
                    <b style={{ bottom: `${Math.min(1, fight.tension) * 100}%` }} />
                  </span>
                </div>
              </>
            )}
            {hint && <p className={`fish-hint ${phase === "bite" || surge ? "is-loud" : ""}`}>{hint}</p>}
            {phase === "lost" && lost && <p className="fish-lost" aria-live="polite">{LOST_TEXT[lost]}</p>}

            {(phase === "landed" || phase === "scoop" || phase === "result") && fish && (
              <div className={`fish-card g${GRADES.indexOf(fish.grade)} is-${phase === "result" ? result?.outcome : phase}`} onPointerDown={(e) => e.stopPropagation()}>
                <span className="fish-card-pic"><FishArt artKey={catchArt(fish)} /></span>
                {phase === "scoop" && <span className="fish-net" aria-hidden><GearPic k={NETS[fs.net].key} label={NETS[fs.net].name} /></span>}
                {phase === "result" && result?.outcome === "sold" && Array.from({ length: 12 }, (_, k) => (
                  <i key={k} className="fish-coin" aria-hidden style={{ "--x": `${Math.cos(k * 0.52) * (70 + (k % 3) * 34)}px`, "--y": `${-Math.abs(Math.sin(k * 0.52)) * (60 + (k % 4) * 26) - 20}px`, "--d": `${(k % 5) * 45}ms` } as CSSProperties}><Coin /></i>
                ))}
                <div className="fish-panel" key={phase === "result" ? "result" : "catch"}>
                  <strong className="fish-name">{catchName(fish)}</strong>
                  <span className={gradeClass(fish.grade)}>{fish.grade}</span>
                  {phase === "scoop" ? (
                    <p className="fish-scoop-note">뜰채로 건지는 중<i /><i /><i /> <small>성공 확률 {pct(chance)}</small></p>
                  ) : phase === "landed" ? (
                    <>
                      <p className="aqua-note">
                        {perfectHook ? "정확한 챔질! " : ""}줄 다루기 {pct(quality)} · 경험치 +{xpValue(fish.difficulty)}
                      </p>
                      {block ? <p className="fish-block">{block} — 수조에 담을 수 없어요</p> : (
                        <button type="button" className="tap aqua-btn is-main is-wide" disabled={busy} onClick={() => void store()}>
                          수조에 담기 · 성공 확률 {pct(chance)}
                        </button>
                      )}
                      <button type="button" className="tap aqua-btn is-wide" disabled={busy} onClick={() => void sell()}>
                        팔기 <span className="aqua-price"><Coin /> {Math.min(coinValue(fish.difficulty), coinsLeft).toLocaleString()}</span>
                      </button>
                      {!block && <p className="aqua-note">실패하면 빠져나가고 하트를 절반 받아요</p>}
                    </>
                  ) : result && (
                    <>
                      <p className="fish-outcome">
                        {result.outcome === "stored" ? "수조에 담았어요!" : result.outcome === "slipped" ? "손에서 미끄러져 빠져나갔어요…" : "시장에 팔았어요"}
                      </p>
                      {result.coins > 0 && <p className="aqua-price"><Coin /> +{result.coins.toLocaleString()}</p>}
                      {result.levelUp > 0 && <p className="fish-levelup">낚시 레벨 업! 능력치 점수를 쓸 수 있어요</p>}
                      <button type="button" className="tap aqua-btn is-main is-wide" onClick={() => { setResult(null); setFish(null); setStamp(null); fx?.reset(); setPhase("ready"); }}>다시 던지기</button>
                    </>
                  )}
                </div>
              </div>
            )}
            {stamp && <Stamp key={stamp.id} text={stamp.text} tone={stamp.tone} />}
          </div>

          <section className="aqua-card">
            <header><strong>낚시 Lv.{fs.level}</strong><small>수조 {aq.fish.length}/{tankOf(aq).fish} · 오늘 하트 {coinsLeft.toLocaleString()} 남음</small></header>
            <div className="fish-xp" aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></div>
            <p className="aqua-note mt-2">포획 {eff.catch} · 힘 {eff.power} · 줄 다루기 {eff.line} · 행운 {eff.luck}</p>
          </section>
        </>
      )}

      {tab === "gear" && (
        <>
          <GearList title="낚싯대" desc="힘과 줄 다루기가 올라요" list={RODS} cur={fs.rod} coins={st.coins} busy={busy} stat={(x) => `힘 +${x.power} · 줄 다루기 +${x.line}`} onBuy={() => void act(buyRod)} />
          <GearList title="뜰채" desc="포획 확률이 올라요" list={NETS} cur={fs.net} coins={st.coins} busy={busy} stat={(x) => `포획 +${x.catch}`} onBuy={() => void act(buyNet)} />
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
                <button type="button" className="tap aqua-btn" disabled={busy || fs.points <= 0 || fs.stats[k] >= STAT_CAP} aria-label={`${STAT_INFO[k].name} 올리기`} onClick={() => void act((s) => spendPoint(s, k))}>+1</button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
              <button type="button" className="tap aqua-btn" disabled={busy || coins < x.price} onClick={onBuy}>
                <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
              </button>
            ) : <small>앞 단계 먼저</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
