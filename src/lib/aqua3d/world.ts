import { FISH_BASE_CM } from "../aquarium.ts";
import { roomX, roomZ, habitCourse, habitOf, settleFollower, softClamp, type Course, type CourseOptions, type Obstacle } from "./habits.ts";

export type { Course, CourseOptions, Feed, Obstacle } from "./habits.ts";

/** Render-space only. Persisted aquarium coordinates and economics remain unchanged. */
export const WORLD = { width: 10, height: 12, depth: 6, floor: -5.3 } as const;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 옆으로 늘린 단계(0~3) → 가로 배율 */
export const wideScale = (wide: number | undefined) => 1 + clamp(wide ?? 0, 0, 3) / 6;
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
 *  자리는 대장이 보는 쪽 기준(옆 · 뒤)이라 대장이 돌아도 앞으로 튀어 나가지 않는다. 바닥 무리는 바닥에 그대로 붙어 따라간다. */
export function schoolCourse(leader: number, slot: number, id: number, seconds: number, length: number, family: string, scale = 1, opts?: CourseOptions): Course {
  // 혼자 사는 물고기는 대장을 따라가지 않는다
  const habit = habitOf(family);
  if (!habit.school) return fishCourse(id, seconds, length, family, scale, opts);
  // 대장의 몸길이로 대장의 길을 그대로 계산한다(제 몸길이로 계산하면 빠르기 · 고리가 달라져 무리에서 떨어진다)
  const lead = opts?.leaderLength ?? length;
  const base = fishCourse(leader, seconds - slot * 0.22, lead, family, scale, opts);
  if (slot <= 0) return lead === length ? base : settleFollower(base, length, scale, WORLD.floor, opts?.obstacles);
  const reach = Math.sqrt(slot) * Math.max(0.42, length * 0.62);
  const a = slot * 2.399 + Math.sin(seconds * 0.35 + id) * 0.25;
  // 대장이 보는 쪽(앞 hx,hz · 옆 sx,sz)으로 자리를 돌린다 — 옛 식은 월드 축 기준이라 대장이 돌면 무리가 대장 앞에 섰다
  const hl = Math.hypot(base.dx, base.dz) || 1, hx = base.dx / hl, hz = base.dz / hl, sx = -hz, sz = hx;
  const side = Math.cos(a) * reach, back = -reach * 0.3 * (1 + Math.sin(a * 1.3)) * 0.5;
  base.x += hx * back + sx * side;
  base.z += hz * back + sz * side;
  if (habit.hug !== undefined) base.y += habit.hug * (length - lead); // 바닥 무리는 제 몸 높이로 모래에 붙는다
  else base.y = clamp(base.y + Math.sin(a) * reach * 0.6, Math.max(-4.4, habit.lo - 0.8), Math.min(4.8, habit.hi + 0.8));
  return settleFollower(base, length, scale, WORLD.floor, opts?.obstacles);
}
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
};
/** 물고기끼리 겹치지 않게 — 길이 계산한 자리(pos: x,y,z 를 차례로)를 보고, 깊이 겹친 쌍을 서로 반대로 민다.
 *  결과는 매 마리 이어지는 보정값(offsets: x,y,z)이며 목표 쪽으로 천천히 따라간다(한 프레임에 1.2·dt 이상 안 움직인다) — 떨림이 없다.
 *  엔진 호출(매 프레임, 물고기를 다 계산한 다음): pos[i*3..] = 길의 x,y,z → separate(pos, lengths, offsets, dt, opts) → 화면 자리 = pos + offsets.
 *  offsets 는 물고기마다 계속 들고 있는다(Float32Array(n*3), 물고기가 바뀌면 그 칸만 0). 새 객체를 만들지 않는다(20마리 = 190쌍). */
export function separate(pos: ArrayLike<number>, lengths: ArrayLike<number>, offsets: Float32Array | number[], dt: number, opts: SeparateOptions = {}) {
  const n = opts.n ?? lengths.length, scale = opts.scale ?? 1, k = opts.strength ?? 1;
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
    const kx = roomX(lengths[i] / 2, scale), kz = roomZ(lengths[i] / 2);
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
