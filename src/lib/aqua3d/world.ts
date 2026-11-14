import { FISH_BASE_CM } from "../aquarium.ts";
import { hyp2, restWindow, ringTangent, roomX, roomZ, habitCourse, habitOf, settleFollower, softClamp, type Course, type CourseOptions, type Hall, type Obstacle } from "./habits.ts";

export type { Course, CourseOptions, Feed, Hall, Obstacle } from "./habits.ts";

/** Render-space only. Persisted aquarium coordinates and economics remain unchanged. */
export const WORLD = { width: 10, height: 12, depth: 6, floor: -5.3 } as const;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 옆으로 늘린 단계(0~3) → 가로 배율 */
export const wideScale = (wide: number | undefined) => 1 + clamp(wide ?? 0, 0, 3) / 6;
/** 수조가 화면에서 차지하는 비율(2026-11-10) [사용자: "크기 사이즈도 늘려도 안늘어나는 것 같아"] — 예전엔 카메라가 늘 수조 폭에 꽉 맞췄다.
 *  그래서 수조를 넓혀도 · 옆으로 늘려도 화면 속 수조는 그대로였다(늘리면 오히려 위아래가 줄어 보였다). 이제 단계(1 ~ 6, 위는 6과 같다)와
 *  넓히기(wideScale 1 ~ 1.5)가 오를수록 화면을 더 채운다 — 가장 큰 단계를 끝까지 늘렸을 때가 꽉 찬 1. 늘 1 이하라 양옆이 잘리지 않는다. */
/** 수조 높이 배율(2026-11-10) [사용자: "양옆으로도 위아래로도 늘려야해"] — 단계마다 위로 10%씩, 6단계 1.5배. 바닥은 그 자리에 두고 위로만 늘린다(물고기 길도 같은 비율로 — tallY) */
export const tankTall = (tier: number) => 1 + 0.1 * (clamp(tier, 1, 6) - 1);
/** 바닥(WORLD.floor)을 붙잡고 위로 늘린 높이 — 수조 · 바닥 높이 · 물고기 길이 모두 이 한 식을 쓴다 */
export const tallY = (y: number, tall: number) => WORLD.floor + (y - WORLD.floor) * tall;
export const tankDisplay = (tier: number, wide: number) => (0.79 + 0.042 * (clamp(tier, 1, 6) - 1)) * (0.9 + 0.1 * clamp((wide - 1) / 0.5, 0, 1));
export const decorToWorld = (x: number, y: number, scale = 1) => ({ x: ((clamp(x, 6, 94) - 50) / 10) * scale, y: WORLD.floor, z: (clamp(y, 14, 94) - 54) / 16 });
export const worldToDecor = (x: number, z: number, scale = 1) => ({ x: clamp((x / scale) * 10 + 50, 6, 94), y: clamp(z * 16 + 54, 14, 94) });
/** 수조에서의 몸길이 — 잡은 cm 가 그대로 크기가 된다 [사용자: "잡은 물고기 cm 크기가 실제 크기처럼 반영"]. 더 긴 물고기가 언제나 더 크게 보인다.
 *  진짜 비율이면 고래상어(950cm)가 구피(5cm)의 190배라 구피가 점이 되므로 세제곱근으로 눌렀다(≈ 부피 비례): 구피 5cm 0.9 · 금붕어 22cm 1.5 · 비단잉어 65cm 2.1 · 참다랑어 220cm 3.2 · 고래상어 950cm 5.2.
 *  위아래를 잘라서 치어도 손가락으로 집히고 대물도 수조 폭의 절반을 넘지 않는다. fishCourse 가 길이만큼 도는 반경을 줄여 벽을 안 넘는다. */
export const fishLength = (cm: number, family = "") => clamp(0.9 * (Math.max(cm, 0.1) / 5) ** 0.334, 0.45, /^(kraken|giant_squid)$/.test(family) ? WORLD.width * .48 : 5.4);
const ADULT = new Map<string, number>();
/** 계열의 보통 어른 몸길이 — 빠르기 · 꼬리 박자를 몸 크기에 맞출 때 기준(표에 없는 품종 습성 키는 기준 없이 1) */
export function adultLength(family: string): number | undefined {
  if (!ADULT.has(family)) { const cm = FISH_BASE_CM[family]; ADULT.set(family, cm ? fishLength(cm, family) : NaN); }
  const v = ADULT.get(family)!;
  return Number.isNaN(v) ? undefined : v;
}
/** 물고기 한 마리의 길 — opts 로 장애물(장식 · 바위) · 먹이 · 결과 객체를 넘긴다(전부 선택). 같은 입력이면 어느 기기에서나 같은 값 */
export function fishCourse(id: number, seconds: number, length: number, family: string, scale = 1, opts?: CourseOptions): Course {
  // 어디서 어떻게 사는지는 어종마다 다르다 — habits.ts
  return habitCourse(id, seconds, length, habitOf(family), scale, WORLD.floor, opts, adultLength(family));
}
/** 같은 물고기끼리 무리 지어 돈다 [사용자: "같은 물고기들은 물고기들끼리 군집을 형성해서 돌아가는 형태로"] — 대장이 길을 정하고, 무리는 조금씩 늦게 그 길을 따라가며 해바라기 씨처럼 퍼져 겹치지 않는다.
 *  자리는 대장이 가는 쪽 기준(옆 · 뒤)이라 대장이 돌아도 앞으로 튀어 나가지 않는다. 바닥 무리는 바닥에 그대로 붙어 따라간다.
 *  2026-11-11 — 대장의 순간 머리 방향으로 자리를 돌렸더니 대장이 멈춰 돌아보거나(구경) 먹이 둘레를 맴돌 때 무리 전체가 한 프레임에 휙 돌아 순간 이동했다.
 *  이제 자리는 대장 고리의 접선(고리를 따라 천천히 돈다)으로 잡고, 머리는 대장이 0.9초 동안 실제로 간 쪽(평균 속도)을 본다(거의 멈췄으면 고리 접선). 깊은 수조에서도 자리는 월드 거리 */
