// 실제 비율 크기 — 2026-11-19 [사용자: "모든 개체들 크기를 실제와 비슷하게 반영해 제일 크거나 작은 개체 기준으로 하고 크기를 실제와 동일하게"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FISH_BASE_CM } from "../aquarium.ts";
import { realLength, sizeUnitFor, SIZE_CM_MIN, SIZE_FLOOR, SIZE_SHARE, WORLD } from "./world.ts";

test("drawn length is proportional to real cm above the tap floor — whales are no longer all the same size", () => {
  const unit = sizeUnitFor(FISH_BASE_CM.blue_whale, WORLD.width * 3.6);
  const L = (f: string) => realLength(FISH_BASE_CM[f], unit);
  assert.ok(L("blue_whale") > L("sperm_whale") && L("sperm_whale") > L("humpback_whale") && L("humpback_whale") > L("gray_whale") && L("gray_whale") > L("whale_shark") && L("whale_shark") > L("minke_whale") && L("minke_whale") > L("orca"));
  // 둘 다 바닥보다 충분히 크면 비율이 실제와 같다(오차 2% 안)
  const r = L("blue_whale") / L("orca"), real = FISH_BASE_CM.blue_whale / FISH_BASE_CM.orca;
  assert.ok(Math.abs(r / real - 1) < 0.02, `${r} vs ${real}`);
  // 더 긴 개체는 늘 더 길다 · 바닥 아래로 안 내려간다
  const cms = Object.values(FISH_BASE_CM).sort((a, b) => a - b);
  for (let i = 1; i < cms.length; i++) if (cms[i] > cms[i - 1]) assert.ok(realLength(cms[i], unit) > realLength(cms[i - 1], unit));
  assert.ok(realLength(0.5, unit) >= SIZE_FLOOR);
});

test("the largest animal in the tank sets the scale — it never passes the share of the tank width; small-only tanks stop at the base unit", () => {
  for (const w of [10, 16, 25, 36]) for (const cm of [5, 65, 650, 950, 2500]) {
    const u = sizeUnitFor(cm, w);
    assert.ok(cm / u <= SIZE_SHARE * w + 1e-9);
    assert.ok(u >= SIZE_CM_MIN);
  }
  assert.equal(sizeUnitFor(22, 10), SIZE_CM_MIN);
});

test("the scene draws real size and swims with the larger of path and drawn length, rescaling every body when the largest changes", () => {
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(scene, /unit=sizeUnitFor\(maxCm,WORLD\.width\*wide\)/);
  assert.match(scene, /setSizeUnit\(unit\);for\(const f of approvedFish\)/);
  assert.match(scene, /scale=drawn\/Math\.max\(\.001,bodyMeasure/);
});
