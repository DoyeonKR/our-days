/* 모험 필드 — 지역마다 걸어 다니는 지도(2026-11-08). README §14.6
 * 수풀에 생물이 보이고, 닿으면 전투가 열린다. 길 끝엔 대장, 곳곳에 상자와 회복 샘이 있다.
 * 순수 로직만 둔다(그리기는 components/adventure/FieldView). 대전 판정과 무관하므로 결정적일 필요는 없지만, 지도는 지역마다 늘 같다. */
import { REGIONS, SPECIES, rnd, rollWild, type Region, type Rng } from "./adventure.ts";

export const FIELD_TPS = 30;
export const FIELD_W = 900;
export const FIELD_H = 2000;
const WALK = 250;
const MON_MAX = 8;
const R_PLAYER = 22;
const R_MON = 34;
/** 조사할 수 있는 거리 */
export const REACH = 96;

export type Blob = { x: number; y: number; r: number };
export type GrassPatch = { x: number; y: number; rx: number; ry: number };
export type FieldMap = {
  key: string;
  /** 길 — 아래에서 위로 굽어 올라간다 */
  path: { x: number; y: number }[];
  grass: GrassPatch[];
  rocks: Blob[];
  /** 못 건너는 물 · 깊은 웅덩이 */
  pools: Blob[];
  spring: { x: number; y: number };
  chests: { x: number; y: number }[];
  guide: { x: number; y: number };
  gate: { x: number; y: number };
  start: { x: number; y: number };
};

const hash = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

export function buildField(region: Region): FieldMap {
  const r: Rng = { s: hash(region.key) };
  const start = { x: FIELD_W / 2, y: FIELD_H - 130 };
  const gate = { x: FIELD_W / 2, y: 150 };
  const path = [start];
  const legs = 6;
  for (let i = 1; i < legs; i++) {
    const side = i % 2 ? 1 : -1;
    path.push({ x: FIELD_W / 2 + side * (120 + rnd(r) * 170), y: start.y + ((gate.y - start.y) * i) / legs });
  }
  path.push(gate);
  const distPath = (x: number, y: number) => {
    let best = Infinity;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const k = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)));
      best = Math.min(best, Math.hypot(a.x + vx * k - x, a.y + vy * k - y));
    }
    return best;
  };
  const taken: Blob[] = [{ ...start, r: 150 }, { ...gate, r: 190 }];
  const free = (x: number, y: number, rad: number) => taken.every((t) => Math.hypot(t.x - x, t.y - y) >= t.r + rad);
  // 수풀 — 길 양옆에 번갈아
  const grass: GrassPatch[] = [];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.7) / 9;
    const y = start.y + (gate.y - start.y) * t;
    for (let n = 0; n < 24; n++) {
      const rx = 130 + rnd(r) * 70;
      const ry = 92 + rnd(r) * 44;
      const x = rx * 0.7 + 30 + rnd(r) * (FIELD_W - rx * 1.4 - 60);
      if (distPath(x, y) < 60 || !free(x, y, ry)) continue;
      grass.push({ x, y, rx, ry });
      taken.push({ x, y, r: ry });
      break;
    }
  }
  // 샘 · 안내인 · 상자
  const place = (min: number, yFrom: number, yTo: number, avoidPath: number) => {
    for (let n = 0; n < 80; n++) {
      const x = 70 + rnd(r) * (FIELD_W - 140);
      const y = yFrom + rnd(r) * (yTo - yFrom);
      if (free(x, y, min) && distPath(x, y) >= avoidPath) {
        taken.push({ x, y, r: min });
        return { x, y };
      }
    }
    return { x: path[3].x, y: path[3].y + 40 };
  };
  const spring = place(70, FIELD_H * 0.42, FIELD_H * 0.62, 70);
  const guide = place(40, start.y - 230, start.y - 110, 70);
  const chests = [place(40, FIELD_H * 0.68, FIELD_H * 0.86, 90), place(40, FIELD_H * 0.36, FIELD_H * 0.56, 90), place(40, FIELD_H * 0.14, FIELD_H * 0.3, 90)];
  // 큰 웅덩이(호수 · 늪) — 길을 막지 않는다
  const pools: Blob[] = [];
  const poolN = region.key === "lake" ? 4 : region.key === "swamp" ? 3 : 0;
  for (let i = 0; i < poolN; i++) {
    for (let n = 0; n < 60; n++) {
      const rad = 90 + rnd(r) * 60;
      const x = rad + 20 + rnd(r) * (FIELD_W - rad * 2 - 40);
      const y = 300 + rnd(r) * (FIELD_H - 600);
      if (free(x, y, rad) && distPath(x, y) >= rad + 74) {
        pools.push({ x, y, r: rad });
        taken.push({ x, y, r: rad });
        break;
      }
    }
  }
  // 바위 · 나무
  const rocks: Blob[] = [];
  for (let i = 0; i < 18; i++) {
    for (let n = 0; n < 30; n++) {
      const rad = 30 + rnd(r) * 24;
      const x = rad + 16 + rnd(r) * (FIELD_W - rad * 2 - 32);
      const y = 120 + rnd(r) * (FIELD_H - 240);
      if (free(x, y, rad + 8) && distPath(x, y) >= rad + 64) {
        rocks.push({ x, y, r: rad });
        taken.push({ x, y, r: rad });
        break;
      }
    }
  }
  return { key: region.key, path, grass, rocks, pools, spring, chests, guide, gate, start };
}

