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
  BALLS, ITEMS, MOVES, SPECIES, TYPE_COLOR, activeOf, catchChance, effectiveness, moveOf, xpFor,
  type BallKey, type Battle, type ItemKey, type Move, type Region, type Status,
} from "@/lib/adventure";
import {
  ARENA_H, ARENA_W, BODY_R, TPS, dirOf, duelInput, newArena, record, ringAim, skillOf, stepArena,
  type AEv, type Arena, type ArenaInput, type Bag, type LogEntry,
} from "@/lib/arena";
import { BattleFx, FX_PAL, type Pt } from "@/lib/battlefx";
import { useBackClose } from "@/lib/useBackClose";
import { heroAsset } from "@/lib/heroassets";
import { asset } from "@/lib/base";
import { enterBattleFullscreen, exitBattleFullscreen } from "@/lib/battlefull";
import GameWindowGuard from "@/components/GameWindowGuard";
import MonArt from "@/components/adventure/MonArt";
import { josa } from "@/lib/josa";
import { confirmDialog } from "@/lib/confirm";

const STATUS_LABEL: Record<Status, string> = { burn: "화상", poison: "독", para: "마비", sleep: "잠듦" };
const STAT_LABEL = { atk: "공격", def: "방어", spd: "스피드" } as const;
const KEYS = ["Q", "W", "E", "R"];
const SHAPE_LABEL = { dash: "돌진", slash: "베기", shot: "탄", orb: "유도탄", wave: "물결", beam: "광선", rain: "범위", blast: "범위", self: "강화", hex: "방해" } as const;

/** 기술 버튼의 성격 표 — 연속 · 흡수 · 반동 · 선제 · 급소 · 움찔 · 상태이상 */
export function moveTags(mv: Move): string[] {
  const t: string[] = [];
  if (mv.hits) t.push(`${mv.hits[0]}~${mv.hits[1]}연타`);
  if (mv.priority) t.push("빠른 시전");
  if (mv.drain) t.push("흡수");
  if (mv.recoil) t.push("반동");
  if (mv.crit) t.push("급소↑");
  if (mv.flinch) t.push("움찔");
  if (mv.inflict) t.push(STATUS_LABEL[mv.inflict.status]);
  if (mv.heal) t.push("회복");
  if (mv.boost) t.push(`${mv.boost.self ? "내" : "상대"} ${STAT_LABEL[mv.boost.stat]}${mv.boost.by > 0 ? "▲" : "▼"}`);
  return t;
}

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
  };
}

/** 생물 그림 — 한 번만 받는다 */
const imgs = new Map<string, HTMLImageElement>();
function imgOf(species: string): HTMLImageElement {
  let im = imgs.get(species);
  if (!im) {
    im = new Image();
    im.decoding = "async";
    im.src = asset(heroAsset(species, 192));
    imgs.set(species, im);
  }
  return im;
}

