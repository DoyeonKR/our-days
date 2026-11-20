// 포유류는 바위 위에서 쉬고(절반 — 2026-11-15 90% 에서 바꿨다) · 만지면 놀란다(2026-11-14)
// [사용자: "표유류는 90프로는 바위 위에서 쉬고있는다 · 10프로는 수영한다 · 모든 수조에 동물들은 유저가 탭하거나 만지면 놀라거나 특성 애니메이션을 취하면서 빠르게 움직인다"]
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { HAUL_REST, haulAssign, haulBlend, haulRest, habitOf, type Course, type Obstacle } from "./habits.ts";
import { STARTLE_S, startleDir, startleDuration, startleKind, startlePose } from "./startle.ts";
import { WORLD } from "./world.ts";

const MAMMALS = ["spotted_seal", "fur_seal", "steller_sea_lion", "japanese_sea_lion", "sea_otter", "otter"];
const course = (): Course => ({ x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, effort: 1, turn: 0, amp: 1, pulse: 0, ground: 0, puff: -1, hover: 0, feed: 0 }) as Course;

test("해양 포유류 여섯은 모두 바위 쉼터를 쓴다 · 다른 종은 안 쓴다", () => {
  for (const k of MAMMALS) assert.equal(habitOf(k).haul, true, k);
  for (const k of ["guppy", "great_white", "sea_turtle", "moray"]) assert.ok(!habitOf(k).haul, k);
});

