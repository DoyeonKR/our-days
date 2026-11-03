/** Render-space only. Persisted aquarium coordinates and economics remain unchanged. */
export const WORLD = { width: 10, height: 12, depth: 6, floor: -5.3 } as const;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 옆으로 늘린 단계(0~3) → 가로 배율 */
export const wideScale = (wide: number | undefined) => 1 + clamp(wide ?? 0, 0, 3) / 6;
export const decorToWorld = (x: number, y: number, scale = 1) => ({ x: ((clamp(x, 6, 94) - 50) / 10) * scale, y: WORLD.floor, z: (clamp(y, 14, 94) - 54) / 16 });
export const worldToDecor = (x: number, z: number, scale = 1) => ({ x: clamp((x / scale) * 10 + 50, 6, 94), y: clamp(z * 16 + 54, 14, 94) });
/** 수조에서의 몸길이 — 작은 물고기는 그대로 두고(더 줄이면 손가락으로 못 집는다) 실제로 큰 물고기를 더 키운다 [사용자: "실체로 큰 개체들은 크게 그려줘"]. 고래상어 약 4.8 · 구피 1.2.
 *  자랄수록 커진다: 치어 40% → 어린 물고기 65% → 다 큰 모습 100%. 주인은 1.3배. fishCourse 가 길이만큼 도는 반경을 줄여 벽을 안 넘는다. */
export function fishLength(size: number, stage: 0 | 1 | 2, crown = false): number {
  const adult = size * 0.08 + Math.max(0, (size - 20) / 25) ** 1.2 * 1.2;
  return adult * (stage === 2 ? 1 : stage === 1 ? 0.65 : 0.4) * (crown ? 1.3 : 1);
}
export function fishCourse(id: number, seconds: number, length: number, family: string, scale = 1) {
  const phase = ((Math.imul(id, 2654435761) >>> 0) % 6283) / 1000;
  const slow = /manta|turtle|whale|ray/.test(family);
  const t = seconds * (slow ? 0.14 : 0.20) + phase;
  const radius = Math.max(2.2, 4.2 - length * 0.6);
  // 큰 물고기는 위아래로 덜 움직인다 — 그대로 두면 고래상어가 거의 수직으로 헤엄친다
  const rise = 3.25 * Math.max(0.3, 1 - Math.max(0, length - 2.5) * 0.3);
  const x = radius * scale * Math.sin(t), y = -0.2 + rise * Math.sin(t * 2 + phase), z = 1.7 * Math.cos(t + phase * 0.7);
  const dx = radius * scale * Math.cos(t), dy = rise * 2 * Math.cos(t * 2 + phase), dz = -1.7 * Math.sin(t + phase * 0.7);
  return { x, y, z, dx, dy: dy * 0.36, dz, effort: 0.7 + Math.abs(Math.cos(t)) * 0.55 };
}
/** 같은 물고기끼리 무리 지어 돈다 [사용자: "같은 물고기들은 물고기들끼리 군집을 형성해서 돌아가는 형태로"] — 대장이 길을 정하고, 무리는 조금씩 늦게 그 길을 따라가며 해바라기 씨처럼 퍼져 겹치지 않는다. */
export function schoolCourse(leader: number, slot: number, id: number, seconds: number, length: number, family: string, scale = 1) {
  const base = fishCourse(leader, seconds - slot * 0.22, length, family, scale);
  if (slot <= 0) return base;
  const reach = Math.sqrt(slot) * Math.max(0.42, length * 0.62);
  const a = slot * 2.399 + Math.sin(seconds * 0.35 + id) * 0.25;
  return { ...base, x: clamp(base.x + Math.cos(a) * reach, -4.5 * scale, 4.5 * scale), y: clamp(base.y + Math.sin(a) * reach * 0.6, -4.4, 4.8), z: clamp(base.z + Math.sin(a * 1.3) * reach * 0.6, -2.5, 2.5) };
}
/** 어느 물고기가 누구를 따라가나 — 같은 계열끼리, id 가 가장 작은 쪽이 대장 */
export function schoolsOf(fish: readonly { id: number; family: string }[]): Map<number, { leader: number; slot: number }> {
  const out = new Map<number, { leader: number; slot: number }>(), groups = new Map<string, number[]>();
  for (const f of fish) groups.set(f.family, [...(groups.get(f.family) ?? []), f.id]);
  for (const ids of groups.values()) ids.slice().sort((p, q) => p - q).forEach((id, slot, sorted) => out.set(id, { leader: sorted[0], slot }));
  return out;
}
