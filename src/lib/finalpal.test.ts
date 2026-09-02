// 최종형 정체성 회귀 lock. [사용자 리포트 2026-08-12 "행운냥이랑 그냥 고양이랑 생긴게 똑같잖아"]
//
// 실측이 그대로였다: FINAL_SPECIES 가 계보 스프라이트를 재탕해 **왕고양이와 행운고양이의
// 픽셀 diff 가 0** 이었고, 그냥 고양이와는 왕관 하나 차이였다. 신화형 리컬러 사고(2026-08-11)와
// 같은 뿌리 — 이름이 다르면 그림도 달라야 한다. 여기서 색까지 포함한 픽셀 차이를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { petSprites } from "./pixelart.ts";
import { pixelAt } from "./pixel.ts";

/** 두 폼의 0번 프레임에서 **색까지 다른** 칸 수. */
function diff(a: string, b: string): number {
  const A = petSprites(a)[0];
  const B = petSprites(b)[0];
  let n = 0;
  for (let y = 0; y < A.h; y++)
    for (let x = 0; x < A.w; x++) if ((pixelAt(A, x, y) ?? "") !== (pixelAt(B, x, y) ?? "")) n++;
  return n;
}

const LINEAGES: [string, string, string][] = [
  ["fox", "celestial_fox", "starlight_fox"],
  ["cat", "royal_cat", "lucky_cat"],
  ["bear", "guardian_bear", "honey_bear"],
  ["panda", "zen_panda", "dream_panda"],
  ["owl", "arcane_owl", "sage_owl"],
  ["wolf", "lunar_wolf", "spirit_wolf"],
];

test("최종형 — 같은 계보의 두 최종형이 서로 다르다(이전엔 diff 0) [회귀 lock]", () => {
  for (const [, hi, lo] of LINEAGES) {
    const d = diff(hi, lo);
    // 몸통 대부분이 갈려야 한다 — 왕관 위치 몇 칸이 아니라 털색 수준(수백 칸)
    assert.ok(d >= 200, `${hi}↔${lo}: 픽셀 차이 ${d}칸 — 같은 그림에 다른 이름이다`);
  }
});

test("최종형 — 중간형과 왕관 이상으로 다르다 [회귀 lock]", () => {
  for (const [mid, hi, lo] of LINEAGES) {
    for (const f of [hi, lo]) {
      const d = diff(mid, f);
      // 왕관+반짝임만으로는 ~80칸 — 팔레트가 갈리면 수백 칸이 된다
      assert.ok(d >= 250, `${mid}→${f}: 픽셀 차이 ${d}칸 — 왕관만 씌운 재탕이다`);
    }
  }
});

test("초기 진화형 — 아기·햇살이·포근이·그늘이가 서로 다른 히어로다", () => {
  const forms = ["hatchling", "sunny", "cozy", "moody"];
  for (let i = 0; i < forms.length; i++) {
    for (let j = i + 1; j < forms.length; j++) {
      assert.ok(diff(forms[i], forms[j]) >= 180, `${forms[i]}↔${forms[j]}: 색과 인상이 거의 같다`);
    }
  }
});

test("최종형 — 각 분기 문장이 얼굴 바깥 무대에도 남는다", () => {
  for (const [, hi, lo] of LINEAGES) {
    for (const form of [hi, lo]) {
      const sprite = petSprites(form)[0];
      let sideInk = 0;
      for (let y = 8; y < 38; y++) {
        for (const x of [4, 5, 42, 43]) {
          if (pixelAt(sprite, x, y)) sideInk++;
        }
      }
      assert.ok(sideInk >= 12, `${form}: 최종형 문장/오라가 보이지 않는다 (${sideInk})`);
    }
  }
});