const LEAD_A = {} as Course, SIDE_OPTS: CourseOptions = {};
// settleFollower 에 넘기는 옵션 — 부를 때마다 객체 · 펼침({...settle})을 새로 만들지 않게 모듈에 둔다(2026-11-12 — 따라가는 물고기마다 프레임마다 셋)
const SETTLE: { deep?: number; tall?: number; hall?: Hall | null; leader?: { x: number; z: number } } = {}, LEAD_AT = { x: 0, z: 0 };
const TAU = Math.PI * 2;
const smooth01 = (u: number) => u * u * (3 - 2 * u);
/** id 로 정해지는 0 ~ 1 값(소금 k) — 화살표 함수를 부를 때마다 만들지 않게 모듈 함수로 둔다 */
const hashUnit = (h: number, k: number) => ((Math.imul(h ^ k, 2246822519) >>> 0) % 10007) / 10007;
/** 따라가는 물고기가 대장 길보다 몇 초 늦게 가나(2026-11-12) — 예전엔 늘 0.22·자리 초 늦은 대장 길 그대로라 빠르기 · 꼬리 박자(effort 상관 1.000) ·
 *  멈춰 떠 있는 때(95~99% 겹침)가 대장과 똑같았다. 이제 늦음이 물고기마다 0 ~ 0.75 초 더 천천히 늘었다 줄었다 하고(두 사인 — 빠르기 ±30% 안팎, 대장이 멈춰 떠 있는 때도 그만큼 어긋난다),
 *  30~64초마다 한 번 제 몫으로 잠깐 멈췄다가(2.5초에 0.8초 늦어지고) 5초 동안 따라잡는다. 늦음의 기울기는 늘 1 보다 작아(최대 약 0.77)
 *  대장 길을 거꾸로 가는 일이 없다. id · 시각만으로 정해진다(같은 시각 = 같은 자리, 두 기기가 같다) */
export function followerLag(id: number, slot: number, t: number) {
  const hsh = Math.imul((id | 0) + 7919, 2654435761) >>> 0;
  const w1 = TAU / (14 + 8 * hashUnit(hsh, 1)), w2 = TAU / (4 + 2 * hashUnit(hsh, 2));
  let lag = slot * 0.22 + 0.35 + 0.3 * Math.sin(w1 * t + hashUnit(hsh, 3) * TAU) + 0.1 * Math.sin(w2 * t + hashUnit(hsh, 4) * TAU);
  const P = 34 + 30 * hashUnit(hsh, 5), x = ((((t + hashUnit(hsh, 6) * P) % P) + P) % P), D1 = 2.5, D2 = 5, A = 0.8;
  if (x < D1) lag += A * smooth01(x / D1);
  else if (x < D1 + D2) lag += A * (1 - smooth01((x - D1) / D2));
  return lag;
}
/** 대장이 쉬는 정도 — 떠 있는 정도와 (1 − 평균 빠르기 / 기준) 중 큰 쪽을 부드럽게 */
const restOf = (hover: number, vl: number, vRef: number) => smooth01(clamp(Math.max(hover, 1 - vl / vRef), 0, 1));
/** 무리 안 제자리 — 대장에서 옆 · 뒤로 해바라기 씨처럼(월드, 대장 고리 접선 hx · hz 기준) + 대장이 쉬는 동안(rest) 그 자리 둘레를 맴도는 몫.
 *  2026-11-12 — 예전엔 대장 길을 늦게 따라갈 뿐이라 대장이 멈추면 무리가 다 같이 그 자리에 굳었다(대장이 떠 있는 동안 따라가는 물고기도 떠 있는 겹침 80~92%).
 *  맴도는 폭(몸길이 0.3 배) · 한 바퀴(10 ~ 16초) · 방향은 물고기마다(id) 정해지고 쉬는 정도만큼만 — 대장이 헤엄치면 0 이라 예전 그대로. 시각만의 함수. 결과는 SLOT */
const SLOT = { x: 0, y: 0, z: 0 };
/** 바닥 무리의 자리(몸길이 배 — 옆, 뒤) — 해바라기 씨 자리는 절반을 위아래로 벌리는데 바닥 무리는 위아래를 버려서(모래에 붙는다) 거의 한 줄로 겹쳤다
 *  (9단계 명태 무리 여섯 마리가 서로 뚫은 시간 합 542% — 2026-11-12). 바닥에선 나란히 누운 긴 몸이 겹치지 않게 옆 칸을 몸통 두께(0.34)보다 넓게(0.5),
 *  다섯째부터는 몸길이 1.3 배 뒤 두 번째 줄의 엇갈린 칸으로 */
const FLAT_SLOTS: readonly (readonly [number, number])[] = [[0, 0], [0.5, -0.2], [-0.5, -0.2], [1.0, -0.5], [-1.0, -0.5], [0.25, -1.3], [-0.25, -1.3], [0.75, -1.6], [-0.75, -1.6]];
/** 대장이 떠 있는 창마다 따라가는 물고기 중 이만큼은 같이 쉬지 않고 대장 둘레를 천천히 헤엄친다(2026-11-12) — 예전엔 모두 같은 몫으로 맴돌아(지느러미 반쯤 · 몸길이 0.3 배)
 *  다 같이 쉬거나(첫판 겹침 88 ~ 92%) 아무도 안 쉬었다(둘째 판 0 ~ 4%). 창 번호 · id 로 정해져(Math.random 없음) 창마다 다른 물고기가 헤엄친다 */
