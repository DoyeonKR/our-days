// 낚시 업그레이드 저장 자리(2026-11-12) — 새 칸은 섬 맨 위 칸 fishPlus 에(fishingOf 가 s.fishing 을 아는 칸만 다시 만든다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland } from "./island.ts";
import { buyBait, haulJunk } from "./fishing.ts";
import { fishPlusOf, landSpecial, specialCatch, withFishPlus } from "./fishplus.ts";

test("fishPlus 는 낚시 저장을 지나도 남는다 · 모르는 칸도 그대로", () => {
  const now = Date.UTC(2026, 10, 12, 3);
  let s = createIsland("펫", null, now);
  s = { ...s, coins: 100000 };
  s = withFishPlus(s, { future: { a: 1 }, bottles: [{ id: "b1" }] });
  const r = buyBait(s, "bait_shrimp", "2026-11-12");
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.state.fishPlus, s.fishPlus, "미끼 사기가 지우지 않는다");
  const j = haulJunk(s, { family: "x", stage: 0, grade: "흔함", difficulty: 1, junk: "can" } as never, "2026-11-12");
  if (j.ok) assert.deepEqual(j.state.fishPlus, s.fishPlus, "꽝 건지기가 지우지 않는다");
  assert.deepEqual(fishPlusOf(s), { future: { a: 1 }, bottles: [{ id: "b1" }] });
  const w = withFishPlus(s, { mastery: {} });
  assert.deepEqual(Object.keys(w.fishPlus ?? {}).sort(), ["bottles", "future", "mastery"], "넘긴 칸만 덮는다");
});

test("특별한 것은 꽝 · 피버 · 순위판과 따로 · 화면이 갈래를 탄다", () => {
  const c = specialCatch("bottle", "b1", "유리병");
  assert.equal(c.junk, undefined);
  assert.equal(c.special?.kind, "bottle");
  const s = createIsland("펫", null, 0);
  assert.equal(landSpecial(s, { ...c, special: undefined }, {} as never).ok, false);
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.match(src, /const c = activeBoss \? base : rollSpecial\(st, specialCtx\(seed, clock\(\)\)\) \?\? base;/, "물고기 뽑기와 따로 · 주인전엔 없다");
  assert.match(src, /if \(c\.special\) \{[\s\S]{0,400}landSpecial\(s, c, sctx\)/, "끌어올리면 landSpecial — 꽝 · 순위판 길을 안 탄다");
  assert.doesNotMatch(src.slice(src.indexOf("if (c.special) {"), src.indexOf("if (c.special) {") + 600), /reportCatch|haulJunk/, "순위판 · 꽝 수집함에 안 간다");
});
