// 수조 움직임 리뷰(2026-11-05) 후속 — 유리 안 · 장식 피하기 · 서로 안 겹치기 · 먹이 · 거북 숨쉬기 · 해파리 · 몸 물결.
// 값이 아니라 성질을 잠근다: 몸이 유리를 안 뚫는다 · 순간 이동이 없다 · 같은 입력이면 같은 자리다.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as T from "three";
import { FAMILIES, FISH_BASE_CM, FISH_STAGE_SIZE } from "../aquarium.ts";
import { FISH_HABITS, habitCourse, habitOf, hugsFloor, type Obstacle } from "./habits.ts";
import { WORLD, bankAngle, fishCourse, fishLength, floorPose, obstacleFromBox, schoolCourse, schoolsOf, separate, wideScale } from "./world.ts";
import { starCourse } from "./invertebrates.ts";
import { substrateHeight } from "./habitat.ts";
import { bendProfile, bodyMeasure, glbUpright, jellyPulse, lengthAxisFor, swimAngles } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { makeAnimal, ModelKit } from "./models.ts";

const SCALES = [0, 1, 2, 3].map(wideScale);
const lengthsOf = (family: string) => FISH_STAGE_SIZE.map((s) => fishLength((FISH_BASE_CM[family] ?? 20) * s, family));
const step = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("유리 안 — 모든 습성 · 모든 크기 · 모든 어항 폭에서 몸이 어느 쪽을 보든 유리 안에 있다", () => {
  for (const key of Object.keys(FISH_HABITS)) for (const length of lengthsOf(key)) for (const scale of SCALES) for (let id = 1; id <= 5; id++) {
    for (let t = 0; t < 360; t += 1.7) {
      const p = key === "starfish" ? starCourse(id, t, length, scale) : fishCourse(id, t, length, key, scale);
      assert.ok(Math.abs(p.x) + length / 2 <= 5 * scale + 1e-6, `${key} L${length.toFixed(2)} ×${scale} x ${p.x}`);
      assert.ok(Math.abs(p.z) + length / 2 <= 3 + 1e-6, `${key} L${length.toFixed(2)} z ${p.z}`);
    }
  }
});

test("무리도 유리 안 — 다섯째 따라가는 물고기까지(옛 식은 참다랑어 무리가 옆 유리를 23% 뚫었다)", () => {
  for (const key of Object.keys(FISH_HABITS).filter((k) => FISH_HABITS[k].school)) for (const length of lengthsOf(key)) for (const scale of SCALES) {
    for (let slot = 1; slot <= 8; slot++) for (let t = 0; t < 240; t += 1.9) {
      const p = schoolCourse(1, slot, slot + 1, t, length, key, scale);
      assert.ok(Math.abs(p.x) + length / 2 <= 5 * scale + 1e-6, `${key} slot${slot} x ${p.x}`);
      assert.ok(Math.abs(p.z) + length / 2 <= 3 + 1e-6, `${key} slot${slot} z ${p.z}`);
      assert.ok(Object.values(p).every(Number.isFinite), key);
    }
  }
});

test("무리는 대장이 보는 쪽 기준 — 대장이 돌아도 따라가는 물고기가 대장 앞에 안 선다", () => {
  let ahead = 0, n = 0;
  for (let t = 0; t < 300; t += 0.5) {
    const lead = schoolCourse(1, 0, 1, t, 1.2, "guppy");
    const hl = Math.hypot(lead.dx, lead.dz);
    for (let slot = 1; slot <= 6; slot++) {
      const f = schoolCourse(1, slot, slot + 1, t, 1.2, "guppy");
      n++;
      if (((f.x - lead.x) * lead.dx + (f.z - lead.z) * lead.dz) / hl > 0.3) ahead++;
    }
  }
  assert.ok(ahead / n < 0.05, `대장 앞에 선 비율 ${ahead / n}`);
});

