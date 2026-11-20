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

// 2026-11-20 [사용자: "수조 다른 어색한 움직임도 더 찾아서 고쳐"] — 165 계열을 6 · 9단계 실제 크기 수조에서 5분씩 돌려 찾은 것들이 다시 생기지 않게.
//   ① 9단계 바닥 심해어가 물가 계산(shoreLocal)이 바닥 굴곡에 x0 ↔ 해변 시작으로 튀어 한 프레임에 몸길이 몇 배를 순간 이동(초당 60 ~ 100)
//   ② 고래상어 대형 자리를 따라가기 없이 그대로 그려 참다랑어 · 잉어가 한 프레임에 1 ~ 1.5 를 건너뜀(초당 25 ~ 33)
//   ③ 모래사장 둑 쪽으로 돈 머리 밑을 바로 들어 올리고 보정 몫을 한 번에 써서 은어가 두 프레임에 몸길이 1.7 배 솟구침(초당 47)
//   ④ 커진 수조의 큰 고리를 같은 각속도로 돌아 작은 무리 물고기가 시간의 20 ~ 27% 를 몸길이 3 배/초 넘게 질주(끝에서 7.5)
import { BEACH_TOP, hasBeach, shoreLocal } from "./habitat.ts";
import { BEACH_REST_FRONT } from "./scene.ts";
function realTank(tier: number) {
  const ax = tankAxes(tier, tTall(tier), tankDeep(tier)), t0 = tankOf(tier, 0, []), beach = hasBeach(tier), sub = Math.min(tier, 6);
  const tank = { ...t0, wide: ax.x, tall: ax.tall, deep: ax.deep, obstacles: [...t0.obstacles.filter((o) => o.kind !== "rock"), ...rockObstacles(tier, ax.x, ax.deep)] };
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / tank.wide, z / tank.deep, sub, beach) - WORLD.floor) * tank.tall;
  const shore = beach ? (y: number, z = 0) => shoreLocal(WORLD.floor + (y - WORLD.floor) / tank.tall, z / tank.deep, beach) * tank.wide : undefined;
  const beachObs = beach ? { x: 4.65 * tank.wide, z: 3 * tank.deep * BEACH_REST_FRONT, r: 2, h: BEACH_TOP - WORLD.floor, kind: "beach" as const } : undefined;
  return { tank, heightAt, shore, beachObs };
}
/** 몸길이/초 빠르기를 프레임마다 모은다(처음 2초는 자리 잡기라 뺀다) */
function speeds(tier: number, fams: string[], seconds: number, hz = 30) {
  const { tank, heightAt, shore, beachObs } = realTank(tier);
  const fish = fams.flatMap((f, i) => [0, 1].map((j) => ({ id: i * 13 + j * 211 + 5, family: f, length: adult(f) })));
  const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0, shore, beach: beachObs };
  const prev = new Float32Array(n * 3), out = fish.map(() => [] as number[]);
  for (let k = 0; k * (1 / hz) < seconds; k++) {
    const t = k / hz;
    stepFish(bodies, schools, (id) => byId.get(id)?.length, t, k ? 1 / hz : 0, { wide: tank.wide, tall: tank.tall, deep: tank.deep, heightAt, obstacles: tank.obstacles, feed: null, hall: tank.hall }, b as never);
    if (t > 2) for (let i = 0; i < n; i++) out[i].push(Math.hypot(b.positions[i * 3] - prev[i * 3], b.positions[i * 3 + 1] - prev[i * 3 + 1], b.positions[i * 3 + 2] - prev[i * 3 + 2]) * hz / fish[i].length);
    prev.set(b.positions.subarray(0, n * 3));
  }
  return fish.map((f, i) => ({ family: f.family, v: out[i] }));
}
test("물가 계산은 바닥 높이 근처에서도 이어진다 — 높이가 조금 바뀌어도 물가가 튀지 않는다(앞쪽은 해변이 오른쪽에서 시작)", () => {
  for (const beach of [true, "hall"] as const) for (const z of [-2.5, -1, 0, 1, 2.5]) {
    let last = shoreLocal(-5.2, z, beach);
    for (let y = -5.2; y < 5.5; y += 0.01) { const s = shoreLocal(y, z, beach); assert.ok(Math.abs(s - last) < 0.25, `${beach} z ${z} y ${y.toFixed(2)}: ${last.toFixed(2)} → ${s.toFixed(2)}`); last = s; }
  }
});
test("순간 이동 없음 — 9단계 바닥 심해어(물가) · 고래상어 대형과 둑 곁 은어, 한 프레임 빠르기가 몸길이 10 배/초 아래", () => {
  for (const fams of [["lanternfish", "hatchetfish", "perch_kkeokji", "mandarin_fish"], ["clown", "discus", "koi", "ray", "arowana", "bluefin", "sea_turtle", "whale_shark", "manta", "rising", "astral", "sweetfish"]]) {
    for (const r of speeds(9, fams, 240)) { const top = Math.max(...r.v); assert.ok(top < 10, `${r.family} ${top.toFixed(1)} 몸길이/초`); }
  }
});
test("작은 무리 물고기가 큰 수조에서 쉬지 않고 질주하지 않는다 — 몸길이 4.5 배/초 넘는 프레임이 3% 아래", () => {
  for (const tier of [6, 9]) for (const r of speeds(tier, ["zebra_danio", "ricefish", "tetra", "molly", "guppy"], 150)) {
    const fast = r.v.filter((v) => v > 4.5).length / r.v.length;
    assert.ok(fast < 0.03, `${tier}단계 ${r.family} ${(100 * fast).toFixed(1)}%`);
  }
});
