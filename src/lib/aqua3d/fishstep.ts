/** 수조 한 프레임의 물고기 자리(2026-11-11) — scene.ts 의 draw 가 부르던 길 → 늘리기 → 겹침 밀기 → 모래에 앉히기를 한 함수로 뺐다.
 *  화면과 테스트(motion.test · aquamotion.test)가 같은 식을 쓰게 하려고(예전엔 테스트가 화면 식을 흉내 내다 깊이 · 높이 변환이 어긋난 채 통과했다).
 *  three 를 쓰지 않는다. 결과는 buffers 에 쓴다(할당 없음). 같은 입력 = 같은 자리(겹침 밀기 보정값만 프레임마다 이어진다). */
import { denAssign, denCourse, haulAssign, haulBlend, habitKey, habitOf, hyp2, hyp3, roomX, type Course, type Feed, type Hall, type Obstacle } from "./habits.ts";
import { anatomy, bendProfile } from "./anatomy.ts";
import { starCourse } from "./invertebrates.ts";
import { WORLD, floorPose, resolveContacts, schoolCourse, separate, tallY, type SeparateOptions } from "./world.ts";
const SEP: SeparateOptions = {};
import { tunnelSpan } from "./tunnel.ts";

export type StepFish = { family: string; key: string; length: number; phase: number; course: Course;
  /** 프레임 사이에 이어 가는 값 — stepFish 가 처음 볼 때 만든다(엔진은 안 넘겨도 된다). 물고기가 바뀌면 새 객체라 새로 시작한다 */
  swim?: SwimState;
  /** 행사 손님 물고기(2026-11-18, aquaevent.visitWeight) — 있으면 수조 물고기가 아니다: 먹이에 안 모이고 · 고래상어를 안 따르고 · 겹침 밀기 · 몸 밀어내기에
   *  밀리지 않는다(다른 물고기가 비킨다). w 는 왼쪽 유리 밖(0)에서 제 길(1)까지 들어온 정도, dw 는 초당 바뀌는 빠르기(머리 방향) */
  visit?: { w: number; dw: number } };
/** 한 마리의 프레임 사이 값 — 지난 화면 자리(빠르기 재기) · 고른 빠르기 · 지난 머리 방향(무리 따라가는 물고기의 turn) */
export type SwimState = { x: number; y: number; z: number; v: number; yaw: number; ready: boolean;
  /** 물고기마다 한 번 정하는 값(처음 볼 때) — 프레임마다 표를 찾지 않는다(문자열 키 · 새 객체를 안 만든다) */
  stride: number; freq: number; own: boolean; school: boolean; idlePace: number;
  /** 둥근 판(불가사리) — 겹침 밀기가 선분이 아니라 원으로 본다 */
  disc: boolean;
  /** 경기장 고리(habits.lap — 고래상어) — 몸이 보는 쪽으로 유리를 지킨다(아래 3) */
  lap: boolean;
  /** 굴에 산다(habits.den — 곰치) */
  den: boolean;
  /** 바위 위에서 쉰다(habits.haul — 해양 포유류) · 지금 쉬는 정도(0~1, 겹침 밀기를 그만큼 덜 받는다) */
  haul: boolean; rest: number };
const swimStateOf = (m: StepFish): SwimState => {
  const a = anatomy(m.family, m.key), h = habitOf(habitKey(m.family, m.key));
  return {
    x: 0, y: 0, z: 0, v: 0, yaw: 0, ready: false,
    stride: bendProfile(m.family, m.key).stride, freq: a.frequency,
    // 박자를 빠르기로 바꾸지 않는 몸 — 해파리(갓 박자는 길의 jet) · 불가사리 · 거북(turtle.ts 가 따로 젓는다 — 쉬는 동안은 habits 가 effort 를 줄인다)
    own: m.family === "starfish" || m.family === "sea_turtle" || a.kind === "jelly",
    school: m.family !== "starfish" && !!h.school,
    idlePace: h.idle ? (h.pace ?? 1) * h.idle * 1.2 : 0,
    disc: m.family === "starfish",
    lap: !!h.lap,
    den: !!h.den,
    haul: !!h.haul, rest: 0,
  };
};
export type StepWorld = {
  wide: number; tall: number; deep: number;
  heightAt: (x: number, z: number) => number;
  obstacles: readonly Obstacle[]; feed: Feed | null; hall: Hall | null;
};
export type StepBuffers = {
  positions: Float32Array; heading: Float32Array; lengths: Float32Array; pinned: Float32Array; offsets: Float32Array; rolls: Float32Array;
  courses: Course[]; count: number;
  /** 모래사장(8단계부터, habitat.shoreX) — 높이 y 의 물가 가로 위치(월드). 물고기는 그 안쪽에서만 헤엄친다 */ shore?: (y: number, z?: number) => number;
  /** 모래사장 쉼터(kind "beach" — x 월드 · h 길 좌표) — 있으면 포유류는 바위 대신 여기서 쉰다 */ beach?: Obstacle;
};
const FP = { pitch: 0, roll: 0, slope: 0, ground: 0 };
/** turn(몸을 C 자로 굽히고 기울이는 값)을 고르는 시간 상수(초) — 길의 turn 은 장애물로 휜 길 점의 두 번 차분이라, 장애물 가장자리에서 한 프레임에
 *  0.84 rad 만큼 C 자가 뒤집혔다(우럭 · 메기 · 둑중개 · 광어 · 농어가 분에 13~18번 — 2026-11-12 측정). 프레임 빠르기와 상관없게 1 − exp(−dt/τ) 로 섞는다 */