test("바닥 무리는 바닥에 붙어 따라간다(옛 식은 -4.4 아래로 못 내려가 떠 있었다)", () => {
  for (let t = 0; t < 200; t += 3) for (let slot = 1; slot <= 4; slot++) {
    const p = schoolCourse(1, slot, slot + 1, t, 1.5, "cutlassfish_pollock");
    assert.ok(p.y < WORLD.floor + 1.5 * 0.45 + 0.4, `y ${p.y}`);
  }
});

test("앞뒤 흔들림이 가로와 90° 어긋난다 — 비스듬히 왔다 갔다 하며 뒤집히는 물고기가 없다", () => {
  // 옛 식 cos(v + phase·0.7) 은 id 의 약 9% 가 거의 한 줄로 오갔다. 고리 넓이 / (π·가로·앞뒤 반지름) 로 잰다
  let flat = 0;
  for (let id = 1; id <= 600; id++) {
    let area = 0, prev = fishCourse(id, 0, 1, "koi");
    const pts = [];
    for (let t = 0.5; t < 2 * Math.PI / 0.1 / 0.85 + 2; t += 0.5) { const p = fishCourse(id, t, 1, "koi"); area += prev.x * p.z - p.x * prev.z; prev = p; pts.push(p); }
    const rx = (Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))) / 2, rz = (Math.max(...pts.map((p) => p.z)) - Math.min(...pts.map((p) => p.z))) / 2;
    if (Math.abs(area / 2) / (Math.PI * rx * rz) < 0.6) flat++;
  }
  assert.equal(flat, 0, `납작한 고리 ${flat}/600`);
});

test("순간 이동이 없다 — 30fps 한 프레임에 몸길이 대비 크게 안 움직인다(장애물 · 구경 · 먹이 포함)", () => {
  const obstacles: Obstacle[] = [{ x: 4, z: -2, r: 1, h: 1.8 }, { x: -2.4, z: 1.3, r: 0.8, h: 1.6 }, { x: 0, z: 0, r: 0.6, h: 1.4 }];
  for (const key of Object.keys(FISH_HABITS)) {
    const length = lengthsOf(key)[2];
    for (const id of [2, 7, 11]) {
      let prev = fishCourse(id, 0, length, key, 1, { obstacles, feed: { t: 40, x: 2 } });
      for (let t = 1 / 30; t < 200; t += 1 / 30) {
        const p = fishCourse(id, t, length, key, 1, { obstacles, feed: { t: 40, x: 2 } });
        assert.ok(step(p, prev) < 0.3, `${key} id${id} t${t.toFixed(2)} 한 프레임 ${step(p, prev)}`);
        prev = p;
      }
    }
  }
});

test("장식 피하기 — 바닥 물고기가 장식을 뚫고 지나가지 않는다(옛 길은 광어 · 메기 · 가오리가 한 바퀴마다 침몰선을 지났다)", () => {
  // 장식이 흔히 놓이는 자리: 옆 · 뒤 구석(침몰선) · 가운데 낮은 돌
  const ship = obstacleFromBox({ x: 3.0, y: WORLD.floor, z: -2.9 }, { x: 4.9, y: WORLD.floor + 1.8, z: -1.3 });
  const obstacles = [ship, { x: -3.9, z: 1.8, r: 0.8, h: 1.2 }, { x: -1.5, z: 0.4, r: 0.5, h: 0.6 }];
  let inside = 0, raw = 0, n = 0;
  for (const key of ["flounder", "catfish", "ray", "croaker", "leopard_shark", "sea_bream", "goldfish", "clown", "octopus", "bullhead"]) {
    const length = lengthsOf(key)[2];
    for (let id = 1; id <= 8; id++) for (let t = 0; t < 400; t += 0.25) {
      const p = fishCourse(id, t, length, key, 1, { obstacles }), q = fishCourse(id, t, length, key, 1);
      n++;
      for (const o of obstacles) {
        const top = WORLD.floor + o.h;
        if (p.y - length * 0.16 < top && Math.hypot(p.x - o.x, p.z - o.z) < o.r) inside++;
        if (q.y - length * 0.16 < top && Math.hypot(q.x - o.x, q.z - o.z) < o.r) raw++;
      }
    }
  }
  assert.ok(raw / n > 0.01, `장애물이 없을 때는 지나간다 ${raw / n}`);
  assert.ok(inside / n < 0.002, `장식 안에 들어간 비율 ${inside / n}(없을 때 ${raw / n})`);
});

