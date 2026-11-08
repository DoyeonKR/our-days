// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.
import {
  MOVES, SPECIES, activeOf, applyItem, catchChance, damage, effectiveness, moveOf, rnd,
  type BallKey, type Battle, type Fighter, type FxStyle, type ItemKey, type Move, type Rng, type StatKey, type Status,
} from "./adventure.ts";

export const TPS = 30;
export const ARENA_W = 400;
export const ARENA_H = 560;
export const BODY_R = 26;
export const DMG_SCALE = 0.42;

export const DUEL_TICKS = 150 * TPS;
const sec = (s: number) => Math.round(s * TPS);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rint = (r: Rng, a: number, b: number) => a + Math.floor(rnd(r) * (b - a + 1));
const stageMul = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

export type Shape = "dash" | "slash" | "shot" | "orb" | "wave" | "beam" | "rain" | "blast" | "self" | "hex";
const SHAPE: Record<FxStyle, Shape> = { contact: "dash", slash: "slash", shot: "shot", spiral: "orb", wave: "wave", beam: "beam", rain: "rain", burst: "blast", self: "self", debuff: "hex" };
export type Skill = { shape: Shape; windup: number; cd: number; range: number; r: number; speed: number; delay: number };

export function skillOf(id: string): Skill {
  const mv = moveOf(id);
  const shape = SHAPE[mv.fx];
  const avg = mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1;
  const total = mv.power * avg;
  const cd = mv.power === 0 ? sec(mv.heal ? 12 : 7) : sec(0.7 + total / 50);
  const W: Record<Shape, number> = { dash: 4, slash: 6, shot: 5, orb: 8, wave: 8, beam: 13, rain: 8, blast: 8, self: 9, hex: 8 };
  const RANGE: Record<Shape, number> = { dash: 230, slash: 118, shot: 520, orb: 560, wave: 420, beam: 600, rain: 9999, blast: 9999, self: 0, hex: 290 };
  const R: Record<Shape, number> = { dash: 0, slash: 118, shot: 11, orb: 22, wave: 40, beam: 16, rain: 66, blast: 54, self: 0, hex: 0 };
  const SPEED: Record<Shape, number> = { dash: 540, slash: 0, shot: 400, orb: 230, wave: 300, beam: 0, rain: 0, blast: 0, self: 0, hex: 0 };
  return {
    shape,
    windup: mv.priority ? 2 : W[shape],
    cd,
    range: RANGE[shape],
    r: R[shape],
    speed: SPEED[shape],
    delay: shape === "rain" ? 18 : shape === "blast" ? 13 : 0,
  };
}

type Cast = { slot: number; move: string; t: number; total: number; tx: number; ty: number; dx: number; dy: number };
type Lunge = { move: string; t: number; dx: number; dy: number; hits: number };
type Burst = { move: string; left: number; t: number; n: number };
type Buff = { stat: StatKey; by: number; t: number };
type Channel = { kind: "item" | "run"; item?: ItemKey; t: number; total: number };

export type Unit = {
  x: number; y: number;

  px: number; py: number;
  kx: number; ky: number;

  fx: number; fy: number;
  cd: number[];
  cast: Cast | null;
  lunge: Lunge | null;
  burst: Burst | null;
  channel: Channel | null;
  dodge: number; ddx: number; ddy: number; dodgeCd: number; iframe: number;
  stun: number; hitstun: number;
  statusT: number; dotT: number;
  buffs: Buff[];
  enter: number;

  ai: { think: number; strafe: number; dir: number };
};
export type Shot = { id: number; side: 0 | 1; move: string; x: number; y: number; px: number; py: number; dx: number; dy: number; speed: number; r: number; life: number; home: number; n: number; passed: boolean };
export type Zone = { id: number; side: 0 | 1; move: string; x: number; y: number; r: number; t: number; total: number; pulses: number; n: number };
export type Throw = { ball: BallKey; x0: number; y0: number; x1: number; y1: number; t: number; total: number; aim: number };
export type Capture = { ball: BallKey; x: number; y: number; t: number; shakes: number; caught: boolean };
export type Bag = { balls: Record<BallKey, number>; items: Record<ItemKey, number> };

export type AEv =
  | { t: "cast"; side: 0 | 1; move: string }
  | { t: "release"; side: 0 | 1; move: string; x: number; y: number; tx: number; ty: number }
  | { t: "hit"; side: 0 | 1; dmg: number; eff: number; crit: boolean; move?: string; dot?: Status; recoil?: boolean; x: number; y: number }
  | { t: "miss"; side: 0 | 1; x: number; y: number }
  | { t: "heal"; side: 0 | 1; amount: number; drain?: boolean }
  | { t: "status"; side: 0 | 1; status: Status; on: boolean }
  | { t: "stat"; side: 0 | 1; stat: StatKey; by: number }
  | { t: "interrupt"; side: 0 | 1 }
  | { t: "dodge"; side: 0 | 1 }
  | { t: "faint"; side: 0 | 1 }
  | { t: "swap"; side: 0 | 1; to: number }
  | { t: "pulse"; side: 0 | 1; move: string; x: number; y: number; r: number }
  | { t: "throw"; ball: BallKey }
  | { t: "shake"; n: number }
  | { t: "capture"; caught: boolean }
  | { t: "text"; s: string }
  | { t: "end"; result: NonNullable<Battle["over"]> };

