import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PET_FORMS } from "./island.ts";
import { HERO_MOTIONS, heroMotion } from "./heromotion.ts";

test("all 151 heroes have an explicit motion classification", () => {
  assert.deepEqual([...HERO_MOTIONS.keys()].sort(), Object.keys(PET_FORMS).sort());
  for (const form of Object.keys(PET_FORMS)) {
    const profile = heroMotion(form);
    assert.deepEqual(profile, heroMotion(form));
    assert.ok(profile.delay <= 0 && profile.delay > -7000);
    assert.ok(profile.duration >= 6.8 && profile.duration <= 8.4);
    assert.ok(profile.breath >= 3.2 && profile.breath <= 4.2);
  }
  assert.ok(new Set(Object.keys(PET_FORMS).map((f) => heroMotion(f).delay)).size > 100);
});
test("larvae stay grounded; adults, guardians and heavy animals have appropriate motion", () => {
  for (const form of ["moth_2", "bee_2", "beetle_2"]) assert.equal(heroMotion(form).kind, "round");
  for (const form of ["moth_4", "azure_dragon", "ghost_3"]) assert.equal(heroMotion(form).kind, "float");
  assert.equal(heroMotion("white_tiger").kind, "feline");
  assert.equal(heroMotion("black_tortoise").kind, "slow");
  assert.equal(heroMotion("unknown").kind, "round");
});
test("sleep, static icons, face crop and reduced-motion do not compete with idle transforms", () => {
  const hero = readFileSync(new URL("../components/island/HeroV2.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(hero, /active && size > 48/);
  assert.match(css, /is-active:not\(\.is-asleep\)/);
  assert.match(css, /is-active\.is-asleep > \.hero-art > img/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{ \.hero-v2\.is-active, \.hero-v2\.is-active > \.hero-art > img \{ animation: none/);
  assert.ok(!css.includes("hero-v2-ear-twitch"), "moving the whole image must not pretend to articulate an ear");
  const yard = readFileSync(new URL("../components/island/PetYard.tsx", import.meta.url), "utf8");
  assert.match(yard, /pix \? "" : "animate-pet-bob"/);
  assert.match(yard, /pix \? "block" : "animate-pet-sleep-breathe block"/);
});