export const SWIM_SHARE = 0.3;
/** 창 n 에서 이 물고기가 헤엄치나 */
const swimsIn = (id: number, n: number) => hashUnit(Math.imul((id | 0) + 31337, 2654435761) >>> 0, (n | 0) * 7919 + 17) < SWIM_SHARE;
function slotOffset(id: number, slot: number, length: number, hx: number, hz: number, rest: number, seconds: number, flat = false, hw = 0, swim = false) {
  const sx = -hz, sz = hx;
  const reach = Math.sqrt(slot) * Math.max(0.42, length * 0.62);
  const a = slot * 2.399 + Math.sin(seconds * 0.35 + id) * 0.25;
  let side = Math.cos(a) * reach, back = -reach * 0.3 * (1 + Math.sin(a * 1.3)) * 0.5;
  if (flat) {
    // 칸 안에서 조금씩 떠돈다(옆 ±0.05 · 앞뒤 ±0.08 몸길이) — 줄 맞춰 선 군대처럼 보이지 않게. 칸이 모자라면 줄을 하나 더 뒤로
    const k = slot % FLAT_SLOTS.length, row = Math.floor(slot / FLAT_SLOTS.length), L = Math.max(0.7, length);
    side = (FLAT_SLOTS[k][0] + 0.05 * Math.sin(seconds * 0.35 + id)) * L;
    back = (FLAT_SLOTS[k][1] - 1.6 * row + 0.08 * Math.sin(seconds * 0.29 + id * 1.7)) * L;
  }
  const mh = Math.imul((id | 0) + 104729, 2654435761) >>> 0;
  // 맴도는 폭 — 떠 있는 창(hw)의 몫은 같이 쉬는 물고기면 작게(0.1 — 제자리에서 지느러미만), 헤엄치는 물고기면 크게(0.6 — 대장 둘레를 천천히 돈다).
  // 창 밖에서 대장이 느려진 몫(rest − hw)은 예전처럼 0.3. 창 무게는 창 끝에서 0 이라 고른 쪽이 바뀌어도 자리가 안 튄다
  const Lm = Math.max(0.42, length), hwk = Math.min(hw, rest), mr = Lm * (0.3 * (rest - hwk) + (swim ? 0.6 : 0.1) * hwk);
  // 헤엄치는 물고기는 제자리를 대장에게서 몸길이 1.2 배 밖으로 내보낸 뒤 돈다 — 첫째 자리(대장에서 0.6 배)를 그대로 돌면 쉬는 대장 몸을 가로질렀다
  if (swim && hwk > 0) { const d = hyp2(side, back), need = 1.2 * Lm; if (d > 1e-6 && d < need) { const k = 1 + (need / d - 1) * hwk; side *= k; back *= k; } }
  const om = (TAU / (10 + 6 * hashUnit(mh, 1))) * (hashUnit(mh, 2) < 0.5 ? -1 : 1), mph = hashUnit(mh, 3) * TAU;
  SLOT.x = hx * back + sx * side + mr * Math.cos(om * seconds + mph);
  SLOT.z = hz * back + sz * side + mr * Math.sin(om * seconds + mph) * 0.8;
  SLOT.y = Math.sin(a) * reach * 0.6 + rest * 0.12 * length * Math.sin(om * 0.7 * seconds + mph * 2);
  return SLOT;
}
/** 대장의 앞뒤 시각 길을 따로 받을 옵션 — 매 프레임 새 객체를 안 만든다 */
const sideOpts = (opts: CourseOptions | undefined, out: Course) => { const o = SIDE_OPTS; o.obstacles = opts?.obstacles; o.feed = opts?.feed; o.adult = opts?.adult; o.deep = opts?.deep; o.tall = opts?.tall; o.hall = opts?.hall; o.out = out; return o; };
export function schoolCourse(leader: number, slot: number, id: number, seconds: number, length: number, family: string, scale = 1, opts?: CourseOptions): Course {
  // 혼자 사는 물고기는 대장을 따라가지 않는다
  const habit = habitOf(family);
  if (!habit.school) return fishCourse(id, seconds, length, family, scale, opts);
  // 대장의 몸길이로 대장의 길을 그대로 계산한다(제 몸길이로 계산하면 빠르기 · 고리가 달라져 무리에서 떨어진다)
  const lead = opts?.leaderLength ?? length, D = Math.max(1, opts?.deep ?? 1);
  const settle = SETTLE;
  settle.deep = opts?.deep; settle.tall = opts?.tall; settle.hall = opts?.hall; settle.leader = undefined;
  if (slot <= 0) {
    const base = fishCourse(leader, seconds, lead, family, scale, opts);
    return lead === length ? base : settleFollower(base, length, scale, WORLD.floor, opts?.obstacles, settle);
  }
  // 제 늦음 — 대장 길 위를 제 빠르기(go = 대장 길 시각이 흐르는 빠르기, 0.09 ~ 1.6)로 간다
  const dh = 0.05, t0 = seconds - followerLag(id, slot, seconds);
  const go = 1 - (followerLag(id, slot, seconds + dh) - followerLag(id, slot, seconds - dh)) / (2 * dh);
  // 대장이 실제로 가는 쪽 — 0.9초 전 자리와의 차이(대장 길을 마지막에 계산해야 settleFollower 가 그 고리를 쓴다)
  const W = 0.9;
  const pa = fishCourse(leader, t0 - W, lead, family, scale, sideOpts(opts, LEAD_A));
  const pax = pa.x, paz = pa.z, pHover = pa.hover;
  // 그때의 떠 있기 창(0.9초 전 자리도 그때 창으로 — 창이 바뀌는 순간 두 자리가 다른 쪽을 고르면 머리가 튄다)
  const pwin = restWindow(), pW = pwin.w, pSwim = swimsIn(id, pwin.n);
  // 0.9초 전 대장 고리의 접선 — 따라가는 물고기 자리가 그동안 어떻게 옮겨 갔는지(머리 방향)를 재는 데 쓴다(ringTangent 는 다음 길 계산이 덮어쓴다)
  const pt = ringTangent(), ptl = hyp2(pt.x, pt.z) || 1, phx = pt.x / ptl, phz = pt.z / ptl;
  const base = fishCourse(leader, t0, lead, family, scale, opts);
  const lx = base.x, lz = base.z;
  const win = restWindow(), hw = win.w, swim = swimsIn(id, win.n);
  const vx = (lx - pax) / W, vz = ((lz - paz) * D) / W, vl = hyp2(vx, vz);
  // 자리는 대장 고리의 접선 쪽(장애물 · 구경 · 먹이로 휘기 전) — 고리를 따라 천천히만 돈다. 대장이 멈춰 돌아보거나 먹이 둘레를 맴돌아도 무리 자리는 안 돈다
  const rt = ringTangent(), rl = hyp2(rt.x, rt.z) || 1, hx = rt.x / rl, hz = rt.z / rl;
  // 대장이 쉬는 정도(0 ~ 1) — 대장이 떠 있거나(hover) 0.9초 평균 빠르기가 몸길이의 0.3 배/초 밑으로 떨어지면 오른다(둘 다 시각만의 이어지는 값)
  const vRef = Math.max(0.05, 0.3 * lead), rest = restOf(base.hover, vl, vRef), restP = restOf(pHover, vl, vRef);
  // 무리 안 제자리(대장에서 옆 · 뒤) + 대장이 쉬는 동안 맴도는 몫 — 지금과 0.9초 전(그때의 고리 접선 · 쉬는 정도)
  const flat = habit.hug !== undefined;
  slotOffset(id, slot, length, hx, hz, rest, seconds, flat, hw, swim); const ox = SLOT.x, oz = SLOT.z, oy = SLOT.y;
  slotOffset(id, slot, length, phx, phz, restP, seconds - W, flat, pW, pSwim);
  base.x += ox;
  base.z += oz / D;
  // 머리는 이 물고기가 실제로 가는 쪽 — 대장의 0.9초 평균 속도에 제자리가 그동안 옮겨 간 만큼을 더한다(예전엔 대장 속도 + 고리 접선만 봐서
  // 대장이 느릴 때 자리가 도는 만큼 옆으로 기었다). 거의 멈췄으면 고리 접선 쪽(맴도는 동안은 그 몫을 줄인다). 대장의 순간 방향이 튀어도 튀지 않는다
  const mvx = vx + (ox - SLOT.x) / W, mvz = vz + (oz - SLOT.z) / W, mv = hyp2(mvx, mvz);
  // 고리 접선 몫은 거의 멈췄을 때만 — 대장이 먹이에서 돌아오며 고리 접선과 거꾸로 갈 때 이 몫이 실제 움직임을 지워 머리가 한 프레임에 뒤집혔다
  const still = 0.3 * (1 - 0.8 * rest) * (1 - smooth01(clamp(mv / Math.max(0.05, 0.3 * length), 0, 1)));
  const fx = mvx + hx * still, fz = mvz + hz * still;
  const fl = hyp2(fx, fz) || 1;
  const sp = Math.max(mv, 0.05);
  base.dx = (fx / fl) * sp; base.dz = ((fz / fl) * sp) / D;
  // 두족류 — 대장은 돌아서지 않고 외투막 쪽으로(길을 거꾸로) 뿜어 나간다. 따라가는 몸도 머리를 고리 접선(대장과 같은 쪽)에 두어 외투막이 앞이 된다
  //  (가는 쪽을 머리로 두면 팔이 앞인 채 뒤로 날아간다). 예전엔 몸을 180° 돌려 납작한 그림 몸이 잠깐 옆선만 보였다
  if (base.rev) {
    const r = base.rev, ax = (base.dx / sp) * (1 - r) + hx * r, az = ((base.dz * D) / sp) * (1 - r) + hz * r, al = hyp2(ax, az);
    if (al > 0.2) { base.dx = (ax / al) * sp; base.dz = ((az / al) * sp) / D; } else { base.dx = hx * sp; base.dz = (hz * sp) / D; }
  }
  // 제 빠르기만큼 — 멈춰 떠 있는 정도 · 꼬리 폭 · 박자도 제 것(대장이 쉬면 같이 쉬지만, 제 몫으로 멈출 땐 대장이 헤엄쳐도 혼자 쉰다).
  // 박자는 엔진(fishstep)이 화면 빠르기로 다시 맞춘다 — 여기 값은 엔진 밖에서 길만 부를 때 쓴다
  // 맴도는 동안은 덜 떠 있다(지느러미를 덜 접는다 · 꼬리를 조금 친다). 떠 있는 창에서 같이 쉬는 물고기는 대장처럼 떠 있고, 헤엄치는 물고기는 꼬리를 친다
  const hwk = Math.min(hw, rest);
  base.hover = clamp(1 - go * (1 - base.hover), 0, 1) * clamp(1 - 0.6 * (rest - hwk) - (swim ? 0.9 : 0) * hwk, 0, 1);
  base.amp = clamp(Math.max(base.amp * (0.55 + 0.45 * go), 0.35 * (rest - hwk), swim ? 0.75 * hwk : 0.2 * hwk), 0.2, 1.3);
  base.effort *= clamp(go, 0.2, 1.6);
  if (habit.hug !== undefined) base.y += habit.hug * (length - lead); // 바닥 무리는 제 몸 높이로 모래에 붙는다
  else base.y = clamp(base.y + oy, Math.max(-4.4, habit.lo - 0.8), Math.min(4.8, habit.hi + 0.8));
  LEAD_AT.x = lx; LEAD_AT.z = lz; settle.leader = LEAD_AT;
  return settleFollower(base, length, scale, WORLD.floor, opts?.obstacles, settle);
}
/** 먹이를 뿌리는 가로 자리 — 먹이를 줄 때마다(n 번째) 다른 곳, 같은 n 이면 같은 곳(두 기기가 같은 자리를 본다). 넓힌 어항이면 넓힌 만큼 */
export function feedSpot(n: number, wide?: number) {
  const u = ((Math.imul((n | 0) + 1, 2654435761) >>> 0) % 10007) / 10007;
  return (u * 2 - 1) * 3 * wideScale(wide);
}
/** 터널 · 돔 — 물고기 길이 아는 모양으로(낮은 물고기는 터널 옆 길 · 돔 둘레로만 다닌다). 장애물 목록의 터널 기둥 · 돔과 같은 반지름 · 높이 */
export const hallFrom = (kind: "tunnel" | "dome", obstacle: Obstacle | undefined): Hall | null => (obstacle ? { kind, r: obstacle.r, h: obstacle.h } : null);
/** 어느 물고기가 누구를 따라가나 — 같은 계열끼리, id 가 가장 작은 쪽이 대장 */
export function schoolsOf(fish: readonly { id: number; family: string }[]): Map<number, { leader: number; slot: number }> {
  const out = new Map<number, { leader: number; slot: number }>(), groups = new Map<string, number[]>();
  for (const f of fish) groups.set(f.family, [...(groups.get(f.family) ?? []), f.id]);
  for (const ids of groups.values()) ids.slice().sort((p, q) => p - q).forEach((id, slot, sorted) => out.set(id, { leader: sorted[0], slot }));
  return out;
}

