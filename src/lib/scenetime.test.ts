import { test } from "node:test";
import assert from "node:assert/strict";
import { kstHourOf, skyLook, skyPhaseOf } from "./scenetime.ts";

test("시간대 판정 — 경계값", () => {
  assert.equal(skyPhaseOf(4), "night");
  assert.equal(skyPhaseOf(5), "dawn");
  assert.equal(skyPhaseOf(7), "dawn");
  assert.equal(skyPhaseOf(8), "day");
  assert.equal(skyPhaseOf(16), "day");
  assert.equal(skyPhaseOf(17), "dusk");
  assert.equal(skyPhaseOf(19), "dusk");
  assert.equal(skyPhaseOf(20), "night");
  assert.equal(skyPhaseOf(0), "night");
});

test("KST 시각 — UTC 자정 = KST 9시", () => {
  assert.equal(kstHourOf(Date.UTC(2026, 6, 27, 0, 0, 0)), 9);
  assert.equal(kstHourOf(Date.UTC(2026, 6, 27, 15, 0, 0)), 0);
});

test("하늘 팔레트 — 전 시간대×계절 유효 + 밤/노을은 어두운 배경 플래그", () => {
  for (const p of ["dawn", "day", "dusk", "night"] as const)
    for (const se of ["spring", "summer", "autumn", "winter"] as const) {
      const l = skyLook(p, se);
      for (const c of [l.top, l.mid, l.bottom, l.hillFar, l.hillNear]) assert.match(c, /^#[0-9a-f]{6}$/i);
      assert.equal(l.night, p === "night");
    }
  assert.equal(skyLook("night", "spring").onDark, true);
  assert.equal(skyLook("dusk", "spring").onDark, true);
  assert.equal(skyLook("day", "spring").onDark, false);
});
