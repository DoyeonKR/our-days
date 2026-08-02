// 픽셀 아트 정합성 lock — 손으로 찍은 도트라 행 길이/미정의 색 오타가 곧 렌더 구멍이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSprite } from "./pixel.ts";
import { ALL_SPRITES, petSprites } from "./pixelart.ts";

test("모든 스프라이트가 포맷 정합", () => {
  const errs: string[] = [];
  for (const [name, v] of Object.entries(ALL_SPRITES)) {
    const list = Array.isArray(v) ? v : [v];
    list.forEach((s, i) => errs.push(...validateSprite(s, `${name}[${i}]`)));
  }
  assert.deepEqual(errs, [], errs.join("\n"));
});

test("펫 폼 → 스프라이트 — 전 진화형이 유효한 프레임을 얻는다", () => {
  const forms = [
    "egg", "hatchling", "sunny", "cozy", "moody",
    "fox", "cat", "bear", "panda", "owl", "wolf",
    "celestial_fox", "starlight_fox", "royal_cat", "lucky_cat",
    "guardian_bear", "honey_bear", "zen_panda", "dream_panda",
    "arcane_owl", "sage_owl", "lunar_wolf", "spirit_wolf",
    "unknown_form_xyz",
  ];
  for (const f of forms) {
    const fr = petSprites(f);
    assert.ok(fr.length >= 1, `${f}: 프레임 없음`);
    for (const s of fr) assert.deepEqual(validateSprite(s, f), []);
  }
});

test("애니 스프라이트는 프레임 간 크기가 같다(튐 방지)", () => {
  for (const [name, v] of Object.entries(ALL_SPRITES)) {
    if (!Array.isArray(v) || v.length < 2) continue;
    const [a] = v;
    for (const s of v) {
      assert.equal(s.w, a.w, `${name}: 프레임 폭 불일치`);
      assert.equal(s.h, a.h, `${name}: 프레임 높이 불일치`);
    }
  }
});