/** 장식 · 바위의 경계 상자(월드 좌표) → 길이 피해 갈 원기둥. 엔진이 장식을 놓은 뒤(seatDecor 다음) 한 번 만든다 */
export function obstacleFromBox(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }): Obstacle {
  const w = max.x - min.x, d = max.z - min.z;
  // 바닥에서 본 반지름 — 긴 변의 절반과 대각선 절반 사이(네모를 원으로 덮되 너무 부풀리지 않게)
  return { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2, r: Math.max(0.15, (Math.max(w, d) / 2) * 0.75 + (hyp2(w, d) / 2) * 0.25), h: Math.max(0.1, max.y - WORLD.floor) };
}

let sepTarget = new Float32Array(0);
/** 캡슐 반지름(월드) */
const capR = (i: number, lengths: ArrayLike<number>, pin: ArrayLike<number> | undefined, disc: ArrayLike<number> | undefined) => lengths[i] * (disc && disc[i] > 0.5 ? DISC_R : pin && pin[i] > 0.5 ? CAP_R_PIN : CAP_R);
// 몸 방향 단위 벡터(y 는 거리 재기처럼 2배로 친 공간에서) — 바닥 물고기는 수평만. 결과는 AX
const AX = { x: 1, y: 0, z: 0 };
function axisOf(hd: ArrayLike<number>, i: number, pin: ArrayLike<number> | undefined) {
  const x = hd[i * 3], y = pin && pin[i] > 0.5 ? 0 : hd[i * 3 + 1] * 2, z = hd[i * 3 + 2], l = Math.sqrt(x * x + y * y + z * z);
  if (l < 1e-9) { AX.x = 1; AX.y = 0; AX.z = 0; } else { AX.x = x / l; AX.y = y / l; AX.z = z / l; }
}
export type SeparateOptions = {
  /** 물고기 수(배열이 더 길어도 앞 n 마리만) */
  n?: number;
  /** 1 이면 바닥에 붙어 사는 물고기 — 위아래로는 안 밀고 옆으로만 */
  pinned?: ArrayLike<number>;
  /** 넓힌 어항의 가로 배율 — 민 자리도 유리 안에 있게 */
  scale?: number;
  /** 밀어내는 정도(1 = 딱 안 겹칠 만큼) */
  strength?: number;
  /** 앞뒤 깊이 배율(tankDeep) — 자리(pos)는 깊이를 곱한 월드 좌표다. 민 자리를 깊은 수조의 앞뒤 유리(±3·deep)에 맞춘다 */
  deep?: number;
  /** 몸 방향(x,y,z 를 차례로, 월드 · 크기 상관없음) — 주면 긴 몸 · 바닥 물고기끼리는 몸 가운데 대신 몸통 선분(캡슐) 사이 거리로 본다 */
  heading?: ArrayLike<number>;
  /** 1 이면 둥근 판(불가사리) — 선분이 아니라 몸길이 0.45 배 반지름의 원으로 본다 */
  disc?: ArrayLike<number>;
  /** 장식 · 바위(stepFish 가 넘기는 목록 그대로 — z 는 길 좌표 · h 는 길 좌표 높이) — 주면 밀어낸 자리가 장애물 속으로 더 들어가지 않게 한다 */
  obstacles?: readonly Obstacle[];
  /** 위로 늘린 배율(tankTall) — 장애물 높이(h)를 월드로 */
  tall?: number;
};
/** 몸통 캡슐로 보는 물고기 — 바닥에 붙었거나(pinned) 이만큼 긴 몸(월드) */
export const CAPSULE_LONG = 2.4;
/** 캡슐 반지름(몸길이 배) · 몸통 선분의 반길이(몸길이 배) — 납작한 바닥 물고기(광어 · 가오리)는 옆으로 넓어 조금 크게 */
const CAP_R = 0.13, CAP_R_PIN = 0.17, CAP_HALF = 0.4, DISC_R = 0.45;
// 두 선분 사이 가장 가까운 두 점의 차(첫 선분 쪽 − 둘째 선분 쪽, y 는 2배로 친 값) — 결과는 SEG(할당 없음)
const SEG = { x: 0, y: 0, z: 0 };
function segGap(ax: number, ay: number, az: number, ux: number, uy: number, uz: number, ha: number, bx: number, by: number, bz: number, vx: number, vy: number, vz: number, hb: number) {
  // 선분 A = a + s·u (s ∈ [−ha, ha]), B = b + t·v (t ∈ [−hb, hb]) — u · v 는 단위 벡터
  const rx = ax - bx, ry = ay - by, rz = az - bz, d = ux * vx + uy * vy + uz * vz, e = ux * rx + uy * ry + uz * rz, f = vx * rx + vy * ry + vz * rz;
  const den = 1 - d * d;
  let sa = den > 1e-6 ? (d * f - e) / den : 0;
  sa = sa < -ha ? -ha : sa > ha ? ha : sa;
  let tb = f + d * sa;
  if (tb < -hb || tb > hb) { tb = tb < -hb ? -hb : hb; sa = d * tb - e; sa = sa < -ha ? -ha : sa > ha ? ha : sa; }
  SEG.x = rx + ux * sa - vx * tb; SEG.y = ry + uy * sa - vy * tb; SEG.z = rz + uz * sa - vz * tb;
  return SEG;
}
/** 장애물에서 몸통 선분까지 수평 거리(월드) — 몸 가운데 (x, z) · 몸 방향 (ux, uz) · 반길이 hl. 가장 가까운 점 쪽 단위 벡터는 GN 에 */
const GN = { x: 1, z: 0 }, GUARD = { x: 0, y: 0, z: 0 };
/** 밀어서 장애물 속으로 더 들어가도 되는 여유(월드) — 0 이면 장식 곁에 누운 광어 · 불가사리를 서로 못 떼어 3단계 겹침이 14.9 → 16.3% 로 늘었다.
 *  0.2 는 짝에게 넘기는 몫(아래)과 함께 2단계 장식 속 2.50% · 3단계 겹침 15.1% · 광어+불가사리 26% */