test("시간의 절반은 바위 위에서 쉬고 절반은 헤엄친다(내려가고 · 올라오는 몇 초 포함)", () => {
  for (const id of [1, 7, 42, 99]) {
    let rest = 0, swim = 0, n = 0;
    for (let t = 0; t < 3600; t += 0.5) { const r = haulRest(id, t); n++; if (r > 0.99) rest++; if (r < 0.01) swim++; }
    assert.ok(Math.abs(rest / n - HAUL_REST) < 0.04, `id ${id} 쉼 ${rest / n}`);
    assert.equal(HAUL_REST, 0.5);
    assert.ok(swim / n > 0.3 && swim / n < 0.4, `id ${id} 헤엄 ${swim / n}`);
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
  assert.equal(startleKind("spotted_seal"), "glide");
  assert.equal(startleKind("spotted_seal", "spotted_seal", true), "galumph");
  assert.equal(startleKind("humpback_whale"), "dive");
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

test("쉼터 바위는 보이는 곳부터 — 양옆 끝 · 뒤 · 앞을 가린 바위보다 가운데 · 앞 바위(2026-11-14 물범이 수초에 가려 안 보였다)", async () => {
  const { haulCandidates } = await import("./habits.ts");
  const side = { x: 9.8, z: -1.8, r: 1.8, h: 0.9, kind: "rock" as const };
  const center = { x: 1.5, z: -1.2, r: 1.4, h: 1.0, kind: "rock" as const };
  assert.equal(haulCandidates(2.8, [side, center], 2.5)[0], center, "가운데 바위가 먼저");
  const front = { x: -2, z: 0.5, r: 1.4, h: 1.0, kind: "rock" as const }, plant = { x: -2, z: 1.5, r: 0.8, h: 1.5, kind: "decor" as const };
  assert.notEqual(haulCandidates(2.8, [front, plant, center], 2.5)[0], front, "앞을 큰 장식이 가린 바위는 뒤로");
});

test("가려진 물고기 윤곽 — 물고기 레이어만 깊이로 한 번 더 그리고, 마지막 그리기가 더 앞에 무언가 있을 때만 옅게 비춘다", async () => {
  const { readFileSync } = await import("node:fs");
  const post = readFileSync(new URL("./post.ts", import.meta.url), "utf8"), scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(post, /scene\.overrideMaterial = xrayMat; camera\.layers\.set\(xray\);/);
  assert.match(post, /camera\.layers\.mask = mask/, "레이어를 되돌린다");
  assert.match(scene, /XRAY_SKIP=\/\^\(moray\|octopus/, "굴에 숨은 곰치 · 셰이더로 팔이 움직이는 두족류는 뺀다");
  const { FINAL_FRAG } = await import("./post.ts");
  assert.ok(/^[\x00-\x7F]*$/.test(FINAL_FRAG), "셰이더 원문은 ASCII 만");
});

// 물범이 기이하게 빨랐다(2026-11-15) — 쉼터를 오가는 3초에 몸길이의 3~4배/초로 미끄러지고, 밀어내기가 한 프레임에 바위 위로 올려 13~16배/초로 튀었다
import { HAUL_RAMP } from "./habits.ts";
import { CONTACT_MAX_SPEED } from "./fishstep.ts";
test("mammals glide to and from their rest spot slowly and are never pushed in one jump", () => {
  assert.ok(HAUL_RAMP >= 0.06, "about ten seconds to go to and from the rest spot");
  assert.ok(CONTACT_MAX_SPEED <= 4);
  const step = readFileSync(new URL("./fishstep.ts", import.meta.url), "utf8");
  assert.match(step, /lim = Math\.max\(0\.01, b\.lengths\[k\] \* CONTACT_MAX_SPEED \* dt\)/);
  const habits = readFileSync(new URL("./habits.ts", import.meta.url), "utf8");
  // 2026-11-20 — 곧장 섞기(높이 √R · 가로 R²)는 승강기처럼 떠오르고 뒤로 미끄러졌다 → 쉼터 앞 물속 한 점을 지나는 곡선을 머리부터 헤엄친다
  assert.match(habits, /out\.x = a0 \* sx \+ a1 \* wx \+ a2 \* rx;/);
});

test("포유류는 쉼터를 오갈 때 머리부터 헤엄친다 — 가는 쪽을 보고, 위아래로만 곧게 오르내리지 않고, 젓는다(2026-11-20)", async () => {
  const { haulBlend, haulRest } = await import("./habits.ts");
  const { WORLD } = await import("./world.ts");
  const rock = { x: 2, z: 0.2, r: 1.6, h: 1.2, kind: "rock" as const };
  for (const id of [3, 11, 29]) {
    let prev: { x: number; y: number; z: number } | null = null, moving = 0, forward = 0, steep = 0, stroke = 0;
    for (let t = 0; t < 420; t += 0.1) {
      const R = haulRest(id, t);
      const c = { x: -3 + Math.sin(t * 0.05), y: 1, z: 0, dx: 1, dy: 0, dz: 0, effort: 1, amp: 1, turn: 0, hover: 0, ground: 0, puff: 0 } as unknown as Parameters<typeof haulBlend>[6];
      haulBlend(id, t, 2.4, 1, WORLD.floor, { rock, share: 0, deep: 1, tall: 1.5 }, c);
      const cur = { x: c.x, y: c.y * 1.5, z: c.z };
      if (prev && R > 0.05 && R < 0.95) {
        const dx = cur.x - prev.x, dy = cur.y - prev.y, dz = cur.z - prev.z, d = Math.hypot(dx, dy, dz);
        if (d / 0.1 > 0.1) { moving++; if ((dx * c.dx + dy * c.dy * 1.5 + dz * c.dz) / (d * (Math.hypot(c.dx, c.dy * 1.5, c.dz) || 1)) > 0.3) forward++; if (Math.abs(dy) / d > 0.9) steep++; if (c.effort > 0.6) stroke++; }
      }
      prev = cur;
    }
    assert.ok(moving > 50, `${id} 오간다`);
    assert.ok(forward / moving > 0.85, `${id} 머리부터 ${forward}/${moving}`);
    assert.ok(steep / moving < 0.2, `${id} 곧게 오르내림 ${steep}/${moving}`);
    assert.ok(stroke / moving > 0.6, `${id} 젓는다 ${stroke}/${moving}`);
  }
});

// 2026-11-18 [사용자: "포유류들도 터치했을때 움직임이 너무 빨라 실제 동물과 비슷하게 … 땅에서 통통 튀며 움직이는거"]
test("포유류는 놀라도 천천히 — 물속은 초당 몸길이 1배 아래, 고래는 0.4배 아래 · 땅에선 통통 튀며 몇 걸음", () => {
  const peak = (k: "glide" | "dive" | "galumph") => { let m = 0; for (let t = 0; t < startleDuration(k); t += 0.02) m = Math.max(m, Math.abs(startlePose(k, t + 0.02).dash - startlePose(k, t).dash) / 0.02); return m; };
  assert.ok(peak("glide") < 1.8, `glide ${peak("glide")}`);
  assert.ok(peak("dive") < 0.5, `dive ${peak("dive")}`);
  assert.ok(peak("galumph") < 1, `galumph ${peak("galumph")}`);
  // 예전 roll 은 처음 1초에 몸길이 1.6배(초당 4.8배 고점)
  let hops = 0, prev = 0; for (let t = 0; t < startleDuration("galumph"); t += 0.01) { const h = startlePose("galumph", t).hop; if (h > 0.1 && prev <= 0.1) hops++; prev = h; }
  assert.ok(hops >= 6, `땅에서 여러 번 통통 ${hops}`);
  for (const k of ["glide", "dive", "galumph"] as const) assert.equal(startlePose(k, startleDuration(k)).dash, 0);
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.ok(scene.includes("onLand=!!sw?.haul&&sw.rest>.5"), "쉬는 중이면 땅의 몸짓");
  assert.ok(scene.includes("if(!onLand&&trickOf"), "땅에선 물속 재주를 안 한다");
});