test("깊고 높은 수조에서도 장식을 비켜 간다 — 장식은 월드 상자, 물고기 길은 늘리기 전 좌표라 화면과 같은 변환으로 잰다(2026-11-11)", () => {
  // 9단계: 앞뒤 1.6배 · 위로 1.5배. 화면(scene.ts)과 같은 식으로 장애물을 길 좌표로 옮기고, 판정은 늘린 뒤의 월드 좌표로 한다
  const deep = 1.6, tall = 1.5;
  const boxes = [
    { min: { x: 3.0, y: WORLD.floor, z: -2.9 * deep }, max: { x: 4.9, y: WORLD.floor + 2.4, z: -1.3 * deep } },
    { min: { x: -4.6, y: WORLD.floor, z: 1.0 * deep }, max: { x: -3.2, y: WORLD.floor + 1.6, z: 2.6 * deep } },
    { min: { x: -2.0, y: WORLD.floor, z: -0.4 }, max: { x: -1.0, y: WORLD.floor + 0.9, z: 1.2 } },
  ];
  // 월드의 장식 발자국(원 — 기존 장식 피하기 테스트와 같은 기준) · 길 좌표로 옮긴 장애물
  const world = boxes.map((b) => obstacleFromBox(b.min, b.max));
  const obstacles = world.map((o) => ({ ...o, z: o.z / deep, h: o.h / tall }));
  const hit = (c: { x: number; y: number; z: number }, length: number) => {
    const wy = WORLD.floor + (c.y - WORLD.floor) * tall, wz = c.z * deep;
    return world.some((o) => wy - length * 0.16 < WORLD.floor + o.h && Math.hypot(c.x - o.x, wz - o.z) < o.r);
  };
  let inside = 0, raw = 0, n = 0;
  for (const key of ["flounder", "catfish", "ray", "croaker", "sea_bream", "goldfish", "clown", "bullhead"]) {
    const length = lengthsOf(key)[2];
    for (let id = 1; id <= 6; id++) for (let t = 0; t < 300; t += 0.25) {
      n++;
      // 화면과 같이 깊이 · 높이를 넘긴다(장애물 반지름은 월드 — 2026-11-11)
      if (hit(fishCourse(id, t, length, key, 1, { obstacles, deep, tall }), length)) inside++;
      if (hit(fishCourse(id, t, length, key, 1, { deep, tall }), length)) raw++;
    }
  }
  assert.ok(raw / n > 0.01, `장애물이 없을 때는 지나간다 ${raw / n}`);
  assert.ok(inside / n < 0.002, `깊은 수조에서 장식 안에 들어간 비율 ${inside / n}(없을 때 ${raw / n})`);
});

test("장애물이 없으면 길이 그대로다 · 높이 떠 있는 물고기는 낮은 장식을 신경 쓰지 않는다", () => {
  for (let t = 0; t < 100; t += 2.3) {
    assert.deepEqual(fishCourse(3, t, 1.2, "koi", 1, { obstacles: [] }), fishCourse(3, t, 1.2, "koi"));
    // 아로와나는 수면 밑(2~3.6) — 높이 0.5 짜리 돌은 상관없다(구경도 안 간다 — 사는 높이보다 낮다)
    assert.deepEqual(fishCourse(3, t, 1.2, "arowana", 1, { obstacles: [{ x: 0, z: 0, r: 1, h: 0.5 }] }), fishCourse(3, t, 1.2, "arowana"));
  }
});