export const TURN_TAU = 0.2;
/** 화면 빠르기를 고르는 시간 상수(초) — 겹침 밀기 · 모래 앉히기가 자리를 조금씩 흔들어 프레임마다 잰 빠르기가 떨린다 */
export const SPEED_TAU = 0.25;
/** 몸끼리 · 바위와 닿아 밀어내는 빠르기 상한(몸길이/초) — 한 프레임 순간 이동을 막는다 */
export const CONTACT_MAX_SPEED = 4;
/** 꼬리 한 번에 나아가는 거리(몸길이) 위 · 아래 박자(Hz) — 화면에서 또렷이 보이는 만큼만 빠르게, 떠 있어도 꼬리가 아예 서지는 않게 */
export const BEAT_MAX_HZ = 4.5, BEAT_IDLE_HZ = 0.35;
const wrapA = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
/** 무리 따라가는 물고기 머리가 도는 빠르기 상한(rad/s) — 거의 멈췄을 때 · 몸길이 0.6 배/초 넘게 헤엄칠 때(사이는 부드럽게) */
export const FOLLOW_TURN_SLOW = 5, FOLLOW_TURN_FAST = 14;
/** 꼬리 박자를 실제 빠르기에 묶는다(2026-11-12) — 옛 effort 는 습성표의 빠르기와 anatomy.frequency 가 따로 놀아, 한 번 칠 때 나아가는 거리가
 *  몸길이의 0.15 ~ 1.1 배였다(참다랑어는 1.8Hz 로 치며 0.29 L/s — 제자리 헤엄, 농어 · 아귀 · 오징어는 1 L 넘게 미끄러졌다. 실제 물고기는 약 0.6, 장어 약 0.35).
 *  이제 박자(Hz) = 화면 빠르기(몸길이/초) ÷ 몸 모양별 보폭(bendProfile.stride) 이고, effort 는 그 박자를 anatomy.frequency 로 나눈 값이다
 *  (GLB · 코드 모델이 phase · frequency 로 박자를 낸다). 멈추면 BEAT_IDLE_HZ(큰 몸일수록 느리게, 모래 위에선 거의 0), 두족류처럼 쉬어도 팔을 움직이는 종은 습성표의 idle 만큼 */
function beatEffort(st: SwimState, length: number, habitEffort: number, ground: number) {
  const idleHz = (BEAT_IDLE_HZ / Math.sqrt(Math.max(0.5, length))) * (1 - 0.8 * Math.max(0, Math.min(1, ground)));
  const hz = Math.max(idleHz, Math.min(BEAT_MAX_HZ, st.v / st.stride));
  let e = (2 * Math.PI * hz) / st.freq;
  if (st.idlePace) e = Math.max(e, Math.min(habitEffort, st.idlePace));
  return e;
}

