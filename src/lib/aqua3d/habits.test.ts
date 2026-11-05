// 어종별 습성 — 바닥에 사는 물고기는 바닥에서 안 떨어지고, 위에 사는 물고기는 바닥에 안 내려간다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FAMILIES, fishCm } from "../aquarium.ts";
import { FISH_HABITS, habitKey, habitOf, hugsFloor } from "./habits.ts";
import { WORLD, fishCourse, fishLength, schoolCourse, schoolsOf } from "./world.ts";

const track = (family: string, length: number, id = 3, seconds = 900) => {
  const out = [];
  for (let t = 0; t < seconds; t += 0.7) out.push(fishCourse(id, t, length, family));
  return out;
};

test("수조에 들어오는 모든 계열에 습성이 있다", () => {
  for (const f of FAMILIES) assert.ok(FISH_HABITS[f.key], `${f.key} 습성 없음`);
});

test("바닥 생활 — 광어 · 메기 · 가오리 · 수염상어 · 심해어는 바닥에서 안 떨어진다", () => {
  for (const key of ["flounder", "catfish", "ray", "nurse_shark", "rockfish", "megamouth", "starfish", "octopus", "anglerfish", "gulper_eel", "coelacanth", "oarfish", "giant_squid", "kraken"]) {
    assert.ok(hugsFloor(key), key);
    for (const length of [0.6, 1.5, 3]) {
      const ys = track(key, length).map((p) => p.y);
      assert.ok(Math.max(...ys) < WORLD.floor + length * 0.45 + 0.4, `${key} 길이 ${length} 가 바닥에서 떠오른다: ${Math.max(...ys)}`);
      assert.ok(Math.min(...ys) >= WORLD.floor - 0.11, `${key} 가 바닥을 뚫는다`);
    }
  }
});

test("광어는 누워 있고 대부분의 시간을 가만히 있는다", () => {
  // 모델 자체가 납작하게 누운 몸이다(GLB 높이 ±0.09 · 폭 ±0.54) — 돌리면 도로 선다
  assert.ok(habitOf("flounder").hug! <= 0.06, "모래에 바짝 붙는다");
  const p = track("flounder", 1.5);
  let still = 0;
  for (let i = 1; i < p.length; i++) if (Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z) < 1e-6) still++;
  assert.ok(still / p.length > 0.7, `가만히 있는 비율 ${still / p.length}`);
  assert.ok(Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x)) > 2, "그래도 가끔은 옮겨 간다");
  assert.ok(p.every((q) => q.dy === 0), "몸을 기울이지 않는다");
});

test("사는 높이가 서로 다르다 — 위 · 가운데 · 아래", () => {
  const mean = (key: string) => { const y = track(key, 1.2).map((p) => p.y); return y.reduce((a, b) => a + b) / y.length; };
  assert.ok(mean("guppy") > mean("tetra"), "구피는 테트라보다 위");
  assert.ok(mean("arowana") > 2, "아로와나는 수면 밑");
  assert.ok(mean("betta") > 1, "베타는 위쪽");
  assert.ok(mean("goldfish") < 0, "금붕어는 아래쪽");
  assert.ok(mean("clown") < -1, "흰동가리는 산호 높이");
  assert.ok(mean("sea_bream") < mean("salmon"));
  for (const key of ["guppy", "tetra", "sweetfish", "arowana", "salmon", "bluefin", "whale_shark", "manta"]) {
    assert.ok(Math.min(...track(key, 1.2).map((p) => p.y)) > WORLD.floor + 2, `${key} 가 바닥까지 내려간다`);
  }
});

