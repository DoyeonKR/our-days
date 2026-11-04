import { habitCourse, habitOf } from "./habits.ts";

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
export const fishLength = (cm: number) => clamp(0.9 * (Math.max(cm, 0.1) / 5) ** 0.334, 0.45, 5.4);
export function fishCourse(id: number, seconds: number, length: number, family: string, scale = 1) {
  // 어디서 어떻게 사는지는 어종마다 다르다 — habits.ts
  return habitCourse(id, seconds, length, habitOf(family), scale, WORLD.floor);
}
/** 같은 물고기끼리 무리 지어 돈다 [사용자: "같은 물고기들은 물고기들끼리 군집을 형성해서 돌아가는 형태로"] — 대장이 길을 정하고, 무리는 조금씩 늦게 그 길을 따라가며 해바라기 씨처럼 퍼져 겹치지 않는다. */
export function schoolCourse(leader: number, slot: number, id: number, seconds: number, length: number, family: string, scale = 1) {
  // 혼자 사는 물고기는 대장을 따라가지 않는다
  const habit = habitOf(family);
  if (!habit.school) return fishCourse(id, seconds, length, family, scale);
  const base = fishCourse(leader, seconds - slot * 0.22, length, family, scale);
  if (slot <= 0) return base;
  const reach = Math.sqrt(slot) * Math.max(0.42, length * 0.62);
  const a = slot * 2.399 + Math.sin(seconds * 0.35 + id) * 0.25;
  return { ...base, x: clamp(base.x + Math.cos(a) * reach, -4.5 * scale, 4.5 * scale), y: clamp(base.y + Math.sin(a) * reach * 0.6, Math.max(-4.4, habit.lo - 0.8), Math.min(4.8, habit.hi + 0.8)), z: clamp(base.z + Math.sin(a * 1.3) * reach * 0.6, -2.5, 2.5) };
}
/** 어느 물고기가 누구를 따라가나 — 같은 계열끼리, id 가 가장 작은 쪽이 대장 */
export function schoolsOf(fish: readonly { id: number; family: string }[]): Map<number, { leader: number; slot: number }> {
  const out = new Map<number, { leader: number; slot: number }>(), groups = new Map<string, number[]>();
  for (const f of fish) groups.set(f.family, [...(groups.get(f.family) ?? []), f.id]);
  for (const ids of groups.values()) ids.slice().sort((p, q) => p - q).forEach((id, slot, sorted) => out.set(id, { leader: sorted[0], slot }));
  return out;
}
