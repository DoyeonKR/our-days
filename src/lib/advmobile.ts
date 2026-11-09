/* 모험 폰 조작 다듬기(2026-11-09) — 화면 쪽 순수 계산만 둔다. README §14.6 '폰 조작 다듬기'
 * 엔진(lib/arena · lib/adventure)의 판정은 건드리지 않는다: 여기 있는 건 손가락 · 글자 크기 · 자동 걷기처럼
 * 화면이 엔진에 무엇을 넘길지 정하는 것뿐이다. advmobile.test 가 잠근다. */
import { dirOf } from "./arena.ts";

/* ───────── 떠 있는 막대 ───────── */

/** 막대 반지름(손가락이 이만큼 가면 끝까지 민 것) — 예전 108px 막대의 손잡이 이동 폭과 같다 */
export const STICK_R = 46;
/** 손잡이 거리 비율이 이보다 작으면 멈춤 — dirOf 의 기본 dead zone 과 같다 */
export const STICK_DEAD = 0.28;

/** 누른 자리(ox, oy)가 가운데다. 손가락(x, y)이 반지름 밖이면 손잡이는 테두리에 멈춘다 */
export function stickVec(ox: number, oy: number, x: number, y: number, r = STICK_R): { kx: number; ky: number; dir: number } {
  let dx = x - ox;
  let dy = y - oy;
  const m = Math.hypot(dx, dy);
  if (m > r) {
    dx = (dx / m) * r;
    dy = (dy / m) * r;
  }
  return { kx: dx, ky: dy, dir: dirOf(dx / r, dy / r, STICK_DEAD) };
}

/* ───────── 기술 길게 누르기 ───────── */

/** 누르고 있는 기술을 이번 틱에 다시 넣을지 — 재사용 대기가 끝났고, 다른 입력이 줄에 없고, 시전 · 돌진 중이 아닐 때 */
export function holdRepeat(held: number | null, cd: readonly number[], busy: boolean, queued: boolean): boolean {
  if (held == null || queued || busy) return false;
  return (cd[held] ?? 1) === 0;
}

/* ───────── 공 고리 ───────── */

/** 고리가 이만큼 작아졌으면 '지금!' — 캔버스가 고리를 금색으로 칠하는 기준(ringAim > 0.75)과 같다 */
export const RING_NOW = 0.75;
export const ringNow = (aim: number) => aim > RING_NOW;

/* ───────── 캔버스 글자 ───────── */

/** 그림 좌표의 글자 크기 — 화면에서 floor(CSS px)보다 작아지지 않게 배율로 나눈다. 좁은 폰에서 배율이 0.6 대로 내려간다 */
export function minFont(size: number, scale: number, floor = 12): number {
  return Math.max(size, floor / Math.max(0.05, scale));
}

/* ───────── 아이폰 사파리 '홈 화면에 추가' 안내 ───────── */

export const A2HS_KEY = "ourdays:adv:a2hs:v1";
export const FIELD_COACH_KEY = "ourdays:adv:fieldcoach:v1";

/** 아이폰 · 아이패드 사파리 탭(홈 화면 앱이 아님)일 때만 — 요소 전체 화면이 없어 홈 화면에 추가해야 꽉 찬다 */
export function wantsA2hsTip(o: { ua: string; platform?: string; maxTouchPoints?: number; standalone?: boolean; seen: boolean }): boolean {
  if (o.seen) return false;
  const ios = /iP(hone|od|ad)/.test(o.ua) || (o.platform === "MacIntel" && (o.maxTouchPoints ?? 0) > 1);
  return ios && o.standalone === false;
}

/** localStorage 한 번 표시 — 막힌 브라우저(사생활 보호 등)면 안 띄운다(매번 뜨는 것보다 낫다) */
export function onceFlag(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

/* ───────── 미니맵 → 자동 걷기 ───────── */

type P = { x: number; y: number };
export type Walk = { to: P; pts: P[]; best: number; idle: number; tries: number; detour: { d: number; n: number } | null };

/** 이만큼 가까워지면 다 왔다(조사 거리 REACH 96 안쪽) */
export const WALK_ARRIVE = 60;
/** 지나간 것으로 칠 길목 거리 — 한 틱 걸음(약 8.3)의 두 배 */
const WALK_PASS = 18;
/** 이 틱 수 동안 지금 길목에 더 가까워지지 못하면 걸린 것 — 옆으로 비켜 걸어 본다 */
export const WALK_STUCK = 10;
/** 한 길목에서 비켜 걷기를 이만큼 해도 안 되면 멈춘다 */
export const WALK_TRIES = 6;
const DETOUR_TICKS = 14;

function project(path: readonly P[], p: P): { i: number; q: P } {
  let best = { i: 0, q: path[0], d: Infinity };
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    const q = { x: a.x + vx * k, y: a.y + vy * k };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < best.d) best = { i, q, d };
  }
  return { i: best.i, q: best.q };
}