export type FieldMon = {
  id: number; species: string; level: number;
  x: number; y: number; px: number; py: number;
  /** 움직이는 방향 · 다음에 방향을 바꿀 때까지 */
  dx: number; dy: number; t: number;
  home: number;
  /** 귀한 녀석 — 반짝이고 도망친다 */
  rare: boolean;
  /** 사나운 녀석 — 가까이 가면 달려든다 */
  bold: boolean;
  /** 놓친 뒤 잠깐 닿아도 안 싸운다 */
  cool: number;
};

export type FieldState = {
  map: FieldMap;
  x: number; y: number; px: number; py: number;
  /** 보는 쪽(좌우) */
  fx: number;
  /** 지나온 자리 — 뒤따르는 동료가 밟는다 */
  trail: { x: number; y: number }[];
  mons: FieldMon[];
  rng: Rng;
  nid: number;
  respawn: number;
  /** 전투 직후 무적 */
  safe: number;
  tick: number;
};

const DIR: readonly [number, number][] = [[0, 0], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2], [1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2]];

function spawn(s: FieldState, region: Region, farFromPlayer: boolean): void {
  if (!s.map.grass.length) return;
  for (let n = 0; n < 12; n++) {
    const home = Math.floor(rnd(s.rng) * s.map.grass.length);
    const g = s.map.grass[home];
    const x = g.x + (rnd(s.rng) - 0.5) * g.rx * 1.2;
    const y = g.y + (rnd(s.rng) - 0.5) * g.ry * 1.2;
    if (farFromPlayer && Math.hypot(x - s.x, y - s.y) < 320) continue;
    const w = rollWild(region, s.rng);
    const sp = SPECIES[w.species];
    const rare = !!sp.legend || (sp.stage >= 4 && REGIONS.indexOf(region) < 6) || sp.stage === 3 && REGIONS.indexOf(region) < 2;
    s.mons.push({ id: s.nid++, species: w.species, level: w.level, x, y, px: x, py: y, dx: 0, dy: 0, t: 0, home, rare, bold: !rare && rnd(s.rng) < 0.3, cool: 0 });
    return;
  }
}

export function newField(region: Region, seed: number): FieldState {
  const map = buildField(region);
  const s: FieldState = {
    map, x: map.start.x, y: map.start.y, px: map.start.x, py: map.start.y, fx: 1,
    trail: [], mons: [], rng: { s: seed | 0 }, nid: 1, respawn: 0, safe: 45, tick: 0,
  };
  for (let i = 0; i < MON_MAX; i++) spawn(s, region, true);
  return s;
}

function solid(map: FieldMap, p: { x: number; y: number }, rad: number) {
  for (const b of [...map.rocks, ...map.pools]) {
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    const min = b.r + rad - 8;
    if (d < min) {
      const k = d > 1e-6 ? d : 1;
      p.x = b.x + ((p.x - b.x) / k) * min;
      p.y = b.y + ((p.y - b.y) / k) * min;
    }
  }
  p.x = Math.max(rad + 8, Math.min(FIELD_W - rad - 8, p.x));
  p.y = Math.max(rad + 40, Math.min(FIELD_H - rad - 8, p.y));
}