const STEP_FISH: StepFish[] = [];
// 곰치 굴 나누기(2026-11-13) — 곰치 목록(id · 길이)이나 장애물 목록이 바뀔 때만 다시 정한다(habits.denAssign)
const DEN_FISH: { id: number; length: number }[] = [];
let DEN_KEY = "", DEN_OBS: readonly Obstacle[] | undefined, DEN_MAP: ReturnType<typeof denAssign> = new Map();
function denPlan(swimmers: Iterable<[number, StepFish]>, obstacles: readonly Obstacle[]) {
  DEN_FISH.length = 0;
  for (const [id, m] of swimmers) if ((m.swim ??= swimStateOf(m)).den) DEN_FISH.push({ id, length: m.length });
  if (DEN_FISH.length < 2) { DEN_KEY = ""; return null; } // 혼자면 예전 그대로(hash 로 고른 바위)
  const key = DEN_FISH.map((f) => `${f.id}:${f.length}`).join(",");
  if (key !== DEN_KEY || obstacles !== DEN_OBS) { DEN_KEY = key; DEN_OBS = obstacles; DEN_MAP = denAssign(DEN_FISH, obstacles); }
  return DEN_MAP;
}
// 포유류 쉼터 나누기(2026-11-14) — 곰치 굴과 같은 방식(포유류 목록이나 장애물이 바뀔 때만 다시 정한다)
const HAUL_FISH: { id: number; length: number }[] = [];
let HAUL_SCALE = 1, HAUL_KEY = "", HAUL_OBS: readonly Obstacle[] | undefined, HAUL_MAP: ReturnType<typeof haulAssign> = new Map();
function haulPlan(swimmers: Iterable<[number, StepFish]>, obstacles: readonly Obstacle[], scale: number, beach?: Obstacle) {
  if (scale !== HAUL_SCALE) { HAUL_SCALE = scale; HAUL_KEY = ""; }
  HAUL_FISH.length = 0;
  for (const [id, m] of swimmers) if ((m.swim ??= swimStateOf(m)).haul) HAUL_FISH.push({ id, length: m.length });
  if (!HAUL_FISH.length) { HAUL_KEY = ""; return HAUL_MAP; }
  // 모래사장 단계 — 모두 모래사장에서 쉰다(id 순으로 앞뒤 자리를 나눈다)
  if (beach) { const map: ReturnType<typeof haulAssign> = new Map(); [...HAUL_FISH].sort((a, b) => a.id - b.id).forEach((f, i) => map.set(f.id, { rock: beach, share: i })); HAUL_KEY = ""; return map; }
  const key = HAUL_FISH.map((f) => `${f.id}:${f.length}`).join(",");
  if (key !== HAUL_KEY || obstacles !== HAUL_OBS) { HAUL_KEY = key; HAUL_OBS = obstacles; HAUL_MAP = haulAssign(HAUL_FISH, obstacles, HAUL_SCALE); }
  return HAUL_MAP;
}
// 겹침 밀기에 넘기는 둥근 판 표시 — 프레임마다 새로 안 만든다(늘어날 때만)
let DISC = new Float32Array(64);
// 몸끼리 닿지 않게(resolveContacts) — 밀리는 정도. 굴 속 곰치는 안 밀리고 · 바위 위에서 쉬는 포유류 · 바닥에 붙은 몸은 덜 밀린다
let MASS = new Float32Array(64);
const massAt = (n: number) => { if (MASS.length <= n) MASS = new Float32Array(Math.max(n + 1, MASS.length * 2)); return MASS; };
let CPREV = new Float32Array(192);
const contactPrev = (n: number) => { if (CPREV.length < n) CPREV = new Float32Array(Math.max(n, CPREV.length * 2)); return CPREV; };
const CONTACT = { heading: new Float32Array(0) as ArrayLike<number>, mass: MASS as ArrayLike<number>, pinned: undefined as ArrayLike<number> | undefined, disc: undefined as ArrayLike<number> | undefined, scale: 1, deep: 1, top: 4.7, rocks: undefined as readonly Obstacle[] | undefined, tall: 1 };
const discAt = (n: number) => { if (DISC.length <= n) { const d = new Float32Array(DISC.length * 2); d.set(DISC); DISC = d; } return DISC; };
// 길 옵션 — 프레임마다 · 물고기마다 새 객체를 안 만든다(2026-11-12)
const OPTS = { obstacles: undefined as readonly Obstacle[] | undefined, feed: null as Feed | null, deep: 1, tall: 1, hall: null as Hall | null, leaderLength: 0 as number | undefined, out: undefined as Course | undefined };
/** 고래상어의 기믹(2026-11-17 [사용자: "자기보다 몸집이 작은 개체들이 모두 자기를 따라오도록"]) — 수조에 고래상어가 있으면 그보다 몸이 작은 물고기는
 *  제 길 대신 고래상어 뒤쪽 둘레(원뿔 대형 · 동갈방어 · 빨판상어처럼)에 자리를 잡고 같은 쪽을 보며 따라간다. 자리는 물고기 id 의 황금각으로 정해 겹치지 않고,
 *  자리마다 천천히 흔들려 줄 맞춘 것처럼 굳지 않는다. 빼는 것: 불가사리 · 굴 속(곰치) · 쉬는 포유류(바위 · 모래사장 위). 길 자체(저장 · habits)는 그대로 — 그리기 전용.
 *  WHALE_ESCORT 만큼 섞는다(1 이면 전부 대형). 여러 마리면 가장 큰 고래상어를 따른다. 유리 · 바닥 · 수면 안쪽으로 묶는다. */