/** 길(map.path)을 따라 목표 가까이까지 간 뒤 곧장 — 길은 바위 · 웅덩이를 피해 놓여 있다. 가까우면(260 안) 곧장 */
export function planWalk(path: readonly P[], from: P, to: P): Walk {
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  const pts: P[] = [];
  if (straight > 260 && path.length > 1) {
    const a = project(path, from);
    const b = project(path, to);
    pts.push(a.q);
    if (a.i < b.i) for (let i = a.i + 1; i <= b.i; i++) pts.push(path[i]);
    else if (a.i > b.i) for (let i = a.i; i > b.i; i--) pts.push(path[i]);
    pts.push(b.q);
  }
  pts.push(to);
  return { to, pts, best: Infinity, idle: 0, tries: 0, detour: null };
}

/** 8방향(1 = 위, 시계 방향) 돌리기 */
const turn = (d: number, k: number) => ((((d - 1 + k) % 8) + 8) % 8) + 1;

/** 한 틱 — 갈 방향(1~8)을 돌려준다. 다 왔거나 끝내 막혔으면 null(자동 걷기를 끝낸다).
 *  바위 · 웅덩이에 걸리면(길목에 더 가까워지지 않으면) 왼쪽 · 오른쪽으로 번갈아 90도 비켜 몇 걸음 걷고 다시 길목으로 */
export function stepWalk(w: Walk, at: P): number | null {
  if (Math.hypot(w.to.x - at.x, w.to.y - at.y) <= WALK_ARRIVE) return null;
  while (w.pts.length > 1 && Math.hypot(w.pts[0].x - at.x, w.pts[0].y - at.y) < WALK_PASS) {
    w.pts.shift();
    w.best = Infinity;
    w.idle = 0;
    w.tries = 0;
  }
  const t = w.pts[0];
  const dx = t.x - at.x;
  const dy = t.y - at.y;
  const dist = Math.hypot(dx, dy);
  const base = dirOf(dx / (dist || 1), dy / (dist || 1), 0);
  if (!base) return null;
  if (w.detour) {
    if (w.detour.n-- > 0) return w.detour.d;
    w.detour = null;
    w.best = dist;
    w.idle = 0;
  }
  if (dist < w.best - 0.5) {
    w.best = dist;
    w.idle = 0;
  } else if (++w.idle >= WALK_STUCK) {
    if (++w.tries > WALK_TRIES) return null;
    w.idle = 0;
    w.detour = { d: turn(base, w.tries % 2 ? 2 : -2), n: DETOUR_TICKS + w.tries * 4 };
    return w.detour.d;
  }
  return base;
}

/* ───────── 필드 이어 걷기 ───────── */

/** 다시 들어온 필드 — 서 있던 자리 그대로, 잠깐 무적(들어오자마자 달려드는 녀석에 바로 잡히지 않게) · 사이 메우기는 제자리 */
export function resumeField<S extends { x: number; y: number; px: number; py: number; safe: number }>(s: S): S {
  s.px = s.x;
  s.py = s.y;
  s.safe = Math.max(s.safe, 45);
  return s;
}

/** 지역마다 하나 — 날이 바뀌면(상자 · 생물이 새로 놓이는 날) 비운다. AdventureTab 이 같은 규칙을 ref 로 들고 있다(이 파일은 엔진을 불러 탭이 정적으로 못 부른다) */
export function keptField<S>(keep: { day: string; m: Map<string, S> }, day: string, key: string): S | undefined {
  if (keep.day !== day) {
    keep.day = day;
    keep.m.clear();
  }
  return keep.m.get(key);
}

/** 미니맵에서 누른 자리(지도 좌표)에 가장 가까운 표시 — reach(지도 좌표) 밖이면 없음 */
export function pickMarker<T extends P>(marks: readonly T[], at: P, reach: number): T | null {
  let best: T | null = null;
  let d0 = reach;
  for (const m of marks) {
    const d = Math.hypot(m.x - at.x, m.y - at.y);
    if (d < d0) {
      d0 = d;
      best = m;
    }
  }
  return best;
}