const GUARD_SLACK = 0.2;
function bodyGap(ox: number, oz: number, x: number, z: number, ux: number, uz: number, hl: number) {
  const s = clamp((ox - x) * ux + (oz - z) * uz, -hl, hl), nx = x + ux * s - ox, nz = z + uz * s - oz, d = Math.sqrt(nx * nx + nz * nz);
  if (d > 1e-6) { GN.x = nx / d; GN.z = nz / d; } else { GN.x = -uz; GN.z = ux; }
  return d;
}
/** 겹침 밀기가 물고기를 장식 · 바위 속으로 밀지 않게(2026-11-12) — 밀어낸 몸(가운데 + v)의 몸통 선분이 장애물에 길 자리보다 GUARD_SLACK 넘게 더 들어가면
 *  장애물에서 바깥쪽으로 그만큼 되돌린다(옆으로 미는 몫은 그대로). 예전엔 겹침 밀기가 장애물을 몰라 2단계 광어 하나를 장식 속으로 밀었다(몸이 장식 속 2.50 → 3.90%).
 *  길이 이미 장애물 속이면 그보다 더 깊이만 안 민다(길이 넣은 것을 밀기가 빼 주지는 않는다 — 길의 일). 결과는 GUARD */
function obstacleGuard(o: readonly Obstacle[], pos: ArrayLike<number>, i: number, L: number, hd: ArrayLike<number> | undefined, deep: number, tall: number, vx: number, vy: number, vz: number) {
  const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], hl = 0.45 * L;
  let ux = 1, uz = 0;
  if (hd) { const a = hd[i * 3], b = hd[i * 3 + 2], l = Math.sqrt(a * a + b * b); if (l > 1e-9) { ux = a / l; uz = b / l; } }
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < o.length; k++) {
    const ob = o[k];
    if (ob.kind === "hall" || Math.min(y, y + vy) - 0.08 * L >= WORLD.floor + ob.h * tall) continue;
    const ox = ob.x, oz = ob.z * deep, want = ob.r + 0.05;
    // 빠른 거르기 — 몸통이 닿을 수 없을 만큼 멀다
    const qx = x + vx - ox, qz = z + vz - oz, far = want + hl + 0.05;
    if (qx * qx + qz * qz > far * far) continue;
    const dp = bodyGap(ox, oz, x, z, ux, uz, hl), dv = bodyGap(ox, oz, x + vx, z + vz, ux, uz, hl), lim = Math.min(want, dp) - GUARD_SLACK;
    if (dv < lim) { vx += GN.x * (lim - dv); vz += GN.z * (lim - dv); }
  }
  GUARD.x = vx; GUARD.y = vy; GUARD.z = vz;
  return GUARD;
}
let nearC = new Float32Array(64), nearN = new Float32Array(128);
/** 물고기 i 의 몸통이 장애물에 얼마나 붙었나 — 0.4 안으로 다가오면 0 → 닿으면 1(nearC), 그 장애물에서 몸 쪽 수평 단위 벡터(nearN) */
function nearOf(o: readonly Obstacle[], pos: ArrayLike<number>, i: number, L: number, hd: ArrayLike<number> | undefined, deep: number, tall: number) {
  const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], hl = 0.45 * L;
  let ux = 1, uz = 0;
  if (hd) { const a = hd[i * 3], b = hd[i * 3 + 2], l = Math.sqrt(a * a + b * b); if (l > 1e-9) { ux = a / l; uz = b / l; } }
  for (let k = 0; k < o.length; k++) {
    const ob = o[k];
    if (ob.kind === "hall" || y - 0.08 * L >= WORLD.floor + ob.h * tall) continue;
    const ox = ob.x, oz = ob.z * deep, qx = x - ox, qz = z - oz, far = ob.r + 0.45 + hl;
    if (qx * qx + qz * qz > far * far) continue;
    const d = bodyGap(ox, oz, x, z, ux, uz, hl), c = 1 - clamp((d - ob.r - 0.05) / 0.4, 0, 1);
    if (c > nearC[i]) { nearC[i] = c; nearN[i * 2] = GN.x; nearN[i * 2 + 1] = GN.z; }
  }
}
/** 물고기끼리 겹치지 않게 — 길이 계산한 자리(pos: x,y,z 를 차례로)를 보고, 깊이 겹친 쌍을 서로 반대로 민다.
 *  결과는 매 마리 이어지는 보정값(offsets: x,y,z)이며 목표 쪽으로 천천히 따라간다(한 프레임에 1.2·dt 이상 안 움직인다) — 떨림이 없다.
 *  엔진 호출(매 프레임, 물고기를 다 계산한 다음): pos[i*3..] = 길의 x,y,z → separate(pos, lengths, offsets, dt, opts) → 화면 자리 = pos + offsets.
 *  offsets 는 물고기마다 계속 들고 있는다(Float32Array(n*3), 물고기가 바뀌면 그 칸만 0). 새 객체를 만들지 않는다(20마리 = 190쌍). */
