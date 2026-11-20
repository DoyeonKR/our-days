// 붐비는 수조의 떨림(2026-11-20) [사용자: "모델 움직임이 실제와 비슷하고 부드럽게 다듬어줘"] — 18종 36마리를 6단계 수조에서 90초(60Hz) 돌려,
// 몸이 실제로 움직이는 방향이 프레임마다 얼마나 흔들리는지(방향 가속 rad/s²)를 잰다. 고치기 전(보정을 그 자리에서 다 더함) 평균 약 40 · 잉어 62 · 참다랑어 78,
// fishstep.CORR_TAU(보정을 0.3초로 따라감) 뒤 평균 약 7. 혼자 헤엄치는 물고기는 원래 0.4 안팎.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FISH_BASE_CM } from "../aquarium.ts";
import { type Course, type Feed, type Hall, type Obstacle } from "./habits.ts";
import { WORLD, fishLength, hallFrom, schoolsOf, tankTall, wideScale } from "./world.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import { rockObstacles, substrateHeight } from "./habitat.ts";
import { tankDeep, tunnelObstacles } from "./tunnel.ts";
import { domeObstacles } from "./dome.ts";

const adult = (family: string) => fishLength(FISH_BASE_CM[family] ?? 20, family);

/** 화면(scene.refreshObstacles)과 같은 장애물 — 장식(월드 원) → 길 좌표, 터널 · 돔, 바닥 바위 */
function tankOf(tier: number, wideStep = 0, decor: { x: number; z: number; r: number; h: number }[] = []) {
  const wide = wideScale(wideStep), tall = tankTall(tier), deep = tankDeep(tier), sub = Math.min(tier, 6);
  const tunnel = tier === 10, dome = tier >= 11;
  const obstacles: Obstacle[] = decor.map((o) => ({ ...o, z: o.z / deep, h: o.h / tall }));
  const hallObs = tunnel ? tunnelObstacles(deep, tall) : dome ? domeObstacles(tall) : [];
  const hall: Hall | null = hallFrom(tunnel ? "tunnel" : "dome", hallObs[0]);
  for (const o of hallObs) obstacles.push({ ...o, kind: "hall" });
  obstacles.push(...rockObstacles(tier, wide, deep));
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, sub) - WORLD.floor) * tall;
  return { tier, wide, tall, deep, obstacles, hall, heightAt, world: decor };
}
type Tank = ReturnType<typeof tankOf>;
type Fish = { id: number; family: string; length: number };
/** 화면의 draw 한 번 = stepFish 한 번. 매 프레임 visit(자리 · 길) */
function run(tank: Tank, fish: Fish[], seconds: number, visit: (t: number, pos: Float32Array, courses: Course[], feed: Feed | null) => void, feeds: Feed[] = [], hz = 30) {
  const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0 };
  let feed: Feed | null = null;
  for (let k = 0, t = 0; t < seconds; k++, t = k / hz) {
    for (const f of feeds) if (t >= f.t && (!feed || feed.t < f.t)) feed = f;
    if (feed && t - feed.t >= 40) feed = null;
    stepFish(bodies, schools, (id) => byId.get(id)?.length, t, k ? 1 / hz : 0, { wide: tank.wide, tall: tank.tall, deep: tank.deep, heightAt: tank.heightAt, obstacles: tank.obstacles, feed, hall: tank.hall }, b);
    visit(t, b.positions, b.courses, feed);
  }
}
test("붐비는 수조에서도 몸이 떨지 않는다 — 움직이는 방향의 프레임 간 흔들림(방향 가속)이 평균 10 rad/s² 아래, 어느 종도 25 아래", () => {
  const tank = tankOf(6, 0, []), hz = 60;
  const fams = ["koi", "bluefin", "sea_bass", "goldfish", "clown", "discus", "mackerel", "tetra", "guppy", "angel", "betta", "octopus", "grouper", "cod", "moray", "flounder", "salmon", "common_carp"];
  const fish = fams.flatMap((f, i) => [{ id: i * 3 + 1, family: f, length: adult(f) }, { id: i * 3 + 2, family: f, length: adult(f) }]);
  const prev = fish.map(() => [NaN, 0, 0, NaN, NaN]); // x y z · 지난 방향 · 지난 방향 빠르기
  const acc = fish.map(() => [0, 0]);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  run(tank, fish, 90, (_t, pos) => {
    for (let i = 0; i < fish.length; i++) {
      const p = prev[i], x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (!Number.isNaN(p[0])) {
        const dx = x - p[0], dz = z - p[2], v = Math.hypot(dx, y - p[1], dz) * hz / fish[i].length;
        if (v < 0.08) { p[3] = NaN; p[4] = NaN; }
        else { const h = Math.atan2(dz, dx); if (!Number.isNaN(p[3])) { const r = wrap(h - p[3]) * hz; if (!Number.isNaN(p[4])) { acc[i][0] += Math.abs(r - p[4]) * hz; acc[i][1]++; } p[4] = r; } p[3] = h; }
      }
      p[0] = x; p[1] = y; p[2] = z;
    }
  }, [], hz);
  const per = fams.map((f, j) => { const a = acc[j * 2], b = acc[j * 2 + 1]; return [f, (a[0] + b[0]) / Math.max(1, a[1] + b[1])] as const; });
  const mean = per.reduce((s, [, v]) => s + v, 0) / per.length;
  assert.ok(mean < 10, `평균 ${mean.toFixed(1)}`);
  for (const [f, v] of per) assert.ok(v < 25, `${f} ${v.toFixed(1)}`);
});

