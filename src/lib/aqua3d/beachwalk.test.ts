// 모래사장으로 오르내리는 길(2026-11-26 [사용자: "해변으로올떄 날아서 오는 것 같은 애니메이션이야 … 해변 모래에 너무 박혀있거나 떨어져있거나"]).
// 해변에 올라선 몸은 그 자리 모래 위 몸 두께만큼(박히지도 뜨지도 않게), 물가 밖 물 위 허공을 날아오지 않는다. 실제 한 프레임(stepFish)을 8 · 9 · 11단계에서 400초 돌려 잰다
import { test } from "node:test";
import assert from "node:assert/strict";
import { substrateHeight, shoreLocal, hasBeach, rockObstacles, BEACH_TOP } from "./habitat.ts";
import { tankAxes } from "./tiers.ts";
import { WORLD, fishLength, schoolsOf, wideScale, tankTall } from "./world.ts";
import { tankDeep } from "./tunnel.ts";
import { FISH_BASE_CM } from "../aquarium.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import type { Course } from "./habits.ts";
const BEACH_REST_FRONT = -0.5;
test("해변 위 몸은 모래 위 몸 두께만큼 · 물 위 허공을 날아오지 않는다", () => {
  for (const tier of [8, 9, 11]) {
    const ax = tankAxes(tier, tankTall(tier), tankDeep(tier)), wide = wideScale(0) * ax.x, tall = ax.tall, deep = ax.deep, beach = hasBeach(tier);
    const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, Math.min(tier, 6), beach) - WORLD.floor) * tall;
    const shore = (y: number, z = 0) => shoreLocal(WORLD.floor + (y - WORLD.floor) / tall, z / deep, beach) * wide;
    const obstacles = rockObstacles(tier, wide, deep);
    const fams = ["spotted_seal", "fur_seal", "steller_sea_lion", "walrus", "gentoo_penguin", "emperor_penguin", "kappa", "polar_bear", "otter", "japanese_sea_lion"];
    const fish = fams.map((family, i) => ({ id: 100 + i * 7, family, length: fishLength(FISH_BASE_CM[family] ?? 50, "adult" as never) }));
    const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
    const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 측정용 버퍼(StepBuffers 일부 + 해변)
    const b: any = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0, shore,
      beach: { x: 4.65 * wide, z: 3 * deep * BEACH_REST_FRONT, r: 2, h: BEACH_TOP - WORLD.floor, kind: "beach" } };
    const prev = new Float32Array(n * 3); const gaps: number[] = [], air: number[] = [], sp: number[] = [];
    for (let k = 0, t = 0; t < 400; k++, t = k / 15) {
      stepFish(bodies, schools, (id) => byId.get(id)?.length, t, k ? 1 / 15 : 0, { wide, tall, deep, heightAt, obstacles, feed: null, hall: null }, b);
      for (let i = 0; i < n; i++) {
        const st = (bodies[i][1] as unknown as { swim?: { rest: number; haul: boolean; float: boolean } }).swim; const x = b.positions[i * 3], y = b.positions[i * 3 + 1], z = b.positions[i * 3 + 2], L = b.lengths[i];
        if (k > 0) { const v = Math.hypot(x - prev[i * 3], y - prev[i * 3 + 1], z - prev[i * 3 + 2]) * 15 / L; if (st && st.rest > 0.05 && st.rest < 0.95) sp.push(v); }
        prev[i * 3] = x; prev[i * 3 + 1] = y; prev[i * 3 + 2] = z;
        if (!st?.haul || st.float) continue;
        const sand = heightAt(x, z), water = WORLD.floor + (5.56 - WORLD.floor) * tall;
        if (sand > water - 0.05 && st.rest > 0.05) gaps.push((y - sand) / L);
        if (y > water + L * 0.4 && sand < water - 0.3) air.push((y - water) / L);
      }
    }
    gaps.sort((a, c) => a - c); sp.sort((a, c) => a - c);
    const q = (a: number[], p: number) => a.length ? a[Math.floor(a.length * p)].toFixed(3) : "-";
    assert.ok(gaps.length > 5000, `${tier} 해변 위 프레임 ${gaps.length}`);
    assert.ok(+q(gaps, 0.05) > 0.04, `${tier} 모래에 박힘 p5 ${q(gaps, 0.05)}`);
    assert.ok(+q(gaps, 0.95) < 0.3, `${tier} 모래 위로 뜸 p95 ${q(gaps, 0.95)}`);
    assert.ok(air.length <= 20 && (air.length ? Math.max(...air) : 0) < 2, `${tier} 물 위 허공 ${air.length}프레임 최대 ${air.length ? Math.max(...air).toFixed(2) : 0}`);
    assert.ok(+q(sp, 0.99) < 5, `${tier} 오가는 빠르기 p99 ${q(sp, 0.99)}`);
  }
});
