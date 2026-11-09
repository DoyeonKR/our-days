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
  ARENA_H, ARENA_W, AWAKE_TICKS, BODY_R, CHARGE_MAX, MAP_RULES, TPS, dirOf, duelInput, newArena, record, ringAim, skillOf, stepArena,
  type AEv, type Arena, type ArenaInput, type Bag, type LogEntry, type Rock,
} from "@/lib/arena";
import { battleDpr, BattleFx, FX_PAL, type Pt } from "@/lib/battlefx";
import { useBackClose } from "@/lib/useBackClose";
import { preloadSprite, spriteOf } from "@/lib/advsprite";
import { frameGate, frozenDraw } from "@/lib/advframe";
import { enterBattleFullscreen, exitBattleFullscreen } from "@/lib/battlefull";
import GameWindowGuard from "@/components/GameWindowGuard";
import MonArt from "@/components/adventure/MonArt";
import { josa } from "@/lib/josa";
import { confirmDialog } from "@/lib/confirm";
import { BallIcon, HpBar, SHAPE_LABEL, STATUS_LABEL, STAT_LABEL, XpBar, moveTags, pressProps, shade } from "@/components/adventure/advui";

const KEYS = ["Q", "W", "E", "R"];

/** 온라인 대전 — 판이 끝나면 입력 기록을 서버에 넘긴다(서버가 다시 돌려 판정). 실패하면 던진다. */
export type Online = {
  finish: (log: LogEntry[], arena: Arena) => Promise<void>;
  forfeit: () => Promise<void>;
  errorText: (e: unknown) => string;
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
  };
}

/** 필드 위 생물 크기(2026-11-08 [사용자: "캐릭터가 너무 커"] 122 → 100). 맞는 판정(BODY_R)과는 따로다 */
const SPRITE = 100;

