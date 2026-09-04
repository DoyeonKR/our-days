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

test("터치 시 사각 하이라이트 없이 히어로만 움직인다", () => {
  const css = readFileSync(join(root, "src", "app", "globals.css"), "utf8");
  const fx = readFileSync(join(root, "src", "components", "island", "PetTapFx.tsx"), "utf8");
  assert.match(css, /\.pet-hit-target[\s\S]*-webkit-tap-highlight-color:\s*transparent/);
  assert.match(css, /\.animate-tap-ring\s*\{[^}]*border-radius:\s*999px/);
  assert.match(fx, /className="animate-tap-ring block rounded-full"/);
});

test("신형 히어로는 원본을 자르지 않고 개별 눈감기 레이어와 종별 모션을 낸다", () => {
  const hero = readFileSync(join(root, "src", "components", "island", "HeroV2.tsx"), "utf8");
  const css = readFileSync(join(root, "src", "app", "globals.css"), "utf8");
  assert.match(hero, /className="hero-art"/);
  assert.match(hero, /className="hero-closed-eyes"/);
  assert.match(hero, /const EYES: Record<string, EyeProfile>/);
  assert.equal((hero.match(/<Image/g) ?? []).length, 1, "히어로 원본 이미지는 한 번만 렌더링해야 한다");
  for (const removedPart of ["hero-top", "hero-eyes", "hero-body"]) {
    assert.ok(!hero.includes(removedPart), `${removedPart} 분할 레이어가 남아 있다`);
  }
  assert.match(css, /\.hero-v2 > \.hero-art\s*\{[\s\S]*?overflow:\s*visible/);
  for (const motion of ["hero-v2-blink", "hero-v2-bird", "hero-v2-canine", "hero-v2-feline", "hero-v2-tall", "hero-v2-ear-twitch"]) {
    assert.ok(css.includes(`@keyframes ${motion}`), `${motion} 애니메이션이 없다`);
  }
  assert.match(css, /\.hero-v2\.is-asleep \.hero-closed-eyes\s*\{[^}]*opacity:\s*1/);
  assert.match(css, /42%, 45%, 53%, 56%\s*\{\s*opacity:\s*1/);
  for (const form of forms.filter((name) => name !== "egg")) {
    assert.match(hero, new RegExp(`\\b${form}:`), `${form} 눈 위치 설정이 없다`);
  }
});
