import { FISH_BASE_CM } from "../aquarium.ts";
import { ringTangent, roomX, roomZ, habitCourse, habitOf, settleFollower, softClamp, type Course, type CourseOptions, type Hall, type Obstacle } from "./habits.ts";

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
const TAU = Math.PI * 2;
const smooth01 = (u: number) => u * u * (3 - 2 * u);
/** 따라가는 물고기가 대장 길보다 몇 초 늦게 가나(2026-11-12) — 예전엔 늘 0.22·자리 초 늦은 대장 길 그대로라 빠르기 · 꼬리 박자(effort 상관 1.000) ·
 *  멈춰 떠 있는 때(95~99% 겹침)가 대장과 똑같았다. 이제 늦음이 물고기마다 0 ~ 0.75 초 더 천천히 늘었다 줄었다 하고(두 사인 — 빠르기 ±30% 안팎, 대장이 멈춰 떠 있는 때도 그만큼 어긋난다),
 *  30~64초마다 한 번 제 몫으로 잠깐 멈췄다가(2.5초에 0.8초 늦어지고) 5초 동안 따라잡는다. 늦음의 기울기는 늘 1 보다 작아(최대 약 0.77)
 *  대장 길을 거꾸로 가는 일이 없다. id · 시각만으로 정해진다(같은 시각 = 같은 자리, 두 기기가 같다) */
export function followerLag(id: number, slot: number, t: number) {
  const hsh = Math.imul((id | 0) + 7919, 2654435761) >>> 0;
  const u = (k: number) => ((Math.imul(hsh ^ k, 2246822519) >>> 0) % 10007) / 10007;
  const w1 = TAU / (14 + 8 * u(1)), w2 = TAU / (4 + 2 * u(2));
  let lag = slot * 0.22 + 0.35 + 0.3 * Math.sin(w1 * t + u(3) * TAU) + 0.1 * Math.sin(w2 * t + u(4) * TAU);
  const P = 34 + 30 * u(5), x = ((((t + u(6) * P) % P) + P) % P), D1 = 2.5, D2 = 5, A = 0.8;
  if (x < D1) lag += A * smooth01(x / D1);
  else if (x < D1 + D2) lag += A * (1 - smooth01((x - D1) / D2));
  return lag;
}
/** 대장의 앞뒤 시각 길을 따로 받을 옵션 — 매 프레임 새 객체를 안 만든다 */
const sideOpts = (opts: CourseOptions | undefined, out: Course) => { const o = SIDE_OPTS; o.obstacles = opts?.obstacles; o.feed = opts?.feed; o.adult = opts?.adult; o.deep = opts?.deep; o.tall = opts?.tall; o.hall = opts?.hall; o.out = out; return o; };
export function schoolCourse(leader: number, slot: number, id: number, seconds: number, length: number, family: string, scale = 1, opts?: CourseOptions): Course {
  // 혼자 사는 물고기는 대장을 따라가지 않는다
  const habit = habitOf(family);
  if (!habit.school) return fishCourse(id, seconds, length, family, scale, opts);
  // 대장의 몸길이로 대장의 길을 그대로 계산한다(제 몸길이로 계산하면 빠르기 · 고리가 달라져 무리에서 떨어진다)
  const lead = opts?.leaderLength ?? length, D = Math.max(1, opts?.deep ?? 1);
  const settle = { deep: opts?.deep, tall: opts?.tall, hall: opts?.hall };
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
  const pax = pa.x, paz = pa.z;
  const base = fishCourse(leader, t0, lead, family, scale, opts);
  const lx = base.x, lz = base.z;
  const vx = (lx - pax) / W, vz = ((lz - paz) * D) / W, vl = Math.hypot(vx, vz);
  // 자리는 대장 고리의 접선 쪽(장애물 · 구경 · 먹이로 휘기 전) — 고리를 따라 천천히만 돈다. 대장이 멈춰 돌아보거나 먹이 둘레를 맴돌아도 무리 자리는 안 돈다
  const rt = ringTangent(), rl = Math.hypot(rt.x, rt.z) || 1, hx = rt.x / rl, hz = rt.z / rl, sx = -hz, sz = hx;
  // 머리는 무리가 실제로 가는 쪽(평균 속도) — 거의 멈췄으면 고리 접선
  const still = 0.3, fx = vx + hx * still, fz = vz + hz * still, fl = Math.hypot(fx, fz) || 1;
  const reach = Math.sqrt(slot) * Math.max(0.42, length * 0.62);
  const a = slot * 2.399 + Math.sin(seconds * 0.35 + id) * 0.25;
  const side = Math.cos(a) * reach, back = -reach * 0.3 * (1 + Math.sin(a * 1.3)) * 0.5;
  base.x += hx * back + sx * side;
  base.z += (hz * back + sz * side) / D;
  // 머리는 무리가 가는 쪽(평균 속도) — 대장의 순간 방향이 튀어도 따라가는 물고기는 튀지 않는다
  const sp = Math.max(vl, 0.05);
  base.dx = (fx / fl) * sp; base.dz = ((fz / fl) * sp) / D;
  // 제 빠르기만큼 — 멈춰 떠 있는 정도 · 꼬리 폭 · 박자도 제 것(대장이 쉬면 같이 쉬지만, 제 몫으로 멈출 땐 대장이 헤엄쳐도 혼자 쉰다).
  // 박자는 엔진(fishstep)이 화면 빠르기로 다시 맞춘다 — 여기 값은 엔진 밖에서 길만 부를 때 쓴다
  base.hover = clamp(1 - go * (1 - base.hover), 0, 1);
  base.amp = clamp(base.amp * (0.55 + 0.45 * go), 0.2, 1.3);
  base.effort *= clamp(go, 0.2, 1.6);
  if (habit.hug !== undefined) base.y += habit.hug * (length - lead); // 바닥 무리는 제 몸 높이로 모래에 붙는다
  else base.y = clamp(base.y + Math.sin(a) * reach * 0.6, Math.max(-4.4, habit.lo - 0.8), Math.min(4.8, habit.hi + 0.8));
  return settleFollower(base, length, scale, WORLD.floor, opts?.obstacles, { ...settle, leader: { x: lx, z: lz } });
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
  return { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2, r: Math.max(0.15, (Math.max(w, d) / 2) * 0.75 + (Math.hypot(w, d) / 2) * 0.25), h: Math.max(0.1, max.y - WORLD.floor) };
}