export function separate(pos: ArrayLike<number>, lengths: ArrayLike<number>, offsets: Float32Array | number[], dt: number, opts: SeparateOptions = {}) {
  const n = opts.n ?? lengths.length, scale = opts.scale ?? 1, k = opts.strength ?? 1, deep = Math.max(1, opts.deep ?? 1), hd = opts.heading, pin = opts.pinned, disc = opts.disc, obs = opts.obstacles, tall = Math.max(1, opts.tall ?? 1);
  if (sepTarget.length < n * 3) sepTarget = new Float32Array(Math.max(n * 3, 60));
  const t = sepTarget;
  t.fill(0, 0, n * 3);
  // 장애물 곁 — 물고기마다 가장 가까운 장애물 쪽 바깥 방향(nearN)과 얼마나 붙었나(nearC 0 ~ 1). 짝을 밀 때 장애물 쪽으로 밀릴 몫은 짝에게 넘긴다
  if (nearC.length < n) { nearC = new Float32Array(n * 2); nearN = new Float32Array(n * 4); }
  nearC.fill(0, 0, n);
  if (obs && obs.length) for (let i = 0; i < n; i++) nearOf(obs, pos, i, lengths[i], hd, deep, tall);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = pos[i * 3] - pos[j * 3], dy = (pos[i * 3 + 1] - pos[j * 3 + 1]) * 2, dz = pos[i * 3 + 2] - pos[j * 3 + 2];
    // 몸은 길고 납작하다 — 옆으로 몸길이 0.3 배, 위아래는 그 절반이면 겹친 것으로 본다(위아래 차이를 2배로 쳐서)
    const need = 0.3 * (lengths[i] + lengths[j]);
    const d2 = dx * dx + dy * dy + dz * dz;
    let ux = 0, uy = 0, uz = 0, push = 0;
    if (d2 < need * need) {
      const d = Math.sqrt(d2);
      if (d > 1e-4) { ux = dx / d; uy = dy / d / 2; uz = dz / d; }
      else { ux = 0; uy = 0; uz = i < j ? 1 : -1; } // 딱 같은 자리 — 앞뒤로 가른다(정해진 쪽)
      push = (need - d) * k;
    }
    // 긴 몸 · 바닥 물고기 — 몸 가운데만 보면 나란히 누운 긴 몸(광어 · 불가사리 · 갈치 무리 · 메가마우스 · 산갈치 · 실러캔스)이 서로 10~30% 뚫었다(2026-11-12).
    // 몸통 선분 사이 가장 가까운 거리로도 보고 더 많이 미는 쪽을 쓴다(두 선분이 겹쳐 0 이면 가운데 차이 쪽 · 그것도 0 이면 정해진 쪽)
    if (hd && ((pin && (pin[i] > 0.5 || pin[j] > 0.5)) || lengths[i] >= CAPSULE_LONG || lengths[j] >= CAPSULE_LONG)) {
      const ri = capR(i, lengths, pin, disc), rj = capR(j, lengths, pin, disc);
      // 빠른 거르기 — 몸 가운데가 두 반길이 + 두 반지름보다 멀면 안 닿는다
      const hi = disc && disc[i] > 0.5 ? 0 : CAP_HALF * lengths[i], hj = disc && disc[j] > 0.5 ? 0 : CAP_HALF * lengths[j], reach = hi + hj + ri + rj;
      if (d2 < reach * reach) {
        axisOf(hd, i, pin); const aix = AX.x, aiy = AX.y, aiz = AX.z;
        axisOf(hd, j, pin);
        const g = segGap(pos[i * 3], pos[i * 3 + 1] * 2, pos[i * 3 + 2], aix, aiy, aiz, hi, pos[j * 3], pos[j * 3 + 1] * 2, pos[j * 3 + 2], AX.x, AX.y, AX.z, hj);
        const gd = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
        if (gd < ri + rj && (ri + rj - gd) * k > push) {
          push = (ri + rj - gd) * k;
          if (gd > 1e-4) { ux = g.x / gd; uy = g.y / gd / 2; uz = g.z / gd; }
          else if (d2 > 1e-8) { const d = Math.sqrt(d2); ux = dx / d; uy = dy / d / 2; uz = dz / d; }
          else { ux = 0; uy = 0; uz = i < j ? 1 : -1; }
        }
      }
    }
    if (push <= 0) continue;
    // 큰 물고기는 덜 밀린다
    let wi = lengths[j] / (lengths[i] + lengths[j]), wj = 1 - wi;
    // 장애물 쪽으로 밀릴 몫은 짝이 대신 비킨다(2026-11-12 — 장애물 속으로 안 밀게 막기만 하니 장식 곁에 누운 광어 · 불가사리가 서로 겹친 채 남았다)
    const bi = nearC[i] * Math.max(0, -(ux * nearN[i * 2] + uz * nearN[i * 2 + 1])), bj = nearC[j] * Math.max(0, ux * nearN[j * 2] + uz * nearN[j * 2 + 1]);
    if (bi > 0 || bj > 0) { const a = wi * (1 - bi) + wj * bj * (1 - bi), b = wj * (1 - bj) + wi * bi * (1 - bj); wi = a; wj = b; }
    t[i * 3] += ux * push * wi; t[i * 3 + 1] += uy * push * wi; t[i * 3 + 2] += uz * push * wi;
    t[j * 3] -= ux * push * wj; t[j * 3 + 1] -= uy * push * wj; t[j * 3 + 2] -= uz * push * wj;
  }
  const rate = Math.min(1, dt * 3), step = 1.2 * dt;
  for (let i = 0; i < n; i++) {
    // 앞뒤 유리는 ±3·deep — 예전엔 깊은 수조에서도 ±3 으로 눌러서, 겹친 물고기를 앞뒤로 못 밀고 오히려 가운데로 끌어당겼다(깊은 수조 겹침 90%)
    // 무릎은 '몸이 어느 쪽을 보든 유리 안'인 자리(kx · kz). 길이 이미 그 너머면(경기장 고리로 도는 고래상어가 곧은 길에서 앞뒤로 1.3 — 몸이 가로로 누워
    // 유리 안이다 · 먹이 쪽으로 돌아선 머리 방향 무릎) 길 자리에서 더 밖으로만 안 민다. 예전엔 밀 것이 없어도 무릎으로 끌어당겨 길을 가운데로 눌렀다(2026-11-12)
    const kx = roomX(lengths[i] / 2, scale), kz = roomZ(lengths[i] / 2) + 3 * (deep - 1), ax = Math.abs(pos[i * 3]), az = Math.abs(pos[i * 3 + 2]);
    if (opts.pinned?.[i]) t[i * 3 + 1] = 0;
    // 민 자리도 유리 안 — 목표를 벽 쪽으로만 줄인다
    t[i * 3] = softClamp(pos[i * 3] + t[i * 3], Math.max(kx, ax), Math.max(kx + 0.15 * scale, ax)) - pos[i * 3];
    t[i * 3 + 2] = softClamp(pos[i * 3 + 2] + t[i * 3 + 2], Math.max(kz, az), Math.max(kz + 0.07, az)) - pos[i * 3 + 2];
    // 장애물 속으로는 안 민다(목표만 — 보정값은 늘 그렇듯 천천히 따라간다: 보정값까지 바로 고치면 장애물 가운데 위에서 미는 쪽이 뒤집혀 몸이 튀었다).
    // 장애물에서 밀어낸 몫도 유리 안
    if (obs && obs.length && (t[i * 3] || t[i * 3 + 2])) {
      const g = obstacleGuard(obs, pos, i, lengths[i], hd, deep, tall, t[i * 3], t[i * 3 + 1], t[i * 3 + 2]);
      t[i * 3] = softClamp(pos[i * 3] + g.x, Math.max(kx, ax), Math.max(kx + 0.15 * scale, ax)) - pos[i * 3];
      t[i * 3 + 2] = softClamp(pos[i * 3 + 2] + g.z, Math.max(kz, az), Math.max(kz + 0.07, az)) - pos[i * 3 + 2];
    }
    for (let c = 0; c < 3; c++) {
      const q = i * 3 + c;
      const move = clamp((t[q] - offsets[q]) * rate, -step, step);
      offsets[q] += move;
    }
  }
  return offsets;
}