test("서로 안 겹친다 — 흔한 16마리 어항에서 깊이 겹친 쌍이 있는 프레임이 줄고, 보정값이 한 프레임에 조금씩만 움직인다", () => {
  const fams = ["guppy", "guppy", "guppy", "tetra", "tetra", "goldfish", "goldfish", "koi", "betta", "clown", "angel", "discus", "crucian", "sea_bream", "flounder", "catfish"];
  const fish = fams.map((family, i) => ({ id: i + 1, family })), sc = schoolsOf(fish), n = fish.length;
  const L = new Float32Array(n), pos = new Float32Array(n * 3), off = new Float32Array(n * 3), pin = new Uint8Array(n), prev = new Float32Array(n * 3);
  fish.forEach((f, i) => { L[i] = fishLength(FISH_BASE_CM[f.family], f.family); pin[i] = hugsFloor(f.family) ? 1 : 0; });
  const dt = 1 / 30;
  let raw = 0, sep = 0, frames = 0, maxStep = 0, floorLift = 0;
  const overlap = (extra: Float32Array | null) => {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const e = (k: number) => (extra ? extra[k] : 0);
      const d = Math.hypot(pos[i * 3] + e(i * 3) - pos[j * 3] - e(j * 3), pos[i * 3 + 1] + e(i * 3 + 1) - pos[j * 3 + 1] - e(j * 3 + 1), pos[i * 3 + 2] + e(i * 3 + 2) - pos[j * 3 + 2] - e(j * 3 + 2));
      if (d < (L[i] + L[j]) * 0.12) return true;
    }
    return false;
  };
  for (let t = 0; t < 300; t += dt) {
    frames++;
    fish.forEach((f, i) => {
      const s = sc.get(f.id)!, lead = L[fish.findIndex((g) => g.id === s.leader)];
      const c = schoolCourse(s.leader, s.slot, f.id, t, L[i], f.family, 1, { leaderLength: lead });
      pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
    });
    prev.set(off);
    separate(pos, L, off, dt, { pinned: pin });
    for (let k = 0; k < n * 3; k++) maxStep = Math.max(maxStep, Math.abs(off[k] - prev[k]));
    for (let i = 0; i < n; i++) if (pin[i]) floorLift = Math.max(floorLift, Math.abs(off[i * 3 + 1]));
    if (overlap(null)) raw++;
    if (overlap(off)) sep++;
  }
  assert.ok(raw / frames < 0.1, `길만으로도 옛 22% 보다 적다 ${raw / frames}`);
  assert.ok(sep / frames < 0.02, `밀어낸 뒤 ${sep / frames}`);
  assert.ok(sep < raw / 3, `밀어내기가 겹침을 줄인다 ${raw} → ${sep}`);
  assert.ok(maxStep <= 1.2 * dt + 1e-6, `한 프레임 보정 ${maxStep}`);
  assert.equal(floorLift, 0, "바닥 물고기는 위아래로 안 민다");
});

test("separate — 겹친 두 마리를 반대로 밀고 · 큰 물고기가 덜 밀리고 · 같은 자리여도 값이 멀쩡하다 · 유리 밖으로 안 민다", () => {
  const pos = [0, 0, 0, 0.1, 0, 0], L = [1, 3], off = new Float32Array(6);
  for (let i = 0; i < 300; i++) separate(pos, L, off, 1 / 30);
  assert.ok(off[0] < 0 && off[3] > 0, "반대로");
  assert.ok(Math.abs(off[0]) > Math.abs(off[3]), "작은 쪽이 더 밀린다");
  const same = new Float32Array(6);
  for (let i = 0; i < 100; i++) separate([1, 1, 1, 1, 1, 1], [1, 1], same, 1 / 30);
  assert.ok([...same].every(Number.isFinite) && Math.abs(same[2] - same[5]) > 0.1);
  const wall = new Float32Array(6);
  for (let i = 0; i < 300; i++) separate([4, 0, 0, 3.9, 0, 0], [1.2, 1.2], wall, 1 / 30);
  assert.ok(4 + wall[0] + 0.6 <= 5 + 1e-6 && 3.9 + wall[3] + 0.6 <= 5 + 1e-6, "유리 안");
});