export type Arena = {
  b: Battle;
  mode: "wild" | "duel";
  tick: number;
  units: [Unit, Unit];
  swapCd: [number, number];
  shots: Shot[];
  zones: Zone[];
  nid: number;
  throwing: Throw | null;
  capture: Capture | null;

  bag: Bag | null;

  foeNext: number;
  limit: number;
  ev: AEv[];
};

export type ArenaInput = { dir: number; skill?: number; dodge?: boolean; swap?: number; ball?: BallKey; item?: ItemKey; run?: boolean };

const S = Math.SQRT1_2;

export const DIRS: readonly [number, number][] = [[0, 0], [0, -1], [S, -S], [1, 0], [S, S], [0, 1], [-S, S], [-1, 0], [-S, -S]];

export function dirOf(x: number, y: number, dead = 0.28): number {
  if (x * x + y * y < dead * dead) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const sx = ax > 0.4142 * ay ? Math.sign(x) : 0;
  const sy = ay > 0.4142 * ax ? Math.sign(y) : 0;
  const k = `${sx},${sy}`;
  return ({ "0,-1": 1, "1,-1": 2, "1,0": 3, "1,1": 4, "0,1": 5, "-1,1": 6, "-1,0": 7, "-1,-1": 8 } as Record<string, number>)[k] ?? 0;
}

const STATUS_T: Record<Status, number> = { burn: sec(6), poison: sec(8), para: sec(5), sleep: sec(2.5) };
const nameOf = (f: Fighter) => SPECIES[f.mon.species].name;

function unit(side: 0 | 1, f: Fighter): Unit {
  const x = ARENA_W / 2;
  const y = side === 0 ? ARENA_H - 110 : 120;
  return {
    x, y, px: x, py: y, kx: 0, ky: 0, fx: 0, fy: side === 0 ? -1 : 1,
    cd: [0, 0, 0, 0], cast: null, lunge: null, burst: null, channel: null,
    dodge: 0, ddx: 0, ddy: 0, dodgeCd: 0, iframe: 0, stun: 0, hitstun: 0,
    statusT: f.mon.status ? STATUS_T[f.mon.status] : 0, dotT: sec(1), buffs: [], enter: sec(0.6),
    ai: { think: 0, strafe: side ? 1 : -1, dir: 0 },
  };
}

export function newArena(b: Battle, bag: Bag | null, limit = b.wild ? 0 : DUEL_TICKS): Arena {
  for (const s of b.sides) for (const f of s.team) if (f.mon.status === "sleep") f.mon.status = undefined;
  return {
    b,
    mode: b.wild ? "wild" : "duel",
    tick: 0,
    units: [unit(0, activeOf(b, 0)), unit(1, activeOf(b, 1))],
    swapCd: [0, 0],
    shots: [],
    zones: [],
    nid: 1,
    throwing: null,
    capture: null,
    bag: b.wild && bag ? { balls: { ...bag.balls }, items: { ...bag.items } } : null,
    foeNext: 0,
    limit,
    ev: [],
  };
}