/** 한 틱 — 닿은 생물이 있으면 돌려준다(canFight = 팀에 싸울 수 있는 생물이 있다). */
export function stepField(s: FieldState, region: Region, dir: number, canFight: boolean): FieldMon | null {
  s.tick++;
  s.px = s.x;
  s.py = s.y;
  if (s.safe > 0) s.safe--;
  const [dx, dy] = DIR[dir] ?? [0, 0];
  s.x += (dx * WALK) / FIELD_TPS;
  s.y += (dy * WALK) / FIELD_TPS;
  if (dx > 0.1) s.fx = 1;
  else if (dx < -0.1) s.fx = -1;
  solid(s.map, s, R_PLAYER);
  if (dx || dy) {
    s.trail.unshift({ x: s.x, y: s.y });
    if (s.trail.length > 24) s.trail.pop();
  }
  // 자리 채우기
  if (s.mons.length < MON_MAX && --s.respawn <= 0) {
    s.respawn = 150;
    spawn(s, region, true);
  }
  let met: FieldMon | null = null;
  for (const m of s.mons) {
    m.px = m.x;
    m.py = m.y;
    if (m.cool > 0) m.cool--;
    const g = s.map.grass[m.home];
    const toMe = Math.hypot(s.x - m.x, s.y - m.y);
    let speed = 70;
    if (m.rare && toMe < 240) {
      // 귀한 녀석은 달아난다 — 플레이어보다 느려서 쫓아가면 잡힌다
      m.dx = (m.x - s.x) / (toMe || 1);
      m.dy = (m.y - s.y) / (toMe || 1);
      speed = 195;
    } else if (m.bold && toMe < 200 && m.cool === 0 && canFight && s.safe === 0) {
      m.dx = (s.x - m.x) / (toMe || 1);
      m.dy = (s.y - m.y) / (toMe || 1);
      speed = 185;
    } else if (--m.t <= 0) {
      m.t = 25 + Math.floor(rnd(s.rng) * 60);
      if (rnd(s.rng) < 0.3) {
        m.dx = 0;
        m.dy = 0;
      } else {
        const back = Math.hypot(g.x - m.x, g.y - m.y) > g.rx * 0.7;
        const ax = back ? g.x - m.x : rnd(s.rng) * 2 - 1;
        const ay = back ? g.y - m.y : rnd(s.rng) * 2 - 1;
        const k = Math.hypot(ax, ay) || 1;
        m.dx = ax / k;
        m.dy = ay / k;
      }
    }
    m.x += (m.dx * speed) / FIELD_TPS;
    m.y += (m.dy * speed) / FIELD_TPS;
    solid(s.map, m, R_MON * 0.6);
    if (!met && canFight && s.safe === 0 && m.cool === 0 && Math.hypot(s.x - m.x, s.y - m.y) < R_PLAYER + R_MON) met = m;
  }
  return met;
}

/** 전투가 끝난 뒤 — 이겼거나 잡았으면 사라지고, 도망쳤으면 잠깐 안 건드린다. */
export function afterBattle(s: FieldState, id: number, over: "win" | "lose" | "run" | "caught" | null): void {
  s.safe = 60;
  if (over === "win" || over === "caught") s.mons = s.mons.filter((m) => m.id !== id);
  else {
    const m = s.mons.find((x) => x.id === id);
    if (m) m.cool = 120;
  }
  if (over === "lose") {
    s.x = s.px = s.map.start.x;
    s.y = s.py = s.map.start.y;
    s.trail = [];
  }
}

export type Thing = { kind: "spring" } | { kind: "chest"; slot: number } | { kind: "boss" } | { kind: "guide" };

/** 가장 가까이 있는 조사할 것 */
export function nearestThing(s: FieldState): Thing | null {
  const list: [Thing, { x: number; y: number }][] = [
    [{ kind: "spring" }, s.map.spring],
    [{ kind: "guide" }, s.map.guide],
    [{ kind: "boss" }, s.map.gate],
    ...s.map.chests.map((c, slot): [Thing, { x: number; y: number }] => [{ kind: "chest", slot }, c]),
  ];
  let best: Thing | null = null;
  let d0: number = REACH;
  for (const [t, p] of list) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < d0) {
      d0 = d;
      best = t;
    }
  }
  return best;
}