let sepTarget = new Float32Array(0);
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
};
/** 물고기끼리 겹치지 않게 — 길이 계산한 자리(pos: x,y,z 를 차례로)를 보고, 깊이 겹친 쌍을 서로 반대로 민다.
 *  결과는 매 마리 이어지는 보정값(offsets: x,y,z)이며 목표 쪽으로 천천히 따라간다(한 프레임에 1.2·dt 이상 안 움직인다) — 떨림이 없다.
 *  엔진 호출(매 프레임, 물고기를 다 계산한 다음): pos[i*3..] = 길의 x,y,z → separate(pos, lengths, offsets, dt, opts) → 화면 자리 = pos + offsets.
 *  offsets 는 물고기마다 계속 들고 있는다(Float32Array(n*3), 물고기가 바뀌면 그 칸만 0). 새 객체를 만들지 않는다(20마리 = 190쌍). */
export function separate(pos: ArrayLike<number>, lengths: ArrayLike<number>, offsets: Float32Array | number[], dt: number, opts: SeparateOptions = {}) {
  const n = opts.n ?? lengths.length, scale = opts.scale ?? 1, k = opts.strength ?? 1, deep = Math.max(1, opts.deep ?? 1);
  if (sepTarget.length < n * 3) sepTarget = new Float32Array(Math.max(n * 3, 60));
  const t = sepTarget;
  t.fill(0, 0, n * 3);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = pos[i * 3] - pos[j * 3], dy = (pos[i * 3 + 1] - pos[j * 3 + 1]) * 2, dz = pos[i * 3 + 2] - pos[j * 3 + 2];
    // 몸은 길고 납작하다 — 옆으로 몸길이 0.3 배, 위아래는 그 절반이면 겹친 것으로 본다(위아래 차이를 2배로 쳐서)
    const need = 0.3 * (lengths[i] + lengths[j]);
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= need * need) continue;
    const d = Math.sqrt(d2);
    let ux: number, uy: number, uz: number;
    if (d > 1e-4) { ux = dx / d; uy = dy / d / 2; uz = dz / d; }
    else { ux = 0; uy = 0; uz = i < j ? 1 : -1; } // 딱 같은 자리 — 앞뒤로 가른다(정해진 쪽)
    const push = (need - d) * k;
    // 큰 물고기는 덜 밀린다
    const wi = lengths[j] / (lengths[i] + lengths[j]), wj = 1 - wi;
    t[i * 3] += ux * push * wi; t[i * 3 + 1] += uy * push * wi; t[i * 3 + 2] += uz * push * wi;
    t[j * 3] -= ux * push * wj; t[j * 3 + 1] -= uy * push * wj; t[j * 3 + 2] -= uz * push * wj;
  }
  const rate = Math.min(1, dt * 3), step = 1.2 * dt;
  for (let i = 0; i < n; i++) {
    // 앞뒤 유리는 ±3·deep — 예전엔 깊은 수조에서도 ±3 으로 눌러서, 겹친 물고기를 앞뒤로 못 밀고 오히려 가운데로 끌어당겼다(깊은 수조 겹침 90%)
    const kx = roomX(lengths[i] / 2, scale), kz = roomZ(lengths[i] / 2) + 3 * (deep - 1);
    if (opts.pinned?.[i]) t[i * 3 + 1] = 0;
    // 민 자리도 유리 안 — 목표를 벽 쪽으로만 줄인다
    t[i * 3] = softClamp(pos[i * 3] + t[i * 3], kx, kx + 0.15 * scale) - pos[i * 3];
    t[i * 3 + 2] = softClamp(pos[i * 3 + 2] + t[i * 3 + 2], kz, kz + 0.07) - pos[i * 3 + 2];
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
  const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, reach = length * 0.42, wide = length * 0.18;
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