test("바닥 물고기는 계열마다 다른 고리를 돈다(광어는 가운데, 메기는 바깥)", () => {
  const ring = (key: string) => { let m = 0; for (let t = 0; t < 900; t += 1) m = Math.max(m, Math.abs(fishCourse(3, t, 2, key).x)); return m; };
  assert.ok(ring("flounder") < ring("catfish") - 0.8, `${ring("flounder")} vs ${ring("catfish")}`);
  for (const key of Object.keys(FISH_HABITS)) if (FISH_HABITS[key].hug !== undefined && !FISH_HABITS[key].home) assert.ok(FISH_HABITS[key].lane, `${key} 고리(lane) 없음`);
});

test("거북은 숨 쉬러 수면(약 5)까지 올라가 잠깐 머물고, 가끔 모래 위에서 쉰다", () => {
  const length = fishLength(95, "sea_turtle");
  let surface = 0, slowAtTop = 0, sand = 0, n = 0, maxY = -9;
  for (let t = 0; t < 600; t += 0.25) {
    const p = fishCourse(5, t, length, "sea_turtle"), q = fishCourse(5, t + 0.25, length, "sea_turtle");
    n++; maxY = Math.max(maxY, p.y);
    if (p.y > 4.5) { surface++; if (Math.hypot(q.x - p.x, q.z - p.z) < 0.05) slowAtTop++; }
    if (p.ground > 0.95) { sand++; assert.ok(p.y < WORLD.floor + length * 0.3, `모래에서 쉴 때 y ${p.y}`); }
  }
  assert.ok(maxY > 4.7 && maxY <= 5.1, `가장 높이 ${maxY}`);
  assert.ok(surface / n > 0.05, `수면 근처 ${surface / n}`);
  assert.ok(slowAtTop > 0, "수면에서 잠깐 멈춘다");
  assert.ok(sand / n > 0.03, `모래 위에서 쉰다 ${sand / n}`);
});

test("해파리 — 갓을 짧게 오므리며 솟고 길게 펴며 가라앉는다 · 갓 축이 맞다", () => {
  // 떠다니는 위아래 흐름을 빼고(lo = hi) 갓 박자만 본다
  const still = { ...habitOf("jellyfish"), lo: 0, hi: 0 };
  let rise = 0, sink = 0, risePulse = 0;
  for (let t = 0; t < 60; t += 0.05) {
    const p = habitCourse(4, t, 1.6, still, 1, WORLD.floor), q = habitCourse(4, t + 0.05, 1.6, still, 1, WORLD.floor);
    assert.ok(p.pulse >= -1 - 1e-9 && p.pulse <= 1 + 1e-9);
    if (q.y > p.y + 0.004) { rise++; if (q.pulse < p.pulse) risePulse++; } else if (q.y < p.y - 0.001) sink++;
  }
  assert.ok(sink > rise * 1.5, `가라앉는 시간이 더 길다 ${sink} vs ${rise}`);
  assert.ok(risePulse / rise > 0.9, `솟는 동안 갓이 오므라든다 ${risePulse / rise}`);
  const s = { x: 0, y: 0, z: 0 };
  jellyPulse(1, "x", s); assert.ok(s.x < 1 && s.y > 1 && Math.abs(s.y - s.z) < 1e-9, "GLB 는 x 가 갓 축 — y · z 가 같이 넓어진다");
  jellyPulse(1, "y", s); assert.ok(s.y < 1 && s.x > 1 && Math.abs(s.x - s.z) < 1e-9);
  assert.equal(glbUpright("jellyfish"), Math.PI / 2); assert.equal(glbUpright("astral", "moon_jelly"), Math.PI / 2); assert.equal(glbUpright("koi"), 0);
  assert.equal(fishCourse(4, 10, 1, "koi").pulse, 0);
});