// 오르내리는 기울기(2026-11-20) [사용자: "숨 쉬러 올라갈 때 가파른 것도 고쳐 그런 어색한것들 싹다"] — 실제 크기 수조(tankAxes)에서 몸이 실제로 오르내리는 각.
//   고치기 전: 포유류 중앙값 50 ~ 56°(숨 쉬는 동안 길이 멈춰 승강기처럼 솟았다 · 높이가 고리 한 바퀴에 두 번 오르내려 고리 끝에서 곧게 섰다), 잉어 · 연어 · 참다랑어도 50 ~ 56°
import { tankAxes } from "./tiers.ts";
import { tankTall as tTall } from "./world.ts";
test("헤엄치며 오르내리는 각 — 포유류 · 물속 물고기 모두 중앙값 45° 아래, 움직이는 프레임 중 55° 넘는 것은 20% 아래, 높이 범위는 수조 높이의 30% 넘게(위 · 아래가 비지 않게)", () => {
  const tier = 6, ax = tankAxes(tier, tTall(tier), tankDeep(tier)), hz = 30;
  const tank = { ...tankOf(tier, 0, []), wide: ax.x, tall: ax.tall, deep: ax.deep, obstacles: rockObstacles(tier, ax.x, ax.deep), heightAt: (x: number, z: number) => WORLD.floor + (substrateHeight(x / ax.x, z / ax.deep, tier) - WORLD.floor) * ax.tall };
  const fams = ["spotted_seal", "fur_seal", "steller_sea_lion", "otter", "koi", "salmon", "bluefin", "tetra"];
  const fish = fams.map((f, i) => ({ id: i * 7 + 3, family: f, length: adult(f) }));
  const prev = fish.map(() => [NaN, 0, 0]), ang: number[][] = fish.map(() => []), yr = fish.map(() => [1e9, -1e9]), moving = fish.map(() => 0), steepN = fish.map(() => 0);
  run(tank as never, fish, 300, (_t, pos, cs) => {
    for (let i = 0; i < fish.length; i++) {
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], q = prev[i];
      yr[i][0] = Math.min(yr[i][0], p[1]); yr[i][1] = Math.max(yr[i][1], p[1]);
      if (!Number.isNaN(q[0]) && (cs[i].ground ?? 0) < 0.3) { const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2], d = Math.hypot(dx, dy, dz); if (d * hz / fish[i].length > 0.15) { moving[i]++; const g = Math.atan2(Math.abs(dy), Math.hypot(dx, dz)) * 57.3; if (g > 55) steepN[i]++; if (Math.abs(dy) > 0.3 * d) ang[i].push(g); } }
      prev[i] = p;
    }
  }, [], hz);
  const tankH = (5.56 - WORLD.floor) * ax.tall;
  for (let i = 0; i < fish.length; i++) {
    const a = ang[i].sort((x, y) => x - y), med = a[a.length >> 1] ?? 0, steep = steepN[i] / Math.max(1, moving[i]);
    assert.ok(med < 45, `${fams[i]} 중앙값 ${med.toFixed(0)}°`);
    assert.ok(steep < 0.2, `${fams[i]} 55° 넘게 ${(100 * steep).toFixed(0)}%`);
    if (!/seal|otter|lion/.test(fams[i])) assert.ok(yr[i][1] - yr[i][0] > tankH * 0.3, `${fams[i]} 높이 범위 ${(yr[i][1] - yr[i][0]).toFixed(1)} / ${tankH.toFixed(1)}`);
  }
});
