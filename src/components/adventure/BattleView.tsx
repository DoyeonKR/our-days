"use client";
/* 모험 전투 화면 — 실시간 아레나(lib/arena). 2026-11-08 [사용자: "레조넌스 팬게임 전투방식을 따라하라고"]
 *
 * 조작: 왼쪽 막대(또는 화살표) = 이동 · 기술 4칸(Q W E R) — 조준은 자동(가장 가까운 상대) · 회피(스페이스, 잠깐 무적) ·
 *       교체(1~6, 대기 시간) · 공(B, 고리가 가장 작을 때 던지면 잘 잡힌다) · 약 · 도망(X, 맞으면 끊긴다).
 * 그리기: 캔버스 한 장(땅 · 경고 원 · 조준선 · 탄 · 생물 · 숫자) + 위에 입자 캔버스(lib/battlefx — 맞는 순간 · 상태 · 회복).
 * ⚠ 판정은 엔진만. 화면은 30틱 엔진을 rAF 로 돌리고 지난 자리와 사이를 메워 그린다.
 * ⚠ 대전은 입력만 기록해서(record) 서버로 보낸다 — 서버가 같은 엔진으로 처음부터 다시 돌려 판정한다.
 * ⚠ 그림은 우리 펫 원화 · 화면 모양은 이 앱 것이다(원작 게임 · 팬게임 화면을 따라 그리지 않는다). */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BALLS, ITEMS, MOVES, REGIONS, SPECIES, TYPE_COLOR, activeOf, catchChance, effectiveness, moveOf,
  type BallKey, type Battle, type ItemKey, type Region, type Status,
} from "@/lib/adventure";
import {
  ARENA_H, ARENA_W, AWAKE_TICKS, BODY_R, CHARGE_MAX, MAP_RULES, SIGNATURES, TPS, dirOf, duelInput, newArena, record, ringAim, skillOf, stepArena,
  type AEv, type Arena, type ArenaInput, type Bag, type LogEntry, type Rock,
} from "@/lib/arena";
import { BATTLE_PIXELS_MAX, battleDpr, BattleFx, FX_PAL, type Pt } from "@/lib/battlefx";
import { paintGround } from "@/lib/groundpaint";
import { useBackClose } from "@/lib/useBackClose";
import { preloadSprite, spriteOf } from "@/lib/advsprite";
import { frameGate, frozenDraw } from "@/lib/advframe";
import { enterBattleFullscreen, exitBattleFullscreen } from "@/lib/battlefull";
import GameWindowGuard from "@/components/GameWindowGuard";
import MonArt from "@/components/adventure/MonArt";
import { josa } from "@/lib/josa";
import { confirmDialog } from "@/lib/confirm";
import { BallIcon, HpBar, SHAPE_LABEL, STATUS_LABEL, STAT_LABEL, XpBar, holdProps, moveTags, pressProps, shade } from "@/components/adventure/advui";
import { A2HS_KEY, holdRepeat, minFont, onceFlag, ringNow, stickVec, wantsA2hsTip } from "@/lib/advmobile";

const KEYS = ["Q", "W", "E", "R"];

/** 온라인 대전 — 판이 끝나면 입력 기록을 서버에 넘긴다(서버가 다시 돌려 판정). 실패하면 던진다. */
export type Online = {
  finish: (log: LogEntry[], arena: Arena) => Promise<void>;
  forfeit: () => Promise<void>;
  errorText: (e: unknown) => string;
  /** 다시 보내면 달라질 오류인가(연결 끊김 · 5xx) — 4xx 는 서버가 정한 답이라 바로 멈춘다(2026-11-09) */
  retryable?: (e: unknown) => boolean;
};

type Mini = { species: string; level: number; hp: number; max: number; status?: Status; xp: number };
type Hud = {
  me: Mini; foe: Mini;
  moves: { id: string; cd: number; max: number }[];
  dodge: number; swap: number; swapMax: number;
  team: { species: string; hp: number; max: number; active: boolean }[];
  foeLeft: number; foeTotal: number;
  needSwap: boolean; over: Battle["over"]; channel: string | null;
  bag: Bag | null;
  charge: number; awake: number;
  /** 공 고리 크기(ringAim) — 공 버튼의 '지금!' 과 확률이 캔버스 고리와 같은 값을 본다 */
  aim: number;
  /** 대장 · 탑 10층마다의 상대(2026-11-10) — 이름 · 분노 · 다음 패턴까지 남은 초. 보통 상대는 null */
  boss: { name: string; enraged: boolean; next: string; left: number } | null;
};
type Float = { x: number; y: number; text: string; color: string; t0: number; big?: boolean };
type Toast = { id: number; text: string };

const miniOf = (a: Arena, side: 0 | 1): Mini => {
  const f = activeOf(a.b, side);
  return { species: f.mon.species, level: f.mon.level, hp: f.mon.hp, max: f.stats.hp, status: f.mon.status, xp: f.mon.xp };
};
function hudOf(a: Arena): Hud {
  const u = a.units[0];
  const f = activeOf(a.b, 0);
  return {
    me: miniOf(a, 0),
    foe: miniOf(a, 1),
    moves: f.mon.moves.map((m, i) => ({ id: m.id, cd: u.cd[i], max: skillOf(m.id).cd })),
    dodge: u.dodgeCd, swap: a.swapCd[0], swapMax: 5 * TPS,
    team: a.b.sides[0].team.map((t, i) => ({ species: t.mon.species, hp: t.mon.hp, max: t.stats.hp, active: i === a.b.sides[0].active })),
    foeLeft: a.b.sides[1].team.filter((t) => t.mon.hp > 0).length,
    foeTotal: a.b.sides[1].team.length,
    needSwap: a.b.needSwap, over: a.b.over,
    channel: u.channel ? (u.channel.kind === "run" ? "도망치는 중" : "약을 쓰는 중") : null,
    bag: a.bag ? { balls: { ...a.bag.balls }, items: { ...a.bag.items } } : null,
    charge: a.charge[0],
    awake: u.awake,
    aim: ringAim(a.tick),
    boss: a.b.boss != null || (a.b.tower != null && a.b.tower % 10 === 0)
      ? { name: a.b.sides[1].name, enraged: a.units[1].enraged, next: SIGNATURES[(a.sig.n + Math.abs(a.b.seed % 2)) % SIGNATURES.length], left: Math.max(0, Math.ceil(a.sig.t / TPS)) }
      : null,
  };
}

const bagTotal = (b: Bag | null) => (b ? Object.values(b.balls).reduce((x, n) => x + n, 0) + Object.values(b.items).reduce((x, n) => x + n, 0) : 0);

/** 필드 위 생물 크기(2026-11-08 [사용자: "캐릭터가 너무 커"] 122 → 100). 맞는 판정(BODY_R)과는 따로다 */
const SPRITE = 100;
/** 구운 바닥의 테두리 여백(테두리 선 두께 · 바위 그림자) */
/** 구운 바닥의 바깥 여백 — 카메라가 판 밖을 비출 때도 질감이 이어지게(2026-11-10) */
const BG_PAD = 140;

/* eslint-disable react-hooks/refs -- 전투 판(arena)은 30틱 엔진이 직접 고치는 가변 객체라 ref 에 두고, 화면은 그 스냅샷(hud)과 판의 고정 값(야생인지 · 팀)을
   렌더에서 읽는다. 실시간 버튼(pressProps · holdProps)도 입력 ref 에 넣는다. 예전엔 뒤로 가기 처리가 아래의 async 함수(forfeit)를 먼저 불러서
   컴파일러 린트가 이 컴포넌트를 통째로 건너뛰었고(그래서 드러나지 않았다), 2026-11-09 대전의 뒤로 가기를 안내로 바꾸자 같은 읽기가 전부 걸렸다.
   React Compiler 는 켜져 있지 않다(README §10.13) — 이 컴포넌트만 이 규칙을 끈다. */