export default function BattleView({ battle: start, region, bag: startBag, onEnd, online }: {
  battle: Battle;
  region: Region;
  bag: Bag;
  onEnd: (battle: Battle, bag: Bag) => void;
  online?: Online;
}) {
  const arenaRef = useRef<Arena | null>(null);
  if (!arenaRef.current) arenaRef.current = newArena(start, startBag);
  const [hud, setHud] = useState<Hud>(() => hudOf(arenaRef.current!));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ball, setBall] = useState<BallKey>(() => (["basic", "great", "star"] as BallKey[]).find((k) => startBag.balls[k] > 0) ?? "basic");
  const [itemsOpen, setItemsOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
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
  /** 카메라 — 필드가 화면보다 넓어 나와 상대 사이를 따라간다 */
  const cam = useRef({ x: 0, y: 0, zoom: 1, fit: 1, ready: false });
  /** 타격감 — 멈칫(히트스톱) · 찌그러짐 · 내지르기 · 충격 고리 */
  const feel = useRef({ stopUntil: 0, squash: [-1e9, -1e9] as [number, number], squashAmt: [0, 0] as [number, number], kick: [-1e9, -1e9] as [number, number], kickDir: [[0, 0], [0, 0]] as [number, number][], rings: [] as { x: number; y: number; t0: number; color: string; r: number }[],
    sparks: [] as { x: number; y: number; dx: number; dy: number; len: number; t0: number; color: string }[],
    dust: [] as { x: number; y: number; vx: number; vy: number; t0: number; r: number }[],
    slashes: [] as { x: number; y: number; ang: number; r: number; color: string; core: string; t0: number }[],
    beams: [] as { x: number; y: number; tx: number; ty: number; w: number; color: string; core: string; t0: number }[],
    bursts: [] as { x: number; y: number; r: number; color: string; core: string; t0: number; rain: boolean }[],
    combo: 0, comboAt: -1e9, hurtAt: -1e9, startAt: 0, endAt: 0, endText: "" });
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
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
    const fit = () => {
      const r = c.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      // 캔버스가 화면 전체다 — 글자판 · 버튼은 그 위에 얹힌다. 한 화면엔 가로 약 380 만 보이고 필드(ARENA_W × ARENA_H)는 카메라가 따라간다
      const s = Math.min(r.width / 380, r.height / 640);
      const top = topRef.current ? topRef.current.getBoundingClientRect().bottom - r.top : 0;
      const bottom = ctlRef.current ? r.bottom - ctlRef.current.getBoundingClientRect().top : 0;
      view.current = { ...view.current, s, w: r.width, h: r.height, top, bottom };
      fx.resize();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    if (topRef.current) ro.observe(topRef.current);
    if (ctlRef.current) ro.observe(ctlRef.current);
    enterBattleFullscreen();
    feel.current.startAt = performance.now();
    for (const t of a.b.sides) for (const f of t.team) imgOf(f.mon.species);
    if (!greeted.current) toast(a.b.wild ? `앗! 야생 ${josa(SPECIES[activeOf(a.b, 1).mon.species].name, "이/가")} 나타났다!` : `${josa(a.b.sides[1].name, "이/가")} 승부를 걸어왔다!`);
    greeted.current = true;

    const deco = groundDeco(a.b.region ?? "arena");
    const scr = (x: number, y: number): Pt => ({ x: view.current.ox + x * view.current.es, y: view.current.oy + y * view.current.es });
    const addFloat = (x: number, y: number, text: string, color: string, big = false) => {
      floats.current.push({ x: x + (Math.random() * 24 - 12), y: y - BODY_R, text, color, t0: performance.now(), big });
      if (floats.current.length > 30) floats.current.shift();
    };

    const handle = (evs: AEv[]) => {
      const now = performance.now();
      for (const e of evs) {
        if (e.t === "release") {
          const mv = moveOf(e.move);
          {
            const d = Math.hypot(e.tx - e.x, e.ty - e.y) || 1;
            feel.current.kick[e.side] = now;
            feel.current.kickDir[e.side] = [(e.tx - e.x) / d, (e.ty - e.y) / d];
          }
          const sh = skillOf(e.move).shape;
          const pal = FX_PAL[mv.type];
          if (sh === "beam") feel.current.beams.push({ x: e.x, y: e.y - 40, tx: e.tx, ty: e.ty - 40, w: 22 + mv.power * 0.18, color: pal[1], core: pal[0], t0: now });
          else if (sh === "slash") feel.current.slashes.push({ x: e.x, y: e.y - 40, ang: Math.atan2(e.ty - e.y, e.tx - e.x), r: 150, color: pal[1], core: pal[0], t0: now });
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
          imgOf(f.mon.species);
          if (e.side === 0) toast(`가랏, ${SPECIES[f.mon.species].name}!`);
        } else if (e.t === "pulse") {
          const mv = moveOf(e.move);
          fx.impact(mv.type, scr(e.x, e.y), { power: mv.hits ? 0.6 : 1 });
          feel.current.bursts.push({ x: e.x, y: e.y, r: e.r, color: FX_PAL[mv.type][1], core: FX_PAL[mv.type][0], t0: now, rain: skillOf(e.move).shape === "rain" });
          if (!still && !mv.hits) shake.current = Math.max(shake.current, 4);
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
        const done = tried.skill == null || a.ev.some((e) => e.t === "cast" && e.side === 0) || a.b.needSwap;
        if (done || --q.queue.ttl <= 0) q.queue = null;
      }
      handle(a.ev);
      if (!still) {
        const now = performance.now();
        for (const side of [0, 1] as const) {
          const u = a.units[side];
          const f = activeOf(a.b, side);
          if (f.mon.hp <= 0) continue;
          if (u.lunge || u.dodge > 0) {
            ghosts.current.push({ side, x: u.x, y: u.y, t0: now, species: f.mon.species, flip: u.fx > 0.15 });
            if (ghosts.current.length > 14) ghosts.current.shift();
          }
          if (Math.hypot(u.x - u.px, u.y - u.py) > 2 && a.tick % 5 === side) {
            feel.current.dust.push({ x: u.x, y: u.y + 8, vx: (u.px - u.x) * 6, vy: -14, t0: now, r: 6 + Math.random() * 5 });
          }
        }
        if (feel.current.dust.length > 50) feel.current.dust.splice(0, feel.current.dust.length - 50);
      }
      if (a.b.over && !ended.current) {
        ended.current = true;
        feel.current.endAt = performance.now();
        feel.current.endText = a.b.over === "win" ? "승리!" : a.b.over === "caught" ? "잡았다!" : a.b.over === "run" ? "도망!" : "패배…";
        setHud(hudOf(a));
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
      ctx.fillStyle = shade(region.ground, -0.45);
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
      g.addColorStop(0, shade(region.ground, 0.12));
      g.addColorStop(0.5, region.ground);
      g.addColorStop(1, shade(region.ground, -0.25));
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
          ctx.strokeStyle = shade(region.ground, -0.3);
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
          ctx.fillStyle = shade(region.ground, -0.22);
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, d.s, d.s * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = shade(region.ground, 0.18);
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
      ctx.strokeStyle = shade(region.ground, -0.5);
      ctx.lineWidth = 8;
      rr(ctx, 0, 0, ARENA_W, ARENA_H, 26);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 떨어질 원
      for (const z of a.zones) {
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
        } else if (sk.shape === "slash") {
          const ang = Math.atan2(u.cast.dy, u.cast.dx);
          ctx.globalAlpha = 0.18 + 0.35 * k;
          ctx.fillStyle = side === 1 ? "#ff6a5a" : col;
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.arc(u.x, u.y, sk.r + BODY_R, ang - 1.25, ang + 1.25);
          ctx.closePath();
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
        const im = imgOf(gh.species);
        if (!im.complete || !im.naturalWidth) continue;
        ctx.globalAlpha = 0.42 * (1 - (now - gh.t0) / 260);
        ctx.save();
        ctx.translate(gh.x, gh.y);
        ctx.scale(gh.flip ? -1 : 1, 1);
        ctx.drawImage(im, -61, -137, 122, 122);
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
        const im = imgOf(f.mon.species);
        const enter = u.enter > 0 ? 1 - u.enter / 18 : 1;
        const sc = (0.55 + 0.45 * Math.min(1, enter)) * (down ? 0.85 : 1);
        const bob = still ? 0 : Math.sin(now / 260 + side * 2) * 2;
        const size = 122 * sc;
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
        const charge = u.cast && !still ? u.cast.t / Math.max(1, u.cast.total) : 0;
        const backX = u.cast ? -u.cast.dx * 12 * charge : 0;
        const backY = u.cast ? -u.cast.dy * 12 * charge : 0;
        const breath = still || moving ? 0 : Math.sin(now / 340 + side) * 0.022;
        const sxk = 1 + sq + charge * 0.1 - breath;
        const syk = 1 - sq * 0.8 + charge * 0.08 + breath;
        ctx.globalAlpha = fade * (u.iframe > 0 ? 0.5 : 1);
        if (im.complete && im.naturalWidth) {
          const put = () => {
            ctx.save();
            ctx.translate(x + kx + backX, y + ky + backY - hop + (moving ? 0 : bob * 0.5) + (down ? (1 - fade) * 20 : 0));
            if (lean) ctx.rotate(lean);
            ctx.scale(u.fx > 0.15 ? -sxk : sxk, syk);
            ctx.drawImage(im, -size / 2, -size * 1.12, size, size);
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
          rr(ctx, x - bw / 2, y - size * 1.18 - 4, bw, 6, 3);
          ctx.fill();
          ctx.fillStyle = r > 0.5 ? "#3ccf6a" : r > 0.2 ? "#f2b833" : "#ef5a4c";
          rr(ctx, x - bw / 2, y - size * 1.18 - 4, bw * r, 6, 3);
          ctx.fill();
          if (f.mon.status === "sleep" || u.stun > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 15px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(f.mon.status === "sleep" ? "Zz" : "!?", x + 30, y - size * 1.05);
          }
          if (u.channel) {
            ctx.strokeStyle = "#ffe27a";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y - size * 0.62, BODY_R + 18, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * u.channel.t) / u.channel.total);
            ctx.stroke();
          }
        }
      }

      // 베기
      feel.current.slashes = feel.current.slashes.filter((v) => now - v.t0 < 200);
      ctx.globalCompositeOperation = "lighter";
      for (const v of feel.current.slashes) {
        const k = (now - v.t0) / 200;
        const from = v.ang - 1.3;
        const to = from + 2.6 * Math.min(1, k * 2.2);
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
      feel.current.beams = feel.current.beams.filter((v) => now - v.t0 < 260);
      ctx.lineCap = "round";
      for (const v of feel.current.beams) {
        const k = (now - v.t0) / 260;
        const wob = 1 + Math.sin(now / 16) * 0.16;
        const thin = 1 - k * k;
        ctx.globalAlpha = 0.45 * thin;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = v.w * 2.4 * wob * thin;
        line(ctx, v.x, v.y, v.tx, v.ty);
        ctx.globalAlpha = 0.95 * thin;
        ctx.lineWidth = v.w * wob * thin;
        line(ctx, v.x, v.y, v.tx, v.ty);
        ctx.strokeStyle = v.core;
        ctx.lineWidth = v.w * 0.42 * thin;
        line(ctx, v.x, v.y, v.tx, v.ty);
      }
      ctx.lineCap = "butt";
      // 터짐 · 쏟아짐
      feel.current.bursts = feel.current.bursts.filter((v) => now - v.t0 < 340);
      for (const v of feel.current.bursts) {
        const k = (now - v.t0) / 340;
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
      if (a.bag && !a.capture && activeOf(a.b, 1).mon.hp > 0) {
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
      if (since0 < 900) label("전투 시작!", top + room * 0.42, 46 * (since0 < 140 ? 1.5 - (since0 / 140) * 0.5 : 1), "#ffe27a", since0 > 620 ? 1 - (since0 - 620) / 280 : 1);
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
    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // 히트스톱 — 세게 맞는 순간 판이 잠깐 멈칫한다(틱 기준이라 대전 판정과 무관)
      if (document.visibilityState === "visible" && now >= feel.current.stopUntil) acc += dt;
      while (acc >= 1 / TPS) {
        acc -= 1 / TPS;
        tick();
        if (++n % 3 === 0) setHud(hudOf(a));
      }
      draw(Math.min(1, acc * TPS), now);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      exitBattleFullscreen();
      cancelAnimationFrame(raf);
      ro.disconnect();
      fx.destroy();
      fxRef.current = null;
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

  // 뒤로 가기 — 야생이면 도망을 시도, 대전이면 기권을 묻는다
  useBackClose(() => {
    if (online) void forfeit();
    else queue({ dir: 0, run: true }, 2);
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

  const a = arenaRef.current!;
  const foeType = SPECIES[hud.foe.species].type;

  return createPortal(
    <div className="adv-rt fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="전투" style={{ background: shade(region.ground, -0.45) }}>
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
        <div className="adv-rt-row">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto" style={{ touchAction: "pan-x" }}>
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
          {hud.bag && (
            <>
              <button type="button" className="tap adv-rt-tool" disabled={hud.bag.balls[ball] <= 0 || !!hud.over} onClick={() => queue({ dir: 0, ball }, 2)} aria-label={`${BALLS[ball].name} 던지기`}>
                <BallIcon k={ball} size={20} /><b>×{hud.bag.balls[ball]}</b>
                <small>{Math.round(catchChance(activeOf(a.b, 1), ball, 1) * 100)}%</small>
              </button>
              <button type="button" className="tap adv-rt-tool adv-rt-tool-sm" onClick={() => setBall((b) => (b === "basic" ? "great" : b === "great" ? "star" : "basic"))} aria-label="공 종류 바꾸기">⇄</button>
              <div className="relative">
                <button type="button" className="tap adv-rt-tool" onClick={() => setItemsOpen((o) => !o)} aria-expanded={itemsOpen}>약</button>
                {itemsOpen && (
                  <div className="adv-rt-pop">
                    {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
                      <button key={k} type="button" className="tap" disabled={hud.bag!.items[k] <= 0} onClick={() => { queue({ dir: 0, item: k }, 2); setItemsOpen(false); }}>
                        {ITEMS[k].name} <b>×{hud.bag!.items[k]}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="tap adv-rt-tool" onClick={() => queue({ dir: 0, run: true }, 2)} disabled={!!hud.over}>도망</button>
            </>
          )}
          {online && <button type="button" className="tap adv-rt-tool" onClick={() => void forfeit()} disabled={!!hud.over}>기권</button>}
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
                  onPointerDown={(e) => { e.preventDefault(); queue({ dir: 0, skill: i }); }}
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
            <button
              type="button"
              className="adv-rt-dodge"
              style={{ ["--p" as string]: `${(hud.dodge / (1.1 * TPS)) * 360}deg` }}
              disabled={!!hud.over}
              onPointerDown={(e) => { e.preventDefault(); queue({ dir: 0, dodge: true }, 3); }}
              aria-label="회피 (스페이스)"
            >
              회피
              {hud.dodge > 0 && <span className="adv-rt-cd" />}
            </button>
          </div>
        </div>
      </div>

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
function Stick({ onDir }: { onDir: (d: number) => void }) {
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
/** #rrggbb 밝기 바꾸기 */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(Math.min(255, Math.max(0, k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
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

/** 체력바 — 앞 막대는 바로, 뒤 잔상은 조금 늦게 따라 준다(얼마나 깎였는지 보이게) */
export function HpBar({ hp, max }: { hp: number; max: number }) {
  const r = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const color = r > 0.5 ? "#3ccf6a" : r > 0.2 ? "#f2b833" : "#ef5a4c";
  return (
    <span className="adv-hpbar" role="meter" aria-label="체력" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <span className="adv-hpbar-lag" style={{ width: `${r * 100}%` }} />
      <span className="adv-hpbar-now" style={{ width: `${r * 100}%`, background: color }} />
    </span>
  );
}

export function XpBar({ level, xp }: { level: number; xp: number }) {
  const a = xpFor(level);
  const b = xpFor(level + 1);
  const r = b > a ? (xp - a) / (b - a) : 1;
  return (
    <span className="adv-xpbar" aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(1, r)) * 100}%` }} />
    </span>
  );
}

/** 공 — 도토리 모양 씨앗 공(이 앱 것). ⚠ 위아래 두 색 + 가운데 띠 + 단추 모양의 공은 원작 게임의 상징이라 쓰지 않는다. */
export function BallIcon({ k, size = 18 }: { k: BallKey; size?: number }) {
  const body = k === "basic" ? "#6cbf4a" : k === "great" ? "#3f8fd8" : "#8a5ad8";
  const dark = k === "basic" ? "#3f8a2e" : k === "great" ? "#2763a3" : "#5d38a6";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="inline-block align-[-3px]">
      <path d="M10 1.2v2.6" stroke="#6b4a2b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10.6c0 4.4 2.7 7.9 6 7.9s6-3.5 6-7.9z" fill={body} stroke={dark} strokeWidth="1.3" />
      <path d="M6.2 12c.3 2.2 1.4 3.9 2.8 4.6" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M2.6 10.8C2.6 6.6 6 3.6 10 3.6s7.4 3 7.4 7.2z" fill="#a8743f" stroke="#6b4a2b" strokeWidth="1.3" />
      <path d="M5 8.2h10M4 10h12M7 5.6l-1.6 4.6M10 4.4v6M13 5.6l1.6 4.6" stroke="#6b4a2b" strokeOpacity=".55" strokeWidth=".8" />
      {k === "star" && <path d="M10 11.6l.8 1.7 1.8.2-1.4 1.2.5 1.8-1.7-1-1.7 1 .5-1.8-1.4-1.2 1.8-.2z" fill="#ffe27a" />}
      {k === "great" && <circle cx="10" cy="14" r="1.6" fill="#fff" fillOpacity=".85" />}
    </svg>
  );
}
