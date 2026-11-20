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
  haul: boolean; rest: number;
  /** 실제로 간 빠르기(부드럽게 거른 값, 월드/초)와 지난 자리 — 머리를 실제로 가는 쪽으로 돌린다(faceTravel) */
  fvx: number; fvy: number; fvz: number; fpx: number; fpy: number; fpz: number; fok: boolean; ceph: boolean; /** 지난 프레임에 그린 머리의 좌우(ohx) · 위아래(ohy) 각 — 큰 몸이 홱 돌지 않게 */ ohx: number; ohy: number; ohz: number; oh: boolean;
  /** 모래 위로 올린 높이(부드럽게 — 한 프레임에 확 들리지 않게) */ lift: number;
  /** 겹침 밀기 + 몸 닿기 보정을 천천히 따라간 값(2026-11-20, CORR_TAU) — 화면에 실제로 더한 보정 */
  cx: number; cy: number; cz: number; corr: boolean; /** 지난 프레임의 보정 목표 — 한 프레임에 확 바뀌었나(순간 이동)를 본다 */ ptx: number; pty: number; ptz: number;
  /** 고래상어 대형 자리를 천천히 따라간 값(2026-11-20, ESCORT_TAU)과 대형에 낀 정도(0~1) */
  ex: number; ey: number; ez: number; ew: number; eok: boolean;
  /** 몸 단계(BODY) — 화면에 그리는 몸의 자리 · 빠르기, 지난 목표 자리, 몸을 잡았던 수조 크기 */
  bx: number; by: number; bz: number; bvx: number; bvy: number; bvz: number; tpx: number; tpy: number; tpz: number; bok: boolean; bw: number; bt: number; bd: number };