test("먹이 — 헤엄치는 물고기는 먹이 쪽 수면으로, 바닥 물고기는 바닥의 먹이로 몰렸다가 원래 길로 부드럽게 돌아간다", () => {
  const feed = { t: 100, x: 2.5 };
  for (const [key, floor] of [["guppy", false], ["koi", false], ["goldfish", false], ["flounder", true], ["catfish", true]] as const) {
    const length = lengthsOf(key)[2];
    for (const id of [3, 8]) {
      // 2026-11-11 — 멀리 있는 느린 물고기는 천천히 온다(평소 가장 빠른 빠르기의 1.8배까지) — 9초 뒤에 본다(예전엔 1.6초에 달려와 4초 뒤에 봤다)
      const mid = fishCourse(id, 109, length, key, 1, { feed }), raw = fishCourse(id, 109, length, key);
      // 멀고 느린 물고기(비단잉어 · 금붕어)는 먹이가 사라지기 전에 다 못 오고 갈 수 있는 만큼만 다가온다 — 그래도 먹이 쪽으로 · 위로 온다
      assert.ok(Math.abs(mid.x - feed.x) < 1.8 || Math.abs(mid.x - feed.x) < Math.abs(raw.x - feed.x) - 0.5, `${key} 먹이 쪽 x ${mid.x}(먹이 없을 때 ${raw.x})`);
      if (floor) assert.ok(mid.y < WORLD.floor + 1, `${key} 바닥에서 y ${mid.y}`);
      else assert.ok(mid.y > 2.5 || mid.y > raw.y + 0.5, `${key} 수면 쪽 y ${mid.y}(먹이 없을 때 ${raw.y})`);
      assert.ok(mid.effort > fishCourse(id, 109, length, key).effort, "먹을 땐 꼬리가 바쁘다");
      // 끝나면 먹이를 안 준 길과 똑같다
      for (const t of [99, 117, 130]) assert.deepEqual(fishCourse(id, t, length, key, 1, { feed }), fishCourse(id, t, length, key), `${key} t${t}`);
    }
  }
  // 해파리는 안 온다
  assert.deepEqual(fishCourse(3, 104, 1.6, "jellyfish", 1, { feed }), fishCourse(3, 104, 1.6, "jellyfish"));
});

test("같은 입력이면 같은 값 — 다른 물고기를 사이에 계산해도(모듈 안의 임시 값이 새지 않는다)", () => {
  const obstacles: Obstacle[] = [{ x: 1, z: -1, r: 0.8, h: 1.5 }];
  for (const key of ["koi", "flounder", "sea_turtle", "jellyfish", "guppy", "rockfish"]) for (let t = 0; t < 200; t += 13.7) {
    const a = schoolCourse(1, 2, 3, t, 1.3, key, 1.2, { obstacles, feed: { t: 50, x: 1 } });
    fishCourse(9, t * 2, 3.1, "whale_shark", 1.5); schoolCourse(5, 4, 8, t + 3, 0.8, "tetra");
    const b = schoolCourse(1, 2, 3, t, 1.3, key, 1.2, { obstacles, feed: { t: 50, x: 1 } });
    assert.deepEqual(a, b, key);
  }
  const out = fishCourse(1, 5, 1, "koi"), reuse = fishCourse(1, 5, 1, "koi", 1, { out: { ...out, x: 99 } });
  assert.deepEqual(reuse, out, "out 에 써도 값은 같다");
});