export function ringAim(tick: number): number {
  const p = (tick % 40) / 40;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

export function moveSpeed(f: Fighter): number {
  const v = clamp(105 + f.stats.spd * stageMul(f.stages.spd) * 1.4, 105, 235);
  return f.mon.status === "para" ? v * 0.6 : v;
}

function norm(x: number, y: number): [number, number] {
  const m = Math.sqrt(x * x + y * y);
  return m > 1e-6 ? [x / m, y / m] : [0, 0];
}

export function stepArena(a: Arena, inp: ArenaInput, foe?: ArenaInput): void {
  a.ev = [];
  const b = a.b;
  if (b.over) return;
  const rng: Rng = { s: b.seed };
  if (b.needSwap) {
    if (inp.swap != null) swapTo(a, 0, inp.swap, true);
    b.seed = rng.s;
    return;
  }
  a.tick++;
  if (a.capture) {
    tickCapture(a);
    b.seed = rng.s;
    return;
  }
  const in1 = foe ?? think(a, 1, rng);
  control(a, 0, inp, rng);
  control(a, 1, in1, rng);
  separate(a);
  updateShots(a, rng);
  updateZones(a, rng);
  updateThrow(a, rng);
  timers(a, 0);
  timers(a, 1);
  resolve(a);
  if (!b.over && a.limit && a.tick >= a.limit) {
    const win = share(b, 0) > share(b, 1);
    b.over = win ? "win" : "lose";
    a.ev.push({ t: "text", s: "시간 끝! 남은 체력으로 가른다" }, { t: "end", result: b.over });
  }
  b.seed = rng.s;
}

export function share(b: Battle, side: 0 | 1): number {
  const t = b.sides[side].team;
  const max = t.reduce((s, f) => s + f.stats.hp, 0);
  return max ? t.reduce((s, f) => s + Math.max(0, f.mon.hp), 0) / max : 0;
}

function control(a: Arena, side: 0 | 1, inp: ArenaInput, rng: Rng) {
  const b = a.b;
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const f = activeOf(b, side);
  u.px = u.x;
  u.py = u.y;
  if (f.mon.hp <= 0) return;
  const [ax, ay] = norm(o.x - u.x, o.y - u.y);
  if (ax || ay) {
    u.fx = ax;
    u.fy = ay;
  }
  u.x += u.kx / TPS;
  u.y += u.ky / TPS;
  u.kx *= 0.8;
  u.ky *= 0.8;
  if (u.enter > 0) {
    u.enter--;
    clampPos(u);
    return;
  }
  const busy = u.stun > 0 || u.hitstun > 0;
  if (!busy) {
    if (inp.swap != null && a.swapCd[side] === 0 && !u.lunge) {
      if (swapTo(a, side, inp.swap, false)) return;
    }
    if (inp.dodge && u.dodgeCd === 0 && f.mon.status !== "para" && !u.lunge) {
      let [dx, dy] = DIRS[inp.dir] ?? [0, 0];
      if (!dx && !dy) [dx, dy] = [-u.fx, -u.fy];
      u.dodge = 5;
      u.ddx = dx;
      u.ddy = dy;
      u.iframe = 8;
      u.dodgeCd = sec(1.1);
      if (u.cast) cancelCast(u, sec(0.4));
      u.channel = null;
      a.ev.push({ t: "dodge", side });
    }
    if (a.bag && side === 0) {
      if (inp.ball && a.bag.balls[inp.ball] > 0 && !a.throwing && !u.cast && !u.channel) {
        a.bag.balls[inp.ball]--;
        a.throwing = { ball: inp.ball, x0: u.x, y0: u.y, x1: o.x, y1: o.y, t: 0, total: 16, aim: ringAim(a.tick) };
        a.ev.push({ t: "throw", ball: inp.ball });
      }
      if (inp.item && a.bag.items[inp.item] > 0 && !u.channel && !u.cast) u.channel = { kind: "item", item: inp.item, t: 0, total: 18 };
      if (inp.run && !u.channel && !u.cast) {
        u.channel = { kind: "run", t: 0, total: 36 };
        a.ev.push({ t: "text", s: "도망칠 틈을 보는 중…" });
      }
    }
    const k = inp.skill;
    if (k != null && k >= 0 && k < 4 && !u.cast && !u.lunge && !u.channel && u.dodge === 0 && u.cd[k] === 0 && f.mon.moves[k]) {
      const id = f.mon.moves[k].id;
      const sk = skillOf(id);
      u.cast = { slot: k, move: id, t: 0, total: sk.windup, tx: o.x, ty: o.y, dx: u.fx, dy: u.fy };
      a.ev.push({ t: "cast", side, move: id });
    }
  }
  if (u.dodge > 0) {
    u.x += (u.ddx * 560) / TPS;
    u.y += (u.ddy * 560) / TPS;
    u.dodge--;
  } else if (u.lunge) {
    tickLunge(a, side, rng);
  } else if (!busy) {
    const [dx, dy] = DIRS[inp.dir] ?? [0, 0];
    const v = (moveSpeed(f) * (u.cast ? 0.35 : u.channel ? 0.15 : 1)) / TPS;
    u.x += dx * v;
    u.y += dy * v;
  }
  clampPos(u);
  if (u.cast && !busy) {
    u.cast.t++;
    if (u.cast.t >= u.cast.total) release(a, side, rng);
  }
  if (u.burst) {
    if (--u.burst.t <= 0) {
      spawnShot(a, side, u.burst.move, u.burst.n);
      u.burst.n++;
      u.burst.left--;
      u.burst.t = 4;
      if (u.burst.left <= 0) u.burst = null;
    }
  }
  if (u.channel && !busy) {
    if (++u.channel.t >= u.channel.total) finishChannel(a, side);
  }
}

function clampPos(u: Unit) {
  u.x = clamp(u.x, BODY_R + 6, ARENA_W - BODY_R - 6);
  u.y = clamp(u.y, BODY_R + 30, ARENA_H - BODY_R - 6);
}

function separate(a: Arena) {
  const [p, q] = a.units;
  if (activeOf(a.b, 0).mon.hp <= 0 || activeOf(a.b, 1).mon.hp <= 0) return;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const min = BODY_R * 2 - 4;
  if (d >= min) return;
  const [nx, ny] = d > 1e-6 ? [dx / d, dy / d] : [0, 1];
  const push = (min - d) / 2;
  p.x -= nx * push;
  p.y -= ny * push;
  q.x += nx * push;
  q.y += ny * push;
  clampPos(p);
  clampPos(q);
}

function cancelCast(u: Unit, cd: number) {
  if (!u.cast) return;
  u.cd[u.cast.slot] = Math.max(u.cd[u.cast.slot], cd);
  u.cast = null;
}

function hitsOf(mv: Move, rng: Rng) {
  return mv.hits ? rint(rng, mv.hits[0], mv.hits[1]) : 1;
}

function release(a: Arena, side: 0 | 1, rng: Rng) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const c = u.cast!;
  u.cast = null;
  const mv = moveOf(c.move);
  const sk = skillOf(c.move);
  const f = activeOf(a.b, side);
  u.cd[c.slot] = f.mon.status === "para" ? Math.round(sk.cd * 1.4) : sk.cd;
  a.ev.push({ t: "release", side, move: mv.id, x: u.x, y: u.y, tx: o.x, ty: o.y });
  if (sk.shape === "dash") {
    u.lunge = { move: mv.id, t: 10, dx: u.fx, dy: u.fy, hits: hitsOf(mv, rng) };
  } else if (sk.shape === "slash") {
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const dot = d > 0 ? (dx * c.dx + dy * c.dy) / d : 1;
    if (d <= sk.r + BODY_R && dot >= 0.3) for (let n = 1, k = hitsOf(mv, rng); n <= k; n++) if (!hit(a, side, mv, n, rng)) break;
  } else if (sk.shape === "shot") {
    const k = hitsOf(mv, rng);
    spawnShot(a, side, mv.id, 1);
    if (k > 1) u.burst = { move: mv.id, left: k - 1, t: 4, n: 2 };
  } else if (sk.shape === "orb" || sk.shape === "wave") {
    spawnShot(a, side, mv.id, 1);
  } else if (sk.shape === "beam") {
    const ex = o.x - u.x;
    const ey = o.y - u.y;
    const along = ex * c.dx + ey * c.dy;
    const perp = Math.abs(ex * c.dy - ey * c.dx);
    a.ev.pop();
    a.ev.push({ t: "release", side, move: mv.id, x: u.x, y: u.y, tx: u.x + c.dx * sk.range, ty: u.y + c.dy * sk.range });
    if (along > 0 && along <= sk.range && perp <= sk.r + BODY_R) {
      for (let n = 1, k = hitsOf(mv, rng); n <= k; n++) if (!hit(a, side, mv, n, rng)) break;
    } else if (along > 0 && along <= sk.range && perp <= sk.r + BODY_R + 40) a.ev.push({ t: "miss", side: side ? 0 : 1, x: o.x, y: o.y });
  } else if (sk.shape === "rain" || sk.shape === "blast") {
    a.zones.push({ id: a.nid++, side, move: mv.id, x: o.x, y: o.y, r: sk.r, t: sk.delay, total: sk.delay, pulses: hitsOf(mv, rng), n: 1 });
  } else if (sk.shape === "self") {
    if (mv.heal) {
      const amount = Math.min(f.stats.hp - f.mon.hp, Math.floor(f.stats.hp * mv.heal));
      f.mon.hp += amount;
      a.ev.push({ t: "heal", side, amount });
    }
    if (mv.boost) boost(a, side, mv.boost.stat, mv.boost.by);
  } else if (sk.shape === "hex") {
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    const tf = activeOf(a.b, side ? 0 : 1);
    const ok = dx * dx + dy * dy <= sk.range * sk.range && o.iframe === 0 && tf.mon.hp > 0 && rnd(rng) * 100 < mv.acc;
    if (!ok) a.ev.push({ t: "miss", side: side ? 0 : 1, x: o.x, y: o.y });
    else {
      if (mv.boost) boost(a, side ? 0 : 1, mv.boost.stat, mv.boost.by);
      if (mv.inflict) inflict(a, side ? 0 : 1, mv.inflict.status, 1);
    }
  }
}

