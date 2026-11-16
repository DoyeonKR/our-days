import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BOSSES, bossArt } from "./fishingworld.ts";
import { BOSS_IMAGE_KEYS, FISH_IMAGE_KEYS, hasFishImage } from "./aquaimages.ts";

// 주인 전용 그림(2026-11-15) — 산호 여왕 · 검은 파도. 그림이 있는 주인은 레이드 · 주인 창 · 결과 카드에서 그것을, 수조에 들어가는 물고기는 종 그림을 쓴다
test("boss art files exist and are registered", () => {
  const withArt = BOSSES.filter((b) => b.art);
  assert.deepEqual(withArt.map((b) => b.key).sort(), ["geomeun", "sanho"]);
  for (const b of withArt) {
    assert.ok(BOSS_IMAGE_KEYS.has(b.art!) && hasFishImage(b.art!), b.art);
    assert.ok(!FISH_IMAGE_KEYS.has(b.art!), "kept out of the species art list");
    for (const dir of ["", "sm/"]) assert.ok(existsSync(new URL(`../../public/aqua/fish/${dir}${b.art}.webp`, import.meta.url)), `${dir}${b.art}`);
    assert.equal(bossArt(b), b.art);
  }
  for (const b of BOSSES.filter((x) => !x.art)) assert.equal(bossArt(b), b.species);
});

test("boss screens draw the boss art", () => {
  const panels = readFileSync(new URL("../components/FishingPanels.tsx", import.meta.url), "utf8");
  assert.ok(!/FishArt artKey=\{(b|boss)\.species\}/.test(panels), "boss list · hero use bossArt");
  const game = readFileSync(new URL("../components/FishingGame.tsx", import.meta.url), "utf8");
  assert.match(game, /art: bossArt\(b\)/);
  assert.match(game, /fish\.boss \? bossArt\(/);
  const raid = readFileSync(new URL("../components/BossRaidGame.tsx", import.meta.url), "utf8");
  assert.match(raid, /artKey=\{setup\.art \?\? setup\.species\}/);
});