test("빠르기 · 꼬리 박자 — 치어는 몸길이에 비해 덜 빠르고 꼬리는 더 바쁘다 · 한 마리마다 ±15% 다르다", () => {
  const bl = (key: string, length: number, id = 3) => { let d = 0, e = 0, n = 0, prev = fishCourse(id, 0, length, key); for (let t = 0.5; t < 600; t += 0.5) { const p = fishCourse(id, t, length, key); d += Math.hypot(p.x - prev.x, p.z - prev.z); e += p.effort; n++; prev = p; } return { bl: d / 600 / length, effort: e / n }; };
  for (const key of ["koi", "goldfish", "bluefin", "guppy"]) {
    const [fry, , adult] = lengthsOf(key), f = bl(key, fry), a = bl(key, adult);
    // 옛 길은 치어가 같은 속도라 몸길이/초가 1.36배(참다랑어처럼 어른이 벽에 막히는 종은 1.55배)였다
    assert.ok(f.bl / a.bl < (key === "bluefin" ? 1.45 : 1.25), `${key} 치어 몸길이/초 ${f.bl} vs 어른 ${a.bl}`);
    assert.ok(f.effort > a.effort, `${key} 치어 꼬리 ${f.effort} vs ${a.effort}`);
  }
  const speeds = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => bl("koi", 2.1, id).bl);
  assert.ok(Math.max(...speeds) / Math.min(...speeds) > 1.1, "한 마리마다 다르다");
});

test("가끔 멈춰 떠 있고(꼬리는 작게) · 바닥 물고기가 내려앉으면 모래 먼지 시각을 준다", () => {
  let hover = 0, n = 0, ampAtHover = 0;
  for (let t = 0; t < 600; t += 0.5) { const p = fishCourse(4, t, 2, "koi"); n++; if (p.hover > 0.9) { hover++; ampAtHover = Math.max(ampAtHover, p.amp); } }
  assert.ok(hover > 0 && hover / n < 0.15, `떠 있는 비율 ${hover / n}`);
  assert.ok(ampAtHover < 0.5, `떠 있을 때 꼬리 폭 ${ampAtHover}`);
  let puffs = 0;
  for (let t = 0; t < 900; t += 0.5) { const p = fishCourse(4, t, 2, "flounder"); if (p.puff >= 0) { puffs++; assert.ok(p.puff < 2.5); } }
  assert.ok(puffs > 0, "광어가 내려앉으면 먼지");
  for (let t = 0; t < 100; t += 5) assert.equal(fishCourse(4, t, 2, "koi").puff, -1);
});

test("몸 물결은 몸 모양을 따른다 — 장어는 고르게 · 다랑어는 꼬리만 · 가오리는 날개 · 엔젤은 가슴지느러미 · 돌면 C 자", () => {
  const eel = bendProfile("eel"), tuna = bendProfile("bluefin"), carp = bendProfile("crucian"), ray = bendProfile("ray"), angel = bendProfile("angel");
  assert.ok(eel.lag > 0.9 && Math.max(...eel.amp) / Math.min(...eel.amp) < 1.5, "장어 고른 물결");
  assert.ok(tuna.amp[5] + tuna.amp[4] > 4 * (tuna.amp[0] + tuna.amp[1] + tuna.amp[2] + tuna.amp[3]), "다랑어는 꼬리 두 마디");
  assert.ok(ray.wing > 0.3 && Math.max(...ray.amp) < 0.05, "가오리는 날개");
  assert.ok(angel.fin > carp.fin * 1.5 && angel.amp[5] < carp.amp[5], "엔젤은 지느러미로 젓는다");
  assert.equal(bendProfile("rising", "imugi_fish").lag, 1, "이무기는 뱀처럼");
  const out = new Float32Array(10);
  // 돌 때(turn > 0 = +Y 축으로 돈다) 꼬리 마디가 모두 같은 쪽으로 휜다 — 흔들림 위상과 상관없이 평균이 한쪽
  let sum = 0;
  for (let ph = 0; ph < Math.PI * 2; ph += 0.1) { swimAngles(carp, ph, { turn: 1.2 }, out); for (let i = 0; i < 6; i++) sum += out[i]; }
  assert.ok(sum < -1, `C 자 ${sum}`);
  swimAngles(carp, 1, { amp: 0 }, out);
  assert.ok(out.slice(0, 6).every((v) => v === 0) && out[6] !== 0, "꼬리를 멈춰도 지느러미는 부친다");
  assert.ok(Math.abs(bankAngle(9)) <= 0.1745 + 1e-9 && bankAngle(1) < 0 && bankAngle(-1) > 0);
});