/** 바닥 물고기가 비탈에서 몸 한쪽이 모래에 묻히지 않게 — 머리 · 꼬리 밑 모래 높이로 기울기와 몸 중심 밑 높이를 구한다.
 *  엔진: const p = floorPose(heightAt, c.x, c.z, c.dx, c.dz, length, out); y = c.y + (p.ground - WORLD.floor); direction.set(c.dx, p.slope·hypot(dx,dz), c.dz) (또는 pitch 를 몸 옆 축으로) · roll 은 몸 앞 축으로 */
export function floorPose(heightAt: (x: number, z: number) => number, x: number, z: number, dx: number, dz: number, length: number, out = { pitch: 0, roll: 0, slope: 0, ground: 0 }) {
  const l = hyp2(dx, dz) || 1, ux = dx / l, uz = dz / l, reach = length * 0.42, wide = length * 0.18;
  const head = heightAt(x + ux * reach, z + uz * reach), tail = heightAt(x - ux * reach, z - uz * reach), mid = heightAt(x, z);
  // 옆(오른쪽 = 앞 × 위 = (-uz, 0, ux)) 두 점 — 넓적한 몸(광어 · 가오리)이 옆으로도 묻히지 않게
  const right = heightAt(x - uz * wide, z + ux * wide), left = heightAt(x + uz * wide, z - ux * wide);
  out.slope = (head - tail) / (2 * reach);
  out.pitch = Math.atan(out.slope);
  out.roll = Math.atan((left - right) / (2 * wide));
  out.ground = Math.max(mid, (head + tail) / 2, (left + right) / 2);
  return out;
}

