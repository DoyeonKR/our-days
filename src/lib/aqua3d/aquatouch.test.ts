// 포유류는 바위 위에서 쉬고(90%) · 만지면 놀란다(2026-11-14)
// [사용자: "표유류는 90프로는 바위 위에서 쉬고있는다 · 10프로는 수영한다 · 모든 수조에 동물들은 유저가 탭하거나 만지면 놀라거나 특성 애니메이션을 취하면서 빠르게 움직인다"]
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { HAUL_REST, haulAssign, haulBlend, haulRest, habitOf, type Course, type Obstacle } from "./habits.ts";
import { STARTLE_S, startleDir, startleKind, startlePose } from "./startle.ts";
import { WORLD } from "./world.ts";

const MAMMALS = ["spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "sea_otter", "otter"];
const course = (): Course => ({ x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, effort: 1, turn: 0, amp: 1, pulse: 0, ground: 0, puff: -1, hover: 0, feed: 0 }) as Course;

test("해양 포유류 여섯은 모두 바위 쉼터를 쓴다 · 다른 종은 안 쓴다", () => {
  for (const k of MAMMALS) assert.equal(habitOf(k).haul, true, k);
  for (const k of ["guppy", "great_white", "sea_turtle", "moray"]) assert.ok(!habitOf(k).haul, k);
});

test("시간의 90% 는 바위 위에서 쉬고 10% 는 헤엄친다(내려가고 · 올라오는 몇 초 포함)", () => {
  for (const id of [1, 7, 42, 99]) {
    let rest = 0, swim = 0, n = 0;
    for (let t = 0; t < 3600; t += 0.5) { const r = haulRest(id, t); n++; if (r > 0.99) rest++; if (r < 0.01) swim++; }
    assert.ok(Math.abs(rest / n - HAUL_REST) < 0.04, `id ${id} 쉼 ${rest / n}`);
    assert.ok(swim / n > 0.04 && swim / n < 0.1, `id ${id} 헤엄 ${swim / n}`);
  }
});

test("쉬는 동안 바위 꼭대기에 있다 · 둘이 한 바위면 양옆으로 비켜 눕는다 · 바위가 없으면 모래 위", () => {
  const rock: Obstacle = { x: 1.2, z: -0.5, r: 1.1, h: 0.9, kind: "rock" };
  const map = haulAssign([{ id: 1, length: 1.2 }, { id: 2, length: 1.2 }], [rock]);
  assert.equal(map.get(1)!.rock, rock);
  assert.equal(map.get(2)!.share, 1);
  const t = (() => { for (let s = 0; s < 400; s += 0.5) if (haulRest(1, s) === 1 && haulRest(2, s) === 1) return s; return 0; })();
  const a = course(), b = course();
  haulBlend(1, t, 1.2, 1, WORLD.floor, { rock, share: 0 }, a);
  haulBlend(2, t, 1.2, 1, WORLD.floor, { rock, share: 1 }, b);
  assert.ok(Math.abs(a.x - rock.x) < 1e-9 && a.y > WORLD.floor + rock.h * 0.9, `꼭대기 ${a.x} ${a.y}`);
  assert.ok(Math.abs(b.x - a.x) > 0.3, "나눠 쓰면 비켜 눕는다");
  assert.ok(a.amp < 0.2 && a.hover === 1 && a.ground === 0, "바위 위에선 쉰다");
  const c = course();
  haulBlend(5, t, 1.2, 1, WORLD.floor, { rock: null, share: 0 }, c);
  if (haulRest(5, t) === 1) assert.ok(c.ground === 1 && Math.abs(c.y - (WORLD.floor + 0.12)) < 1e-9, "바위가 없으면 모래 위");
  // 먹이를 주면 쉬다가도 먹으러 간다
  const f = { ...course(), feed: 1 } as Course;
  assert.equal(haulBlend(1, t, 1.2, 1, WORLD.floor, { rock, share: 0 }, f), 0);
});

test("놀라는 몸짓은 종마다 다르다 · 끝나면 원래 길로 돌아온다 · 처음엔 빠르게 튀어 나간다", () => {
  assert.equal(startleKind("puffer"), "inflate");
  assert.equal(startleKind("octopus"), "ink");
  assert.equal(startleKind("spotted_seal"), "roll");
  assert.equal(startleKind("flounder"), "burrow");
  assert.equal(startleKind("jellyfish"), "pulse");
  assert.equal(startleKind("guppy"), "dart");
  for (const k of ["dart", "inflate", "ink", "burrow", "pulse", "roll", "tuck"] as const) {
    const end = startlePose(k, STARTLE_S);
    assert.equal(end.dash, 0); assert.equal(end.puff, 1); assert.equal(end.roll, 0);
    const early = startlePose(k, 0.3), late = startlePose(k, 2.6);
    assert.ok(early.beat >= late.beat, `${k} 처음 꼬리가 더 세다`);
    assert.ok(early.dash > 0, k);
  }
  assert.ok(startlePose("dart", 1).dash > 1.5, "튀어 나간다");
  // 2026-11-14 [사용자: "반응이 너무 빨라"] — 튀어 나가는 데 1초, 돌아오기까지 3.6초
  assert.ok(STARTLE_S >= 3.5 && startlePose("dart", 0.5).dash < startlePose("dart", 1).dash, "천천히 멀어진다");
  assert.ok(Math.abs(startlePose("dart", 0.2, 1).bend) > 1, "C 자로 꺾는다");
  assert.ok(startlePose("inflate", 1.5).puff > 1.6, "복어는 부푼다");
  assert.ok(Math.abs(startlePose("roll", 1.8, 1).roll - 2 * Math.PI) < 1e-6, "포유류는 한 바퀴 구른다");
  const up = startleDir("pulse", 1, 0, 1, 0, 1);
  assert.ok(up.y > 0.9, "해파리는 위로");
  const back = startleDir("ink", 0, -1, 1, 0, 1);
  assert.ok(back.x < -0.5, "먹물은 머리 반대쪽(외투막 쪽)으로");
  const side = startleDir("dart", 0, -1, 1, 0, 1);
  assert.ok(Math.abs(Math.hypot(side.x, side.y, side.z) - 1) < 1e-9);
});

test("화면 — 누르면 놀란다(먹물 · 모래) · 놀란 만큼 자리 · 머리 · 꼬리 · 굴리기 · 부풀기 · 움직임 줄이기면 안 한다", () => {
  const src = readFileSync("src/lib/aqua3d/scene.ts", "utf8");
  assert.match(src, /startleFish\(o\.userData\.id\);events\.fish\(o\.userData\.id\)/);
  assert.match(src, /startleFish\(best\);events\.fish\(best\)/);
  assert.match(src, /function startleFish\(id:number\)\{\s*const m=swimmers\.get\(id\);if\(!m\|\|reduced\.matches\)return;/);
  assert.match(src, /"ink",new T\.Color/);
  assert.match(src, /"sand",new T\.Color/);
  assert.match(src, /m\.root\.scale\.setScalar\(m\.scale\*sp\.puff\)/);
  const step = readFileSync("src/lib/aqua3d/fishstep.ts", "utf8");
  assert.match(step, /haulBlend\(id, elapsed, m\.length, wide, WORLD\.floor/);
});