test("빠르기 — 회유어는 어항 끝까지 빠르게, 해파리 · 베타 · 흰동가리는 자기 자리", () => {
  // 옆으로 간 거리만 잰다 — 해파리는 2026-11-05 부터 갓을 오므릴 때마다 제자리에서 위아래로 솟았다 가라앉는다(헤엄이 아니다)
  const travel = (key: string) => { const p = track(key, 1.2); let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return d; };
  const span = (key: string, id = 3) => { const x = track(key, 1.2, id).map((p) => p.x); return Math.max(...x) - Math.min(...x); };
  assert.ok(travel("bluefin") > travel("koi") * 2);
  assert.ok(travel("koi") > travel("jellyfish") * 2);
  assert.ok(span("bluefin") > 7);
  for (const key of ["betta", "clown"]) assert.ok(span(key) < 3, key);
  const homes = [1, 2, 3, 4, 5, 6].map((id) => { const x = track("clown", 1.2, id, 60).map((p) => p.x); return x.reduce((a, b) => a + b) / x.length; });
  assert.ok(Math.max(...homes) - Math.min(...homes) > 1, "흰동가리마다 자리가 다르다");
});

test("거북은 평소 낮게 있다가 숨 쉬러 올라간다", () => {
  const y = track("sea_turtle", 2, 5, 1500).map((p) => p.y);
  const low = y.filter((v) => v < -1).length / y.length;
  assert.ok(low > 0.5, `낮게 있는 비율 ${low}`);
  assert.ok(Math.max(...y) > 1, "수면 쪽으로 올라간다");
});

test("무리 — 작은 물고기는 무리 짓고, 혼자 사는 물고기는 대장을 안 따라간다", () => {
  const f = [{ id: 1, family: "x" }, { id: 2, family: "x" }];
  assert.deepEqual(schoolsOf(f).get(2), { leader: 1, slot: 1 });
  for (const key of ["betta", "flounder", "catfish", "jellyfish", "great_white", "sea_turtle", "clown"]) {
    assert.ok(!habitOf(key).school, key);
    assert.deepEqual(schoolCourse(1, 1, 2, 30, 1, key), fishCourse(2, 30, 1, key), `${key} 는 혼자 다닌다`);
  }
  for (const key of ["guppy", "tetra", "bluefin", "striped_jack"]) assert.ok(habitOf(key).school, key);
});

test("어느 습성이든 다 큰 몸이 어항을 안 벗어난다 · 값이 멀쩡하다", () => {
  for (const f of FAMILIES) {
    const length = fishLength(fishCm({ family: f.key, stage: 2 }));
    for (let id = 1; id <= 6; id++) for (let t = 0; t < 400; t += 1.3) for (const scale of [1, 1.5]) {
      const p = fishCourse(id, t, length, f.key, scale);
      assert.ok(Object.values(p).every(Number.isFinite), f.key);
      assert.ok(Math.abs(p.x) + length / 2 <= 5.05 * scale, `${f.key} x ${p.x} 길이 ${length}`);
      assert.ok(Math.abs(p.z) <= 2.6, `${f.key} z ${p.z}`);
      // 거북만 숨 쉬러 수면(약 5.5) 바로 밑까지 올라간다(2026-11-05 — 4.3 에서 멈추면 숨 쉬는 게 안 보였다)
      assert.ok(p.y >= WORLD.floor - 0.1 && p.y <= (f.key === "sea_turtle" ? 5.15 : 4.3), `${f.key} y ${p.y}`);
      assert.ok(p.dx * p.dx + p.dy * p.dy + p.dz * p.dz > 0);
    }
  }
});

test("품종이 자기 습성을 가지면 그쪽을 쓴다", () => {
  assert.equal(habitKey("astral", "moon_jelly"), "moon_jelly");
  assert.equal(habitKey("astral", "galaxy_fish"), "astral");
  assert.equal(habitKey("guppy", "fry_guppy"), "guppy");
});

test("수조가 습성을 쓴다 — 모래 높이에 맞춘다", () => {
  const scene = readFileSync("src/lib/aqua3d/scene.ts", "utf8");
  // 2026-11-05 — 한 점(hugsFloor) 대신 머리 · 꼬리 · 양옆의 모래 높이로 앉고 기운다(world.floorPose). 바닥 정도는 길이 준다(course.ground)
  assert.ok(scene.includes("floorPose(heightAt,x,z,c.dx,c.dz"), "바닥 생활 물고기가 모래 높이를 안 따른다");
  assert.ok(scene.includes("y+=c.ground*(fp.ground-WORLD.floor)"));
});