test("몸길이 재는 축 · 재질 표", () => {
  assert.equal(lengthAxisFor("angel"), "x"); assert.equal(lengthAxisFor("discus"), "x"); assert.equal(lengthAxisFor("ray"), "xz");
  assert.equal(lengthAxisFor("jellyfish"), "y"); assert.equal(lengthAxisFor("octopus"), "max"); assert.equal(lengthAxisFor("starfish"), "xz");
  assert.equal(bodyMeasure("angel", "silver_angel", { x: 2, y: 2.1, z: 0.5 }), 2, "엔젤은 키가 커도 머리~꼬리로 잰다");
  for (const f of FAMILIES) for (const key of [f.key, ...f.finals.map((s) => s.key)]) {
    const m = materialTweak(f.key, key);
    assert.ok(m.roughness > 0 && m.roughness < 1 && m.metalness >= 0 && m.metalness < 0.6, key);
  }
  assert.ok(materialTweak("bluefin").metalness > materialTweak("crucian").metalness, "참다랑어는 번쩍인다");
  assert.ok(materialTweak("rising").emissiveIntensity > 0 && materialTweak("astral").emissiveFromMap, "신화는 빛난다");
  assert.ok(materialTweak("anglerfish").emissiveIntensity === 0 && !materialTweak("anglerfish").emissiveFromMap, "아귀 몸은 안 빛난다(초롱은 따로 — models-fix.test)");
  assert.ok(materialTweak("great_white").roughness > 0.6, "상어 피부는 거칠다");
});

test("비탈의 바닥 물고기 — 머리 · 꼬리 밑 모래를 보고 기울고 묻히지 않는다", () => {
  const h = (x: number, z: number) => substrateHeight(x, z, 3);
  const p = floorPose(h, 3.4, 0, 1, 0, 2);
  assert.ok(p.pitch > 0.1, `오르막이면 머리를 든다 ${p.pitch}`);
  const ends = [h(3.4 + 0.84, 0), h(3.4 - 0.84, 0)];
  assert.ok(p.ground >= (ends[0] + ends[1]) / 2 - 1e-9 && p.ground >= h(3.4, 0));
  // 몸을 기울이면 양 끝이 모래 위 — 끝의 높이 = ground + ±reach·slope
  assert.ok(p.ground + 0.84 * p.slope >= ends[0] - 0.02 && p.ground - 0.84 * p.slope >= ends[1] - 0.02);
  const flat = floorPose(() => WORLD.floor, 0, 0, 1, 1, 2);
  assert.equal(flat.pitch, 0); assert.equal(flat.roll, 0);
});

test("거북 무늬는 수조마다 한 번만 그린다 — 두 번째 거북은 바로 만든다", () => {
  const kit = new ModelKit();
  const a = makeAnimal(kit, "sea_turtle", "green_sea_turtle"); a.animate(0, 1);
  const t0 = performance.now();
  const b = makeAnimal(kit, "sea_turtle", "juv_sea_turtle"); b.animate(0, 1);
  const ms = performance.now() - t0;
  const mat = (m: typeof a) => ((m.root.getObjectByName("sculpted-carapace") as T.Mesh).material as T.MeshStandardMaterial);
  assert.equal(mat(a).map, mat(b).map, "같은 등딱지 무늬를 나눠 쓴다");
  assert.ok(ms < 200, `두 번째 거북 ${ms}ms`);
});

test("습성표의 모든 계열이 새 칸(lane · breathe · jet)과 어긋나지 않는다", () => {
  assert.ok(habitOf("sea_turtle").breathe);
  assert.ok(habitOf("jellyfish").jet && habitOf("moon_jelly").jet && habitOf("jellyfish").feeds === false);
});
