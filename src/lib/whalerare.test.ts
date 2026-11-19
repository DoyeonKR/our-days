// 범고래는 주인에서 빼고 더 귀하게 · 고래류는 수조에 담는 확률 절반 — 2026-11-19 [사용자: "범고래는 보스에서빼 범고래는 더 귀하게 해야해 고래류 포획률은 더 낮춰줘 반으로"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOSSES, TIMED_FISH } from "./fishingworld.ts";
import { captureChance, isWhale } from "./fishing.ts";

test("orca is no boss · the Antarctic boss is a giant squid (same key keeps progress)", () => {
  assert.ok(BOSSES.every((b) => b.family !== "orca" && b.species !== "orca"));
  const b = BOSSES.find((x) => x.key === "bingbyeok")!;
  assert.equal(b.family, "giant_squid");
});

test("orca is rarer — picked as a guest only 30% of the time", () => {
  const o = TIMED_FISH.filter((t) => t.species === "orca");
  assert.ok(o.length > 0 && o.every((t) => t.rare === 0.3));
});

test("whales store at half the chance — the button shows the same value", () => {
  for (const f of ["orca", "minke_whale", "gray_whale", "humpback_whale", "sperm_whale", "blue_whale"]) assert.ok(isWhale(f), f);
  for (const f of ["whale_shark", "koi", "sawshark"]) assert.ok(!isWhale(f), f);
  const base = captureChance(20, 4, 0.8, true, "float", 0), whale = captureChance(20, 4, 0.8, true, "float", 0, "orca");
  assert.ok(Math.abs(whale - Math.round(base * 0.5 * 100) / 100) < 0.011, `${base} → ${whale}`);
  assert.match(readFileSync("src/components/FishingGame.tsx", "utf8"), /DEEP_GENTLE_BONUS : 0\), fish\.family\)\) : 0;/);
});
