import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BOSSES } from "../fishingworld.ts";
import { BOSS_LOOK_KEYS, bossLookOf, shellTop } from "./bosslook.ts";
import { BOSS_MODEL_REVISIONS } from "./model-revisions.ts";

// 수조의 주인 모습(2026-11-15) — 잡아서 수조에 넣은 산호 여왕 · 검은 파도가 종 모습 그대로였다 → 주인 전용 3D 모델
test("crowned boss fish in the tank get the boss model", () => {
  const sanho = BOSSES.find((b) => b.key === "sanho")!, geomeun = BOSSES.find((b) => b.key === "geomeun")!;
  const t = bossLookOf(sanho.name, sanho.species), g = bossLookOf(geomeun.name, geomeun.species);
  assert.equal(t?.model, "boss_sanho"); assert.ok(t?.shell && t.coral);
  assert.equal(g?.model, "boss_geomeun");
  // 왕관이 없거나 · 다른 종이거나 · 전용 모습이 없는 주인은 그대로
  assert.equal(bossLookOf(undefined, "green_sea_turtle"), null);
  assert.equal(bossLookOf(sanho.name, "bluefin_tuna"), null);
  for (const b of BOSSES.filter((x) => !BOSS_LOOK_KEYS.includes(x.key))) assert.equal(bossLookOf(b.name, b.species), null, b.key);
  for (const k of BOSS_LOOK_KEYS) assert.ok(BOSSES.find((b) => b.key === k)?.art, k);
});

test("boss models exist with a cache revision equal to their bytes", async () => {
  const { createHash } = await import("node:crypto");
  for (const k of BOSS_LOOK_KEYS) {
    const b = BOSSES.find((x) => x.key === k)!, look = bossLookOf(b.name, b.species)!;
    const url = new URL(`../../../public/aqua/models/boss/${look.model}.glb`, import.meta.url);
    assert.ok(existsSync(url), look.model);
    const sha = createHash("sha256").update(readFileSync(url)).digest("hex");
    assert.equal(BOSS_MODEL_REVISIONS[look.model!], sha.slice(0, 12), `${look.model} revision`);
  }
  assert.ok(Math.abs(shellTop(0, 0) - .335) < 1e-9);
  assert.ok(shellTop(.9, 0) < shellTop(.4, 0) && shellTop(.4, 0) < shellTop(0, 0));
});

test("scene loads the boss model and swims the turtle like a turtle", () => {
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(scene, /look=bossLookOf\(f\.crown,key\)/);
  assert.match(scene, /makeAnimal\(kit,f\.family,key,look\)/);
  assert.match(scene, /gKind=look\?\.model\?"boss"/);
  assert.match(scene, /glb\.release\(m\.glbKind\?\?"fish",m\.glbKey\)/);
  assert.match(scene, /look\?\.model&&f\.family==="sea_turtle"\?turtleGlbMotion\(inner\):fishMotion/);
  const glb = readFileSync(new URL("./glb.ts", import.meta.url), "utf8");
  assert.match(glb, /kind === "boss"\) prepareFishSource\(scene, ""\)/);
  const turtle = readFileSync(new URL("./turtle.ts", import.meta.url), "utf8");
  assert.match(turtle, /export function turtleGlbMotion/);
  assert.match(turtle, /coral\.userData\.glbShared = true/);
});