export default function BattleView({ battle: start, region, bag: startBag, onEnd, onSettle, online, keepFull }: {
  battle: Battle;
  region: Region;
  bag: Bag;
  /** 축하 연출(1.5초) 뒤 — 화면을 닫는다 */
  onEnd: (battle: Battle, bag: Bag) => void;
  /** 판이 끝난 그 틱에 — 진행 저장은 여기서(연출을 기다리다 앱이 닫히면 잡은 생물 · 경험치가 사라졌다). 대전은 서버가 정한다 */
  onSettle?: (battle: Battle, bag: Bag) => void;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<BattleFx | null>(null);
  const input = useRef<{ keys: Set<string>; stick: number; queue: { a: ArenaInput; ttl: number } | null }>({ keys: new Set(), stick: 0, queue: null });
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
  const onEndRef = useRef(onEnd);
  const onSettleRef = useRef(onSettle);
  const hudRef = useRef(hud);
  useEffect(() => {
    onEndRef.current = onEnd;
    onSettleRef.current = onSettle;
    hudRef.current = hud;
  });

  const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toast(text: string) {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
  }

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

    const deco = groundDeco(a.map.key);
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
          if (mv.power > 0) addFloat(u.x, u.y - 62, mv.name, FX_PAL[mv.type][0]);
          if (mv.power >= 90 && !still) feel.current.ult = { name: mv.name, color: FX_PAL[mv.type][1], t0: now };
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
          feel.current.ult = { name: e.side === 0 ? "각성!" : `${SPECIES[activeOf(a.b, e.side).mon.species].name} 각성!`, color: FX_PAL[ty][1], t0: now };
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
      let inp: ArenaInput = { dir: kx || ky ? dirOf(kx, ky) : q.stick };
      if (q.queue) inp = { ...q.queue.a, dir: inp.dir };
      if (online) {
        inp = duelInput(inp);
        lastDir.current = record(logRef.current, lastDir.current, a.tick, inp);
      }
      stepArena(a, inp);
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
      ctx.fillStyle = shade(stage.ground, -0.45);
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
      // 땅
      const g = ctx.createLinearGradient(0, 0, 0, ARENA_H);
      g.addColorStop(0, shade(stage.ground, 0.12));
      g.addColorStop(0.5, stage.ground);
      g.addColorStop(1, shade(stage.ground, -0.25));
      ctx.fillStyle = g;
      rr(ctx, 0, 0, ARENA_W, ARENA_H, 26);
      ctx.fill();
      ctx.save();
      rr(ctx, 0, 0, ARENA_W, ARENA_H, 26);
      ctx.clip();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let x = 80; x < ARENA_W; x += 80) line(ctx, x, 0, x, ARENA_H);
      for (let y = 80; y < ARENA_H; y += 80) line(ctx, 0, y, ARENA_W, y);
      // 땅 꾸밈 — 풀 · 꽃 · 돌(움직일 때 땅이 흘러가는 게 보이게)
      ctx.globalAlpha = 1;
      for (const d of deco) {
        if (d.k === 0) {
          ctx.strokeStyle = shade(stage.ground, -0.3);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(d.x - 5, d.y);
          ctx.lineTo(d.x - 7, d.y - d.s);
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y - d.s * 1.3);
          ctx.moveTo(d.x + 5, d.y);
          ctx.lineTo(d.x + 7, d.y - d.s);
          ctx.stroke();
        } else if (d.k === 1) {
          ctx.fillStyle = d.c;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.s * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff4b0";
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.s * 0.14, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = shade(stage.ground, -0.22);
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, d.s, d.s * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = shade(stage.ground, 0.18);
          ctx.beginPath();
          ctx.ellipse(d.x - d.s * 0.25, d.y - d.s * 0.2, d.s * 0.45, d.s * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ARENA_W / 2, ARENA_H / 2, 110, 0, Math.PI * 2);
      ctx.stroke();
      line(ctx, 30, ARENA_H / 2, ARENA_W - 30, ARENA_H / 2);
      ctx.restore();
      // 필드 테두리
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = shade(stage.ground, -0.5);
      ctx.lineWidth = 8;
      rr(ctx, 0, 0, ARENA_W, ARENA_H, 26);
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawMap(ctx, a, still ? 0 : now);

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
        // 그림자 · 발밑 고리
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(x, y + 6, BODY_R * 1.6, BODY_R * 0.6, 0, 0, Math.PI * 2);
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
        const sc = (0.55 + 0.45 * Math.min(1, enter)) * (down ? 0.85 : 1);
        const bob = still ? 0 : Math.sin(now / 260 + side * 2) * 2;
        // 대장은 몸집이 크게 보이고, 각성하면 더 커진다(맞는 판정은 그대로)
        const size = SPRITE * sc * (side === 1 && (a.b.boss || (a.b.tower != null && a.b.tower % 10 === 0)) ? 1.28 : 1) * (u.awake > 0 ? 1.16 : 1);
        const im = spriteOf(f.mon.species, Math.ceil(size * s * dpr));
        const fe = feel.current;
        // 맞으면 납작해졌다 튀어 오르고(찌그러짐), 기술을 내지르면 그쪽으로 한 번 쏠린다
        const sqT = (now - fe.squash[side]) / 220;
        const sq = still || sqT >= 1 ? 0 : fe.squashAmt[side] * Math.cos(sqT * Math.PI * 1.5) * (1 - sqT);
        const kT = (now - fe.kick[side]) / 180;
        const kick = still || kT >= 1 ? 0 : Math.sin(kT * Math.PI) * 14;
        const kx = fe.kickDir[side][0] * kick;
        const ky = fe.kickDir[side][1] * kick;
        // 걸을 때 통통 튄다 · 시전 중엔 뒤로 움츠렸다가 내지른다 · 가만히 있으면 숨을 쉰다
        const moving = !still && Math.hypot(u.x - u.px, u.y - u.py) > 1 && !down;
        const hop = moving ? Math.abs(Math.sin(now / 75 + side)) * 13 : 0;
        const lean = moving ? Math.max(-0.14, Math.min(0.14, (u.x - u.px) * 0.03)) : 0;
        const air = u.leap ? Math.sin((u.leap.t / u.leap.total) * Math.PI) * 130 : 0;
        const charge = u.cast && !still ? u.cast.t / Math.max(1, u.cast.total) : 0;
        const backX = u.cast ? -u.cast.dx * 12 * charge : 0;
        const backY = u.cast ? -u.cast.dy * 12 * charge : 0;
        const breath = still || moving ? 0 : Math.sin(now / 340 + side) * 0.022;
        const sxk = 1 + sq + charge * 0.1 - breath;
        const syk = 1 - sq * 0.8 + charge * 0.08 + breath;
        ctx.globalAlpha = fade * (u.iframe > 0 ? 0.5 : 1);
        if (im) {
          const put = () => {
            ctx.save();
            ctx.translate(x + kx + backX, y + ky + backY - hop - air + (moving ? 0 : bob * 0.5) + (down ? (1 - fade) * 20 : 0));
            if (lean) ctx.rotate(lean);
            ctx.scale(u.fx > 0.15 ? -sxk : sxk, syk);
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
          const bw = 56;
          const r = f.mon.hp / f.stats.hp;
          ctx.fillStyle = "rgba(0,0,0,.45)";
          rr(ctx, x - bw / 2, y - size * 1.06 - 4, bw, 6, 3);
          ctx.fill();
          ctx.fillStyle = r > 0.5 ? "#3ccf6a" : r > 0.2 ? "#f2b833" : "#ef5a4c";
          rr(ctx, x - bw / 2, y - size * 1.06 - 4, bw * r, 6, 3);
          ctx.fill();
          if (f.mon.status === "sleep" || u.stun > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 15px sans-serif";
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
        ctx.font = `900 ${Math.round((fl.big ? 30 : 21) * pop)}px sans-serif`;
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

  // 뒤로 가기 — 일시정지(대전이면 기권을 묻는다). 다음 생물을 고르는 중엔 멈추지 않는다 —
  // 멈춤 창이 고르기 창 밑에 깔려 누를 수 없었고, 멈춘 동안엔 틱이 안 돌아 고르기도 안 먹었다
  useBackClose(() => {
    if (online) void forfeit();
    else if (!hudRef.current.needSwap) setPausedView((v) => (v ? null : "pause"));
    return false;
  }, !hud.over);

  async function forfeit() {
    if (!online || ended.current) return;
    if (!(await confirmDialog({ message: "기권할까요? 진 것으로 기록돼요.", confirmText: "기권", danger: true }))) return;
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
    <div className="adv-rt fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="전투" style={{ background: shade(stage.ground, -0.45) }}>
      <GameWindowGuard />
      <div ref={stageRef} className="adv-rt-stage">
        <canvas ref={canvasRef} className="adv-rt-canvas" aria-hidden />
        <canvas ref={fxCanvasRef} className="adv-rt-canvas" aria-hidden />
      </div>

      <div ref={topRef} className="adv-rt-top">
        <HpCard m={hud.foe} extra={!a.b.wild ? `${hud.foeLeft}/${hud.foeTotal}` : undefined} foe />
        <HpCard m={hud.me} xp />
      </div>
      <div className="adv-rt-toasts" aria-live="polite">
        {toasts.map((t) => <p key={t.id}>{t.text}</p>)}
      </div>
      {hud.channel && <p className="adv-rt-channel">{hud.channel} — 맞으면 끊겨요</p>}
      {sending && <p className="adv-rt-sending">{sending}</p>}

      <div ref={ctlRef} className="adv-rt-ctl">
        <div ref={rowRef} className="adv-rt-row">
          <div className="adv-rt-team" style={{ touchAction: "pan-x" }}>
            {hud.team.map((t, i) => (
              <button
                key={i}
                type="button"
                className={`tap adv-rt-chip ${t.active ? "is-on" : ""}`}
                disabled={t.active || t.hp <= 0 || hud.swap > 0 || !!hud.over}
                onClick={() => queue({ dir: 0, swap: i }, 2)}
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
              <button type="button" className="tap adv-rt-tool adv-rt-ball" disabled={hud.bag.balls[ball] <= 0 || !!hud.over} onClick={() => queue({ dir: 0, ball }, 2)} aria-label={`${BALLS[ball].name} 던지기`}>
                <BallIcon k={ball} size={20} />
                <span><b>×{hud.bag.balls[ball]}</b><small>{Math.round(catchChance(activeOf(a.b, 1), ball, 1) * 100)}%</small></span>
              </button>
            )}
            {hud.bag && (
              <div className="relative">
                <button type="button" className="tap adv-rt-tool" onClick={() => setItemsOpen((o) => !o)} aria-expanded={itemsOpen} aria-label={a.b.wild ? "가방 — 공 고르기 · 약 · 도망" : "가방 — 약"}>가방</button>
                {itemsOpen && (
                  <div className="adv-rt-pop">
                    {a.b.wild && (["basic", "great", "star"] as BallKey[]).map((k) => (
                      <button key={k} type="button" className={`tap ${ball === k ? "is-on" : ""}`} aria-pressed={ball === k} onClick={() => { setBall(k); setItemsOpen(false); }}>
                        <span><BallIcon k={k} size={16} /> {BALLS[k].name}</span> <b>×{hud.bag!.balls[k]}</b>
                      </button>
                    ))}
                    {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
                      <button key={k} type="button" className="tap" disabled={hud.bag!.items[k] <= 0 || !!hud.over} onClick={() => { queue({ dir: 0, item: k }, 2); setItemsOpen(false); }}>
                        {ITEMS[k].name} <b>×{hud.bag!.items[k]}</b>
                      </button>
                    ))}
                    {a.b.wild && <button type="button" className="tap" disabled={!!hud.over} onClick={() => { queue({ dir: 0, run: true }, 2); setItemsOpen(false); }}>도망치기 <b>X</b></button>}
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
              return (
                <button
                  key={m.id}
                  type="button"
                  className="adv-rt-skill"
                  style={{ ["--c" as string]: TYPE_COLOR[mv.type], ["--p" as string]: `${p * 360}deg` }}
                  disabled={!!hud.over}
                  {...pressProps(() => queue({ dir: 0, skill: i }))}
                  aria-label={`${mv.name} (${KEYS[i]})`}
                  title={`${mv.note} · ${moveTags(mv).join(" · ")}`}
                >
                  <span className="adv-rt-skill-name">{mv.name}</span>
                  <span className="adv-rt-skill-meta">{SHAPE_LABEL[sk.shape]}{mv.power ? ` · ${mv.power}` : ""}{eff > 1 ? " · 굉장" : eff < 1 ? " · 별로" : ""}</span>
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
              <li><b>왼쪽 막대</b> 움직이기 — 붉은 원과 조준선을 피해요</li>
              <li><b>기술 4칸</b> 누르면 가장 가까운 상대에게 나가요</li>
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
                <button key={f.mon.id} type="button" disabled={f.mon.hp <= 0} className="tap adv-swap" onClick={() => queue({ dir: 0, swap: i }, 2)}>
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

/** 가상 막대 — 누른 자리가 가운데가 된다. 8방향으로 엔진에 넘긴다. */
export function Stick({ onDir }: { onDir: (d: number) => void }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 46;
  const move = (e: React.PointerEvent) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    let dx = e.clientX - o.x;
    let dy = e.clientY - o.y;
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    setKnob({ x: dx, y: dy });
    onDir(dirOf(dx / R, dy / R));
  };
  const end = (e: React.PointerEvent) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    setKnob(null);
    onDir(0);
  };
  return (
    <div
      className="adv-rt-stick"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      role="application"
      aria-label="이동 막대 (화살표 키)"
    >
      <span className="adv-rt-knob" style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }} />
    </div>
  );
}

function HpCard({ m, xp, extra, foe }: { m: Mini; xp?: boolean; extra?: string; foe?: boolean }) {
  const sp = SPECIES[m.species];
  return (
    <div className={`adv-rt-card ${foe ? "is-foe" : "is-me"}`}>
      <div className="adv-rt-card-head">
        <i className="adv-type" style={{ background: TYPE_COLOR[sp.type] }}>{sp.type}</i>
        <b className="min-w-0 flex-1 truncate">{sp.name}</b>
        {m.status && <i className={`adv-status adv-status-${m.status}`}>{STATUS_LABEL[m.status]}</i>}
        <span className="shrink-0">Lv.{m.level}{extra ? ` · ${extra}` : ""}</span>
      </div>
      <HpBar hp={m.hp} max={m.max} />
      {xp && <XpBar level={m.level} xp={m.xp} />}
    </div>
  );
}

/** 땅 꾸밈 — 지역마다 같은 자리(무작위가 아니라 해시) */
function groundDeco(key: string): { x: number; y: number; k: 0 | 1 | 2; s: number; c: string }[] {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = () => {
    h = (Math.imul(h ^ (h >>> 13), 1274126177) + 0x6d2b79f5) | 0;
    return ((h >>> 0) % 10000) / 10000;
  };
  const flowers = ["#ff8fb1", "#ffd84d", "#a98bff", "#ffffff"];
  return Array.from({ length: 150 }, () => {
    const k = (r() < 0.62 ? 0 : r() < 0.6 ? 1 : 2) as 0 | 1 | 2;
    return { x: 20 + r() * (ARENA_W - 40), y: 20 + r() * (ARENA_H - 40), k, s: k === 2 ? 8 + r() * 10 : 8 + r() * 6, c: flowers[Math.floor(r() * flowers.length)] };
  });
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

/** 맵 기믹 — 웅덩이 · 바위 · 낙하 경고 · 줍는 것 */
function drawMap(ctx: CanvasRenderingContext2D, a: Arena, t: number) {
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
  const rocks = [...a.map.rocks].sort((p, q) => p.y - q.y);
  for (const r of rocks) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + r.r * 0.4, r.r * 1.1, r.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawRock(ctx, r, a.map.key, pal);
  }
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