const swimStateOf = (m: StepFish): SwimState => {
  const a = anatomy(m.family, m.key), h = habitOf(habitKey(m.family, m.key));
  return {
    x: 0, y: 0, z: 0, v: 0, yaw: 0, ready: false, cx: 0, cy: 0, cz: 0, corr: false, ptx: 0, pty: 0, ptz: 0, ex: 0, ey: 0, ez: 0, ew: 0, eok: false, bx: 0, by: 0, bz: 0, bvx: 0, bvy: 0, bvz: 0, tpx: 0, tpy: 0, tpz: 0, bok: false, bw: 0, bt: 0, bd: 0, fvx: 0, fvy: 0, fvz: 0, fpx: 0, fpy: 0, fpz: 0, fok: false, lift: 0, ohx: 1, ohy: 0, ohz: 0, oh: false, ceph: !!h.ceph || a.kind === "jelly",
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
  /** 있으면 몸 단계가 이번 프레임의 목표 자리(x,y,z)를 여기에 남긴다 — 테스트가 몸이 목표에서 얼마나 늦나 잰다 */ targets?: Float32Array;
};
const FP = { pitch: 0, roll: 0, slope: 0, ground: 0 };
/** turn(몸을 C 자로 굽히고 기울이는 값)을 고르는 시간 상수(초) — 길의 turn 은 장애물로 휜 길 점의 두 번 차분이라, 장애물 가장자리에서 한 프레임에
 *  0.84 rad 만큼 C 자가 뒤집혔다(우럭 · 메기 · 둑중개 · 광어 · 농어가 분에 13~18번 — 2026-11-12 측정). 프레임 빠르기와 상관없게 1 − exp(−dt/τ) 로 섞는다 */
export const TURN_TAU = 0.2;
/** 화면 빠르기를 고르는 시간 상수(초) — 겹침 밀기 · 모래 앉히기가 자리를 조금씩 흔들어 프레임마다 잰 빠르기가 떨린다 */
export const SPEED_TAU = 0.25;
/** 몸끼리 · 바위와 닿아 밀어내는 빠르기 상한(몸길이/초) — 한 프레임 순간 이동을 막는다 */
export const CONTACT_MAX_SPEED = 4;
/** 모래 위로 올리는 몫이 한 프레임에 오를 수 있는 빠르기(몸길이/초) */
export const LIFT_MAX_LPS = 2.5;
/** 보정(겹침 밀기 + 몸 닿기)을 화면에 더하는 시간 상수(초, 2026-11-20) [사용자: "모델 움직임이 실제와 비슷하고 부드럽게"]
 *  붐비는 수조를 90초 돌려 재 보니 혼자 헤엄치는 잉어는 움직이는 방향이 매끈한데(방향 가속 0.4 rad/s²), 18종 36마리 속에서는
 *  몸끼리 닿기를 프레임마다 그 자리에서 밀어내고 다음 프레임 길이 다시 파고들어 몸이 앞뒤 · 좌우로 떨었다(평균 30 ~ 80 rad/s², 방향이 한 프레임에 거의 뒤집히는 일 수백 번).
 *  보정을 이 시간만큼(0.3초) 천천히 따라가게 하면 떨림이 사라지고, 겹침은 한 박자 늦게(0.3초 안) 풀린다(smoothmotion.test) */
export const CORR_TAU = 0.3;
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
const CONTACT = { heading: new Float32Array(0) as ArrayLike<number>, mass: MASS as ArrayLike<number>, pinned: undefined as ArrayLike<number> | undefined, disc: undefined as ArrayLike<number> | undefined, scale: 1, deep: 1, top: 4.7, rocks: undefined as readonly Obstacle[] | undefined, tall: 1, ground: undefined as ((x: number, z: number) => number) | undefined };
const discAt = (n: number) => { if (DISC.length <= n) { const d = new Float32Array(DISC.length * 2); d.set(DISC); DISC = d; } return DISC; };
// 길 옵션 — 프레임마다 · 물고기마다 새 객체를 안 만든다(2026-11-12)
const OPTS = { obstacles: undefined as readonly Obstacle[] | undefined, feed: null as Feed | null, deep: 1, tall: 1, hall: null as Hall | null, leaderLength: 0 as number | undefined, out: undefined as Course | undefined };
/** 고래상어의 기믹(2026-11-17 [사용자: "자기보다 몸집이 작은 개체들이 모두 자기를 따라오도록"]) — 수조에 고래상어가 있으면 그보다 몸이 작은 물고기는
 *  제 길 대신 고래상어 뒤쪽 둘레(원뿔 대형 · 동갈방어 · 빨판상어처럼)에 자리를 잡고 같은 쪽을 보며 따라간다. 자리는 물고기 id 의 황금각으로 정해 겹치지 않고,
 *  자리마다 천천히 흔들려 줄 맞춘 것처럼 굳지 않는다. 빼는 것: 불가사리 · 굴 속(곰치) · 쉬는 포유류(바위 · 모래사장 위). 길 자체(저장 · habits)는 그대로 — 그리기 전용.
 *  WHALE_ESCORT 만큼 섞는다(1 이면 전부 대형). 여러 마리면 가장 큰 고래상어를 따른다. 유리 · 바닥 · 수면 안쪽으로 묶는다. */
export const WHALE_ESCORT = 0.88, WHALE_ESCORT_MAX = 5;
/** 대형 자리를 따라가는 시간(초) · 대형에 들고 나는 시간(초) · 따라가는 가장 빠른 빠르기(몸길이/초) */
export const ESCORT_TAU = 0.5, ESCORT_IN = 1.2, ESCORT_MAX_LPS = 3.5;
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
  if (wk < 0) { for (let k = 0; k < n; k++) { const st = fishes[k].swim; if (st) { st.ew = 0; st.eok = false; } } return; }
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
  // 2026-11-20 — 예전엔 대형 자리를 고래상어 길 방향으로 매 프레임 새로 잡아 그대로 그렸다(따라가기 없음). 고래상어가 돌면 몸 뒤 3 ~ 4 떨어진 자리가 팔 끝처럼 휘둘리고,
  //   대형에 드는 물고기가 바뀌면(포유류가 쉬러 가고 오면) 자리 번호가 밀려 한 프레임에 1 ~ 1.5 를 건너뛰었다(9단계 참다랑어 · 비단잉어 초당 몸길이 25 ~ 33).
  //   이제 자리는 ESCORT_TAU 로 따라가고(한 프레임에 몸길이 ESCORT_MAX_LPS 배/초까지), 대형에 들고 나는 것도 ESCORT_IN 초에 걸쳐 섞는다
  const a = dt > 0 ? 1 - Math.exp(-Math.min(dt, 0.25) / ESCORT_TAU) : 0, ain = dt > 0 ? 1 - Math.exp(-Math.min(dt, 0.25) / ESCORT_IN) : 0;
  for (let k = 0; k < n; k++) {
    if (k === wk) continue;
    const st = fishes[k].swim!, L = b.lengths[k], slot = ESCORT.indexOf(k), c = b.courses[k];
    if (slot < 0 && st.ew <= 0) continue;
    if (slot >= 0) {
      const s = escortSlot(slot, WL, L, elapsed);
      let tx = W.x - fx * s.back - fz * s.side, tz = W.z - fz * s.back + fx * s.side, ty = W.y + s.up;
      const mx = 5 * wide - 0.1 - L / 2, mz = 3 * deep - 0.1 - L / 2;
      tx = Math.max(-mx, Math.min(mx, tx)); tz = Math.max(-mz, Math.min(mz, tz)); if (b.shore) tx = Math.min(tx, b.shore(ty - L * 0.2, tz) - L * 0.45); ty = Math.max(WORLD.floor + 0.3 + L * 0.2, Math.min(top - L * 0.2, ty));
      if (!st.eok) { st.ex = c.x; st.ey = c.y; st.ez = c.z; st.eok = true; }
      let mxs = tx - st.ex, mys = ty - st.ey, mzs = tz - st.ez;
      const step = Math.sqrt(mxs * mxs + mys * mys + mzs * mzs) * a, cap = ESCORT_MAX_LPS * L * Math.min(dt, 0.25);
      const k2 = step > cap && step > 1e-9 ? (cap / step) * a : a;
      mxs *= k2; mys *= k2; mzs *= k2;
      st.ex += mxs; st.ey += mys; st.ez += mzs;
      st.ew += (1 - st.ew) * ain;
    } else {
      // 대형에서 빠졌다 — 제 길로 천천히 돌아간다
      st.ew -= st.ew * ain;
      if (st.ew < 0.01) { st.ew = 0; st.eok = false; continue; }
    }
    const w = WHALE_ESCORT * st.ew;
    c.x += (st.ex - c.x) * w; c.y += (st.ey - c.y) * w; c.z += (st.ez - c.z) * w;
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
//  2026-11-20 — 터널 · 돔 수조(10 · 11단계)는 왼쪽 유리가 아니라 터널 · 돔 오른쪽 가장자리(pivot)부터 줄인다. 왼쪽 유리부터 줄이면 터널 오른쪽 옆 길(x 5.6)이
//   터널 띠 안(1.3)으로, 먹이 때는 건너편까지 끌려가 길이 터널을 가로질렀다(짱뚱어 · 동사리 · 가오리 · 샛비늘치). pivot 왼쪽은 그대로
export function shoreSquash(c: Course, L: number, wide: number, lim: number | ((y: number, z: number) => number), give = 0, pivot?: number) {
  const right = 5 * wide - 0.1 - L / 2, left = pivot !== undefined && pivot < right - 0.5 ? pivot : -right;
  if (c.x <= left) return;
  const limAt = typeof lim === "number" ? () => lim : lim, l0 = limAt(c.y, c.z);
  if (!(l0 < right) || right <= 0) return;
  const sAt = (l: number) => Math.max(0.05, (Math.min(right, Math.max(l, left + 0.05)) - left) / (right - left)), s = sAt(l0);
  // 줄이는 비율이 높이 · 깊이를 따라 바뀌면 오르내릴 때 몸이 옆으로도 움직인다 — 그 몫까지 머리 방향에 넣는다(2026-11-19 — 큰 몸이 모래사장 수조에서 옆으로 미끄러졌다)
  const e = 0.05, dsy = typeof lim === "number" ? 0 : (sAt(limAt(c.y + e, c.z)) - sAt(limAt(c.y - e, c.z))) / (2 * e), dsz = typeof lim === "number" ? 0 : (sAt(limAt(c.y, c.z + e)) - sAt(limAt(c.y, c.z - e))) / (2 * e);
  const x = left + (c.x - left) * s, dx = c.dx * s + (c.x - left) * (dsy * c.dy + dsz * c.dz);
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
  // 몸 단계 스위치 — 테스트가 몸 단계 없는 기준을 잰다(__noBody, contacts.test 의 __noContacts 와 같은 방식)
  const bodyOn = !(globalThis as { __noBody?: boolean }).__noBody;
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
    if (b.shore) { const sw = (m.swim ??= swimStateOf(m)); const sh = b.shore, L2 = m.length; shoreSquash(c, L2, wide, (yy, zz) => sh(yy - L2 * 0.2, zz) - L2 * 0.45, sw.haul ? sw.rest : 0, hall ? Math.min(hall.r + L2 * 0.275 + 0.1, roomX(L2 / 2, wide) + 0.15 * wide) : undefined); }
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
      // 2026-11-20 — 어느 쪽으로 밀지는 지난 프레임에 그린 몸 쪽으로(st.x · st.z). 예전엔 길(c.x)이나 지금 자리의 쪽이라 길이 터널 가운데 · 돔 한가운데를 지날 때마다
      //   쪽이 뒤집혀 목표가 둘레 건너편으로 순간 이동했다(10 · 11단계 갈치 · 메기 · 샛비늘치 초당 몸길이 80 ~ 180). 이제 길이 건너편으로 실제로 빠져나갈 때 한 번만 넘어간다
      const sw0 = fishes[k].swim, px0 = sw0?.ready ? sw0.x : c.x, pz0 = sw0?.ready ? sw0.z : c.z;
      if (hall.kind === "tunnel") { if (span && z > span.back - 0.3 && Math.abs(x) < want) x = (px0 < 0 ? -1 : 1) * want; }
      else { const d = hyp2(x, z); if (d < want) { const d0 = hyp2(px0, pz0); const ux = d0 > 1e-3 ? px0 / d0 : d > 1e-3 ? x / d : 1, uz = d0 > 1e-3 ? pz0 / d0 : d > 1e-3 ? z / d : 0; x = ux * want; z = uz * want; } }
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
    // 모래 위로(2026-11-19) — 헤엄치는 몸(바닥에 안 앉은 몸)은 머리 · 가운데 · 꼬리 밑 모래보다 몸 두께만큼 위에. 길이 비탈 · 모래사장 쪽으로 낮게 지나가도
    //   머리가 모래에 박히지 않는다(예전엔 몸 가운데만 물가 선으로 묶었다). 밀어내기(resolveContacts 의 ground)는 그 뒤 남은 겹침만 받는다
    // 쉼터로 오가는 포유류도 다 올라설 때까지(rest 0.97) 모래 위에 둔다(2026-11-20 — 예전엔 0.3 부터 꺼서 모래사장 경사 속을 몸길이 넘게 지나갔다)
    if (c.ground < 0.5 && !fishes[k].swim!.den && !(fishes[k].swim!.haul && fishes[k].swim!.rest > 0.97)) {
      const hl = hyp3(c.dx, dy, c.dz) || 1, ux = c.dx / hl, uy = dy / hl, uz = c.dz / hl, ha = L * 0.42, clear = L * 0.1;
      let lift = 0;
      for (let t = -1; t <= 1; t += 0.5) lift = Math.max(lift, w.heightAt(x + ux * ha * t, z + uz * ha * t) + clear - (y + uy * ha * t));
      const st2 = fishes[k].swim!, want = lift * (1 - c.ground * 2), ka = dt > 0 ? 1 - Math.exp(-Math.min(dt, 0.25) / 0.3) : 1;
      // 올라갈 땐 0.3초에 걸쳐(다만 몸 두께 넘게 박히진 않게), 내려갈 땐 천천히
      // 2026-11-20 — 몸 두께만큼 박히지 않게 바로 올리던 몫(want − clear)은 한 프레임에 몸길이 LIFT_MAX_LPS 배/초까지만. 9단계 모래사장 둑은 위로 늘린 수조에서 거의 벽이라,
      //   둑 쪽으로 돌아선 머리 밑 모래가 한 프레임에 몸길이만큼 높아져 은어가 두 프레임에 몸길이 1.7 배를 솟구쳤다(초당 47)
      const rise = dt > 0 ? L * LIFT_MAX_LPS * Math.min(dt, 0.25) : Infinity;
      st2.lift = want > st2.lift ? Math.min(st2.lift + rise, Math.max(st2.lift + (want - st2.lift) * ka, want - clear)) : st2.lift + (want - st2.lift) * ka * 0.5;
      if (st2.lift > 0) y += st2.lift;
    } else fishes[k].swim!.lift = 0;
    if (fishes[k].swim!.lap) { const hh = hyp2(c.dx, c.dz); if (hh > 1e-4 && Math.abs(dy) > 1.2 * hh) dy = Math.sign(dy) * 1.2 * hh; }
    b.positions[k * 3] = x; b.positions[k * 3 + 1] = y; b.positions[k * 3 + 2] = z; b.heading[k * 3 + 1] = dy; b.rolls[k] = FP.roll;
    // 4) 꼬리 박자 — 화면에 실제로 그린 자리가 움직인 빠르기(몸길이/초)를 골라 박자로(beatEffort). 처음 · 순간 이동(수조가 바뀜)은 잇기만 한다
    //    몸 단계(BODY)가 켜져 있으면 박자는 몸이 실제로 움직인 빠르기로 — 아래 7) 에서
    if (!bodyOn) {
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
  }
  // 5) 몸끼리 닿지 않게 — 마지막 자리에서 겹친 만큼 밀어낸다(물리 엔진의 접촉처럼, 2026-11-14)
  if (n > 0) {
    const M = massAt(n);
    for (let k = 0; k < n; k++) { const st = fishes[k].swim!; M[k] = (st.den || fishes[k].visit ? 0 : st.haul && st.rest > 0.5 ? 0.15 : 1 - 0.6 * Math.min(1, b.pinned[k])) / (1 + (b.lengths[k] / 1.5) ** 2); }
    // ↑ 몸이 클수록 덜 밀린다(2026-11-19 — 무게는 몸길이의 세제곱이라 고래가 구피와 똑같이 밀려 옆으로 미끄러졌다; 제곱으로 누름)
    CONTACT.heading = b.heading; CONTACT.mass = M; CONTACT.pinned = b.pinned; CONTACT.disc = DISC; CONTACT.scale = wide; CONTACT.deep = deep; CONTACT.top = tallY(4.7, tall); CONTACT.rocks = w.obstacles; CONTACT.tall = tall; CONTACT.ground = w.heightAt;
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
  // 6) 보정을 부드럽게 — 길 자리(c) 대비 보정(겹침 밀기 · 몸 닿기 · 모래 · 유리)을 CORR_TAU 로 따라간다. 처음 · 순간 이동은 그대로 다 쓴다.
  // 멈춘 그리기(dt 0 — 사진 모드 · 움직임 줄이기)는 따라간 값을 그대로 둔다(한 번에 다 더하면 그 프레임에 몸이 튄다). 오래 멈췄다 돌아오면(0.25초 넘게) 바로 다 쓴다
  const kc = dt > 0 && dt < 0.25 ? 1 - Math.exp(-dt / CORR_TAU) : dt === 0 ? 0 : 1;
  for (let k = 0; k < n; k++) {
    const c = b.courses[k], st = fishes[k].swim!, P = b.positions;
    const tx = P[k * 3] - c.x, ty = P[k * 3 + 1] - c.y, tz = P[k * 3 + 2] - c.z, f = st.corr ? kc : 1;
    // 너무 크게 벌어진 보정(몸길이 넘게 — 수조가 바뀜 · 유리 · 모래 경계)은 바로 쓴다(유리 · 모래 밖으로 나가지 않게)
    // 2026-11-20 — 예전엔 보정이 따라간 값과 몸길이 넘게 벌어지면 그 프레임에 다 썼다. 보정이 천천히 커져도(둑 · 몸 닿기) 벌어진 만큼이 한 번에 튀었다.
    //   이제 바로 쓰는 건 보정 목표 자체가 한 프레임에 몸길이 넘게 바뀐 때(수조가 바뀜 · 순간 이동)뿐이고, 천천히 벌어진 건 몸길이 안으로만 붙잡는다
    const gap = hyp3(tx - st.cx, ty - st.cy, tz - st.cz), Lk = b.lengths[k];
    const big = !st.corr || hyp3(tx - st.ptx, ty - st.pty, tz - st.ptz) > Lk;
    const g = big ? 1 : gap > Lk ? Math.max(f, (gap - Lk) / gap) : f;
    st.ptx = tx; st.pty = ty; st.ptz = tz;
    st.cx += (tx - st.cx) * g; st.cz += (tz - st.cz) * g;
    // 바닥에 앉은 몸의 위아래는 바로 쓴다(늦으면 모래에 묻힌다) — 다만 쉼터에서 쉬는 포유류는 고른다(2026-11-20 — 모래 위에 나란히 쉬는 물범끼리 닿기 밀어내기로
    //   한 프레임에 몸 두께만큼 튀었다). 올라갈 땐 세 배 빨리(모래에 묻히지 않게). 굴 속 곰치 · 바닥 물고기까지 고르면 제자리에서 오르내렸다(smoothmotion.test)
    st.cy = c.ground > 0.3 ? (st.haul ? st.cy + (ty - st.cy) * (big ? 1 : ty > st.cy ? Math.min(1, Math.max(g, f * 3)) : g) : ty) : st.cy + (ty - st.cy) * g;
    st.corr = true;
    P[k * 3] = c.x + st.cx; P[k * 3 + 1] = c.y + st.cy; P[k * 3 + 2] = c.z + st.cz;
  }
  // 7) 몸 — 위 단계들이 정한 자리는 '가고 싶은 자리'(목표)이고, 화면에 그리는 몸은 종마다 정한 최고 빠르기 · 가속 안에서만 그 자리를 따라간다(bodyFollow)
  if (bodyOn) bodyFollow(n, fishes, b, dt, w, hall ? hallTop : 0, span);
  // 머리 방향은 부드럽게 따라간 자리로 잰다
  faceTravel(n, fishes, b, dt);
  fishes.length = 0;
  return n;
}

/** 몸 단계(2026-11-20) [사용자: "더 개선할것들 찾아봐 좀 크게 변화해야할걸" → 헤엄 엔진의 마지막 단계 다시 짜기] —
 *  길(habits)에 보정을 여러 겹(물가 줄이기 · 고래상어 대형 · 겹침 밀기 · 모래 위로 올리기 · 몸 닿기 · 보정 고르기) 더한 자리를 예전엔 그대로 그렸다.
 *  어느 한 겹이 한 프레임에 크게 바뀌면 몸이 순간 이동했고, 그때마다 그 겹만 고쳐 왔다(엔진 주석에 '순간 이동 · 튀었다'를 고친 자리 32곳).
 *  이제 그 자리는 목표이고, 몸은 목표를 따라가되 최고 빠르기(그 길이 평소 내는 가장 빠른 빠르기 course.vtop × BODY_MARGIN — 먹이로 달려갈 땐 더,
 *  두족류 물 뿜기는 더, 바닥은 몸길이 BODY_MIN_LPS 배/초)와 가속(최고 빠르기를 BODY_ACC_T 초에 낸다)을 넘지 않는다. 그래서 어느 겹이 틀려도 몸은 튀지 않는다.
 *  따라가기는 목표의 빠르기를 그대로 쓰고(늦지 않게) 남은 거리를 BODY_TAU 초에 줄인다. 몸 자리에서 다시 지킨다: 유리 · 모래 · 물가 · 터널 · 돔(목표가 이미 그 너머면 거기까지).
 *  바닥 물고기는 몸 자리의 모래 높이로 앉힌다. 몸을 잡는 때: 처음 · 오래 멈췄다 돌아옴(0.25초 넘게) · 수조 크기가 바뀜(목표가 멀리 튀어도 잡지 않고 최고 빠르기로 헤엄쳐 간다).
 *  멈춘 그리기(dt 0)는 몸을 목표가 옮긴 만큼만 같이 옮긴다. 빼는 몸(목표 그대로): 굴 속 곰치 · 행사 손님(유리 밖에서 들어온다).
 *  화면(scene)이 stepFish 뒤에 더하는 것(놀람 · 뛰어오르기 · 사냥 달아나기 · 순서 바뀜 이음)은 이 단계 밖이다 */
export const BODY_MARGIN = 1.35, BODY_FEED = 1.9, BODY_JET = 2.6, BODY_TRIP = 2.5, BODY_MIN_LPS = 1.2, BODY_ACC_T = 0.3, BODY_TAU = 0.25;
const BFP = { pitch: 0, roll: 0, slope: 0, ground: 0 };
function bodyFollow(n: number, fishes: StepFish[], b: StepBuffers, dt: number, w: StepWorld, hallTop: number, span: { back: number } | null) {
  const P = b.positions, live = dt > 0 && dt < 0.25, { wide, tall, deep, hall } = w;
  for (let k = 0; k < n; k++) {
    const m = fishes[k], st = m.swim!, c = b.courses[k], L = Math.max(0.05, b.lengths[k]);
    const tx = P[k * 3], ty = P[k * 3 + 1], tz = P[k * 3 + 2];
    if (b.targets && b.targets.length >= (k + 1) * 3) { b.targets[k * 3] = tx; b.targets[k * 3 + 1] = ty; b.targets[k * 3 + 2] = tz; }
    const exempt = st.den || !!m.visit;
    const resized = st.bw !== wide || st.bt !== tall || st.bd !== deep;
    let bx = st.bx, by = st.by, bz = st.bz;
    if (!st.bok || resized || dt > 0.25 || exempt) {
      // 몸을 목표에 잡는다 — 빠르기는 목표가 움직인 만큼(빼는 몸에서 풀려날 때 이어지게)
      if (st.bok && live && !resized) { st.bvx = (tx - st.tpx) / dt; st.bvy = (ty - st.tpy) / dt; st.bvz = (tz - st.tpz) / dt; } else { st.bvx = st.bvy = st.bvz = 0; }
      bx = tx; by = ty; bz = tz;
    } else if (!live) {
      // 멈춘 그리기(dt 0 — 움직임 줄이기 · 숨김 · 장식 옮김 · 물고기 바뀜) — 몸은 목표가 옮긴 만큼만 같이 옮긴다(늦은 거리는 그대로, 예전 길 자리에 남지 않게)
      bx += tx - st.tpx; by += ty - st.tpy; bz += tz - st.tpz;
    } else {
      // 먹이로 달려갈 때 · 두족류 물 뿜기 · 포유류가 쉼터를 오갈 때(haulBlend 의 길은 vtop 에 안 들어간다)는 더 빨리. 바닥은 몸길이로(집 곁만 맴도는 흰동가리도 먹이까지는 간다)
      const feeding = (c.feed ?? 0) > 0.05, trip = st.haul && st.rest > 0.01 && st.rest < 0.99;
      const vtop = c.vtop ?? 0, boost = Math.max(feeding ? BODY_FEED : 1, st.ceph ? BODY_JET : 1, trip ? BODY_TRIP : 1);
      const vmax = Math.max(BODY_MIN_LPS * L * (feeding || trip ? BODY_TRIP : 1), vtop * BODY_MARGIN * boost), amax = vmax / BODY_ACC_T;
      // 목표의 빠르기(최고 빠르기 안으로) + 남은 거리를 BODY_TAU 초에
      let gx = (tx - st.tpx) / dt, gy = (ty - st.tpy) / dt, gz = (tz - st.tpz) / dt;
      const gl = hyp3(gx, gy, gz); if (gl > vmax) { const f = vmax / gl; gx *= f; gy *= f; gz *= f; }
      // 터널 · 돔 너머의 목표 — 곧장 가면 막히므로(목표가 둘레 건너편으로 넘어갔다) 둘레를 돌아가는 자리(aim)로 간다
      let ax0 = tx, az0 = tz, ff = 1;
      if (hall && by - L * 0.16 < hallTop) {
        const want = Math.min(hall.r + L * 0.275 + 0.1, roomX(L / 2, wide) + 0.15 * wide);
        if (hall.kind === "tunnel" && span) {
          // 터널 양옆 — 반대쪽이면 터널 뒤(span.back 너머)로 돌아간다
          //   터널 뒤에 아직 안 왔으면 제 쪽으로 뒤로, 뒤에 왔으면 목표 쪽으로 건너간다(뒤에서 멈칫거리지 않게)
          if (Math.sign(tx) !== Math.sign(bx)) { const behind = bz < span.back - 0.3 - L * 0.4; ax0 = (behind ? Math.sign(tx || 1) : Math.sign(bx || 1)) * want; az0 = span.back - 0.3 - L * 0.6; ff = 0; }
        } else if (hall.kind !== "tunnel") {
          // 돔 — 몸에서 목표로 가는 선이 돔을 지나면 둘레를 따라 목표 쪽으로 0.6 rad 앞선 자리
          const sx = tx - bx, sz = tz - bz, sl2 = sx * sx + sz * sz, u = sl2 > 1e-9 ? Math.max(0, Math.min(1, -(bx * sx + bz * sz) / sl2)) : 0;
          if (hyp2(bx + sx * u, bz + sz * u) < want) {
            const ab = Math.atan2(bz, bx), da = wrapA(Math.atan2(tz, tx) - ab), a = ab + Math.sign(da || 1) * Math.min(Math.abs(da), 0.6), r = want * 1.1;
            ax0 = Math.cos(a) * r; az0 = Math.sin(a) * r; ff = 0;
          }
        }
      }
      // 남은 거리를 줄이는 빠르기 — BODY_TAU 초에, 다만 멈출 수 있는 빠르기(√(2 · 가속 · 거리))까지(빨리 달려와 목표를 지나쳐 솟구치지 않게)
      let ex = ax0 - bx, ey = ty - by, ez = az0 - bz;
      { const el = hyp3(ex, ey, ez); if (el > 1e-9) { const sp = Math.min(el / BODY_TAU, Math.sqrt(2 * amax * el)); ex *= sp / el; ey *= sp / el; ez *= sp / el; } }
      let wx = gx * ff + ex, wy = gy * ff + ey, wz = gz * ff + ez;
      const wl = hyp3(wx, wy, wz); if (wl > vmax) { const f = vmax / wl; wx *= f; wy *= f; wz *= f; }
      let ax = wx - st.bvx, ay = wy - st.bvy, az = wz - st.bvz;
      const al = hyp3(ax, ay, az), amx = amax * dt; if (al > amx) { const f = amx / al; ax *= f; ay *= f; az *= f; }
      st.bvx += ax; st.bvy += ay; st.bvz += az;
      bx += st.bvx * dt; by += st.bvy * dt; bz += st.bvz * dt;
      // 몸 자리에서 다시 지킨다 — 목표가 이미 그 너머면(먹이 · 쉼터로 오르는 길) 목표까지는 허락한다
      const mx = Math.max(5 * wide - 0.1 - L / 2, Math.abs(tx)), mz = Math.max(3 * deep - 0.1 - L / 2, Math.abs(tz));
      bx = Math.max(-mx, Math.min(mx, bx)); bz = Math.max(-mz, Math.min(mz, bz));
      // 수면 — 쉼터(모래사장 · 바위 위)로 오르는 포유류가 아니면 물 위로 안 나간다(목표가 이미 그 위면 거기까지)
      if (!(st.haul && st.rest > 0)) { const top = Math.max(tallY(4.7, tall) - L * 0.2, ty); if (by > top) by = top; }
      // 물가 — 목표와 같은 식(쉬러 오르는 포유류는 쉬는 만큼 풀어 준다), 목표가 이미 그 너머면 거기까지
      if (b.shore) { const give = st.haul ? st.rest : 0, lim = b.shore(by - L * 0.2, bz) - L * 0.45; if (bx > lim) bx = Math.max(lim + (bx - lim) * give, Math.min(bx, tx)); }
      // 터널 · 돔 — 몸이 지난 프레임에 그 위에 있었으면 위에 남기고(옆으로 밀면 한 번에 둘레를 건너뛴다), 옆에 있었으면 지난 몸 쪽으로 둘레를 따라 민다.
      //   목표 쪽(가운데 — 방향이 뒤집힌다)이 아니라 몸 쪽으로 정해서 이어진다. 9 · 11단계 바닥 물고기의 길이 돔 한가운데를 지나 목표가 돔 둘레를 건너뛰어도 몸은 둘레를 돌아간다
      if (hall && by - L * 0.16 < hallTop) {
        const hx0 = bx, hy0 = by, hz0 = bz;
        const want = Math.min(hall.r + L * 0.275 + 0.1, roomX(L / 2, wide) + 0.15 * wide), above = st.by - L * 0.16 >= hallTop - 1e-3;
        // 터널은 지난 몸이 터널 뒤였으면 뒤에 남긴다(옆으로 밀면 터널 너비를 한 번에 건너뛴다)
        //   목표가 그 띠 안이면(길이 터널보다 높다고 본 몸) 몸도 그대로 둔다 — 목표와 싸우지 않게
        if (hall.kind === "tunnel") { if (span && bz > span.back - 0.3 && Math.abs(bx) < want && !(tz > span.back - 0.3 && Math.abs(tx) < want)) { if (above) by = hallTop + L * 0.16; else if (st.bz <= span.back - 0.3 + 1e-3) bz = span.back - 0.3; else bx = (st.bx < 0 ? -1 : 1) * want; } }
        else { const d = hyp2(bx, bz); if (d < want && hyp2(tx, tz) >= want) { if (above) by = hallTop + L * 0.16; else { const d0 = hyp2(st.bx, st.bz) || 1, ux = d > 1e-3 ? bx / d : st.bx / d0, uz = d > 1e-3 ? bz / d : st.bz / d0; bx = ux * want; bz = uz * want; } } }
        // 밀어낸 몫은 한 프레임에 최고 빠르기의 2 배까지 — 띠 안에 들어와 있던 몸(목표를 따라 들어왔다)이 한 번에 밖으로 튀지 않게(나머지는 다음 프레임들이)
        { const px = bx - hx0, py = by - hy0, pz = bz - hz0, pl = hyp3(px, py, pz), lim = 2 * vmax * dt; if (pl > lim) { const f = lim / pl; bx = hx0 + px * f; by = hy0 + py * f; bz = hz0 + pz * f; } }
      }
      if (c.ground > 0) {
        // 바닥 물고기 — 몸 자리의 모래로 앉는다(목표 자리 모래와의 차이만큼)
        floorPose(w.heightAt, tx, tz, c.dx, c.dz, L, BFP); const gT = BFP.ground;
        floorPose(w.heightAt, bx, bz, c.dx, c.dz, L, BFP);
        // 높이도 한 프레임에 최고 빠르기의 2 배까지(모래가 한 번에 확 바뀌어도 — 바닥 물고기의 비탈 오르내림은 이보다 훨씬 느리다)
        const yd = ty + (by - ty) * (1 - c.ground) + c.ground * (BFP.ground - gT), ylim = 2 * vmax * dt;
        by = st.by + Math.max(-ylim, Math.min(ylim, yd - st.by));
        b.rolls[k] = BFP.roll * c.ground;
      } else {
        // 헤엄치는 몸 — 몸 자리 모래 위로(목표가 모래에서 떠 있던 만큼, 몸길이 0.3 배까지)
        // 올리는 몫은 한 프레임에 최고 빠르기의 1.5 배까지 — 늦게 따라오던 몸이 모래사장 둑(위로 늘린 수조에선 거의 벽)에 닿아 둑을 타고 솟구치지 않게
        //   목표가 이미 모래 속이면(먹으러 가다 쉼터 쪽으로 섞인 포유류 — 길 쪽 문제) 몸도 목표만큼만 — 몸이 따로 모래 위로 솟구치지 않게
        const clear = Math.min(ty - w.heightAt(tx, tz), L * 0.3), floor = w.heightAt(bx, bz) + clear;
        if (by < floor) by = Math.min(floor, Math.max(by, st.by) + 1.5 * vmax * dt);
      }
      // 지킨 뒤의 빠르기로 — 막힌 쪽으로 빠르기가 쌓이지 않게
      //   지킨 자리로 민 몫은 다음 프레임 빠르기에 최고 빠르기까지만 남긴다(넘으면 가속 상한 탓에 몇 초 동안 날아갔다 — 10단계 산갈치 초당 몸길이 10)
      st.bvx = (bx - st.bx) / dt; st.bvy = (by - st.by) / dt; st.bvz = (bz - st.bz) / dt;
      { const vl = hyp3(st.bvx, st.bvy, st.bvz); if (vl > vmax) { const f = vmax / vl; st.bvx *= f; st.bvy *= f; st.bvz *= f; } }
    }
    st.tpx = tx; st.tpy = ty; st.tpz = tz; st.bw = wide; st.bt = tall; st.bd = deep;
    // 꼬리 박자 — 몸이 실제로 움직인 빠르기(몸길이/초)로(4 를 몸 단계에서). 처음 · 잡은 때는 잇기만 한다
    const first = !st.bok || !st.ready;
    if (live && !first) {
      const v = hyp3(bx - st.bx, by - st.by, bz - st.bz) / dt / L;
      if (v < 20) st.v += (v - st.v) * (1 - Math.exp(-dt / SPEED_TAU));
    }
    st.bx = bx; st.by = by; st.bz = bz; st.bok = true;
    st.x = bx; st.y = by; st.z = bz; st.ready = true;
    if (!st.own && !first) c.effort = beatEffort(st, L, c.effort, c.ground);
    m.phase += dt * c.effort;
    P[k * 3] = bx; P[k * 3 + 1] = by; P[k * 3 + 2] = bz;
  }
}

/** 머리를 실제로 가는 쪽으로(2026-11-19) [사용자: "애들 움직임 자체가 너무 부자연스러워 진짜 물고기들과 진짜 개체처럼 수영하는 움직임을 … 부드럽게"] —
 *  길 방향(course.dx)을 그대로 머리로 썼는데, 겹침 밀기 · 밀어내기(몸끼리 · 바위 · 모래) · 물가 줄이기가 자리만 옮겨 몸이 옆으로 미끄러졌다
 *  (9단계 실제 크기 수조에서 프레임의 21 ~ 28% 가 머리와 35° 넘게 다른 쪽으로 움직였다 — 범고래 45% · 백상아리 45%). 진짜 물고기는 밀리면 미끄러지지 않고 돈다.
 *  그래서 실제로 간 빠르기를 0.3초로 거른 뒤, 몸길이 0.25 배/초가 넘으면 몸길이 0.08 배/초가 넘으면 그 쪽으로 머리를 돌린다(0.4 배/초에서 최대 85% — 큰 고래는 몸길이에 비해 느려서 문턱을 낮게).
 *  빼는 몸: 두족류 · 해파리(외투막 쪽으로 쏘아 간다) · 불가사리 · 굴 속 곰치 · 바위 · 모래사장에서 쉬는 포유류 · 바닥에 내려앉은 몸 · 잠깐 손님 */
export const FACE_TAU = 0.3, FACE_MAX = 0.85;
function faceTravel(n: number, fishes: StepFish[], b: StepBuffers, dt: number) {
  const P = b.positions, H = b.heading;
  for (let k = 0; k < n; k++) {
    const m = fishes[k], st = m.swim!, x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
    if (!st.fok || !(dt > 0) || dt > 0.25) { st.fpx = x; st.fpy = y; st.fpz = z; st.fok = dt >= 0; st.fvx = st.fvy = st.fvz = 0; continue; }
    const a = 1 - Math.exp(-dt / FACE_TAU);
    st.fvx += ((x - st.fpx) / dt - st.fvx) * a; st.fvy += ((y - st.fpy) / dt - st.fvy) * a; st.fvz += ((z - st.fpz) / dt - st.fvz) * a;
    st.fpx = x; st.fpy = y; st.fpz = z;
    // 바닥에 내려앉은 몸은 길 방향 그대로 — 다만 몸 단계가 목표에서 몸길이 반 넘게 늦어 따로 헤엄쳐 가는 동안(터널 · 돔 둘레로 돌아가기)은 가는 쪽을 본다
    const detour = st.bok && hyp3(x - st.tpx, y - st.tpy, z - st.tpz) > 0.5 * b.lengths[k];
    if (st.ceph || st.disc || st.den || m.visit || (st.haul && st.rest > 0.3) || (b.pinned[k] > 0.5 && !detour)) continue;
    const L = Math.max(0.05, b.lengths[k]), sp = hyp3(st.fvx, st.fvy, st.fvz), bl = sp / Math.min(L, 2); // 큰 몸은 몸길이 2 기준 — 범고래 · 백상아리는 몸길이에 비해 느려 문턱을 못 넘었다
    if (bl < 0.08) continue;
    const t = Math.min(1, (bl - 0.08) / 0.32), w = FACE_MAX * t * t * (3 - 2 * t);
    let hx = H[k * 3], hy = H[k * 3 + 1], hz = H[k * 3 + 2];
    const hl = hyp3(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
    const vx = st.fvx / sp, vy = st.fvy / sp, vz = st.fvz / sp;
    let tx = hx * (1 - w) + vx * w, ty = hy * (1 - w) + vy * w, tz = hz * (1 - w) + vz * w;
    // 오르내릴 때 머리가 곧게 서지 않게(위아래 35° 안) — 거의 수직이면 좌우 방향이 한 프레임에 홱 돌았다. 옆 방향이 거의 없으면 길 쪽 옆 방향을 쓴다
    { let th = Math.sqrt(tx * tx + tz * tz); if (th < 0.05) { const ph = Math.sqrt(hx * hx + hz * hz) || 1; tx = hx / ph * 0.05; tz = hz / ph * 0.05; th = 0.05; } if (Math.abs(ty) > 0.7 * th) ty = Math.sign(ty) * 0.7 * th; }
    const tl = hyp3(tx, ty, tz); if (tl < 1e-4) continue; tx /= tl; ty /= tl; tz /= tl;
    H[k * 3] = tx * hl; H[k * 3 + 1] = ty * hl; H[k * 3 + 2] = tz * hl;
    const c = b.courses[k]; if (c) { c.dx = H[k * 3]; c.dy = H[k * 3 + 1]; c.dz = H[k * 3 + 2]; }
  }
  // 도는 빠르기 묶기 — 몸이 클수록 천천히(초당 6/√몸길이 rad, 0.8 ~ 2.9). 큰 고래 · 상어가 한 프레임에 홱 돌던 것(9단계 8%).
  //   좌우(yaw)와 위아래(pitch)를 따로 묶는다 — 3D 각으로 묶으면 거의 수직인 머리에서 좌우가 한 프레임에 크게 돌 수 있다. 좌우 성분이 거의 없으면 좌우는 지난 값 그대로
  for (let k = 0; k < n; k++) {
    const m = fishes[k], st = m.swim!, hx = H[k * 3], hy = H[k * 3 + 1], hz = H[k * 3 + 2];
    const hl = hyp3(hx, hy, hz); if (hl < 1e-6) continue;
    const hh = Math.sqrt(hx * hx + hz * hz), yaw0 = hh > 0.05 * hl ? Math.atan2(-hz, hx) : st.ohx, pitch0 = Math.atan2(hy, hh);
    if (!st.oh || !(dt > 0) || dt > 0.25 || st.ceph || st.disc || st.den) { st.ohx = yaw0; st.ohy = pitch0; st.oh = true; continue; }
    const L = Math.max(0.05, b.lengths[k]), lim = Math.max(0.8, Math.min(2.9, 6 / Math.sqrt(L))) * dt;
    const dyaw = wrapA(yaw0 - st.ohx), dp = pitch0 - st.ohy;
    const yaw = Math.abs(dyaw) > lim ? st.ohx + Math.sign(dyaw) * lim : yaw0, pitch = Math.abs(dp) > lim ? st.ohy + Math.sign(dp) * lim : pitch0;
    if (yaw !== yaw0 || pitch !== pitch0 || hh <= 0.05 * hl) {
      const cp = Math.cos(pitch);
      H[k * 3] = Math.cos(yaw) * cp * hl; H[k * 3 + 1] = Math.sin(pitch) * hl; H[k * 3 + 2] = -Math.sin(yaw) * cp * hl;
      const c = b.courses[k]; if (c) { c.dx = H[k * 3]; c.dy = H[k * 3 + 1]; c.dz = H[k * 3 + 2]; }
    }
    st.ohx = wrapA(yaw); st.ohy = pitch;
  }
}