function spawnShot(a: Arena, side: 0 | 1, move: string, n: number) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const sk = skillOf(move);
  let [dx, dy] = norm(o.x - u.x, o.y - u.y);
  if (n > 1) {
    const k = (n % 2 ? 1 : -1) * 0.09 * Math.ceil((n - 1) / 2);
    [dx, dy] = norm(dx - dy * k, dy + dx * k);
  }
  const life = Math.ceil((sk.range / sk.speed) * TPS);
  a.shots.push({ id: a.nid++, side, move, x: u.x + dx * (BODY_R + 4), y: u.y + dy * (BODY_R + 4), px: u.x, py: u.y, dx, dy, speed: sk.speed, r: sk.r, life, home: sk.shape === "orb" ? 0.07 : 0, n, passed: false });
}

function tickLunge(a: Arena, side: 0 | 1, rng: Rng) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const l = u.lunge!;
  const step = 540 / TPS;
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= BODY_R * 2 + 12) {
    u.lunge = null;
    const mv = moveOf(l.move);
    for (let n = 1; n <= l.hits; n++) if (!hit(a, side, mv, n, rng)) break;
    u.kx = -l.dx * 160;
    u.ky = -l.dy * 160;
    return;
  }
  u.x += l.dx * step;
  u.y += l.dy * step;
  if (--l.t <= 0) u.lunge = null;
}

