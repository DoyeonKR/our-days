import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const forms = [
  "egg", "hatchling", "sunny", "cozy", "moody", "fox", "cat",
  "bear", "panda", "owl", "wolf", "celestial_fox", "starlight_fox", "royal_cat",
  "lucky_cat", "guardian_bear", "honey_bear", "zen_panda", "dream_panda", "arcane_owl", "sage_owl",
  "lunar_wolf", "spirit_wolf", "tiger", "bengal_tiger", "mudeung_tiger", "lion", "giraffe",
];

test("28종 신형 히어로 자산이 모두 존재한다", () => {
  for (const form of forms) {
    assert.ok(existsSync(join(root, "public", "heroes", "v2", `${form}.png`)), `${form} 신형 자산이 없다`);
  }
});

test("메인·게임·우리 섬의 공통 렌더러가 신형 히어로를 사용한다", () => {
  const icon = readFileSync(join(root, "src", "components", "island", "PetIcon.tsx"), "utf8");
  const yard = readFileSync(join(root, "src", "components", "island", "PetYard.tsx"), "utf8");
  const island = readFileSync(join(root, "src", "components", "IslandGame.tsx"), "utf8");
  assert.match(icon, /<HeroV2/);
  assert.match(yard, /<HeroV2/);
  assert.match(island, /<HeroV2/);
});
