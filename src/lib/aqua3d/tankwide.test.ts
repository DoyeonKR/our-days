// 어항 넓히기 · 군집 · 전체 보기 lock. [사용자 2026-11-02 "군집을 형성해서" · "재화를 주고 어항을 옆으로" · "전체 보기 풀스크린" · "모래를 좀 더 좋은 그래픽으로"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TANKS, WIDE_STEPS, aquaOf, tankOf, widenTank } from "../aquarium.ts";
import { createIsland } from "../island.ts";
import { decorToWorld, fishCourse, schoolCourse, schoolsOf, wideScale, worldToDecor } from "./world.ts";

test("같은 계열끼리 한 무리 · 대장은 id 가 가장 작다 · 계열이 다르면 따로", () => {
  const m = schoolsOf([{ id: 9, family: "guppy" }, { id: 3, family: "guppy" }, { id: 5, family: "koi" }, { id: 7, family: "guppy" }]);
  assert.deepEqual(m.get(3), { leader: 3, slot: 0 });
  assert.deepEqual(m.get(7), { leader: 3, slot: 1 });
  assert.deepEqual(m.get(9), { leader: 3, slot: 2 });
  assert.deepEqual(m.get(5), { leader: 5, slot: 0 });
});

test("무리는 대장 곁에서 헤엄친다 · 서로 겹치지 않는다 · 어항 밖으로 안 나간다", () => {
  for (let t = 0; t < 200; t += 3.7) {
    const lead = schoolCourse(1, 0, 1, t, 1.2, "guppy");
    assert.deepEqual(lead, fishCourse(1, t, 1.2, "guppy"), "대장은 원래 길 그대로");
    const pts = [1, 2, 3, 4, 5, 6].map((slot) => schoolCourse(1, slot, slot + 1, t, 1.2, "guppy"));
    for (const p of pts) {
      assert.ok(Math.hypot(p.x - lead.x, p.y - lead.y, p.z - lead.z) < 4.5, "무리에서 안 떨어진다");
      assert.ok(Math.abs(p.x) <= 4.5 && p.y >= -4.4 && p.y <= 4.8 && Math.abs(p.z) <= 2.5);
      assert.ok(Object.values(p).every(Number.isFinite));
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z) > 0.05);
  }
});

test("옆으로 늘리기 — 하트로 사고 · 물고기 · 장식 칸이 는다 · 끝이 있다 · 옛 저장분은 0 단계", () => {
  const rich = { ...createIsland("콩", null, 0), coins: 1_000_000 };
  assert.equal(aquaOf(rich, 0).wide, 0);
  assert.equal(tankOf(aquaOf(rich, 0)).fish, TANKS[0].fish);
  let st = rich;
  for (let i = 0; i < WIDE_STEPS.length; i++) {
    const r = widenTank(st, 0);
    assert.ok(r.ok);
    if (r.ok) st = r.state;
  }
  const a = aquaOf(st, 0);
  assert.equal(a.wide, WIDE_STEPS.length);
  assert.equal(st.coins, 1_000_000 - WIDE_STEPS.reduce((n, x) => n + x.price, 0));
  assert.equal(tankOf(a).fish, TANKS[0].fish + WIDE_STEPS.reduce((n, x) => n + x.fish, 0));
  assert.equal(widenTank(st, 0).ok, false);
  assert.equal(widenTank({ ...rich, coins: WIDE_STEPS[0].price - 1 }, 0).ok, false);
  for (let i = 1; i < WIDE_STEPS.length; i++) assert.ok(WIDE_STEPS[i].price > WIDE_STEPS[i - 1].price);
});

test("넓혀도 놓은 장식 좌표가 그대로 왕복한다(저장값은 안 바뀐다) · 가로 배율은 1 ~ 1.5", () => {
  assert.equal(wideScale(undefined), 1);
  assert.equal(wideScale(3), 1.5);
  for (const w of [1, 1.5]) for (const x of [6, 50, 94]) for (const y of [14, 54, 94]) {
    const p = decorToWorld(x, y, w), back = worldToDecor(p.x, p.z, w);
    assert.ok(Math.abs(back.x - x) < 1e-9 && Math.abs(back.y - y) < 1e-9);
  }
  assert.ok(Math.abs(fishCourse(2, 9, 1, "guppy", 1.5).x) > Math.abs(fishCourse(2, 9, 1, "guppy", 1).x) - 1e-9, "물고기도 넓어진 만큼 돈다");
});

test("화면 — 전체 보기 · 늘리기 버튼이 있다 · 장면이 군집을 쓴다 · 모래는 전용 그림", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  assert.ok(read("src/components/Aquarium3D.tsx").includes("전체 보기"));
  assert.ok(read("src/components/AquariumGame.tsx").includes("widenTank"));
  const scene = read("src/lib/aqua3d/scene.ts"), step = read("src/lib/aqua3d/fishstep.ts");
  assert.ok(step.includes("schoolCourse(") && scene.includes("schoolsOf(") && scene.includes("stepFish("));
  assert.ok(read("src/lib/aqua3d/habitat.ts").includes("sandMap(512)"));
  assert.match(read("src/app/globals.css"), /\.aqua-tank-3d\.is-full \{[^}]*position: fixed/);
});

