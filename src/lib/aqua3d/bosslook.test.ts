import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BOSSES } from "../fishingworld.ts";
import { BOSS_LOOK_KEYS, bossLookOf, shellTop } from "./bosslook.ts";

// 수조의 주인 모습(2026-11-15) — 잡아서 수조에 넣은 산호 여왕 · 검은 파도가 종 모습 그대로였다
test("crowned boss fish in the tank get the boss look", () => {
  const sanho = BOSSES.find((b) => b.key === "sanho")!, geomeun = BOSSES.find((b) => b.key === "geomeun")!;
  const t = bossLookOf(sanho.name, sanho.species), g = bossLookOf(geomeun.name, geomeun.species);
  assert.ok(t?.shell && t.coral && t.art === sanho.art);
  assert.ok(g?.skin && g.art === geomeun.art);
  // 왕관이 없거나 · 다른 종이거나 · 전용 모습이 없는 주인은 그대로
  assert.equal(bossLookOf(undefined, "green_sea_turtle"), null);
  assert.equal(bossLookOf(sanho.name, "bluefin_tuna"), null);
  for (const b of BOSSES.filter((x) => !BOSS_LOOK_KEYS.includes(x.key))) assert.equal(bossLookOf(b.name, b.species), null, b.key);
  // 전용 모습이 있는 주인은 전용 그림도 있다
  for (const k of BOSS_LOOK_KEYS) assert.ok(BOSSES.find((b) => b.key === k)?.art, k);
});

test("boss skins exist and the coral sits on the shell dome", () => {
  for (const k of BOSS_LOOK_KEYS) { const b = BOSSES.find((x) => x.key === k)!, look = bossLookOf(b.name, b.species)!; if (look.skin) assert.ok(existsSync(new URL(`../../../public/aqua/boss/${look.skin}.webp`, import.meta.url)), look.skin); }
  assert.ok(Math.abs(shellTop(0, 0) - .335) < 1e-9);
  assert.ok(shellTop(.9, 0) < shellTop(.4, 0) && shellTop(.4, 0) < shellTop(0, 0));
  assert.ok(shellTop(.95, 0) >= .035 - 1e-9);
});

test("scene and turtle wire the boss look", () => {
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(scene, /look=bossLookOf\(f\.crown,key\)/);
  assert.match(scene, /makeAnimal\(kit,f\.family,key,look\)/);
  assert.match(scene, /if\(look\?\.skin\)bossSkin\(m,inner,look\.skin\)/);
  // 복제한 재질은 떠날 때 지운다 · 셰이더 덧칠은 잇는다
  assert.match(scene, /m\.ownMats\?\.forEach\(x=>x\.dispose\(\)\)/);
  assert.match(scene, /c\.onBeforeCompile=src\.onBeforeCompile;c\.customProgramCacheKey=src\.customProgramCacheKey/);
  const turtle = readFileSync(new URL("./turtle.ts", import.meta.url), "utf8");
  assert.match(turtle, /coralCrownGeometry\(\)/);
  assert.match(turtle, /coral\.userData\.glbShared = true/);
});