export const WHALE_ESCORT = 0.88, WHALE_ESCORT_MAX = 5;
const ESCORT: number[] = [];
export function escortSlot(i: number, whaleL: number, L: number, elapsed: number): { back: number; side: number; up: number } {
  const ring = Math.floor(Math.sqrt(i)), a = i * 2.39996, wob = Math.sin(elapsed * 0.6 + i * 1.7);
  const back = whaleL * (0.35 + 0.22 * ring) + L * 0.6 + wob * whaleL * 0.04;
  const rad = whaleL * (0.22 + 0.09 * ring) + L * 0.5;
  return { back, side: Math.cos(a) * rad, up: Math.sin(a) * rad * 0.6 + Math.cos(elapsed * 0.45 + i) * whaleL * 0.03 };
}
function whaleEscort(n: number, fishes: StepFish[], b: StepBuffers, elapsed: number, dt: number, wide: number, deep: number, tall: number) {
  let wk = -1;
  for (let k = 0; k < n; k++) if (fishes[k].family === "whale_shark" && !fishes[k].visit && (wk < 0 || b.lengths[k] > b.lengths[wk])) wk = k;
  if (wk < 0) return;
  const W = b.courses[wk], WL = b.lengths[wk], hx = W.dx, hz = W.dz, hl = Math.sqrt(hx * hx + hz * hz) || 1, fx = hx / hl, fz = hz / hl;
  const top = tallY(4.7, tall);
  // 2026-11-18 [사용자: "크기작은 개체 오름차순 최대 5마리만"] — 따를 수 있는 몸 중 가장 작은 것부터 WHALE_ESCORT_MAX 마리만(같은 크기면 수조 순서)
  ESCORT.length = 0;
  for (let k = 0; k < n; k++) {
    if (k === wk) continue;
    const m = fishes[k], st = m.swim!, L = b.lengths[k];
    if (L >= WL || m.family === "starfish" || st.den || (st.haul && st.rest > 0.05)) continue;
    // 행사 손님은 잠깐 들르는 그림 — 고래상어 무리에 안 낀다
    if (m.visit) continue;
    ESCORT.push(k);
  }
  ESCORT.sort((a, c) => b.lengths[a] - b.lengths[c] || a - c);
  if (ESCORT.length > WHALE_ESCORT_MAX) ESCORT.length = WHALE_ESCORT_MAX;
  for (let i = 0; i < ESCORT.length; i++) {
    const k = ESCORT[i], st = fishes[k].swim!, L = b.lengths[k];
    const s = escortSlot(i, WL, L, elapsed), c = b.courses[k];
    let tx = W.x - fx * s.back - fz * s.side, tz = W.z - fz * s.back + fx * s.side, ty = W.y + s.up;
    const mx = 5 * wide - 0.1 - L / 2, mz = 3 * deep - 0.1 - L / 2;
    tx = Math.max(-mx, Math.min(mx, tx)); tz = Math.max(-mz, Math.min(mz, tz)); if (b.shore) tx = Math.min(tx, b.shore(ty - L * 0.2, tz) - L * 0.45); ty = Math.max(WORLD.floor + 0.3 + L * 0.2, Math.min(top - L * 0.2, ty));
    const w = WHALE_ESCORT;
    c.x += (tx - c.x) * w; c.y += (ty - c.y) * w; c.z += (tz - c.z) * w;
    // 고래상어와 같은 쪽을 본다 — 제 빠르기는 남긴다
    const mag = Math.sqrt(c.dx * c.dx + c.dz * c.dz) || 1;
    c.dx += (fx * mag - c.dx) * w; c.dz += (fz * mag - c.dz) * w; c.dy += (W.dy * mag / hl - c.dy) * w;
    c.ground *= 1 - w; c.turn *= 1 - w;
    st.yaw = Math.atan2(-c.dz, c.dx);
    b.positions[k * 3] = c.x; b.positions[k * 3 + 1] = c.y; b.positions[k * 3 + 2] = c.z;
    b.heading[k * 3] = c.dx; b.heading[k * 3 + 1] = c.dy; b.heading[k * 3 + 2] = c.dz; b.pinned[k] = c.ground;
  }
  void dt;
}
/** 물가 쪽으로 길 줄이기(2026-11-18 [사용자: "수조 안의 개체들이 해변 절벽에서 계속 군집하는 경향이 있어 수영 알고리즘의 변경이 필요"]) —
 *  길(habits)은 수조 가로 전체를 쓰는데, 모래사장 단계(8단계부터)는 오른쪽이 모래라 예전엔 물가(shore)를 넘은 자리를 물가 선에 그대로 붙였다.
 *  그 결과 물가 너머로 가는 길은 전부 경사면 한 줄에 쌓였다(8 · 9단계 물고기-프레임의 44% 가 물가 몸길이 0.3 안 — 2026-11-18 측정).
 *  이제 왼쪽 유리 ~ 오른쪽 유리의 길을 왼쪽 유리 ~ 그 높이의 물가로 비례해 줄인다 — 물 안에서 고르게 퍼지고, 머리 방향(dx)도 같은 비율로 줄여 몸이 가는 쪽을 본다.
 *  물가가 오른쪽 유리보다 바깥이면(수면 가까이 · 앞유리 쪽) 그대로. give(0 ~ 1)만큼 원래 길로 풀어 준다(모래사장으로 올라가 쉬는 포유류) */