export default function BattleView({ battle: start, region, bag: startBag, onEnd, onSettle, onSpend, online, keepFull }: {
  battle: Battle;
  region: Region;
  bag: Bag;
  /** 축하 연출(1.5초) 뒤 — 화면을 닫는다 */
  onEnd: (battle: Battle, bag: Bag) => void;
  /** 판이 끝난 그 틱에 — 진행 저장은 여기서(연출을 기다리다 앱이 닫히면 잡은 생물 · 경험치가 사라졌다). 대전은 서버가 정한다 */
  onSettle?: (battle: Battle, bag: Bag) => void;
  /** 공을 던지거나 약을 쓴 그 틱에 — 지금 가방(앱을 꺼서 판을 버려도 쓴 것은 쓴 것으로 남게, 2026-11-09) */
  onSpend?: (bag: Bag) => void;
  online?: Online;
  /** 필드에서 열렸다 — 끝나도 전체 화면을 유지한다 */
  keepFull?: boolean;
}) {
  const arenaRef = useRef<Arena | null>(null);
  if (!arenaRef.current) arenaRef.current = newArena(start, startBag);
  const stage = REGIONS.find((r) => r.key === arenaRef.current!.map.key) ?? region;
  const [hud, setHud] = useState<Hud>(() => hudOf(arenaRef.current!));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ball, setBall] = useState<BallKey>(() => (["basic", "great", "star"] as BallKey[]).find((k) => startBag.balls[k] > 0) ?? "basic");
  const [itemsOpen, setItemsOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  // 일시정지 · 처음 전투 안내(대전은 멈출 수 없다)
  const [pausedView, setPausedView] = useState<"pause" | "coach" | null>(() => {
    if (online) return null;
    try {
      if (localStorage.getItem("ourdays:adv:coach:v2")) return null;
      localStorage.setItem("ourdays:adv:coach:v2", "1");
      return "coach";
    } catch {
      return null;
    }
  });
  const paused = useRef(pausedView != null);
  useEffect(() => {
    paused.current = pausedView != null;
  }, [pausedView]);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<BattleFx | null>(null);
  // held = 누르고 있는 기술 칸 — 재사용 대기가 끝나는 틱에 다시 넣는다(2026-11-09 길게 누르기)
  const input = useRef<{ keys: Set<string>; stick: number; queue: { a: ArenaInput; ttl: number } | null; held: number | null }>({ keys: new Set(), stick: 0, queue: null, held: null });
  const logRef = useRef<LogEntry[]>([]);
  const lastDir = useRef(0);
  const floats = useRef<Float[]>([]);
  const shake = useRef(0);
  const flash = useRef(0);
  const hitAt = useRef<[number, number]>([-1e9, -1e9]);
  const faintAt = useRef<[number, number]>([-1e9, -1e9]);
  const ghosts = useRef<{ side: 0 | 1; x: number; y: number; t0: number; species: string; flip: boolean }[]>([]);
  const ended = useRef(false);
  const greeted = useRef(false);
  const toastId = useRef(0);
  const view = useRef({ s: 1, es: 1, ox: 0, oy: 0, w: 0, h: 0, top: 0, bottom: 0 });
  const topRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  /** 카메라 — 필드가 화면보다 넓어 나와 상대 사이를 따라간다 */
  const cam = useRef({ x: 0, y: 0, zoom: 1, fit: 1, ready: false });
  /** 타격감 — 멈칫(히트스톱) · 찌그러짐 · 내지르기 · 충격 고리 */
  const feel = useRef({ stopUntil: 0, squash: [-1e9, -1e9] as [number, number], squashAmt: [0, 0] as [number, number], kick: [-1e9, -1e9] as [number, number], kickDir: [[0, 0], [0, 0]] as [number, number][], rings: [] as { x: number; y: number; t0: number; color: string; r: number }[],
    sparks: [] as { x: number; y: number; dx: number; dy: number; len: number; t0: number; color: string }[],
    dust: [] as { x: number; y: number; vx: number; vy: number; t0: number; r: number }[],
    slashes: [] as { x: number; y: number; ang: number; r: number; half: number; color: string; core: string; t0: number }[],
    bursts: [] as { x: number; y: number; r: number; color: string; core: string; t0: number; rain: boolean; nova?: boolean }[],
    ult: null as { name: string; color: string; t0: number } | null, combo: 0, comboAt: -1e9, hurtAt: -1e9, startAt: 0, endAt: 0, endText: "" });
  /** 생물의 몸짓(그림만) — 바라보는 쪽을 천천히 돌고, 걸음 주기 · 맞은 휘청임 · 쓰러짐을 이어서 그린다(2026-11-10) */
  const poses = useRef(([0, 1] as const).map(() => ({ face: 1, spd: 0, vx: 0, phase: 0, tilt: 0, tiltV: 0, lastStep: 0, fallDir: 1 })));
  const lastDraw = useRef(0);
  const onEndRef = useRef(onEnd);
  const onSettleRef = useRef(onSettle);
  const onSpendRef = useRef(onSpend);
  /** 가방에 남은 공 · 약 개수 — 줄면 onSpend */
  const bagLeft = useRef(bagTotal(startBag));
  const hudRef = useRef(hud);
  useEffect(() => {
    onEndRef.current = onEnd;
    onSettleRef.current = onSettle;
    onSpendRef.current = onSpend;
    hudRef.current = hud;
  });

  const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toast(text: string, ms = 1800) {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }
  /** 재사용 대기 중에 누른 기술 칸 — 짧게 흔든다(입력은 그대로 줄에 넣는다: 6틱 안에 풀리면 나간다) */
  const [nope, setNope] = useState<{ slot: number; n: number } | null>(null);

  /** 버튼 · 키 입력 — 다음 틱부터 6틱 동안 시도한다(시전 중이면 끝나자마자 나간다) */
  function queue(a: ArenaInput, ttl = 6) {
    input.current.queue = { a, ttl };
  }

  // 화면 · 루프
  useEffect(() => {
    const a = arenaRef.current!;
    const c = canvasRef.current!;
    const fc = fxCanvasRef.current!;
    const fx = new BattleFx(fc);
    fxRef.current = fx;
    const ctx = c.getContext("2d")!;
    let dpr = 1;
    // 구운 바닥 — 크기(배율 · 기기 배율)가 바뀌면 bgK 를 0 으로 두어 다음 그림에서 다시 굽는다
    let bg: HTMLCanvasElement | null = null;
    let bgK = 0;
    const bake = () => {
      // 한 장 칸 수는 전투 캔버스와 같은 상한(battleDpr 의 220만) — 바닥은 부드러운 색이라 조금 덜 촘촘해도 티가 안 난다
      const side = (ARENA_W + BG_PAD * 2) * (ARENA_H + BG_PAD * 2);
      const k = Math.max(0.5, Math.min(Math.sqrt(BATTLE_PIXELS_MAX / side), view.current.s * dpr * 1.07));
      const cv = bg ?? document.createElement("canvas");
      cv.width = Math.ceil((ARENA_W + BG_PAD * 2) * k);
      cv.height = Math.ceil((ARENA_H + BG_PAD * 2) * k);
      const g = cv.getContext("2d");
      bgK = k;
      if (!g) {
        bg = null;
        return;
      }
      g.setTransform(k, 0, 0, k, BG_PAD * k, BG_PAD * k);
      // 판 밖 — 같은 질감을 어둡게 깔고, 가장자리에 그늘을 둘러 액자처럼
      g.save();
      g.translate(-BG_PAD, -BG_PAD);
      paintGround(g, a.map.key, ARENA_W + BG_PAD * 2, ARENA_H + BG_PAD * 2, shade(stage.ground, -0.25));
      g.fillStyle = "rgba(10,6,20,.5)";
      g.fillRect(0, 0, ARENA_W + BG_PAD * 2, ARENA_H + BG_PAD * 2);
      g.restore();
      for (let i = 0; i < 4; i++) {
        g.strokeStyle = "rgba(0,0,0," + (0.1 + i * 0.04) + ")";
        g.lineWidth = 34 - i * 8;
        rr(g, -6, -6, ARENA_W + 12, ARENA_H + 12, 30);
        g.stroke();
      }
      drawGround(g, stage.ground, a.map.key);
      drawRocks(g, a);
      bg = cv;
    };
    // 크기가 바뀌면 캔버스가 지워진다 — 멈춘 화면이어도 한 장은 다시 그린다
    let dirty = true;
    const fit = () => {
      const r = c.getBoundingClientRect();
      dpr = battleDpr(r.width, r.height);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      // 캔버스가 화면 전체다 — 글자판 · 버튼은 그 위에 얹힌다. 한 화면엔 가로 약 380 만 보이고 필드(ARENA_W × ARENA_H)는 카메라가 따라간다
      // 가로 화면(globals.css 의 같은 조건)은 버튼이 양옆 아래 모서리라 가운데 아래 한 줄만 가린다
      const landscape = r.width > r.height && r.height < 560;
      const s = landscape ? Math.min(r.width / 600, r.height / 480) : Math.min(r.width / 380, r.height / 640);
      const top = topRef.current ? topRef.current.getBoundingClientRect().bottom - r.top : 0;
      const cover = landscape ? rowRef.current : ctlRef.current;
      const bottom = cover ? r.bottom - cover.getBoundingClientRect().top : 0;
      view.current = { ...view.current, s, w: r.width, h: r.height, top, bottom };
      // '도망치는 중 · 서버에 보내는 중' 알약은 잰 버튼 칸 높이 위에 — 예전 bottom 196px 고정은 버튼 칸이 두 줄이면 그 뒤에 숨었다
      if (ctlRef.current) rootRef.current?.style.setProperty("--adv-ctl-h", `${Math.round(r.bottom - ctlRef.current.getBoundingClientRect().top)}px`);
      bgK = 0;
      fx.resize();
      dirty = true;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    if (topRef.current) ro.observe(topRef.current);
    if (ctlRef.current) ro.observe(ctlRef.current);
    if (rowRef.current) ro.observe(rowRef.current);
    enterBattleFullscreen();
    feel.current.startAt = performance.now();
    for (const t of a.b.sides) for (const f of t.team) preloadSprite(f.mon.species);
    if (!greeted.current) toast(a.b.wild ? `앗! 야생 ${josa(SPECIES[activeOf(a.b, 1).mon.species].name, "이/가")} 나타났다!` : `${josa(a.b.sides[1].name, "이/가")} 승부를 걸어왔다!`);
    if (!greeted.current) toast(`${MAP_RULES[a.map.key].name} — ${MAP_RULES[a.map.key].tip}`);
    greeted.current = true;

    const scr = (x: number, y: number): Pt => ({ x: view.current.ox + x * view.current.es, y: view.current.oy + y * view.current.es });
    const addFloat = (x: number, y: number, text: string, color: string, big = false) => {
      floats.current.push({ x: x + (Math.random() * 24 - 12), y: y - BODY_R, text, color, t0: performance.now(), big });
      if (floats.current.length > 30) floats.current.shift();
    };

    const handle = (evs: AEv[]) => {
      const now = performance.now();
      for (const e of evs) {
        if (e.t === "cast") {
          const mv = moveOf(e.move);
          const u = a.units[e.side];
          // 화면을 어둡게 하고 큰 띠를 거는 건 내 큰 기술뿐(2026-11-09) — 상대 큰 기술에 띠가 필드를 덮어, 피해야 할 경고 원을 가렸다.
          // 상대 것은 그 생물 머리 위에 붉은 이름표만 크게 띄운다
          const foeBig = e.side === 1 && mv.power >= 90;
          if (mv.power > 0) addFloat(u.x, u.y - 62, foeBig ? `${mv.name}!` : mv.name, foeBig ? "#ff8a7a" : FX_PAL[mv.type][0], foeBig);
          if (mv.power >= 90 && !still && e.side === 0) feel.current.ult = { name: mv.name, color: FX_PAL[mv.type][1], t0: now };
        } else if (e.t === "release") {
          const mv = moveOf(e.move);
          {
            const d = Math.hypot(e.tx - e.x, e.ty - e.y) || 1;
            feel.current.kick[e.side] = now;
            feel.current.kickDir[e.side] = [(e.tx - e.x) / d, (e.ty - e.y) / d];
          }
          const sh = skillOf(e.move).shape;
          const pal = FX_PAL[mv.type];
          const hand = scr(e.x, e.y - 40);
          if (mv.power > 0) fx.flare(mv.type, hand);
          if (sh === "fan") {
            const fk = skillOf(e.move);
            fx.sweep(mv.type, hand, Math.atan2(e.ty - e.y, e.tx - e.x), Math.acos(Math.max(-1, Math.min(1, fk.cos))), fk.r * view.current.es);
          }
          if (sh === "beam" && !still) shake.current = Math.max(shake.current, mv.power >= 90 ? 9 : 5);
          if (sh === "fan") {
            const k = skillOf(e.move);
            feel.current.slashes.push({ x: e.x, y: e.y - 40, ang: Math.atan2(e.ty - e.y, e.tx - e.x), r: k.r + 26, half: Math.acos(Math.max(-1, Math.min(1, k.cos))), color: pal[1], core: pal[0], t0: now });
          }
          else if (sh === "self") fx.aura(mv.type, scr(e.x, e.y), true);
          else if (sh === "hex") void fx.travel("debuff", mv.type, scr(e.x, e.y), scr(e.tx, e.ty));
        } else if (e.t === "hit") {
          const mv = e.move ? moveOf(e.move) : null;
          const at = scr(e.x, e.y);
          if (e.dot) fx.status(e.dot, at);
          else if (mv && !e.recoil) fx.impact(mv.type, at, { power: mv.hits ? 0.45 : mv.power / 90, eff: e.eff, crit: e.crit });
          else fx.impact("노말", at, { small: true });
          hitAt.current[e.side] = now;
          const color = e.crit ? "#ffe14a" : e.eff > 1 ? "#ff7a4a" : e.eff < 1 ? "#b9c3d6" : e.side === 0 ? "#ff8b8b" : "#ffffff";
          addFloat(e.x, e.y, `${e.dmg}`, color, e.crit || e.eff > 1);
          if (e.crit) addFloat(e.x, e.y - 18, "급소!", "#ffe14a");
          else if (e.eff > 1 && !e.dot) addFloat(e.x, e.y - 18, "효과 굉장!", "#ff9b5c");
          if (!e.dot) {
            const max = activeOf(a.b, e.side).stats.hp || 1;
            const big = e.crit || e.eff > 1 || (mv ? mv.power >= 70 : false);
            const fe = feel.current;
            fe.squash[e.side] = now;
            fe.squashAmt[e.side] = Math.min(0.36, 0.16 + (e.dmg / max) * 0.8 + (e.crit ? 0.08 : 0));
            fe.rings.push({ x: e.x, y: e.y - 30, t0: now, color: mv ? FX_PAL[mv.type][1] : "#ffffff", r: big ? 70 : 44 });
            if (fe.rings.length > 12) fe.rings.shift();
            if (!still) {
              const col = mv ? FX_PAL[mv.type][0] : "#ffffff";
              const n = big ? 14 : 8;
              for (let k = 0; k < n; k++) {
                const ang = Math.random() * Math.PI * 2;
                fe.sparks.push({ x: e.x, y: e.y - 44, dx: Math.cos(ang), dy: Math.sin(ang), len: (big ? 90 : 56) * (0.6 + Math.random() * 0.8), t0: now, color: k % 3 ? "#ffffff" : col });
              }
              if (fe.sparks.length > 90) fe.sparks.splice(0, fe.sparks.length - 90);
              for (let k = 0; k < 5; k++) fe.dust.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y + 6, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 30, t0: now, r: 7 + Math.random() * 7 });
            }
            if (e.side === 1 && !e.recoil) {
              fe.combo = now - fe.comboAt < 1500 ? fe.combo + 1 : 1;
              fe.comboAt = now;
            }
            if (e.side === 0) fe.hurtAt = now;
            {
              const att = a.units[e.side ? 0 : 1];
              const dir = Math.sign(a.units[e.side].x - att.x) || 1;
              const pz = poses.current[e.side];
              pz.tiltV += dir * (big ? 9 : 5.5);
              pz.fallDir = dir;
            }
            if (!still) {
              fe.stopUntil = Math.max(fe.stopUntil, now + (e.crit ? 120 : big ? 85 : 45));
              shake.current = Math.max(shake.current, Math.min(15, 3 + (e.dmg / max) * 55 + (e.crit ? 5 : 0)));
              if (e.crit || e.eff > 1) cam.current.zoom = 1.07;
              try {
                if ((e.side === 0 || e.crit) && "vibrate" in navigator && navigator.userActivation?.hasBeenActive) navigator.vibrate(e.crit ? 45 : e.side === 0 ? 25 : 15);
              } catch {
                /* 진동이 막힌 기기 */
              }
            }
          }
          if (!still && e.crit) flash.current = now;
        } else if (e.t === "miss") {
          addFloat(e.x, e.y, e.side === 0 && a.units[0].iframe > 0 ? "회피!" : "빗나감", "#bff3ff");
        } else if (e.t === "heal") {
          const u = a.units[e.side];
          fx.heal(scr(u.x, u.y));
          if (e.amount > 0) addFloat(u.x, u.y, `+${e.amount}`, "#7dff9a");
        } else if (e.t === "status") {
          const u = a.units[e.side];
          if (e.on) fx.status(e.status, scr(u.x, u.y));
          addFloat(u.x, u.y, e.on ? STATUS_LABEL[e.status] : `${STATUS_LABEL[e.status]} 풀림`, e.on ? "#d9a3ff" : "#bfe8c8");
        } else if (e.t === "stat") {
          const u = a.units[e.side];
          if (e.by) {
            fx.aura(SPECIES[activeOf(a.b, e.side).mon.species].type, scr(u.x, u.y), e.by > 0);
            addFloat(u.x, u.y, `${STAT_LABEL[e.stat]} ${e.by > 0 ? "▲".repeat(e.by) : "▼".repeat(-e.by)}`, e.by > 0 ? "#ffd27a" : "#9fb3ff");
          }
        } else if (e.t === "interrupt") {
          const u = a.units[e.side];
          addFloat(u.x, u.y - 14, "끊김!", "#ffb1b1");
        } else if (e.t === "faint") {
          faintAt.current[e.side] = now;
          if (!still) {
            feel.current.stopUntil = Math.max(feel.current.stopUntil, now + 240);
            shake.current = 16;
            flash.current = now;
          }
          const u = a.units[e.side];
          fx.impact(SPECIES[activeOf(a.b, e.side).mon.species].type, scr(u.x, u.y), { small: true });
          toast(`${josa(SPECIES[activeOf(a.b, e.side).mon.species].name, "은/는")} 쓰러졌다!`);
        } else if (e.t === "swap") {
          faintAt.current[e.side] = -1e9;
          const f = activeOf(a.b, e.side);
          preloadSprite(f.mon.species);
          if (e.side === 0) toast(`가랏, ${SPECIES[f.mon.species].name}!`);
        } else if (e.t === "pulse") {
          const mv = moveOf(e.move);
          fx.impact(mv.type, scr(e.x, e.y), { power: mv.hits ? 0.6 : 1 });
          if (mv.power >= 60) fx.shockwave(mv.type, scr(e.x, e.y), e.r * view.current.es);
          feel.current.bursts.push({ x: e.x, y: e.y, r: e.r, color: FX_PAL[mv.type][1], core: FX_PAL[mv.type][0], t0: now, rain: skillOf(e.move).shape === "rain" });
          if (!still && !mv.hits) shake.current = Math.max(shake.current, 4);
        } else if (e.t === "nova") {
          const mv = moveOf(e.move);
          feel.current.bursts.push({ x: e.x, y: e.y, r: e.r, color: FX_PAL[mv.type][1], core: FX_PAL[mv.type][0], t0: now, rain: false, nova: true });
          if (mv.power > 0) fx.shockwave(mv.type, scr(e.x, e.y - 20), e.r * view.current.es);
          if (!still && mv.power >= 60) shake.current = Math.max(shake.current, 7);
        } else if (e.t === "block") {
          fx.pop(moveOf(e.move).type, scr(e.x, e.y - 40), 8);
          addFloat(e.x, e.y, "막힘", "#e6ddc8");
        } else if (e.t === "pick") {
          fx.pop(e.kind === "heal" ? "풀" : e.kind === "power" ? "불꽃" : "전기", scr(e.x, e.y - 20), 20);
          addFloat(e.x, e.y, e.kind === "heal" ? "회복!" : e.kind === "power" ? "공격 강화!" : "빨라졌다!", e.kind === "heal" ? "#7dff9a" : e.kind === "power" ? "#ffb13d" : "#ffe14a", true);
        } else if (e.t === "awaken") {
          const ty = SPECIES[activeOf(a.b, e.side).mon.species].type;
          if (e.side === 0) feel.current.ult = { name: "각성!", color: FX_PAL[ty][1], t0: now };
          else addFloat(e.x, e.y - 30, `${SPECIES[activeOf(a.b, e.side).mon.species].name} 각성!`, "#ff8a7a", true);
          fx.shockwave(ty, scr(e.x, e.y - 20), e.r * view.current.es);
          fx.shockwave(ty, scr(e.x, e.y - 20), e.r * 0.6 * view.current.es);
          fx.aura(ty, scr(e.x, e.y), true);
          feel.current.bursts.push({ x: e.x, y: e.y, r: e.r, color: FX_PAL[ty][1], core: FX_PAL[ty][0], t0: now, rain: false, nova: true });
          if (!still) {
            flash.current = now;
            shake.current = Math.max(shake.current, 15);
            feel.current.stopUntil = Math.max(feel.current.stopUntil, now + 200);
          }
        } else if (e.t === "enrage") {
          const u = a.units[e.side];
          addFloat(u.x, u.y - 30, "분노!", "#ff6a5a", true);
          toast(`${a.b.sides[1].name}의 생물이 분노했다!`);
          if (!still) shake.current = Math.max(shake.current, 10);
          fx.aura("불꽃", scr(u.x, u.y), true);
        } else if (e.t === "hazard") {
          fx.pop("노말", scr(e.x, e.y), 16);
          feel.current.rings.push({ x: e.x, y: e.y, t0: now, color: "#fff1c9", r: e.r });
          if (!still) shake.current = Math.max(shake.current, 6);
        } else if (e.t === "wind") {
          toast("돌풍이 불어온다!");
        } else if (e.t === "capture") {
          if (e.caught) fx.impact("페어리", scr(a.units[1].x, a.units[1].y), { power: 1.3 });
        } else if (e.t === "text") toast(e.s);
      }
    };

    const tick = () => {
      if (ended.current) return;
      const q = input.current;
      const k = q.keys;
      const kx = (k.has("ArrowRight") ? 1 : 0) - (k.has("ArrowLeft") ? 1 : 0);
      const ky = (k.has("ArrowDown") ? 1 : 0) - (k.has("ArrowUp") ? 1 : 0);
      // 길게 누른 기술 — 재사용 대기가 끝나는 틱에 다시 넣는다(엔진은 그대로, 입력 줄만)
      {
        const u0 = a.units[0];
        // ⚠ 다음 생물을 고르는 동안(틱이 멈춘다)엔 넣지 않는다 — 대전 기록이 한 틱에 쌓이면 서버가 bad log 로 거절한다
        const busy = a.b.needSwap || !!a.b.over || !!(u0.cast || u0.lunge || u0.leap || u0.chain || u0.lock || u0.channel) || u0.dodge > 0;
        if (holdRepeat(q.held, u0.cd, busy, !!q.queue)) q.queue = { a: { dir: 0, skill: q.held! }, ttl: 6 };
      }
      let inp: ArenaInput = { dir: kx || ky ? dirOf(kx, ky) : q.stick };
      if (q.queue) inp = { ...q.queue.a, dir: inp.dir };
      if (online) {
        inp = duelInput(inp);
        lastDir.current = record(logRef.current, lastDir.current, a.tick, inp);
      }
      stepArena(a, inp);
      if (a.bag) {
        const left = bagTotal(a.bag);
        if (left < bagLeft.current) onSpendRef.current?.({ balls: { ...a.bag.balls }, items: { ...a.bag.items } });
        bagLeft.current = left;
      }
      // 나간 입력은 지운다(기술은 시전이 시작되면, 그 밖은 바로)
      if (q.queue) {
        const tried = q.queue.a;
        const done = (tried.skill == null && !tried.awaken) || a.ev.some((e) => (e.t === "cast" || e.t === "awaken") && e.side === 0) || a.b.needSwap;
        if (done || --q.queue.ttl <= 0) q.queue = null;
      }
      handle(a.ev);
      if (!still) {
        const now = performance.now();
        for (const side of [0, 1] as const) {
          const u = a.units[side];
          const f = activeOf(a.b, side);
          if (f.mon.hp <= 0) continue;
          if (u.cast && moveOf(u.cast.move).power > 0) fx.charge(moveOf(u.cast.move).type, scr(u.x, u.y - 44), u.cast.t / Math.max(1, u.cast.total));
          if (u.lunge) fx.trail(moveOf(u.lunge.move).type, scr(u.x, u.y - 40), u.lunge.dx * 7, u.lunge.dy * 7, 2, 1.2);
          if (u.awake > 0 && a.tick % 2 === 0) fx.trail(SPECIES[f.mon.species].type, scr(u.x + (Math.random() - 0.5) * 60, u.y - Math.random() * 30), 0, -5, 2, 1.3);
          if (u.lunge || u.dodge > 0) {
            ghosts.current.push({ side, x: u.x, y: u.y, t0: now, species: f.mon.species, flip: u.fx > 0.15 });
            if (ghosts.current.length > 14) ghosts.current.shift();
          }
          if (Math.hypot(u.x - u.px, u.y - u.py) > 2 && a.tick % 5 === side) {
            feel.current.dust.push({ x: u.x, y: u.y + 8, vx: (u.px - u.x) * 6, vy: -14, t0: now, r: 6 + Math.random() * 5 });
          }
        }
        for (const s of a.shots) fx.trail(moveOf(s.move).type, scr(s.x, s.y - 40), s.dx * 6, s.dy * 6);
        for (const b of a.beams) {
          const along = Math.random() * b.len;
          fx.trail(moveOf(b.move).type, scr(b.x + b.dx * along, b.y + b.dy * along - 40), b.dx * 8, b.dy * 8, 2, 1.1);
        }
        if (feel.current.dust.length > 50) feel.current.dust.splice(0, feel.current.dust.length - 50);
      }
      if (a.b.over && !ended.current) {
        ended.current = true;
        feel.current.endAt = performance.now();
        feel.current.endText = a.b.over === "win" ? "승리!" : a.b.over === "caught" ? "잡았다!" : a.b.over === "run" ? "도망!" : "패배…";
        setHud(hudOf(a));
        // 진행 저장은 지금 — 축하 연출(1.5초)을 기다리다 앱이 닫히면 잡은 생물 · 경험치가 사라졌다
        if (!online) onSettleRef.current?.(a.b, a.bag ?? startBag);
        const r = a.b.over;
        setTimeout(() => toast(r === "win" ? "이겼다!" : r === "caught" ? "새 친구가 생겼다!" : r === "run" ? "무사히 빠져나왔다" : "졌다…"), 300);
        void (async () => {
          await new Promise((res) => setTimeout(res, 1500));
          if (online) {
            for (let tries = 0; ; tries++) {
              setSending("결과를 서버에 보내는 중…");
              try {
                await online.finish(logRef.current, a);
                break;
              } catch (err) {
                // 4xx(이미 끝난 판 · 늦음 · 깨진 기록)는 몇 번을 보내도 같은 답 — 바로 결과로 넘어간다
                if (online.retryable && !online.retryable(err)) break;
                setSending(`${online.errorText(err)} — 다시 보낼게요`);
                if (tries >= 4) break;
                await new Promise((res) => setTimeout(res, 1500 * (tries + 1)));
              }
            }
            setSending(null);
          }
          onEndRef.current(a.b, a.bag ?? startBag);
        })();
      }
    };

    const draw = (alpha: number, now: number) => {
      const { w, h, top, bottom } = view.current;
      // 카메라 — 나 60% · 상대 40% 쪽을 부드럽게 따라가고, 둘이 멀어지면 살짝 물러나 함께 담는다
      const me = a.units[0];
      const op = a.units[1];
      const cm = cam.current;
      cm.zoom += (1 - cm.zoom) * 0.12;
      const base = view.current.s;
      const room = Math.max(160, h - top - bottom);
      const fitTo = Math.max(0.72, Math.min(1, w / (base * (Math.abs(me.x - op.x) + 240)), room / (base * (Math.abs(me.y - op.y) + 250))));
      cm.fit += (fitTo - cm.fit) * 0.05;
      const s = base * cm.fit * cm.zoom;
      view.current.es = s;
      const visW = w / s;
      const visH = room / s;
      let tx = me.x * 0.6 + op.x * 0.4;
      let ty = me.y * 0.55 + op.y * 0.45 - 34;
      tx = ARENA_W + 60 > visW ? Math.min(ARENA_W + 30 - visW / 2, Math.max(visW / 2 - 30, tx)) : ARENA_W / 2;
      ty = ARENA_H + 120 > visH ? Math.min(ARENA_H + 60 - visH / 2, Math.max(visH / 2 - 60, ty)) : ARENA_H / 2;
      if (!cm.ready) {
        cm.x = tx;
        cm.y = ty;
        cm.ready = true;
      }
      cm.x += (tx - cm.x) * 0.1;
      cm.y += (ty - cm.y) * 0.1;
      const ox = w / 2 - cm.x * s;
      const oy = top + room / 2 - cm.y * s;
      view.current.ox = ox;
      view.current.oy = oy;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = "high";
      // 그릴 크기(기기 픽셀) — 캐시가 2의 거듭제곱 단으로 묶어 줌이 흔들려도 다시 굽지 않는다(lib/spritecache)
      const spriteTarget = Math.ceil(SPRITE * s * dpr);
      ctx.fillStyle = shade(stage.ground, -0.62);
      ctx.fillRect(0, 0, w, h);
      let sx = 0;
      let sy = 0;
      if (shake.current > 0) {
        sx = (Math.random() * 2 - 1) * shake.current;
        sy = (Math.random() * 2 - 1) * shake.current;
        shake.current = Math.max(0, shake.current - 0.6);
      }
      ctx.translate(ox + sx, oy + sy);
      ctx.scale(s, s);
      // 땅 · 꾸밈 · 바위는 구워 둔 한 장을 카메라대로 붙인다(2026-11-09) — 예전엔 프레임마다 그라데이션 · 꾸밈 150개 · 바위 정렬 · 바위 그라데이션을 새로 만들었다
      if (!bgK) bake();
      if (bg) ctx.drawImage(bg, -BG_PAD, -BG_PAD, ARENA_W + BG_PAD * 2, ARENA_H + BG_PAD * 2);
      else drawGround(ctx, stage.ground, a.map.key);

      drawMap(ctx, a, still ? 0 : now, !bg);

      // 떨어질 원
      for (const z of a.zones) {
        if (z.ward) {
          const left = Math.min(1, z.t / 45);
          ctx.globalAlpha = 0.16 * left;
          ctx.fillStyle = z.side === 0 ? "#7ee0ff" : "#ff8a7a";
          ctx.beginPath();
          ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.8 * left;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 8]);
          ctx.lineDashOffset = -now / 40;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          continue;
        }
        const col = TYPE_COLOR[moveOf(z.move).type];
        const k = 1 - z.t / Math.max(1, z.total);
        const foeZone = z.side === 1;
        ctx.globalAlpha = 0.16 + 0.22 * k;
        ctx.fillStyle = foeZone ? "#ff4b4b" : col;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = foeZone ? "#ffb0a6" : col;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // 하늘에서 떨어지는 덩어리 · 땅에서 차오르는 빛
        const shape = skillOf(z.move).shape;
        const zp = FX_PAL[moveOf(z.move).type];
        if (shape === "rain") {
          const drop = (1 - k) * 460;
          const orb = z.r * 0.42;
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = zp[1];
          ctx.lineCap = "round";
          ctx.lineWidth = orb * 1.1;
          line(ctx, z.x, z.y - drop - 90, z.x, z.y - drop);
          ctx.lineCap = "butt";
          const ball = ctx.createRadialGradient(z.x, z.y - drop, 0, z.x, z.y - drop, orb * 1.5);
          ball.addColorStop(0, "#ffffff");
          ball.addColorStop(0.4, zp[0]);
          ball.addColorStop(0.75, zp[1]);
          ball.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = ball;
          ctx.beginPath();
          ctx.arc(z.x, z.y - drop, orb * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        } else if (shape === "blast") {
          ctx.strokeStyle = zp[0];
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.35 + 0.55 * k;
          for (let c = 0; c < 7; c++) {
            const ang = (c / 7) * Math.PI * 2 + z.id;
            line(ctx, z.x, z.y, z.x + Math.cos(ang) * z.r * k, z.y + Math.sin(ang) * z.r * 0.6 * k);
          }
        }
        ctx.globalAlpha = 1;
      }

      // 시전 — 조준선 · 부채꼴 · 모으는 빛
      for (const side of [0, 1] as const) {
        const u = a.units[side];
        if (!u.cast) continue;
        const sk = skillOf(u.cast.move);
        const col = TYPE_COLOR[moveOf(u.cast.move).type];
        const k = u.cast.t / Math.max(1, u.cast.total);
        if (sk.shape === "beam") {
          ctx.globalAlpha = 0.22 + 0.4 * k;
          ctx.strokeStyle = side === 1 ? "#ff6a5a" : col;
          ctx.lineWidth = (sk.r + BODY_R) * 2 * (0.4 + 0.6 * k);
          ctx.lineCap = "round";
          line(ctx, u.x, u.y, u.x + u.cast.dx * sk.range, u.y + u.cast.dy * sk.range);
          ctx.lineCap = "butt";
        } else if (sk.shape === "fan") {
          const ang = Math.atan2(u.cast.dy, u.cast.dx);
          const half = Math.acos(Math.max(-1, Math.min(1, sk.cos)));
          ctx.globalAlpha = 0.18 + 0.35 * k;
          ctx.fillStyle = side === 1 ? "#ff6a5a" : col;
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.arc(u.x, u.y, (sk.r + BODY_R) * (0.5 + 0.5 * k), ang - half, ang + half);
          ctx.closePath();
          ctx.fill();
        } else if (sk.shape === "dash" || sk.shape === "combo") {
          ctx.globalAlpha = 0.2 + 0.4 * k;
          ctx.strokeStyle = side === 1 ? "#ff6a5a" : col;
          ctx.lineWidth = (BODY_R + 6) * 2;
          ctx.lineCap = "round";
          const len = (sk.dist * 540) / TPS;
          line(ctx, u.x, u.y, u.x + u.cast.dx * len * k, u.y + u.cast.dy * len * k);
          ctx.lineCap = "butt";
        } else if (sk.shape === "nova" || sk.shape === "hex") {
          const r = sk.shape === "nova" ? sk.r + BODY_R : sk.range;
          ctx.globalAlpha = 0.14 + 0.2 * k;
          ctx.fillStyle = side === 1 ? "#ff6a5a" : col;
          ctx.beginPath();
          ctx.arc(u.x, u.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(u.x, u.y, r * k, 0, Math.PI * 2);
          ctx.stroke();
        } else if (sk.shape === "leap") {
          const o = a.units[side ? 0 : 1];
          ctx.globalAlpha = 0.2 + 0.4 * k;
          ctx.fillStyle = side === 1 ? "#ff6a5a" : col;
          ctx.beginPath();
          ctx.arc(o.x, o.y, sk.r + BODY_R, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 0.25 + 0.5 * k;
          ctx.strokeStyle = col;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(u.x, u.y, BODY_R + 14 - 8 * k, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // 회피 잔상
      ghosts.current = ghosts.current.filter((gh) => now - gh.t0 < 260);
      for (const gh of ghosts.current) {
        const im = spriteOf(gh.species, spriteTarget);
        if (!im) continue;
        ctx.globalAlpha = 0.42 * (1 - (now - gh.t0) / 260);
        ctx.save();
        ctx.translate(gh.x, gh.y);
        ctx.scale(gh.flip ? -1 : 1, 1);
        ctx.drawImage(im, -SPRITE / 2, -SPRITE, SPRITE, SPRITE);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // 먼지
      feel.current.dust = feel.current.dust.filter((p) => now - p.t0 < 420);
      ctx.fillStyle = "#ffffff";
      for (const p of feel.current.dust) {
        const k = (now - p.t0) / 420;
        ctx.globalAlpha = 0.34 * (1 - k);
        ctx.beginPath();
        ctx.arc(p.x + p.vx * k * 0.4, p.y + p.vy * k * 0.4, p.r * (0.6 + k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 생물
      const order = ([0, 1] as const).slice().sort((p, q) => a.units[p].y - a.units[q].y);
      for (const side of order) {
        const u = a.units[side];
        const f = activeOf(a.b, side);
        if (side === 1 && a.capture) continue;
        const x = u.px + (u.x - u.px) * alpha;
        const y = u.py + (u.y - u.py) * alpha;
        const down = f.mon.hp <= 0;
        const fade = down ? Math.max(0, 1 - (now - faintAt.current[side]) / 700) : 1;
        if (fade <= 0) continue;
        // 몸짓 — 프레임 사이 시간으로 부드럽게(틱이 아니라 화면 시간)
        const pz = poses.current[side];
        const dt = Math.min(0.05, Math.max(0, (now - lastDraw.current) / 1000));
        const vxNow = (u.x - u.px) * TPS;
        const vyNow = (u.y - u.py) * TPS;
        const spdNow = down ? 0 : Math.hypot(vxNow, vyNow);
        pz.spd += (spdNow - pz.spd) * Math.min(1, dt * 12);
        pz.vx += (vxNow - pz.vx) * Math.min(1, dt * 10);
        // 바라보는 쪽 — 한 프레임에 뒤집지 않고 몸을 돌린다(납작해졌다 펴진다)
        const faceTo = u.fx > 0.15 ? -1 : u.fx < -0.15 ? 1 : pz.face >= 0 ? 1 : -1;
        pz.face += (faceTo - pz.face) * Math.min(1, dt * (still ? 60 : 13));
        const faceK = Math.sign(pz.face || 1) * Math.max(0.18, Math.abs(pz.face));
        // 걸음 — 빠를수록 잦고 높게, 발이 땅에 닿는 순간 살짝 눌린다
        const moving = !still && !down && pz.spd > 30;
        if (moving) {
          const before = Math.floor(pz.phase / Math.PI);
          pz.phase += dt * (7 + pz.spd / 26);
          if (Math.floor(pz.phase / Math.PI) !== before && now - pz.lastStep > 90) {
            pz.lastStep = now;
            feel.current.dust.push({ x: x + (Math.random() - 0.5) * 18, y: y + 6, vx: -pz.vx * 0.12, vy: -16, t0: now, r: 5 + Math.random() * 5 });
          }
        }
        const stride = moving ? Math.min(1, pz.spd / 180) : 0;
        const hopS = Math.abs(Math.sin(pz.phase));
        const hop = moving ? hopS * (5 + 9 * stride) : 0;
        const landSquash = moving ? Math.pow(1 - hopS, 4) * 0.09 * (0.5 + stride) : 0;
        const runLean = still || down ? 0 : Math.max(-0.17, Math.min(0.17, pz.vx * 0.0011));
        // 휘청임 — 용수철(기울었다 되돌아오며 한두 번 출렁)
        pz.tiltV += (-130 * pz.tilt - 13 * pz.tiltV) * dt;
        pz.tilt += pz.tiltV * dt;
        if (still) pz.tilt = pz.tiltV = 0;
        const air = u.leap ? Math.sin((u.leap.t / u.leap.total) * Math.PI) * 130 : 0;
        const rising = u.leap ? (u.leap.t / u.leap.total < 0.5 ? 0.12 : -0.06) : 0;
        const lift = hop + air;
        // 그림자 · 발밑 고리 — 뜰수록 작고 옅게
        const shK = Math.max(0.45, 1 - lift / 220);
        ctx.globalAlpha = 0.28 * fade * shK;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(x, y + 6, BODY_R * 1.6 * shK, BODY_R * 0.6 * shK, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8 * fade;
        ctx.strokeStyle = side === 0 ? "#7ee0ff" : "#ff8a7a";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(x, y + 6, BODY_R * 1.7, BODY_R * 0.66, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (!down && (u.power > 0 || u.haste > 0)) {
          ctx.globalAlpha = 0.5 + Math.sin(now / 90) * 0.25;
          ctx.strokeStyle = u.power > 0 ? "#ffb13d" : "#ffe14a";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(x, y + 6, BODY_R * 2.05, BODY_R * 0.82, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (!down && (u.awake > 0 || u.enraged)) {
          const col = u.awake > 0 ? FX_PAL[SPECIES[f.mon.species].type][0] : "#ff5a48";
          ctx.globalCompositeOperation = "lighter";
          for (let ring = 0; ring < 3; ring++) {
            const k = still ? 0.4 : (now / 620 + ring / 3) % 1;
            ctx.globalAlpha = (u.awake > 0 ? 0.8 : 0.5) * (1 - k);
            ctx.strokeStyle = col;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(x, y + 4, BODY_R * (1.4 + k * 1.7), BODY_R * (0.55 + k * 0.7), 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        }
        const enter = u.enter > 0 ? 1 - u.enter / 18 : 1;
        // 들어올 때 — 작게 떨어져 통 튀며 커진다
        const enterK = Math.min(1, enter);
        const enterPop = enterK < 1 ? Math.sin(enterK * Math.PI) * 0.12 : 0;
        const sc = (0.55 + 0.45 * enterK + enterPop) * (down ? 0.92 : 1);
        // 대장은 몸집이 크게 보이고, 각성하면 더 커진다(맞는 판정은 그대로)
        const size = SPRITE * sc * (side === 1 && (a.b.boss || (a.b.tower != null && a.b.tower % 10 === 0)) ? 1.28 : 1) * (u.awake > 0 ? 1.16 : 1);
        const im = spriteOf(f.mon.species, Math.ceil(size * s * dpr));
        const fe = feel.current;
        // 맞으면 납작해졌다 튀어 오르고(찌그러짐), 기술을 내지르면 그쪽으로 한 번 쏠리며 길어진다
        const sqT = (now - fe.squash[side]) / 220;
        const sq = still || sqT >= 1 ? 0 : fe.squashAmt[side] * Math.cos(sqT * Math.PI * 1.5) * (1 - sqT);
        const kT = (now - fe.kick[side]) / 180;
        const kickK = still || kT >= 1 ? 0 : Math.sin(kT * Math.PI);
        const kx = fe.kickDir[side][0] * kickK * 16;
        const ky = fe.kickDir[side][1] * kickK * 16;
        const charge = u.cast && !still ? u.cast.t / Math.max(1, u.cast.total) : 0;
        // 모을 때 — 뒤로 움츠리며 떨린다
        const tremble = charge > 0.4 ? Math.sin(now / 22) * 1.6 * charge : 0;
        const backX = u.cast ? -u.cast.dx * 14 * charge + tremble : 0;
        const backY = u.cast ? -u.cast.dy * 14 * charge : 0;
        // 가만히 — 숨쉬기와 아주 작은 흔들림
        const idle = still || moving || down ? 0 : 1;
        const breath = Math.sin(now / 340 + side) * 0.024 * idle;
        const sway = Math.sin(now / 900 + side * 1.7) * 0.03 * idle;
        const sxk = 1 + sq + charge * 0.12 + landSquash - breath + kickK * 0.06 - rising * 0.5;
        const syk = 1 - sq * 0.8 + charge * 0.06 - landSquash + breath - kickK * 0.04 + rising;
        // 쓰러짐 — 맞은 쪽으로 넘어지며 가라앉는다
        const fallT = down ? Math.min(1, (now - faintAt.current[side]) / 420) : 0;
        const fallRot = down ? pz.fallDir * fallT * fallT * 1.25 : 0;
        const rot = runLean + sway + pz.tilt * 0.06 + fallRot;
        ctx.globalAlpha = fade * (u.iframe > 0 ? 0.5 : 1);
        if (im) {
          const put = () => {
            ctx.save();
            ctx.translate(x + kx + backX, y + ky + backY - lift + (down ? fallT * 14 : 0));
            if (rot) ctx.rotate(rot);
            ctx.scale(faceK * sxk, syk);
            ctx.drawImage(im, -size / 2, -size, size, size);
            ctx.restore();
          };
          put();
          const since = now - hitAt.current[side];
          if (since < 170) {
            ctx.globalAlpha = 0.9 * (1 - since / 170);
            ctx.globalCompositeOperation = "lighter";
            put();
            if (since < 60) put();
            ctx.globalCompositeOperation = "source-over";
          }
        } else {
          ctx.fillStyle = TYPE_COLOR[SPECIES[f.mon.species].type];
          ctx.beginPath();
          ctx.arc(x, y - BODY_R, BODY_R, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // 머리 위 체력 · 상태
        if (!down) {
          // 머리 위 체력바 — 화면에서 6px 보다 얇아지지 않게(배율 0.6 대에선 4px 이 안 됐다)
          const bw = 56;
          const bh = minFont(6, s, 6);
          const r = f.mon.hp / f.stats.hp;
          ctx.fillStyle = "rgba(0,0,0,.45)";
          rr(ctx, x - bw / 2, y - size * 1.06 - 4, bw, bh, bh / 2);
          ctx.fill();
          ctx.fillStyle = r > 0.5 ? "#3ccf6a" : r > 0.2 ? "#f2b833" : "#ef5a4c";
          rr(ctx, x - bw / 2, y - size * 1.06 - 4, bw * r, bh, bh / 2);
          ctx.fill();
          if (f.mon.status === "sleep" || u.stun > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = `700 ${Math.round(minFont(15, s))}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(f.mon.status === "sleep" ? "Zz" : "!?", x + 30, y - size * 0.93);
          }
          if (u.channel) {
            ctx.strokeStyle = "#ffe27a";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y - size * 0.5, BODY_R + 18, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * u.channel.t) / u.channel.total);
            ctx.stroke();
          }
        }
      }

      lastDraw.current = now;

      // 베기
      feel.current.slashes = feel.current.slashes.filter((v) => now - v.t0 < 200);
      ctx.globalCompositeOperation = "lighter";
      for (const v of feel.current.slashes) {
        const k = (now - v.t0) / 200;
        const from = v.ang - v.half;
        const to = from + 2 * v.half * Math.min(1, k * 2.2);
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, from, to);
        ctx.arc(v.x + Math.cos(v.ang) * 34, v.y + Math.sin(v.ang) * 34, v.r * 0.82, to, from, true);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = v.core;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, from, to);
        ctx.stroke();
      }
      // 광선
      ctx.lineCap = "round";
      for (const v of a.beams) {
        const pal = FX_PAL[moveOf(v.move).type];
        const k = v.t / Math.max(1, v.total);
        const thin = Math.min(1, k * 3);
        const wob = 1 + Math.sin(now / 16) * 0.16;
        const w0 = (v.r + 12) * 2;
        const x0 = v.x;
        const y0 = v.y - 40;
        const x1 = v.x + v.dx * v.len;
        const y1 = v.y - 40 + v.dy * v.len;
        ctx.globalAlpha = 0.45 * thin;
        ctx.strokeStyle = pal[1];
        ctx.lineWidth = w0 * 1.9 * wob * thin;
        line(ctx, x0, y0, x1, y1);
        ctx.globalAlpha = 0.95 * thin;
        ctx.lineWidth = w0 * wob * thin;
        line(ctx, x0, y0, x1, y1);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = w0 * 0.42 * thin;
        line(ctx, x0, y0, x1, y1);
      }
      ctx.lineCap = "butt";
      // 터짐 · 쏟아짐
      feel.current.bursts = feel.current.bursts.filter((v) => now - v.t0 < 340);
      for (const v of feel.current.bursts) {
        const k = (now - v.t0) / 340;
        if (v.nova) {
          ctx.globalAlpha = 0.5 * (1 - k);
          ctx.fillStyle = v.color;
          ctx.beginPath();
          ctx.arc(v.x, v.y - 20, v.r * Math.min(1, 0.3 + k * 1.6), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = v.core;
          ctx.lineWidth = 12 * (1 - k) + 2;
          ctx.beginPath();
          ctx.arc(v.x, v.y - 20, v.r * Math.min(1, 0.3 + k * 1.6), 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.ellipse(v.x, v.y, v.r * (0.5 + k * 0.7), v.r * (0.3 + k * 0.42), 0, 0, Math.PI * 2);
        ctx.fill();
        const height = (v.rain ? 520 : 220) * (1 - k * 0.3);
        const halfW = v.r * 0.42 * (1 - k);
        const g2 = ctx.createLinearGradient(0, v.y - height, 0, v.y);
        g2.addColorStop(0, "rgba(255,255,255,0)");
        g2.addColorStop(1, v.core);
        ctx.globalAlpha = 0.95 * (1 - k);
        ctx.fillStyle = g2;
        ctx.fillRect(v.x - halfW, v.y - height, halfW * 2, height);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      // 충격 고리
      feel.current.rings = feel.current.rings.filter((rg) => now - rg.t0 < 260);
      for (const rg of feel.current.rings) {
        const k = (now - rg.t0) / 260;
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = 7 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, 12 + rg.r * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 불꽃 줄기
      feel.current.sparks = feel.current.sparks.filter((p) => now - p.t0 < 240);
      ctx.lineCap = "round";
      for (const p of feel.current.sparks) {
        const k = (now - p.t0) / 240;
        const a0 = p.len * k;
        const a1 = p.len * Math.min(1, k + 0.32);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * (1 - k) + 1;
        line(ctx, p.x + p.dx * a0, p.y + p.dy * a0, p.x + p.dx * a1, p.y + p.dy * a1);
      }
      ctx.lineCap = "butt";
      ctx.globalAlpha = 1;

      // 탄
      for (const sh of a.shots) {
        const x = sh.px + (sh.x - sh.px) * alpha;
        const y = sh.py + (sh.y - sh.py) * alpha;
        const pal = FX_PAL[moveOf(sh.move).type];
        const shape = skillOf(sh.move).shape;
        const vy = y - 40; // 몸 높이로 날아간다
        const big = sh.r * 2.2;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let tail = 3; tail >= 1; tail--) {
          ctx.globalAlpha = 0.5 / tail;
          ctx.strokeStyle = pal[1];
          ctx.lineWidth = big * (1.1 - tail * 0.2);
          line(ctx, x - sh.dx * big * tail * 1.5, vy - sh.dy * big * tail * 1.5, x, vy);
        }
        ctx.lineCap = "butt";
        if (shape === "wave") {
          const ang = Math.atan2(sh.dy, sh.dx);
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = pal[1];
          ctx.lineWidth = 16;
          ctx.beginPath();
          ctx.arc(x - sh.dx * 34, vy - sh.dy * 34, sh.r * 1.5, ang - 1, ang + 1);
          ctx.stroke();
          ctx.strokeStyle = pal[0];
          ctx.lineWidth = 6;
          ctx.stroke();
        } else {
          const rg = ctx.createRadialGradient(x, vy, 0, x, vy, big);
          rg.addColorStop(0, "#ffffff");
          rg.addColorStop(0.35, pal[0]);
          rg.addColorStop(0.65, pal[1]);
          rg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(x, vy, big, 0, Math.PI * 2);
          ctx.fill();
          if (shape === "orb") {
            ctx.strokeStyle = pal[0];
            ctx.lineWidth = 4;
            ctx.setLineDash([12, 12]);
            ctx.lineDashOffset = -now / 12;
            ctx.beginPath();
            ctx.arc(x, vy, big * 1.15, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        ctx.globalCompositeOperation = "source-over";
        if (sh.side === 1) {
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = "#ff6a5a";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, vy, big * 0.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // 공 · 겨누기 고리
      if (a.bag && a.b.wild && !a.capture && activeOf(a.b, 1).mon.hp > 0) {
        const o = a.units[1];
        const aim = ringAim(a.tick);
        const rad = BODY_R * (2.6 - 1.8 * aim);
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = aim > 0.75 ? "#ffd84d" : aim > 0.4 ? "#9be37a" : "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(o.x, o.y - 52, rad * 1.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      const th = a.throwing;
      if (th) {
        const k = (th.t + alpha) / th.total;
        const x = th.x0 + (th.x1 - th.x0) * k;
        const y = th.y0 + (th.y1 - th.y0) * k - Math.sin(k * Math.PI) * 120 - 30;
        acorn(ctx, x, y, th.ball, k * 9);
      }
      if (a.capture) {
        const c0 = a.capture;
        let wob = 0;
        for (let n = 1; n <= c0.shakes; n++) {
          const d = c0.t - (14 + n * 20);
          if (d >= -6 && d <= 6) wob = Math.sin(((d + 6) / 12) * Math.PI * 2) * 0.5;
        }
        acorn(ctx, c0.x, c0.y - 12, c0.ball, wob);
        if (c0.t < 12) {
          ctx.globalAlpha = 1 - c0.t / 12;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(c0.x, c0.y - 30, BODY_R * 2 * (1 - c0.t / 12), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      drawMapTop(ctx, a, still ? 0 : now);

      // 숫자
      floats.current = floats.current.filter((fl) => now - fl.t0 < 900);
      ctx.textAlign = "center";
      for (const fl of floats.current) {
        const k = (now - fl.t0) / 900;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const pop = k < 0.12 ? 1.7 - (k / 0.12) * 0.7 : 1;
        // 좁은 폰은 배율이 0.6 대 — 화면에서 16px(큰 것 20px)보다 작아지지 않게 배율로 나눈다
        ctx.font = `900 ${Math.round(minFont(fl.big ? 30 : 21, s, fl.big ? 20 : 16) * pop)}px sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(20,10,30,.8)";
        const y = fl.y - 50 - k * 40;
        ctx.strokeText(fl.text, fl.x, y);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, fl.x, y);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 화면 밖 상대 — 가장자리에 화살표
      if (activeOf(a.b, 1).mon.hp > 0 && !a.capture) {
        const px = ox + op.x * s;
        const py = oy + (op.y - 40) * s;
        if (px < 0 || px > w || py < 0 || py > h) {
          const cx = Math.min(w - 22, Math.max(22, px));
          const cy = Math.min(h - 22, Math.max(22, py));
          const ang = Math.atan2(py - h / 2, px - w / 2);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(ang);
          ctx.fillStyle = "#ff6a5a";
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-8, -10);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      const fe2 = feel.current;
      ctx.textAlign = "center";
      if (!still && now - fe2.hurtAt < 300) {
        const k = 1 - (now - fe2.hurtAt) / 300;
        const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
        vg.addColorStop(0, "rgba(255,40,30,0)");
        vg.addColorStop(1, `rgba(255,40,30,${0.55 * k})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }
      const label = (text: string, y: number, size: number, color: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.font = `900 ${Math.round(size)}px sans-serif`;
        ctx.lineJoin = "round";
        ctx.lineWidth = size * 0.2;
        ctx.strokeStyle = "rgba(20,10,30,.85)";
        ctx.strokeText(text, w / 2, y);
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, y);
        ctx.globalAlpha = 1;
      };
      const since0 = now - fe2.startAt;
      if (since0 < (a.b.boss ? 1300 : 900)) {
        const fadeAt = a.b.boss ? 1000 : 620;
        label(a.b.boss ? "대장전!" : "전투 시작!", top + room * 0.42, 46 * (since0 < 140 ? 1.5 - (since0 / 140) * 0.5 : 1), a.b.boss ? "#ff9a8a" : "#ffe27a", since0 > fadeAt ? 1 - (since0 - fadeAt) / 300 : 1);
        if (a.b.boss) label(a.b.sides[1].name, top + room * 0.42 + 42, 22, "#ffffff", since0 > fadeAt ? 1 - (since0 - fadeAt) / 300 : 1);
      }
      if (fe2.combo >= 2 && now - fe2.comboAt < 1500) {
        const t = now - fe2.comboAt;
        ctx.textAlign = "right";
        ctx.globalAlpha = t > 1100 ? 1 - (t - 1100) / 400 : 1;
        ctx.font = `900 ${Math.round(38 * (t < 110 ? 1.45 - (t / 110) * 0.45 : 1))}px sans-serif`;
        ctx.lineWidth = 7;
        ctx.strokeStyle = "rgba(20,10,30,.85)";
        ctx.strokeText(`${fe2.combo} 연타`, w - 14, top + 54);
        ctx.fillStyle = fe2.combo >= 5 ? "#ffb13d" : "#ffffff";
        ctx.fillText(`${fe2.combo} 연타`, w - 14, top + 54);
        ctx.globalAlpha = 1;
        ctx.textAlign = "center";
      }
      if (fe2.ult) {
        const t = now - fe2.ult.t0;
        if (t > 720) fe2.ult = null;
        else {
          const fade = t < 90 ? t / 90 : t > 520 ? 1 - (t - 520) / 200 : 1;
          ctx.globalAlpha = 0.34 * fade;
          ctx.fillStyle = "#07040f";
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 0.85 * fade;
          ctx.fillStyle = fe2.ult.color;
          const bandY = top + room * 0.2;
          ctx.fillRect(-20 + (1 - Math.min(1, t / 110)) * -w, bandY - 34, w + 40, 58);
          ctx.globalAlpha = 1;
          label(fe2.ult.name, bandY + 8, 34, "#ffffff", fade);
        }
      }
      if (fe2.endText) {
        const t = now - fe2.endAt;
        label(fe2.endText, top + room * 0.42, 72 * (t < 180 ? 1.7 - (t / 180) * 0.7 : 1), fe2.endText === "패배…" ? "#b9c3d6" : "#ffe27a", Math.min(1, t / 120));
      }
      const fl = now - flash.current;
      if (fl < 140) {
        ctx.globalAlpha = 0.55 * (1 - fl / 140);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    };

    let raf = 0;
    let stopped = false;
    let last = performance.now();
    let acc = 0;
    let n = 0;
    let drawAcc = 0;
    let frozenAt = 0;
    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const ms = now - last;
      const dt = Math.min(0.1, ms / 1000);
      last = now;
      // 히트스톱 — 세게 맞는 순간 판이 잠깐 멈칫한다(틱 기준이라 대전 판정과 무관)
      if (document.visibilityState === "visible" && now >= feel.current.stopUntil && !paused.current) acc += dt;
      while (acc >= 1 / TPS) {
        acc -= 1 / TPS;
        tick();
        if (++n % 3 === 0) setHud(hudOf(a));
      }
      // 배터리 — 120Hz 화면에서도 초당 60장. 멈춘 화면(일시정지 · 안내 · 다음 생물 고르기 · 끝난 뒤)은 연출이 끝나면 그리지 않는다
      const gate = frameGate(drawAcc, ms);
      drawAcc = gate.acc;
      const frozen = paused.current || a.b.needSwap || (ended.current && now - feel.current.endAt > 1400);
      if (!frozen) frozenAt = 0;
      else if (!frozenAt) frozenAt = now;
      if (frozen && !frozenDraw(now - frozenAt, dirty)) return;
      if (!gate.draw && !dirty) return;
      dirty = false;
      draw(Math.min(1, acc * TPS), now);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      if (!keepFull) exitBattleFullscreen();
      cancelAnimationFrame(raf);
      ro.disconnect();
      fx.destroy();
      fxRef.current = null;
      // 큰 캔버스 두 장을 바로 돌려준다 — iOS 는 크기를 0 으로 해야 메모리를 놓는다
      c.width = c.height = 0;
      fc.width = fc.height = 0;
      if (bg) bg.width = bg.height = 0;
    };
    // 판 하나에 한 번만 — 판이 바뀌면 부모가 key 로 새로 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 키보드
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key;
      if (k.startsWith("Arrow")) {
        input.current.keys.add(k);
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      const up = k.toUpperCase();
      const skill = KEYS.indexOf(up);
      if (skill >= 0) queue({ dir: 0, skill });
      else if (k === " ") {
        e.preventDefault();
        queue({ dir: 0, dodge: true }, 3);
      } else if (/^[1-6]$/.test(k)) queue({ dir: 0, swap: Number(k) - 1 }, 2);
      else if (up === "F") queue({ dir: 0, awaken: true }, 8);
      else if (k === "Escape" && !online && !hudRef.current.needSwap) setPausedView((v) => (v ? null : "pause"));
      else if (up === "B" && !online) queue({ dir: 0, ball }, 2);
      else if (up === "X" && !online) queue({ dir: 0, run: true }, 2);
    };
    const upH = (e: KeyboardEvent) => input.current.keys.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", upH);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", upH);
    };
  }, [ball, online]);

  // 앱을 내리면(홈 · 다른 앱 · 화면 잠금) 멈춤 창을 연다 — 돌아왔을 때 판이 바로 이어지지 않게(2026-11-09).
  // 대전은 멈출 수 없고, 다음 생물을 고르는 중엔 고르기 창이 먼저다(위 needSwap 규칙과 같다)
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== "hidden" || online || ended.current) return;
      if (hudRef.current.needSwap || hudRef.current.over) return;
      input.current.held = null;
      setPausedView((v) => v ?? "pause");
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [online]);

  // 아이폰 사파리 탭이면 첫 전투에 한 번 — 요소 전체 화면이 없어 '홈 화면에 추가'해야 꽉 찬다
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    let seen = true;
    try {
      seen = !!localStorage.getItem(A2HS_KEY);
    } catch {
      /* 막힌 저장소 — 띄우지 않는다 */
    }
    if (wantsA2hsTip({ ua: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints, standalone: nav.standalone, seen }) && onceFlag(A2HS_KEY)) {
      const t = window.setTimeout(() => toast("공유 → '홈 화면에 추가'로 열면 전투가 화면 전체를 써요", 5200), 1600);
      return () => window.clearTimeout(t);
    }
  }, []);

  // 뒤로 가기 — 일시정지. 다음 생물을 고르는 중엔 멈추지 않는다 —
  // 멈춤 창이 고르기 창 밑에 깔려 누를 수 없었고, 멈춘 동안엔 틱이 안 돌아 고르기도 안 먹었다
  // 대전은 아무것도 안 하고 알려만 준다(2026-11-09) — 예전엔 기권 확인창이 판을 가린 채 판은 계속 돌았다. 기권은 기권 버튼으로
  useBackClose(() => {
    if (online) toast("기권은 기권 버튼으로");
    else if (!hudRef.current.needSwap) setPausedView((v) => (v ? null : "pause"));
    return false;
  }, !hud.over);

  /** 기술 칸 누름 — 바로 한 번 넣고, 누르고 있으면 tick 이 재사용 대기가 끝날 때마다 다시 넣는다(holdRepeat) */
  function pressSkill(i: number) {
    input.current.held = i;
    if ((hudRef.current.moves[i]?.cd ?? 0) > 0) setNope((p) => ({ slot: i, n: (p?.n ?? 0) + 1 }));
    queue({ dir: 0, skill: i });
  }
  function releaseSkill(i: number) {
    if (input.current.held === i) input.current.held = null;
  }

  async function forfeit() {
    if (!online || ended.current) return;
    if (!(await confirmDialog({ message: "기권할까요? 진 것으로 기록돼요.", confirmText: "기권", danger: true }))) return;
    // 확인창을 띄운 사이 판이 끝났을 수 있다(판은 멈추지 않는다) — 끝난 판을 또 기권으로 닫지 않는다
    if (ended.current) return;
    ended.current = true;
    setSending("기권하는 중…");
    try {
      await online.forfeit();
    } catch (e) {
      toast(online.errorText(e));
    }
    setSending(null);
    const a = arenaRef.current!;
    a.b.over = "lose";
    onEndRef.current(a.b, startBag);
  }

  async function giveUp() {
    if (ended.current) return;
    if (!(await confirmDialog({ message: "이 승부를 포기할까요? 진 것으로 쳐요.", confirmText: "포기", danger: true }))) return;
    ended.current = true;
    const ar = arenaRef.current!;
    ar.b.over = "lose";
    // 지금 가방 — 판 도중 쓴 약은 돌려주지 않는다(시작 가방을 넘기면 쓴 약이 되살아났다)
    onEndRef.current(ar.b, ar.bag ?? startBag);
  }

  const a = arenaRef.current!;
  const foeType = SPECIES[hud.foe.species].type;

  return createPortal(
    <div ref={rootRef} className="adv-rt fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="전투" style={{ background: shade(stage.ground, -0.62) }}>
      <GameWindowGuard />
      <div ref={stageRef} className="adv-rt-stage">
        <canvas ref={canvasRef} className="adv-rt-canvas" aria-hidden />
        <canvas ref={fxCanvasRef} className="adv-rt-canvas" aria-hidden />
      </div>

      <div ref={topRef} className="adv-rt-top">
        <HpCard m={hud.foe} extra={!a.b.wild ? `${hud.foeLeft}/${hud.foeTotal}` : undefined} foe boss={hud.boss} />
        <HpCard m={hud.me} xp />
      </div>
      <div className="adv-rt-toasts" aria-live="polite">
        {toasts.map((t) => <p key={t.id}>{t.text}</p>)}
      </div>
      {hud.channel && <p className="adv-rt-channel">{hud.channel} — 맞으면 끊겨요</p>}
      {sending && <p className="adv-rt-sending">{sending}</p>}

      <div ref={ctlRef} className="adv-rt-ctl">
        <div ref={rowRef} className="adv-rt-row">
          {/* 팀 · 공 · 가방은 손가락이 닿는 순간(pressProps) — 막대를 쥔 채 두 번째 손가락으로 누르면 click 이 자주 안 왔다(2026-11-09).
              팀 칸은 옆으로 넘기지 않는다(얼굴이 줄어든다) — 넘기기 판정이 누름을 삼켰다 */}
          <div className="adv-rt-team" style={{ flexBasis: `${Math.max(138, hud.team.length * 36 + (hud.team.length - 1) * 6)}px` }}>
            {hud.team.map((t, i) => (
              <button
                key={i}
                type="button"
                className={`tap adv-rt-chip ${t.active ? "is-on" : ""}`}
                disabled={t.active || t.hp <= 0 || hud.swap > 0 || !!hud.over}
                {...pressProps(() => queue({ dir: 0, swap: i }, 2))}
                aria-label={`${SPECIES[t.species].name}로 교체`}
              >
                <MonArt species={t.species} size={30} mode={t.hp <= 0 ? "faded" : "full"} />
                <span className="adv-rt-chip-hp"><span style={{ width: `${(t.hp / t.max) * 100}%` }} /></span>
                {!t.active && hud.swap > 0 && t.hp > 0 && <em>{Math.ceil(hud.swap / TPS)}</em>}
              </button>
            ))}
          </div>
          {/* 도구는 공 · 가방 · 멈춤 셋 — 공 종류 · 약 · 도망은 가방 안에(320px 폭에서도 팀 얼굴이 셋 보이게) */}
          <div className="adv-rt-tools">
            {hud.bag && a.b.wild && (
              // 고리가 작을 때 '지금!' — 캔버스 고리와 같은 ringAim, 확률도 그 고리 값으로(예전엔 늘 가장 작은 고리 값이라 실제보다 높게 보였다)
              <button type="button" className={`tap adv-rt-tool adv-rt-ball ${ringNow(hud.aim) && hud.bag.balls[ball] > 0 ? "is-now" : ""}`} disabled={hud.bag.balls[ball] <= 0 || !!hud.over} {...pressProps(() => queue({ dir: 0, ball }, 2))} aria-label={`${BALLS[ball].name} 던지기`}>
                <BallIcon k={ball} size={20} />
                <span><b>×{hud.bag.balls[ball]}</b><small>{ringNow(hud.aim) ? "지금!" : `${Math.round(catchChance(activeOf(a.b, 1), ball, hud.aim) * 100)}%`}</small></span>
              </button>
            )}
            {hud.bag && (
              <div className="relative">
                <button type="button" className="tap adv-rt-tool" {...pressProps(() => setItemsOpen((o) => !o))} aria-expanded={itemsOpen} aria-label={a.b.wild ? "가방 — 공 고르기 · 약 · 도망" : "가방 — 약"}>가방</button>
                {itemsOpen && (
                  <div className="adv-rt-pop">
                    {a.b.wild && (["basic", "great", "star"] as BallKey[]).map((k) => (
                      <button key={k} type="button" className={`tap ${ball === k ? "is-on" : ""}`} aria-pressed={ball === k} {...pressProps(() => { setBall(k); setItemsOpen(false); })}>
                        <span><BallIcon k={k} size={16} /> {BALLS[k].name}</span> <b>×{hud.bag!.balls[k]}</b>
                      </button>
                    ))}
                    {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
                      <button key={k} type="button" className="tap" disabled={hud.bag!.items[k] <= 0 || !!hud.over} {...pressProps(() => { queue({ dir: 0, item: k }, 2); setItemsOpen(false); })}>
                        {ITEMS[k].name} <b>×{hud.bag!.items[k]}</b>
                      </button>
                    ))}
                    {a.b.wild && <button type="button" className="tap" disabled={!!hud.over} {...pressProps(() => { queue({ dir: 0, run: true }, 2); setItemsOpen(false); })}>도망치기 <b>X</b></button>}
                  </div>
                )}
              </div>
            )}
            {online && <button type="button" className="tap adv-rt-tool" onClick={() => void forfeit()} disabled={!!hud.over}>기권</button>}
            {!online && <button type="button" className="tap adv-rt-tool adv-rt-tool-sm" onClick={() => setPausedView("pause")} disabled={!!hud.over || hud.needSwap} aria-label="일시정지">Ⅱ</button>}
          </div>
        </div>

        <div className="adv-rt-pad">
          <Stick onDir={(d) => (input.current.stick = d)} />
          <div className="adv-rt-skills">
            {hud.moves.map((m, i) => {
              const mv = MOVES[m.id];
              const eff = mv.power > 0 ? effectiveness(mv.type, foeType) : 1;
              const sk = skillOf(m.id);
              const p = m.max ? m.cd / m.max : 0;
              // 상성은 테두리 색 + 모서리 딱지(2026-11-09) — 줄 끝 글자였을 땐 320px 에서 말줄임에 잘려 안 보였다
              const effCls = eff > 1 ? "is-good" : eff < 1 ? "is-bad" : "";
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`adv-rt-skill ${effCls} ${nope?.slot === i ? `is-nope${nope.n % 2}` : ""}`}
                  style={{ ["--c" as string]: TYPE_COLOR[mv.type], ["--p" as string]: `${p * 360}deg` }}
                  disabled={!!hud.over}
                  {...holdProps(() => pressSkill(i), () => releaseSkill(i))}
                  aria-label={`${mv.name} (${KEYS[i]})${eff > 1 ? " — 효과 굉장" : eff < 1 ? " — 효과 별로" : ""}`}
                  title={`${mv.note} · ${moveTags(mv).join(" · ")}`}
                >
                  <span className="adv-rt-skill-name">{mv.name}</span>
                  <span className="adv-rt-skill-meta">{SHAPE_LABEL[sk.shape]}{mv.power ? ` · ${mv.power}` : ""}</span>
                  {effCls && <i className={`adv-rt-eff ${effCls}`} aria-hidden>{eff > 1 ? "굉장" : "별로"}</i>}
                  <kbd>{KEYS[i]}</kbd>
                  {m.cd > 0 && <span className="adv-rt-cd"><b>{(m.cd / TPS).toFixed(1)}</b></span>}
                </button>
              );
            })}
            {!online && <button
              type="button"
              className={`adv-rt-awake ${hud.charge >= CHARGE_MAX ? "is-full" : ""} ${hud.awake > 0 ? "is-on" : ""}`}
              style={{ ["--p" as string]: `${hud.awake > 0 ? (hud.awake / AWAKE_TICKS) * 360 : (hud.charge / CHARGE_MAX) * 360}deg` }}
              disabled={!!hud.over || hud.charge < CHARGE_MAX}
              {...pressProps(() => queue({ dir: 0, awaken: true }, 8))}
              aria-label={`각성 (F) — 게이지 ${Math.floor(hud.charge)}%`}
            >
              <span>각성</span>
            </button>}
            <button
              type="button"
              className="adv-rt-dodge"
              style={{ ["--p" as string]: `${(hud.dodge / (1.1 * TPS)) * 360}deg`, gridRow: online ? "1 / span 2" : undefined }}
              disabled={!!hud.over}
              {...pressProps(() => queue({ dir: 0, dodge: true }, 3))}
              aria-label="회피 (스페이스)"
            >
              회피
              {hud.dodge > 0 && <span className="adv-rt-cd" />}
            </button>
          </div>
        </div>
      </div>

      {pausedView && !hud.over && !hud.needSwap && (
        <div className="adv-rt-modal" role="dialog" aria-label={pausedView === "coach" ? "조작 안내" : "일시정지"}>
          <div className="adv-card w-full max-w-sm">
            <p className="adv-h">{pausedView === "coach" ? "전투는 이렇게 해요" : "잠깐 멈췄어요"}</p>
            <ul className="adv-coach">
              <li><b>왼쪽 아래</b> 아무 데나 누르고 끌면 움직여요 — 붉은 원과 조준선을 피해요</li>
              <li><b>기술 4칸</b> 누르면 가장 가까운 상대에게 나가요. 누르고 있으면 기다렸다 다시 나가요</li>
              <li><b>회피</b> 잠깐 무적이에요. 큰 기술은 이걸로 피해요</li>
              <li><b>각성</b> 때리거나 맞으면 차요. 가득 차면 8초간 강해져요</li>
              {a.b.wild && <li><b>공</b> 체력이 낮을 때, 고리가 작을 때 던지면 잘 잡혀요</li>}
              <li><b>아래 얼굴</b> 눌러서 교체해요. 상성이 좋은 친구로 바꿔요</li>
            </ul>
            <div className="mt-3 flex gap-2">
              {pausedView === "pause" && a.b.wild && <button type="button" className="tap adv-btn flex-1" onClick={() => { setPausedView(null); queue({ dir: 0, run: true }, 2); }}>도망치기</button>}
              {pausedView === "pause" && !a.b.wild && <button type="button" className="tap adv-btn flex-1" onClick={() => { setPausedView(null); void giveUp(); }}>포기</button>}
              <button type="button" className="tap adv-btn adv-btn-main flex-1" onClick={() => setPausedView(null)}>{pausedView === "coach" ? "시작하기" : "계속하기"}</button>
            </div>
          </div>
        </div>
      )}

      {hud.needSwap && !hud.over && (
        <div className="adv-rt-modal" role="dialog" aria-label="다음 생물 고르기">
          <div className="adv-card w-full max-w-sm">
            <p className="adv-h">다음으로 누구를 내보낼까?</p>
            <div className="mt-2 grid gap-1.5">
              {a.b.sides[0].team.map((f, i) => (
                <button key={f.mon.id} type="button" disabled={f.mon.hp <= 0} className="tap adv-swap" {...pressProps(() => queue({ dir: 0, swap: i }, 2))}>
                  <MonArt species={f.mon.species} size={40} />
                  <span className="min-w-0 flex-1 text-left">
                    <b>{SPECIES[f.mon.species].name}</b> <small>Lv.{f.mon.level}</small>
                    <HpBar hp={f.mon.hp} max={f.stats.hp} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/* eslint-enable react-hooks/refs */

/** 떠 있는 막대(2026-11-09) — 왼쪽 아래 칸(.adv-rt-stickzone) 어디를 눌러도 누른 자리가 가운데가 되고, 막대 그림도 거기 뜬다.
 *  예전 막대는 108px 고정 원이라 엄지가 원 밖에 닿으면 안 먹었고, 가운데가 원의 가운데라(주석과 달리) 누르는 순간 한쪽으로 튀었다.
 *  다른 버튼(팀 · 공 · 기술 · 조사)은 칸 위에 얹혀 있어(z-index) 그 버튼이 먼저 받는다. 8방향 · dead zone 은 dirOf 그대로, 화살표 키는 따로 간다.
 *  제자리 그림(.adv-rt-stick)은 어디를 누르면 되는지 보여 주는 자리표시일 뿐 손가락을 받지 않는다 */
export function Stick({ onDir }: { onDir: (d: number) => void }) {
  const [at, setAt] = useState<{ ox: number; oy: number; kx: number; ky: number } | null>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const move = (e: React.PointerEvent) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    const v = stickVec(o.x, o.y, e.clientX, e.clientY);
    setAt({ ox: o.x, oy: o.y, kx: v.kx, ky: v.ky });
    onDir(v.dir);
  };
  const end = (e: React.PointerEvent) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    setAt(null);
    onDir(0);
  };
  return (
    <>
      <div className={`adv-rt-stick ${at ? "is-away" : ""}`} aria-hidden>
        <span className="adv-rt-knob" />
      </div>
      <div
        className="adv-rt-stickzone"
        onPointerDown={(e) => {
          if (origin.current) return; // 두 번째 손가락은 막대를 옮기지 않는다
          e.preventDefault();
          origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          setAt({ ox: e.clientX, oy: e.clientY, kx: 0, ky: 0 });
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* 이미 떨어진 손가락 — 잡지 못해도 막대는 그 자리에서 시작한다 */
          }
          onDir(0);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        role="application"
        aria-label="이동 막대 — 왼쪽 아래 아무 데나 눌러 끌어요 (화살표 키)"
      />
      {at && (
        <div className="adv-rt-stickfloat" style={{ left: at.ox, top: at.oy }} aria-hidden>
          <span className="adv-rt-knob" style={{ transform: `translate(${at.kx}px, ${at.ky}px)` }} />
        </div>
      )}
    </>
  );
}

/** 대장이면 위에 이름 띠 · 분노 표시, 체력 절반에 눈금(그 밑이면 분노한다), 아래에 다음 패턴까지 남은 초 — 예고 원이 뜨기 전에 미리 비켜 설 수 있게 */
function HpCard({ m, xp, extra, foe, boss }: { m: Mini; xp?: boolean; extra?: string; foe?: boolean; boss?: Hud["boss"] }) {
  const sp = SPECIES[m.species];
  return (
    <div className={`adv-rt-card ${foe ? "is-foe" : "is-me"} ${boss ? "is-boss" : ""} ${boss?.enraged ? "is-enraged" : ""}`}>
      {boss && (
        <div className="adv-rt-boss">
          <b className="min-w-0 flex-1 truncate">👑 {boss.name}</b>
          {boss.enraged && <i>분노</i>}
        </div>
      )}
      <div className="adv-rt-card-head">
        <i className="adv-type" style={{ background: TYPE_COLOR[sp.type] }}>{sp.type}</i>
        <b className="min-w-0 flex-1 truncate">{sp.name}</b>
        {m.status && <i className={`adv-status adv-status-${m.status}`}>{STATUS_LABEL[m.status]}</i>}
        <span className="shrink-0">Lv.{m.level}{extra ? ` · ${extra}` : ""}</span>
      </div>
      <span className="relative block">
        <HpBar hp={m.hp} max={m.max} />
        {boss && !boss.enraged && <u className="adv-rt-tick" aria-hidden />}
      </span>
      {boss && <p className={`adv-rt-sig ${boss.left <= 2 ? "is-soon" : ""}`}>다음 패턴 · {boss.next} {boss.left > 0 ? `${boss.left}초` : "지금!"}</p>}
      {xp && <XpBar level={m.level} xp={m.xp} />}
    </div>
  );
}

/** 땅 · 테두리 — 판 동안 안 변해서 한 번 굽는다(아래 bake). 질감은 lib/groundpaint */
function drawGround(ctx: CanvasRenderingContext2D, ground: string, key: string) {
  ctx.save();
  rr(ctx, 0, 0, ARENA_W, ARENA_H, 26);
  ctx.clip();
  paintGround(ctx, key, ARENA_W, ARENA_H, ground, { arena: true });
  ctx.restore();
  // 필드 테두리 — 두 겹(어두운 바깥 · 밝은 안쪽 결)
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = shade(ground, -0.55);
  ctx.lineWidth = 10;
  rr(ctx, 0, 0, ARENA_W, ARENA_H, 26);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = shade(ground, 0.4);
  ctx.lineWidth = 2;
  rr(ctx, 6, 6, ARENA_W - 12, ARENA_H - 12, 21);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, Math.max(0, w), h, Math.min(r, Math.max(0, w) / 2, h / 2));
}
function line(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}
/** 도토리 공(캔버스) — BallIcon 과 같은 모양 */
function acorn(c: CanvasRenderingContext2D, x: number, y: number, k: BallKey, tilt: number) {
  const body = k === "basic" ? "#6cbf4a" : k === "great" ? "#3f8fd8" : "#8a5ad8";
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.fillStyle = body;
  c.beginPath();
  c.ellipse(0, 3, 9, 10, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = "#a8743f";
  c.beginPath();
  c.ellipse(0, 3, 10, 8, 0, Math.PI, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#6b4a2b";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -5);
  c.lineTo(0, -10);
  c.stroke();
  c.restore();
}

const ROCK_PAL: Record<string, [string, string, string]> = {
  meadow: ["#4a9a54", "#2c6b38", "#7cc97e"], hill: ["#a39a86", "#6f6754", "#d3cab6"], lake: ["#8c9aa0", "#5f6d73", "#bcc9ce"], swamp: ["#6a6a48", "#44442c", "#94946a"],
  cave: ["#7b7194", "#4b4366", "#ada3c6"], plateau: ["#bfe6f5", "#7fb6d2", "#f0fbff"], temple: ["#bfb4e6", "#7a6db0", "#f1ecff"],
};
const PICK_LOOK = { heal: ["#7dff9a", "♥"], power: ["#ffb13d", "力"], haste: ["#ffe14a", "»"] } as const;

/** 지역마다 다른 장애물 — 덤불 · 돌 · 종유석 · 얼음 결정 · 돌기둥 */
export function drawRock(ctx: CanvasRenderingContext2D, r: Pick<Rock, "x" | "y" | "r">, key: string, pal: [string, string, string]) {
  const R = r.r;
  if (key === "meadow") {
    const parts: [number, number, number, string][] = [[-0.55, -0.15, 0.62, pal[1]], [0.55, -0.15, 0.62, pal[1]], [0, -0.6, 0.72, pal[0]], [-0.35, -0.55, 0.42, pal[2]], [0.35, -0.8, 0.28, pal[2]]];
    for (const [dx, dy, q, c] of parts) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(r.x + dx * R, r.y + dy * R, q * R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd9e8";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(r.x + Math.sin(i * 2.4) * R * 0.7, r.y - R * 0.45 + Math.cos(i * 1.7) * R * 0.4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (key === "cave" || key === "plateau") {
    const spires: [number, number, number][] = [[-0.62, 0.62, 1.15], [0.6, 0.55, 1.0], [0, 0.78, 1.9]];
    for (const [dx, w, h] of spires) {
      const cx = r.x + dx * R;
      const top = r.y - h * R;
      const g = ctx.createLinearGradient(cx - w * R, 0, cx + w * R, 0);
      g.addColorStop(0, pal[2]);
      g.addColorStop(0.5, pal[0]);
      g.addColorStop(1, pal[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - w * R, r.y + R * 0.25);
      ctx.lineTo(cx - w * R * 0.18, top + R * 0.12);
      ctx.lineTo(cx, top);
      ctx.lineTo(cx + w * R * 0.2, top + R * 0.2);
      ctx.lineTo(cx + w * R, r.y + R * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal[1];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (key === "temple") {
    const w = R * 0.62;
    const h = R * 2.1;
    const g = ctx.createLinearGradient(r.x - w, 0, r.x + w, 0);
    g.addColorStop(0, pal[1]);
    g.addColorStop(0.35, pal[2]);
    g.addColorStop(1, pal[1]);
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + R * 0.2, R, R * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(r.x - w, r.y + R * 0.15);
    ctx.lineTo(r.x - w, r.y - h + R * 0.25);
    ctx.lineTo(r.x - w * 0.2, r.y - h);
    ctx.lineTo(r.x + w * 0.45, r.y - h + R * 0.38);
    ctx.lineTo(r.x + w, r.y - h + R * 0.12);
    ctx.lineTo(r.x + w, r.y + R * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal[1];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    for (let i = -1; i <= 1; i++) line(ctx, r.x + i * w * 0.5, r.y - h + R * 0.55, r.x + i * w * 0.5, r.y + R * 0.05);
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const q = R * (0.86 + Math.sin(r.x * 0.7 + i * 2.3) * 0.16);
      const X0 = r.x + Math.cos(ang) * q;
      const Y0 = r.y - R * 0.3 + Math.sin(ang) * q * 0.82;
      if (i) ctx.lineTo(X0, Y0);
      else ctx.moveTo(X0, Y0);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, r.y - R * 1.2, 0, r.y + R * 0.5);
    g.addColorStop(0, pal[2]);
    g.addColorStop(0.5, pal[0]);
    g.addColorStop(1, pal[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = pal[1];
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    line(ctx, r.x - R * 0.35, r.y - R * 0.65, r.x + R * 0.1, r.y - R * 0.1);
    line(ctx, r.x + R * 0.1, r.y - R * 0.1, r.x + R * 0.45, r.y - R * 0.3);
    ctx.globalAlpha = 1;
  }
}

/** 바위 — 판 동안 안 움직인다(구운 바닥에 같이 넣는다). 깊이 순서로 한 번 정렬 */
function drawRocks(ctx: CanvasRenderingContext2D, a: Arena) {
  const pal = ROCK_PAL[a.map.key];
  for (const r of [...a.map.rocks].sort((p, q) => p.y - q.y)) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + r.r * 0.4, r.r * 1.1, r.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawRock(ctx, r, a.map.key, pal);
  }
}

/** 맵 기믹 — 웅덩이 · 낙하 경고 · 줍는 것(바위는 구운 바닥에 있다 · 굽지 못했을 때만 rocks) */
function drawMap(ctx: CanvasRenderingContext2D, a: Arena, t: number, rocks: boolean) {
  for (const p of a.map.patches) {
    const col = { water: "#4aa8ff", poison: "#8a4fb0", ice: "#d9f2ff", bloom: "#ffb7d5", altar: "#ffd36b" }[p.kind];
    ctx.globalAlpha = p.kind === "ice" ? 0.72 : 0.46;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r, p.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = shade(col, 0.25);
    ctx.lineWidth = 3;
    ctx.stroke();
    if (p.kind === "water" || p.kind === "poison") {
      for (let i = 0; i < 3; i++) {
        const k = ((t / 1400 + i / 3) % 1 + 1) % 1;
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.beginPath();
        if (p.kind === "water") ctx.ellipse(p.x + (i - 1) * p.r * 0.4, p.y + (i % 2) * 14, p.r * 0.5 * k, p.r * 0.3 * k, 0, 0, Math.PI * 2);
        else ctx.arc(p.x + (i - 1) * p.r * 0.5, p.y - k * 26, 5 + k * 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (p.kind === "ice") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) line(ctx, p.x + i * p.r * 0.5 - 18, p.y + 12 - i * 8, p.x + i * p.r * 0.5 + 18, p.y - 12 - i * 8);
    } else if (p.kind === "bloom") {
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        const fx0 = p.x + Math.cos(ang) * p.r * 0.62;
        const fy0 = p.y + Math.sin(ang) * p.r * 0.42;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = i % 2 ? "#ff8fbe" : "#ffe08a";
        ctx.beginPath();
        ctx.arc(fx0, fy0 - Math.abs(Math.sin(t / 500 + i)) * 3, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff1b8";
      ctx.globalAlpha = 0.6 + Math.sin(t / 240) * 0.3;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const ang = t / 900 + (i * 2 * Math.PI * 2) / 5;
        const X0 = p.x + Math.cos(ang) * p.r * 0.72;
        const Y0 = p.y + Math.sin(ang) * p.r * 0.5;
        if (i) ctx.lineTo(X0, Y0);
        else ctx.moveTo(X0, Y0);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const pal = ROCK_PAL[a.map.key];
  if (rocks) drawRocks(ctx, a);
  for (const h of a.hazards) {
    const k = 1 - h.t / Math.max(1, h.total);
    ctx.globalAlpha = 0.18 + 0.28 * k;
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "#ffd0c8";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * (1 - k), 0, Math.PI * 2);
    ctx.stroke();
    const dy = (1 - k * k) * 520;
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(h.x - 8, h.y - dy - 8, 2, h.x, h.y - dy, h.r * 0.55);
    g.addColorStop(0, pal[2]);
    g.addColorStop(1, pal[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y - dy, h.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "center";
  for (const p of a.picks) {
    const [col, mark] = PICK_LOOK[p.kind];
    const by = p.y - 26 + Math.sin(t / 240) * 6;
    ctx.globalAlpha = 0.3 + Math.sin(t / 180) * 0.15;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x, by, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, by, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#3a2a10";
    ctx.font = "900 22px sans-serif";
    ctx.fillText(mark, p.x, by + 8);
  }
}

const wrap = (v: number, m: number) => ((v % m) + m) % m;

/** 위에 얹는 날씨 — 돌풍 · 꽃잎 · 눈 · 별 · 안개 · 어둠 */
function drawMapTop(ctx: CanvasRenderingContext2D, a: Arena, t: number) {
  const key = a.map.key;
  const wind = a.map.wind;
  if (wind) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.globalAlpha = wind.warn > 0 ? 0.28 : 0.72;
    for (let i = 0; i < 30; i++) {
      const x = wrap(i * 137 + (t / 2) * wind.dx, ARENA_W);
      const y = wrap(i * 211 + (t / 2) * wind.dy, ARENA_H);
      line(ctx, x, y, x - wind.dx * 60, y - wind.dy * 60);
    }
    ctx.lineCap = "butt";
  }
  if (key === "meadow" || key === "plateau" || key === "temple") {
    const col = key === "meadow" ? "#ffc4dc" : key === "plateau" ? "#ffffff" : "#ffeaa0";
    ctx.fillStyle = col;
    for (let i = 0; i < 34; i++) {
      const x = wrap(i * 173 + Math.sin(t / 900 + i) * 40 + t / 26, ARENA_W);
      const y = wrap(i * 97 + t / (key === "temple" ? 60 : 16), ARENA_H);
      ctx.globalAlpha = key === "temple" ? 0.35 + Math.sin(t / 200 + i) * 0.3 : 0.75;
      ctx.beginPath();
      ctx.arc(x, y, key === "temple" ? 3 : 4 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (key === "swamp") {
    ctx.fillStyle = "#dfe8d6";
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.13;
      ctx.beginPath();
      ctx.ellipse(wrap(i * 241 + t / 40, ARENA_W + 300) - 150, 90 + i * 124, 240, 70, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (key === "cave") {
    const me = a.units[0];
    const g = ctx.createRadialGradient(me.x, me.y - 30, 170, me.x, me.y - 30, 620);
    g.addColorStop(0, "rgba(10,6,24,0)");
    g.addColorStop(1, "rgba(10,6,24,.62)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(-200, -200, ARENA_W + 400, ARENA_H + 400);
  }
  ctx.globalAlpha = 1;
}
