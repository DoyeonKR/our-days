/** Render-space only. Persisted aquarium coordinates and economics remain unchanged. */
export const WORLD = { width: 10, height: 12, depth: 6, floor: -5.3 } as const;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const decorToWorld = (x: number, y: number) => ({ x: (clamp(x, 6, 94) - 50) / 10, y: WORLD.floor, z: (clamp(y, 14, 94) - 54) / 16 });
export const worldToDecor = (x: number, z: number) => ({ x: clamp(x * 10 + 50, 6, 94), y: clamp(z * 16 + 54, 14, 94) });
export function fishCourse(id: number, seconds: number, length: number, family: string) {
  const phase = ((Math.imul(id, 2654435761) >>> 0) % 6283) / 1000;
  const slow = /manta|turtle|whale|ray/.test(family);
  const t = seconds * (slow ? 0.14 : 0.20) + phase;
  const radius = Math.max(1.4, 4.2 - length * 0.6);
  const x = radius * Math.sin(t), y = -0.2 + 3.25 * Math.sin(t * 2 + phase), z = 1.7 * Math.cos(t + phase * 0.7);
  const dx = radius * Math.cos(t), dy = 6.5 * Math.cos(t * 2 + phase), dz = -1.7 * Math.sin(t + phase * 0.7);
  return { x, y, z, dx, dy: dy * 0.36, dz, effort: 0.7 + Math.abs(Math.cos(t)) * 0.55 };
}