/** 돌 때 몸을 안쪽으로 기울인다(비행기처럼, 최대 10°). turn 은 course.turn(+Y 축 기준 rad/s) — 엔진은 몸 앞 축(로컬 x)으로 이만큼 돌린다 */
export const bankAngle = (turn: number) => clamp(-turn * 0.09, -0.1745, 0.1745);

/* ── 몸끼리 닿지 않게(2026-11-14) ─────────────────────────────
 * [사용자: "물고기 개체끼리 겹치면 안돼 물리엔진처럼"] separate 는 보정값을 천천히 따라가게 해서(떨림 없음) 몇 초씩 몸이 겹친 채였다.
 * 이제 매 프레임 마지막에 몸통 캡슐(몸 방향 선분 + 반지름)끼리 실제로 겹친 만큼을 밀어낸다 — 위치 기반 물리(PBD)의 접촉 제약과 같은 방식.
 * 무거운 몸(바닥에 붙음 · 바위 위 쉼)은 덜 밀리고, mass 0(굴 속 곰치)은 안 밀린다. skip(사냥 장면의 둘)은 서로 닿아도 된다.
 * 몇 번 되풀이해 셋 이상이 엉킨 것도 푼다. 민 자리는 유리 · 모래 · 수면 안. 할당 없음. */
export type ContactOptions = {
  /** 몸 방향(x,y,z 차례, 크기 상관없음) */ heading: ArrayLike<number>;
  /** 밀리는 정도(0 안 밀림 ~ 1) — 없으면 모두 1 */ mass?: ArrayLike<number>;
  /** 바닥에 붙은 정도(0~1) — 납작한 바닥 물고기는 캡슐이 조금 두껍다 */ pinned?: ArrayLike<number>;
  /** 1 이면 둥근 판(불가사리) */ disc?: ArrayLike<number>;
  /** 건너뛸 물고기(1) */ skip?: ArrayLike<number>;
  scale?: number; deep?: number; top?: number; iters?: number;
};
export function resolveContacts(pos: Float32Array, lengths: ArrayLike<number>, n: number, o: ContactOptions): number {
  const H = o.heading, S = o.scale ?? 1, D = o.deep ?? 1, top = o.top ?? 4.7, iters = o.iters ?? 4;
  let moved = 0;
  for (let it = 0; it < iters; it++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      if (o.skip && o.skip[i]) continue;
      const Li = lengths[i], wi = o.mass ? o.mass[i] : 1;
      let ux = H[i * 3], uy = H[i * 3 + 1], uz = H[i * 3 + 2];
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const di = o.disc && o.disc[i] ? 1 : 0, ha = di ? 0 : Li * CAP_HALF, ri = di ? Li * DISC_R : Li * (o.pinned && o.pinned[i] > 0.5 ? CAP_R_PIN : CAP_R);
      for (let j = i + 1; j < n; j++) {
        if (o.skip && o.skip[j]) continue;
        const wj = o.mass ? o.mass[j] : 1;
        if (wi + wj <= 0) continue;
        const Lj = lengths[j];
        // 먼 짝은 빨리 거른다(몸 가운데 사이가 두 몸의 반길이 합보다 멀면 닿을 수 없다)
        const cx = pos[i * 3] - pos[j * 3], cy = pos[i * 3 + 1] - pos[j * 3 + 1], cz = pos[i * 3 + 2] - pos[j * 3 + 2], reach = (Li + Lj) * 0.62;
        if (cx * cx + cy * cy + cz * cz > reach * reach) continue;
        let vx = H[j * 3], vy = H[j * 3 + 1], vz = H[j * 3 + 2];
        const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1; vx /= vl; vy /= vl; vz /= vl;
        const dj = o.disc && o.disc[j] ? 1 : 0, hb = dj ? 0 : Lj * CAP_HALF, rj = dj ? Lj * DISC_R : Lj * (o.pinned && o.pinned[j] > 0.5 ? CAP_R_PIN : CAP_R);
        const g = segGap(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], ux, uy, uz, ha, pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2], vx, vy, vz, hb);
        let gx = g.x, gy = g.y, gz = g.z;
        const d = Math.sqrt(gx * gx + gy * gy + gz * gz), need = ri + rj;
        if (d >= need) continue;
        if (d < 1e-5) { gx = 0; gy = 0; gz = 1; } else { gx /= d; gy /= d; gz /= d; }
        const push = need - d, ki = wi / (wi + wj), kj = wj / (wi + wj);
        pos[i * 3] += gx * push * ki; pos[i * 3 + 1] += gy * push * ki; pos[i * 3 + 2] += gz * push * ki;
        pos[j * 3] -= gx * push * kj; pos[j * 3 + 1] -= gy * push * kj; pos[j * 3 + 2] -= gz * push * kj;
        any = true; moved++;
      }
    }
    for (let k = 0; k < n; k++) {
      if (o.skip && o.skip[k]) continue;
      if (o.mass && o.mass[k] <= 0) continue;
      const L = lengths[k], mx = 5 * S - L * 0.4, mz = 3 * D - L * 0.25;
      if (mx > 0) pos[k * 3] = clamp(pos[k * 3], -mx, mx);
      if (mz > 0) pos[k * 3 + 2] = clamp(pos[k * 3 + 2], -mz, mz);
      pos[k * 3 + 1] = clamp(pos[k * 3 + 1], WORLD.floor + L * 0.04, top);
    }
    if (!any) break;
  }
  return moved;
}