test("수조 크기 — 단계 · 옆으로 늘리기가 오를수록 화면을 더 채우고, 끝까지 키우면 꽉 찬 1(양옆이 안 잘린다)", async () => {
  const { tankDisplay, wideScale } = await import("./world.ts");
  let prev = 0;
  for (let t = 1; t <= 6; t++) for (let w = 0; w <= 3; w++) {
    const v = tankDisplay(t, wideScale(w));
    assert.ok(v <= 1 + 1e-9, `${t}/${w}: ${v}`);
    if (w === 0) { assert.ok(v > prev, `단계 ${t} 가 앞 단계보다 커야 한다`); prev = v; }
  }
  assert.ok(Math.abs(tankDisplay(6, wideScale(3)) - 1) < 1e-9);
  assert.ok(tankDisplay(9, 1) === tankDisplay(6, 1), "7 ~ 9 단계는 6 과 같은 크기(그림만 다르다)");
  assert.ok(tankDisplay(1, 1) >= 0.7, "1단계도 물고기가 보일 만큼은 크다");
});

test("수조 높이 — 단계마다 위로 늘고(6단계 1.5배) 바닥은 그 자리, 물고기 길도 같은 식으로 늘린다", async () => {
  const { tankTall, tallY, WORLD } = await import("./world.ts");
  assert.equal(tankTall(1), 1);
  assert.ok(Math.abs(tankTall(6) - 1.5) < 1e-9 && tankTall(9) === tankTall(6));
  assert.equal(tallY(WORLD.floor, 1.5), WORLD.floor, "바닥은 안 움직인다");
  assert.ok(tallY(4, 1.5) > 4);
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8"), step = readFileSync(join(import.meta.dirname, "fishstep.ts"), "utf8");
  // 2026-11-11 — 헤엄치는 물고기는 tallY 그대로, 바닥에 붙은 만큼(ground)은 몸 높이를 안 늘린다(모래 높이만 따른다)
  assert.match(step, /const k = tall \+ \(1 - tall\) \* c\.ground; c\.y = WORLD\.floor \+ \(c\.y - WORLD\.floor\) \* k;/, "물고기 길도 늘린다");
  assert.match(scene, /habitat\.root\.scale\.y=tall;habitat\.root\.position\.y=WORLD\.floor\*\(1-tall\)/);
  const hab = readFileSync(join(import.meta.dirname, "habitat.ts"), "utf8");
  assert.match(hab, /WORLD\.floor \+ \(substrateHeight\(x \/ root\.scale\.x, z \/ root\.scale\.z, tier\) - WORLD\.floor\) \* root\.scale\.y/, "바닥 높이도 같은 식");
});

test("터널 수족관 — 7~9 는 점점 깊어지고 10 · 11 단계가 가장 깊다 · 터널은 앞유리에서 뒤 바위 앞까지 · 물고기는 터널 둘레를 비켜 간다", async () => {
  const { tankDeep, tunnelSpan, tunnelObstacles, TUNNEL_R } = await import("./tunnel.ts");
  assert.equal(tankDeep(6), 1);
  assert.ok(tankDeep(7) > 1 && tankDeep(8) > tankDeep(7) && tankDeep(9) > tankDeep(8) && tankDeep(10) > tankDeep(9), "단계마다 더 깊게");
  assert.ok(tankDeep(10) > 2 && tankDeep(11) === tankDeep(10));
  const d = tankDeep(10), span = tunnelSpan(d);
  assert.equal(span.front, 3 * d, "앞유리에서 시작");
  assert.ok(span.back > -3 * d, "뒤 벽 앞에서 끝난다");
  const obs = tunnelObstacles(d, 1.5);
  assert.ok(obs.length >= 6 && obs.every((o) => o.x === 0 && o.r >= TUNNEL_R * 0.9 && Math.abs(o.z) <= 3), "물고기 길 좌표(앞뒤를 늘리기 전)로 준다");
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8"), step = readFileSync(join(import.meta.dirname, "fishstep.ts"), "utf8");
  assert.match(step, /if \(deep !== 1\) \{ c\.z \*= deep; c\.dz \*= deep; \}/, "물고기 길도 깊어진다");
  assert.match(scene, /worldToDecor\(point\.x,point\.z\/deep,wide\)/, "장식 자리도 같은 배율");
  const hab = readFileSync(join(import.meta.dirname, "habitat.ts"), "utf8");
  assert.match(hab, /z \/ root\.scale\.z/, "바닥 높이도 같은 배율");
});

