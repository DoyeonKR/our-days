// 옆 · 앞뒤로 늘리기 + 고래상어 플랑크톤 먹기 — 2026-11-19 [사용자: "수조 옆으로 늘리기와 깊이 늘리기도 · 업그레이드하면 50% 씩" · "고래상어는 입 벌리고 플랑크톤을 먹는 애니메이션"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEEP_STEPS, TANKS, WIDE_CORE_MAX, WIDE_STEPS, aquaOf, deepenTank, tankOf, widenTank, type Island } from "../aquarium.ts";
import { deepScale, wideScale } from "./world.ts";

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const rich = { coins: 10_000_000 } as unknown as Island;

test("each step past the old three widens the tank by half again; depth grows 1.5x per step", () => {
  assert.equal(wideScale(0), 1);
  assert.equal(wideScale(3), 1.5);
  assert.equal(wideScale(4), 2.25);
  assert.equal(wideScale(5), 3.375);
  for (let i = 1; i <= 5; i++) assert.ok(wideScale(i) > wideScale(i - 1));
  assert.equal(deepScale(0), 1);
  for (let i = 1; i <= DEEP_STEPS.length; i++) assert.ok(Math.abs(deepScale(i) / deepScale(i - 1) - 1.5) < 1e-9);
});

test("width past step 3 and depth live in top-level island fields old apps pass through", () => {
  let st: Island = rich;
  for (let i = 0; i < WIDE_STEPS.length; i++) { const r = widenTank(st, 0); assert.ok(r.ok); st = r.state; }
  for (let i = 0; i < DEEP_STEPS.length; i++) { const r = deepenTank(st, 0); assert.ok(r.ok); st = r.state; }
  assert.equal(deepenTank(st, 0).ok, false);
  const s = st as Island & { aquaWideTop?: number; aquaDeep?: number; aquarium?: { wide?: number } };
  assert.equal(s.aquaWideTop, WIDE_STEPS.length);
  assert.equal(s.aquaDeep, DEEP_STEPS.length);
  assert.ok((s.aquarium?.wide ?? 0) <= WIDE_CORE_MAX, "옛 앱이 아는 칸은 3까지");
  // 옛 앱이 aquarium 을 다시 지어도 최상위 칸이 남아 그대로 읽힌다
  const old = { ...st, aquarium: { ...(st as { aquarium: object }).aquarium, wide: 3 } } as Island;
  const a = aquaOf(old, 0);
  assert.equal(a.wide, WIDE_STEPS.length);
  assert.equal(a.deepen, DEEP_STEPS.length);
  const cap = tankOf(a);
  assert.equal(cap.fish, TANKS[a.tank - 1].fish + WIDE_STEPS.reduce((n, x) => n + x.fish, 0) + DEEP_STEPS.reduce((n, x) => n + x.fish, 0));
  for (let i = 1; i < DEEP_STEPS.length; i++) assert.ok(DEEP_STEPS[i].price > DEEP_STEPS[i - 1].price);
});

test("scene scales the tank front-to-back and the screen offers the depth button", () => {
  const scene = read("src/lib/aqua3d/scene.ts");
  assert.match(scene, /deepScale\(next\.aquarium\.deepen\)/);
  assert.ok(read("src/components/AquariumGame.tsx").includes("deepenTank"));
});

test("whale sharks open their mouth and suck plankton on a cycle, skipping meals and reduced motion", () => {
  const scene = read("src/lib/aqua3d/scene.ts");
  assert.match(scene, /function feedWhaleSharks\(\)/);
  assert.match(scene, /m\.family!=="whale_shark"/);
  assert.match(scene, /reduced\.matches/);
  assert.match(scene, /addJaw\(m\.root,\{teeth:TEETH_CODE\.none/);
  assert.match(scene, /"suck",plankTint/);
  assert.match(scene, /feedWhaleSharks\(\);/);
});