function hit(a: Arena, att: 0 | 1, mv: Move, n: number, rng: Rng, frac = 1): boolean {
  const def = (att ? 0 : 1) as 0 | 1;
  const t = a.units[def];
  const df = activeOf(a.b, def);
  const af = activeOf(a.b, att);
  if (df.mon.hp <= 0) return false;
  if (t.iframe > 0 || t.enter > 0) {
    a.ev.push({ t: "miss", side: def, x: t.x, y: t.y });
    return false;
  }
  const r = damage(af, df, mv, rng);
  const dmg = Math.max(1, Math.floor(r.dmg * DMG_SCALE * frac));
  const dealt = Math.min(df.mon.hp, dmg);
  df.mon.hp -= dealt;
  a.ev.push({ t: "hit", side: def, dmg: dealt, eff: r.eff, crit: r.crit, move: mv.id, x: t.x, y: t.y });
  if (t.cast) {
    cancelCast(t, sec(0.6));
    a.ev.push({ t: "interrupt", side: def });
  }
  if (t.channel) {
    t.channel = null;
    a.ev.push({ t: "interrupt", side: def });
  }
  t.hitstun = Math.max(t.hitstun, 4);
  const [nx, ny] = norm(t.x - a.units[att].x, t.y - a.units[att].y);
  const kb = 60 + mv.power * 1.4 + (r.crit ? 80 : 0);
  t.kx = nx * kb;
  t.ky = ny * kb;
  if (df.mon.status === "sleep") {
    df.mon.status = undefined;
    t.stun = 0;
    t.statusT = 0;
    a.ev.push({ t: "status", side: def, status: "sleep", on: false });
  }
  if (mv.drain && af.mon.hp > 0) {
    const back = Math.min(af.stats.hp - af.mon.hp, Math.max(1, Math.floor(dealt * mv.drain)));
    if (back > 0) {
      af.mon.hp += back;
      a.ev.push({ t: "heal", side: att, amount: back, drain: true });
    }
  }
  if (mv.recoil && af.mon.hp > 0) {
    const back = Math.min(af.mon.hp, Math.max(1, Math.floor(dealt * mv.recoil)));
    af.mon.hp -= back;
    const u = a.units[att];
    a.ev.push({ t: "hit", side: att, dmg: back, eff: 1, crit: false, recoil: true, x: u.x, y: u.y });
    if (af.mon.hp <= 0) a.ev.push({ t: "faint", side: att });
  }
  if (mv.flinch && df.mon.hp > 0 && rnd(rng) < mv.flinch) t.stun = Math.max(t.stun, sec(0.5));
  if (mv.inflict && df.mon.hp > 0 && mv.power > 0) inflict(a, def, mv.inflict.status, mv.inflict.chance, rng);
  if (df.mon.hp <= 0) {
    a.ev.push({ t: "faint", side: def });
    return false;
  }
  return true;
}

function inflict(a: Arena, side: 0 | 1, st: Status, chance: number, rng?: Rng) {
  const f = activeOf(a.b, side);
  if (f.mon.status || f.mon.hp <= 0) {
    if (chance >= 1) a.ev.push({ t: "text", s: "그러나 아무 일도 없었다" });
    return;
  }
  if (chance < 1 && rng && rnd(rng) >= chance) return;
  const ty = SPECIES[f.mon.species].type;
  if ((st === "burn" && ty === "불꽃") || (st === "para" && ty === "전기")) return;
  f.mon.status = st;
  const u = a.units[side];
  u.statusT = STATUS_T[st];
  u.dotT = sec(1);
  if (st === "sleep") {
    u.stun = STATUS_T.sleep;
    if (u.cast) cancelCast(u, sec(0.4));
    u.channel = null;
  }
  a.ev.push({ t: "status", side, status: st, on: true });
}

function boost(a: Arena, side: 0 | 1, stat: StatKey, by: number) {
  const f = activeOf(a.b, side);
  const before = f.stages[stat];
  f.stages[stat] = clamp(before + by, -6, 6);
  const d = f.stages[stat] - before;
  if (d) a.units[side].buffs.push({ stat, by: d, t: sec(12) });
  a.ev.push({ t: "stat", side, stat, by: d });
}

function updateShots(a: Arena, rng: Rng) {
  const keep: Shot[] = [];
  for (const s of a.shots) {
    s.px = s.x;
    s.py = s.y;
    const o = a.units[s.side ? 0 : 1];
    const of = activeOf(a.b, s.side ? 0 : 1);
    if (s.home && of.mon.hp > 0) {
      const [tx, ty] = norm(o.x - s.x, o.y - s.y);
      [s.dx, s.dy] = norm(s.dx + tx * s.home, s.dy + ty * s.home);
    }
    s.x += (s.dx * s.speed) / TPS;
    s.y += (s.dy * s.speed) / TPS;
    const dx = o.x - s.x;
    const dy = o.y - s.y;
    const rr = s.r + BODY_R - 4;
    let gone = --s.life <= 0 || s.x < -40 || s.x > ARENA_W + 40 || s.y < -40 || s.y > ARENA_H + 40;
    if (!gone && of.mon.hp > 0 && dx * dx + dy * dy <= rr * rr && o.enter === 0) {
      if (o.iframe > 0) {
        if (!s.passed) a.ev.push({ t: "miss", side: s.side ? 0 : 1, x: o.x, y: o.y });
        s.passed = true;
      } else {
        hit(a, s.side, moveOf(s.move), s.n, rng);
        gone = true;
      }
    }
    if (!gone) keep.push(s);
  }
  a.shots = keep;
}