export function shoreSquash(c: Course, L: number, wide: number, lim: number, give = 0) {
  const right = 5 * wide - 0.1 - L / 2, left = -right;
  if (!(lim < right) || right <= 0) return;
  const s = Math.max(0.05, (Math.max(lim, left + 0.05) - left) / (right - left));
  const x = left + (c.x - left) * s, dx = c.dx * s;
  c.x = x + (c.x - x) * give; c.dx = dx + (c.dx - dx) * give;
}
/** 행사 손님이 들어오고 나가는 자리(2026-11-18) — 왼쪽 유리 밖(몸길이 0.6 배 바깥)과 제 길 c 를 w 로 섞는다.
 *  w = 0 이면 유리 밖이라 보이지 않고(scene 이 크기도 줄인다), 1 이면 제 길 그대로. 몸 밀어내기(mass 0)가 유리 안으로 묶지 않으므로 이 자리가 그대로 그려진다 */
export function visitBlend(c: Course, L: number, wide: number, v: { w: number; dw: number }) {
  const ax = -(5 * wide) - L * 0.6, cx = c.x, w = Math.max(0, Math.min(1, v.w));
  c.x = ax + (cx - ax) * w;
  c.dx = c.dx * w + (cx - ax) * v.dw; c.dy *= w; c.dz *= w;
  // 들어오기 시작하는 첫 순간(w · dw 가 둘 다 0)엔 머리 방향이 0 이 된다 — 들어오는 쪽(오른쪽)을 보게 한다
  if (Math.abs(c.dx) + Math.abs(c.dy) + Math.abs(c.dz) < 1e-6) c.dx = v.dw < 0 ? -0.1 : 0.1;
  c.feed = 0;
}
/** 한 프레임 — swimmers 의 순서가 buffers 의 순서다. elapsed 는 수조 시계(초), dt 는 이번 프레임(초, 0 이면 멈춘 그리기) */
export function stepFish(swimmers: Iterable<[number, StepFish]>, schools: ReadonlyMap<number, { leader: number; slot: number }>, lengthOf: (id: number) => number | undefined,
  elapsed: number, dt: number, w: StepWorld, b: StepBuffers) {
  const { wide, tall, deep, hall } = w;
  const opts = OPTS;
  opts.obstacles = w.obstacles; opts.feed = w.feed; opts.deep = deep; opts.tall = tall; opts.hall = hall; opts.leaderLength = 0; opts.out = undefined;
  const span = hall?.kind === "tunnel" ? tunnelSpan(deep) : null;
  let n = 0;
  const fishes = STEP_FISH;
  const dens = denPlan(swimmers, w.obstacles);
  const hauls = haulPlan(swimmers, w.obstacles, wide, b.beach);
  // 1) 이번 프레임 길 — 모두의 자리를 먼저 채운다
  for (const [id, m] of swimmers) {
    const sc = schools.get(id), c = m.course, prevTurn = c.turn;
    // 길 — 장식 · 바위 · 터널 · 돔을 피하고(obstacles · hall) 먹이에 모인다(feed). 무리는 대장 몸으로 길을 계산해야 같은 길을 따라간다
    if (m.family === 'starfish') { const s = starCourse(id, elapsed, m.length, wide, { obstacles: w.obstacles, deep, tall, hall }); c.x = s.x; c.y = s.y; c.z = s.z; c.dx = s.dx; c.dy = s.dy; c.dz = s.dz; c.effort = s.effort; c.turn = 0; c.amp = 1; c.pulse = 0; c.ground = 1; c.puff = -1; c.hover = 0; c.feed = 0; }
    else if ((m.swim ??= swimStateOf(m)).den) { const d = dens?.get(id); denCourse(id, elapsed, m.length, wide, WORLD.floor, { obstacles: w.obstacles, deep, ...(d ? { rock: d.rock, share: d.share } : {}) }, c); }
    else {
      // 행사 손님은 먹이에 안 모인다(먹이 알갱이도 안 먹는다 — food.ts 가 course.feed 를 본다)
      opts.leaderLength = lengthOf(sc?.leader ?? id); opts.out = c; opts.feed = m.visit ? null : w.feed; schoolCourse(sc?.leader ?? id, sc?.slot ?? 0, id, elapsed, m.length, habitKey(m.family, m.key), wide, opts);
      // 해양 포유류 — 헤엄 길을 바위 쉼터와 섞는다(90% 는 바위 위)
      const sw = m.swim!;
      if (sw.haul) { const a = hauls.get(id); sw.rest = haulBlend(id, elapsed, m.length, wide, WORLD.floor, { rock: a?.rock ?? null, share: a?.share ?? 0, deep, tall }, c); }
    }
    // 위로 늘리기 — 바닥에 붙은 만큼(ground)은 모래 높이만 따르고 몸 높이(hug)는 안 늘린다(2026-11-11 — 6단계에서 바닥 물고기가 몸 높이의 1.5배 떠 있었다). 헤엄치는 물고기는 그대로 tallY
    if (tall !== 1) { const k = tall + (1 - tall) * c.ground; c.y = WORLD.floor + (c.y - WORLD.floor) * k; c.dy *= k; }
    if (deep !== 1) { c.z *= deep; c.dz *= deep; }
    // 모래사장 단계 — 길을 물가에서 자르지 않고 그 높이의 물 폭에 맞춰 가로로 줄인다(shoreSquash). 쉬러 올라가는 포유류는 쉬는 만큼 풀어 준다
    if (b.shore) { const sw = (m.swim ??= swimStateOf(m)); shoreSquash(c, m.length, wide, b.shore(c.y - m.length * 0.2, c.z) - m.length * 0.45, sw.haul ? sw.rest : 0); }
    // 행사 손님 — 제 길(물가까지 줄인 뒤)과 왼쪽 유리 밖 한 점을 w 로 섞는다. 왼쪽은 어느 단계든 물이다(모래사장은 오른쪽).
    //   높이 · 깊이는 제 길 그대로라 그 높이로 옆에서 헤엄쳐 들어오고 나간다. 머리 방향은 섞은 자리의 빠르기(들어올 땐 오른쪽, 나갈 땐 왼쪽)
    if (m.visit) visitBlend(c, m.length, wide, m.visit);
    // 몸이 도는 빠르기 — 무리 따라가는 물고기는 대장 길의 turn 이 아니라 제 머리 방향이 실제로 돈 빠르기(예전엔 대장의 C 자를 그대로 따라 했다)
    const st = (m.swim ??= swimStateOf(m));
    let yaw = Math.atan2(-c.dz, c.dx);
    const follower = !!sc && sc.slot > 0 && st.school;
    // 무리 따라가는 물고기의 머리 — 제가 실제로 가는 쪽을 보게 한 뒤로(world.schoolCourse) 거의 멈춰 있을 때(먹이가 끝나 돌아설 때 · 대장 둘레를 맴돌 때)
    // 그 쪽이 한 프레임에 34° 넘게 돌아 홱 꺾였다(10 · 11단계 1분에 9 ~ 10번 — 2026-11-12). 도는 빠르기를 제 빠르기에 맞춰 묶는다:
    // 멈춰 있으면 초당 FOLLOW_TURN_SLOW, 몸길이 0.6 배/초 이상이면 FOLLOW_TURN_FAST(빠를 땐 가는 쪽을 바로 따라가 옆으로 기지 않는다)
    if (follower && st.ready && dt > 0 && dt < 0.25) {
      const k = Math.min(1, st.v / 0.6), lim = (FOLLOW_TURN_SLOW + (FOLLOW_TURN_FAST - FOLLOW_TURN_SLOW) * k * k * (3 - 2 * k)) * dt;
      const d = wrapA(yaw - st.yaw);
      if (Math.abs(d) > lim) {
        yaw = st.yaw + Math.sign(d) * lim;
        const mag = Math.sqrt(c.dx * c.dx + c.dz * c.dz);
        c.dx = Math.cos(yaw) * mag; c.dz = -Math.sin(yaw) * mag;
      }
    }
    let raw = c.turn;
    if (follower) raw = st.ready && dt > 0 && dt < 0.25 ? Math.max(-3, Math.min(3, wrapA(yaw - st.yaw) / dt)) : 0;
    st.yaw = yaw;
    if (Number.isFinite(prevTurn) && st.ready) c.turn = dt > 0 ? prevTurn + (raw - prevTurn) * (1 - Math.exp(-Math.min(dt, 0.25) / TURN_TAU)) : prevTurn;
    else c.turn = raw;
    b.courses[n] = c; fishes[n] = m;
    b.positions[n * 3] = c.x; b.positions[n * 3 + 1] = c.y; b.positions[n * 3 + 2] = c.z;
    b.heading[n * 3] = c.dx; b.heading[n * 3 + 1] = c.dy; b.heading[n * 3 + 2] = c.dz;
    b.lengths[n] = m.length; b.pinned[n] = c.ground;
    discAt(n)[n] = st.disc ? 1 : 0;
    n++;
  }
  b.count = n;
  whaleEscort(n, fishes, b, elapsed, dt, wide, deep, tall);
  // 2) 물고기끼리 깊이 겹치지 않게 — 보정값이 천천히 따라간다(떨림 없음, world.separate). 깊은 수조는 앞뒤 유리도 깊다
  const off = b.offsets.length >= n * 3 ? b.offsets : null;
  // 몸 방향(heading) · 둥근 판(DISC)을 주면 긴 몸 · 바닥 물고기는 몸통 캡슐 사이 거리로도 본다. 장애물을 주면 장식 · 바위 속으로는 안 민다
  SEP.obstacles = w.obstacles; SEP.tall = tall;
  if (off) {
    SEP.n = n; SEP.pinned = b.pinned; SEP.scale = wide; SEP.deep = deep; SEP.heading = b.heading; SEP.disc = DISC; separate(b.positions, b.lengths, off, dt, SEP);
    // 굴에 사는 물고기(곰치)는 겹침 밀기로 굴 밖에 끌려 나오지 않는다 — 비키는 건 다른 물고기 몫
    for (let k = 0; k < n; k++) if (habitOf(habitKey(fishes[k].family, fishes[k].key)).den) off[k * 3] = off[k * 3 + 1] = off[k * 3 + 2] = 0;
    // 행사 손님도 — 유리 밖에서 들어오고 나가는 길이 겹침 밀기로 흐트러지지 않게(비키는 건 수조 물고기 몫)
    for (let k = 0; k < n; k++) if (fishes[k].visit) off[k * 3] = off[k * 3 + 1] = off[k * 3 + 2] = 0;
    // 바위 위에서 쉬는 포유류도 — 쉬는 만큼 밀리지 않는다(바위에서 밀려 떨어지지 않게)
    for (let k = 0; k < n; k++) { const st = fishes[k].swim!; if (st.haul && st.rest > 0) { const keep = 1 - st.rest; off[k * 3] *= keep; off[k * 3 + 1] *= keep; off[k * 3 + 2] *= keep; } }
  }
  // 3) 모래에 앉히기 · 터널 · 돔 밖에 두기
  const hallTop = hall ? WORLD.floor + hall.h * tall : 0;
  for (let k = 0; k < n; k++) {
    const c = b.courses[k], L = b.lengths[k];
    let x = c.x + (off ? off[k * 3] : 0), z = c.z + (off ? off[k * 3 + 2] : 0), y = c.y + (off ? off[k * 3 + 1] : 0), dy = c.dy;
    // 겹침 밀기가 터널 · 돔 속으로 밀지 않게 — 낮은 물고기만, 길이 있던 쪽으로(가운데에서 좌우가 안 뒤집힌다)
    if (hall && y - L * 0.16 < hallTop) {
      // 유리보다 바깥으로는 안 민다(몸이 커서 터널 옆에 다 안 들어가면 유리 쪽이 먼저)
      const want = Math.min(hall.r + L * 0.275 + 0.1, roomX(L / 2, wide) + 0.15 * wide);
      if (hall.kind === "tunnel") { if (span && z > span.back - 0.3 && Math.abs(x) < want) x = (c.x < 0 ? -1 : 1) * want; }
      else { const d = hyp2(x, z); if (d < want) { const ux = d > 1e-3 ? x / d : 1, uz = d > 1e-3 ? z / d : 0; x = ux * want; z = uz * want; } }
    }
    // 경기장 고리 물고기 — 길은 몸이 보는 쪽으로 유리 안이지만(habits) 겹침 밀기 보정은 천천히 따라가 먹이 쪽으로 돌아선 뒤에도 남아 코끝이 앞유리를 0.02 넘었다.
    // 마지막에 머리 방향으로 한 번 더 지킨다(몸 끝 = 가운데 + 반길이 · 머리 방향, 유리 여유 0.1) — 길 위에선 닿지 않는다
    if (fishes[k].swim!.lap) {
      const hl = hyp2(c.dx, c.dz) || 1, mx = 5 * wide - 0.1 - (L / 2) * Math.abs(c.dx) / hl, mz = 3 * deep - 0.1 - (L / 2) * Math.abs(c.dz) / hl;
      if (mx > 0) x = Math.max(-mx, Math.min(mx, x));
      if (mz > 0) z = Math.max(-mz, Math.min(mz, z));
    }
    // 모래사장 경사 — 물가(shore) 안쪽에서만. 머리(몸 반)까지 모래에 안 닿게, 쉬러 올라가는 포유류는 쉬는 만큼 풀어 준다
    if (b.shore) { const lim = b.shore(y - L * 0.2, z) - L * 0.45, give = fishes[k].swim!.haul ? fishes[k].swim!.rest : 0; if (x > lim) x = lim + (x - lim) * give; }
    FP.roll = 0;
    // 바닥 물고기 — 머리 · 꼬리 · 양옆의 모래 높이로 앉고 기운다(비탈에서 몸 끝이 묻히지 않게). 쉬는 거북도 ground 동안
    if (c.ground > 0) { floorPose(w.heightAt, x, z, c.dx, c.dz, L, FP); y += c.ground * (FP.ground - WORLD.floor); dy += c.ground * FP.slope * hyp2(c.dx, c.dz); FP.roll *= c.ground; }
    // 경기장 고리 물고기(고래상어)는 옆모습 돌리기를 안 해서 scene 이 기울기 묶기(sideon.limitPitch)도 안 거친다 — 먹이 바로 밑에서 85° 까지 곧게 섰다.
    // 여기서 같은 값(tan 1.2 ≈ 50°)으로 묶는다
    if (fishes[k].swim!.lap) { const hh = hyp2(c.dx, c.dz); if (hh > 1e-4 && Math.abs(dy) > 1.2 * hh) dy = Math.sign(dy) * 1.2 * hh; }
    b.positions[k * 3] = x; b.positions[k * 3 + 1] = y; b.positions[k * 3 + 2] = z; b.heading[k * 3 + 1] = dy; b.rolls[k] = FP.roll;
    // 4) 꼬리 박자 — 화면에 실제로 그린 자리가 움직인 빠르기(몸길이/초)를 골라 박자로(beatEffort). 처음 · 순간 이동(수조가 바뀜)은 잇기만 한다
    const m = fishes[k], st = m.swim!;
    if (dt > 0 && dt < 0.25 && st.ready) {
      const v = hyp3(x - st.x, y - st.y, z - st.z) / dt / Math.max(0.05, L);
      if (v < 20) st.v += (v - st.v) * (1 - Math.exp(-dt / SPEED_TAU));
    }
    const first = !st.ready;
    st.x = x; st.y = y; st.z = z; st.ready = true;
    if (!st.own && !first) c.effort = beatEffort(st, L, c.effort, c.ground);
    m.phase += dt * c.effort;
  }
  // 5) 몸끼리 닿지 않게 — 마지막 자리에서 겹친 만큼 밀어낸다(물리 엔진의 접촉처럼, 2026-11-14)
  if (n > 0) {
    const M = massAt(n);
    for (let k = 0; k < n; k++) { const st = fishes[k].swim!; M[k] = st.den || fishes[k].visit ? 0 : st.haul && st.rest > 0.5 ? 0.15 : 1 - 0.6 * Math.min(1, b.pinned[k]); }
    CONTACT.heading = b.heading; CONTACT.mass = M; CONTACT.pinned = b.pinned; CONTACT.disc = DISC; CONTACT.scale = wide; CONTACT.deep = deep; CONTACT.top = tallY(4.7, tall); CONTACT.rocks = w.obstacles; CONTACT.tall = tall;
    // __noContacts — 테스트가 밀어내기 없는 기준을 재는 스위치(contacts.test)
    if (!(globalThis as { __noContacts?: boolean }).__noContacts) {
      // 밀어낸 만큼을 겹침 밀기 보정값(offsets)에도 남긴다 — 다음 프레임이 원래 길에서 다시 시작하면 매 프레임 파고들었다 튕겨 나와 한 칸에 몸길이 반씩 튀었다
      const P = b.positions, before = contactPrev(n * 3);
      before.set(P.subarray(0, n * 3));
      resolveContacts(P, b.lengths, n, CONTACT);
      // 한 프레임에 밀어내는 거리는 몸길이 × CONTACT_MAX_SPEED 배/초까지(2026-11-15) — 바위 옆구리에 파고든 몸을 한 번에 바위 위로 밀어 올려 해달 · 물개가 몸길이의 13 ~ 16배/초로 튀었다.
      //   남은 겹침은 다음 프레임들이 나눠 민다(겹침 보정값에 남는다). 멈춘 그리기(dt 0)는 그대로 다 민다
      if (dt > 0) for (let k = 0; k < n; k++) {
        const ox = P[k * 3] - before[k * 3], oy = P[k * 3 + 1] - before[k * 3 + 1], oz = P[k * 3 + 2] - before[k * 3 + 2], d = hyp3(ox, oy, oz), lim = Math.max(0.01, b.lengths[k] * CONTACT_MAX_SPEED * dt);
        if (d > lim) { const f = lim / d; P[k * 3] = before[k * 3] + ox * f; P[k * 3 + 1] = before[k * 3 + 1] + oy * f; P[k * 3 + 2] = before[k * 3 + 2] + oz * f; }
      }
      if (off) for (let k = 0; k < n * 3; k++) off[k] += (P[k] - before[k]) * 0.9;
    }
  }
  fishes.length = 0;
  return n;
}
