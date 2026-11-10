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
  const scene = read("src/lib/aqua3d/scene.ts");
  assert.ok(scene.includes("schoolCourse(") && scene.includes("schoolsOf("));
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