function updateZones(a: Arena, rng: Rng) {
  const keep: Zone[] = [];
  for (const z of a.zones) {
    if (--z.t <= 0) {
      const o = a.units[z.side ? 0 : 1];
      const of = activeOf(a.b, z.side ? 0 : 1);
      a.ev.push({ t: "pulse", side: z.side, move: z.move, x: z.x, y: z.y, r: z.r });
      const dx = o.x - z.x;
      const dy = o.y - z.y;
      const rr = z.r + BODY_R * 0.5;
      if (of.mon.hp > 0 && dx * dx + dy * dy <= rr * rr) hit(a, z.side, moveOf(z.move), z.n, rng);
      z.pulses--;
      z.n++;
      z.t = 6;
      z.total = 6;
      if (z.pulses <= 0) continue;
    }
    keep.push(z);
  }
  a.zones = keep;
}

function updateThrow(a: Arena, rng: Rng) {
  const th = a.throwing;
  if (!th) return;
  if (++th.t < th.total) return;
  a.throwing = null;
  const o = a.units[1];
  const f = activeOf(a.b, 1);
  const dx = o.x - th.x1;
  const dy = o.y - th.y1;
  if (f.mon.hp <= 0 || o.iframe > 0 || dx * dx + dy * dy > 56 * 56) {
    a.ev.push({ t: "text", s: "공이 빗나갔다!" }, { t: "miss", side: 1, x: th.x1, y: th.y1 });
    return;
  }
  const p = catchChance(f, th.ball, th.aim);
  const each = Math.pow(p, 1 / 3);
  let shakes = 0;
  while (shakes < 3 && rnd(rng) < each) shakes++;
  a.capture = { ball: th.ball, x: o.x, y: o.y, t: 0, shakes, caught: shakes === 3 };
  a.shots = a.shots.filter((s) => s.side === 1);
  o.cast = null;
  o.lunge = null;
}

function tickCapture(a: Arena) {
  const c = a.capture!;
  c.t++;
  for (let n = 1; n <= c.shakes; n++) if (c.t === 14 + n * 20) a.ev.push({ t: "shake", n });
  const end = 14 + Math.max(1, c.shakes) * 20 + 14;
  if (c.t < end) return;
  a.capture = null;
  a.ev.push({ t: "capture", caught: c.caught });
  const f = activeOf(a.b, 1);
  if (c.caught) {
    a.b.over = "caught";
    a.b.caught = { ...f.mon, moves: f.mon.moves.map((x) => ({ ...x })) };
    a.ev.push({ t: "text", s: `${josaName(nameOf(f), "을/를")} 잡았다!` }, { t: "end", result: "caught" });
  } else {
    const u = a.units[1];
    u.iframe = sec(0.6);
    u.stun = 0;
    a.ev.push({ t: "text", s: c.shakes === 0 ? "공에서 바로 튀어나왔다!" : c.shakes === 1 ? "아까워! 금방 나왔다" : "조금만 더였는데!" });
  }
}