test("정어리 떼 — 한 묶음(그리기 한 번) · 누를 수 없다 · 같은 시각이면 같은 자리 · 수조 안에 머문다", async () => {
  const T = await import("three");
  const { makeShoal } = await import("./shoal.ts");
  const a = makeShoal(64, { halfX: 6, halfZ: 6.4, top: 10 }), b = makeShoal(64, { halfX: 6, halfZ: 6.4, top: 10 });
  a.animate(37.5); b.animate(37.5);
  const m = new T.Matrix4(), n = new T.Matrix4(), p = new T.Vector3();
  for (let i = 0; i < 64; i++) {
    a.mesh.getMatrixAt(i, m); b.mesh.getMatrixAt(i, n);
    assert.ok(m.equals(n), "같은 시각 = 같은 자리");
    p.setFromMatrixPosition(m);
    assert.ok(Math.abs(p.x) < 8 && Math.abs(p.z) < 8 && p.y < 11 && p.y > -5.3, `${p.x},${p.y},${p.z}`);
  }
  const hits: unknown[] = [];
  a.mesh.raycast(new T.Raycaster(), hits as never);
  assert.equal(hits.length, 0);
  a.dispose(); b.dispose();
});

test("먼 바다 — 고래는 수조 안에서만 지나가고(옆벽 밖으로 안 삐져나온다) · 같은 시각 = 같은 자리 · 셰이더 재질은 묶어 그리지 않는다", async () => {
  const T = await import("three");
  const { makeGiants } = await import("./giants.ts");
  const halfX = 4.6 * 1.5, g = makeGiants({ halfX, backZ: -5.6, top: 10 }), h = makeGiants({ halfX, backZ: -5.6, top: 10 });
  const box = new T.Box3();
  for (let t = 0; t < 160; t += 2.5) {
    g.animate(t); h.animate(t);
    const w = g.root.children[0], w2 = h.root.children[0];
    assert.ok(w.position.equals(w2.position));
    if (!w.visible) continue;
    g.root.updateMatrixWorld(true);
    box.setFromObject(w);
    assert.ok(box.min.x >= -halfX - 0.6 && box.max.x <= halfX + 0.6, `t=${t}: ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
  }
  g.dispose(); h.dispose();
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8");
  assert.match(scene, /!\(o\.material instanceof T\.ShaderMaterial\)/);
});

test("빛줄기 — 모든 수조에 있고, 기울어진 아래 끝도 옆벽 안에 있다(고래는 대수족관만)", async () => {
  const T = await import("three");
  const { makeGiants } = await import("./giants.ts");
  for (const [halfX, top, whale] of [[4.6, 5.4, false], [6.9, 10.4, true]] as const) {
    const g = makeGiants({ halfX, backZ: -2.2, top, whale });
    const beams = g.root.children.filter((o): o is import("three").Mesh => o instanceof T.Mesh && o.material instanceof T.ShaderMaterial);
    assert.equal(beams.length, 6);
    for (let t = 0; t < 120; t += 7) {
      g.animate(t);
      g.root.updateMatrixWorld(true);
      for (const b of beams) {
        const box = new T.Box3().setFromObject(b);
        assert.ok(box.min.x > -halfX - 0.4 && box.max.x < halfX + 0.4, `${halfX}: ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
      }
    }
    assert.equal(g.root.children.length, whale ? 7 : 6, "고래는 대수족관만");
    g.dispose();
  }
});

test("단계별 볼거리 — 기준값은 tiers.ts 한곳(three 없음) · 정어리 8 · 고래 9 · 터널 10 · 돔 11 · 돔은 장애물로 비켜 간다", async () => {
  const tiers = readFileSync(join(import.meta.dirname, "tiers.ts"), "utf8");
  assert.doesNotMatch(tiers, /from "three"/, "화면이 읽으므로 three 를 부르지 않는다");
  const { SHOAL_TIER, WHALE_TIER, TUNNEL_TIER, DOME_TIER } = await import("./tiers.ts");
  assert.ok(SHOAL_TIER < WHALE_TIER && WHALE_TIER < TUNNEL_TIER && TUNNEL_TIER < DOME_TIER);
  const { DOME_R, domeObstacles } = await import("./dome.ts");
  const o = domeObstacles(1.5)[0];
  assert.ok(o.x === 0 && o.z === 0 && o.r >= DOME_R);
  const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8");
  assert.match(scene, /wantTunnel=habitatTier>=TUNNEL_TIER&&habitatTier<DOME_TIER,wantDome=habitatTier>=DOME_TIER/);
  assert.match(scene, /\{\.\.\.o,z:o\.z\/deep,h:o\.h\/tall\}/, "장식 장애물도 물고기 길 좌표로");
  const step = readFileSync(join(import.meta.dirname, "fishstep.ts"), "utf8");
  assert.match(step, /if \(m\.family === 'starfish'\) \{ const s = starCourse\(id, elapsed, m\.length, wide, \{ obstacles: w\.obstacles, deep, tall, hall \}\)/, "불가사리도 장식 · 터널 · 돔을 비켜 간다");
  const ui = readFileSync(join(import.meta.dirname, "../../components/Aquarium3D.tsx"), "utf8");
  assert.match(ui, /from "@\/lib\/aqua3d\/tiers"/);
  assert.doesNotMatch(ui, /tank >= 7/);
});