function josaName(s: string, pair: "을/를" | "은/는" | "이/가"): string {
  const c = s.charCodeAt(s.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0;
  const [x, y] = pair.split("/");
  return s + (has ? x : y);
}

function finishChannel(a: Arena, side: 0 | 1) {
  const u = a.units[side];
  const ch = u.channel!;
  u.channel = null;
  if (ch.kind === "run") {
    a.b.over = "run";
    a.ev.push({ t: "text", s: "무사히 도망쳤다!" }, { t: "end", result: "run" });
    return;
  }
  const f = activeOf(a.b, side);
  const used = ch.item ? applyItem(f.mon, ch.item) : null;
  if (!used || !a.bag || !ch.item) {
    a.ev.push({ t: "text", s: "써도 소용이 없다" });
    return;
  }
  a.bag.items[ch.item]--;
  const gain = used.hp - f.mon.hp;
  if (ch.item === "cure" && f.mon.status) {
    a.ev.push({ t: "status", side, status: f.mon.status, on: false });
    u.statusT = 0;
    u.stun = 0;
  }
  f.mon = used;
  if (gain > 0) a.ev.push({ t: "heal", side, amount: gain });
}

function timers(a: Arena, side: 0 | 1) {
  const u = a.units[side];
  const f = activeOf(a.b, side);
  for (let k = 0; k < 4; k++) if (u.cd[k] > 0) u.cd[k]--;
  if (u.dodgeCd > 0) u.dodgeCd--;
  if (u.iframe > 0) u.iframe--;
  if (u.hitstun > 0) u.hitstun--;
  if (a.swapCd[side] > 0) a.swapCd[side]--;
  if (u.stun > 0) u.stun--;
  for (const bf of u.buffs) if (--bf.t <= 0) {
    f.stages[bf.stat] = clamp(f.stages[bf.stat] - bf.by, -6, 6);
    a.ev.push({ t: "stat", side, stat: bf.stat, by: -bf.by });
  }
  u.buffs = u.buffs.filter((bf) => bf.t > 0);
  if (f.mon.hp <= 0 || !f.mon.status) return;
  const st = f.mon.status;
  if (st === "burn" || st === "poison") {
    if (--u.dotT <= 0) {
      u.dotT = sec(1);
      const dmg = Math.min(f.mon.hp, Math.max(1, Math.floor(f.stats.hp / (st === "burn" ? 20 : 16))));
      f.mon.hp -= dmg;
      a.ev.push({ t: "hit", side, dmg, eff: 1, crit: false, dot: st, x: u.x, y: u.y });
      if (f.mon.hp <= 0) a.ev.push({ t: "faint", side });
    }
  }
  if (--u.statusT <= 0 && f.mon.hp > 0) {
    f.mon.status = undefined;
    if (st === "sleep") u.stun = 0;
    a.ev.push({ t: "status", side, status: st, on: false });
  }
}

function swapTo(a: Arena, side: 0 | 1, to: number, forced: boolean): boolean {
  const s = a.b.sides[side];
  const f = s.team[to];
  if (!f || f.mon.hp <= 0 || to === s.active) return false;
  const old = a.units[side];
  activeOf(a.b, side).stages = { atk: 0, def: 0, spd: 0 };
  s.active = to;
  const u = unit(side, f);
  u.x = u.px = old.x;
  u.y = u.py = old.y;
  u.enter = sec(0.4);
  a.units[side] = u;
  a.swapCd[side] = forced ? sec(2) : sec(5);
  if (side === 0) {
    a.b.needSwap = false;
    if (!a.b.joined.includes(f.mon.id)) a.b.joined.push(f.mon.id);
  }
  a.ev.push({ t: "swap", side, to });
  return true;
}

function resolve(a: Arena) {
  const b = a.b;
  const alive = (side: 0 | 1) => b.sides[side].team.some((f) => f.mon.hp > 0);
  if (activeOf(b, 1).mon.hp <= 0) {
    if (!alive(1)) {
      b.over = "win";
      a.ev.push({ t: "end", result: "win" });
      return;
    }
    if (a.foeNext === 0) a.foeNext = sec(1);
    else if (--a.foeNext <= 0) {
      a.foeNext = 0;
      const next = b.sides[1].team.findIndex((f) => f.mon.hp > 0);
      swapTo(a, 1, next, true);
      a.ev.push({ t: "text", s: `${josaName(b.sides[1].name, "은/는")} ${josaName(nameOf(b.sides[1].team[next]), "을/를")} 내보냈다!` });
    }
  }
  if (activeOf(b, 0).mon.hp <= 0) {
    if (!alive(0)) {
      b.over = "lose";
      a.ev.push({ t: "text", s: "눈앞이 캄캄해졌다…" }, { t: "end", result: "lose" });
      return;
    }
    b.needSwap = true;
    a.units[0].cast = null;
    a.units[0].lunge = null;
    a.units[0].burst = null;
  }
}

export function think(a: Arena, side: 0 | 1, rng: Rng, sharp = a.mode === "duel"): ArenaInput {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const f = activeOf(a.b, side);
  const of = activeOf(a.b, side ? 0 : 1);
  if (f.mon.hp <= 0 || of.mon.hp <= 0) return { dir: 0 };
  if (u.ai.think > 0) {
    u.ai.think--;
    return { dir: u.ai.dir };
  }
  u.ai.think = sharp ? 4 : 8;
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const out: ArenaInput = { dir: 0 };
  let threat: [number, number] | null = null;
  for (const s of a.shots) {
    if (s.side === side) continue;
    const rx = u.x - s.x;
    const ry = u.y - s.y;
    const along = rx * s.dx + ry * s.dy;
    const perp = rx * s.dy - ry * s.dx;
    if (along > 0 && along < 150 && Math.abs(perp) < s.r + BODY_R + 6) threat = [s.dy * Math.sign(perp || 1), -s.dx * Math.sign(perp || 1)];
  }
  for (const z of a.zones) {
    if (z.side === side) continue;
    const rx = u.x - z.x;
    const ry = u.y - z.y;
    if (rx * rx + ry * ry < (z.r + BODY_R) * (z.r + BODY_R)) threat = norm(rx || 1, ry);
  }
  const oc = o.cast;
  if (oc && skillOf(oc.move).shape === "beam" && oc.total - oc.t < 8) threat = [-oc.dy, oc.dx];
  if (threat && u.dodgeCd === 0 && rnd(rng) < (sharp ? 0.55 : 0.2)) {
    const flip = rnd(rng) < 0.5 && !a.zones.length ? -1 : 1;
    out.dodge = true;
    out.dir = dirOf(threat[0] * flip, threat[1] * flip, 0.1);
  }
  let want = 200;
  if (!u.cast && !u.lunge && !out.dodge && rnd(rng) < (sharp ? 0.75 : 0.45)) {
    const ready = f.mon.moves.map((m, i) => ({ id: m.id, i })).filter(({ i }) => u.cd[i] === 0);
    const scored = ready.map(({ id, i }) => {
      const mv = MOVES[id];
      const sk = skillOf(id);
      let w = mv.power > 0 ? (mv.power * (mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1) * effectiveness(mv.type, SPECIES[of.mon.species].type)) / 10 : 4;
      if (mv.heal) w = f.mon.hp < f.stats.hp * 0.4 ? 30 : 0.2;
      if (mv.inflict && mv.power === 0 && of.mon.status) w = 0.2;
      if (mv.boost && mv.boost.self && f.stages[mv.boost.stat] >= 2) w = 0.2;
      if (dist > sk.range + BODY_R) w *= sk.shape === "dash" || sk.shape === "slash" ? 0.15 : 0.05;
      return { i, w: w + 0.5 };
    });
    const total = scored.reduce((s, x) => s + x.w * x.w, 0);
    let x = rnd(rng) * total;
    for (const s of scored) if ((x -= s.w * s.w) < 0) {
      const sk = skillOf(f.mon.moves[s.i].id);
      if (dist <= sk.range + BODY_R || sk.shape === "dash" || sk.shape === "slash") out.skill = s.i;
      if (sk.shape === "dash" || sk.shape === "slash") want = 70;
      break;
    }
  } else {
    const melee = f.mon.moves.some((m, i) => u.cd[i] < sec(0.5) && ["dash", "slash"].includes(skillOf(m.id).shape) && MOVES[m.id].power > 0);
    want = melee && rnd(rng) < 0.5 ? 80 : 190;
  }
  if (!out.dodge) {
    if (rnd(rng) < 0.12) u.ai.strafe = -u.ai.strafe;
    const [nx, ny] = norm(dx, dy);
    const radial = dist > want + 20 ? 1 : dist < want - 20 ? -1 : 0;
    let mx = nx * radial + -ny * u.ai.strafe * 0.8;
    let my = ny * radial + nx * u.ai.strafe * 0.8;
    if (u.x < 70) mx += 1;
    if (u.x > ARENA_W - 70) mx -= 1;
    if (u.y < 90) my += 1;
    if (u.y > ARENA_H - 70) my -= 1;
    if (threat) {
      mx += threat[0] * 1.5;
      my += threat[1] * 1.5;
    }
    out.dir = dirOf(mx, my, 0.2);
  }
  u.ai.dir = out.dir;
  return out;
}

export type LogEntry = [number, number, number, number];
export const LOG_MAX = 9000;

export function duelInput(i: ArenaInput): ArenaInput {
  const out: ArenaInput = { dir: Number.isInteger(i.dir) && i.dir >= 0 && i.dir <= 8 ? i.dir : 0 };
  if (Number.isInteger(i.skill) && i.skill! >= 0 && i.skill! < 4) out.skill = i.skill;
  else if (i.dodge) out.dodge = true;
  else if (Number.isInteger(i.swap) && i.swap! >= 0 && i.swap! < 6) out.swap = i.swap;
  return out;
}

const entryOf = (tick: number, i: ArenaInput): LogEntry =>
  i.skill != null ? [tick, i.dir, 1, i.skill] : i.dodge ? [tick, i.dir, 2, 0] : i.swap != null ? [tick, i.dir, 3, i.swap] : [tick, i.dir, 0, 0];

export function record(log: LogEntry[], lastDir: number, tick: number, i: ArenaInput): number {
  const e = entryOf(tick, i);
  if ((e[2] !== 0 || e[1] !== lastDir) && log.length < LOG_MAX) log.push(e);
  return i.dir;
}

const inputOf = (e: LogEntry): ArenaInput => duelInput(e[2] === 1 ? { dir: e[1], skill: e[3] } : e[2] === 2 ? { dir: e[1], dodge: true } : e[2] === 3 ? { dir: e[1], swap: e[3] } : { dir: e[1] });

export function replayDuel(start: Battle, log: readonly LogEntry[]): Arena {
  const a = newArena(JSON.parse(JSON.stringify(start)) as Battle, null);
  let i = 0;
  let dir = 0;
  let guard = 0;
  while (!a.b.over && a.tick < a.limit && guard++ < DUEL_TICKS * 3) {
    while (i < log.length && log[i][0] < a.tick) i++;
    if (a.b.needSwap) {
      if (i < log.length && log[i][0] === a.tick) {
        const inp = inputOf(log[i++]);
        dir = inp.dir;
        stepArena(a, inp);
        continue;
      }
      break;
    }
    let inp: ArenaInput = { dir };
    if (i < log.length && log[i][0] === a.tick) {
      inp = inputOf(log[i++]);
      dir = inp.dir;
    }
    stepArena(a, inp);
  }
  return a;
}

export function validLog(x: unknown): x is LogEntry[] {
  if (!Array.isArray(x) || x.length > LOG_MAX) return false;
  let last = 0;
  for (const e of x) {
    if (!Array.isArray(e) || e.length !== 4 || !e.every((v) => Number.isInteger(v))) return false;
    if (e[0] < last || e[0] > DUEL_TICKS || e[1] < 0 || e[1] > 8 || e[2] < 0 || e[2] > 3 || e[3] < 0 || e[3] > 5) return false;
    last = e[0];
  }
  return true;
}
