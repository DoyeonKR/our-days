// 히어로 그림 · 탭 위치 lock. [2026-09-24 펫 탭 리뷰에서 찾은 두 사고]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PET_FORMS } from "./island.ts";
import { petSprites } from "./pixelart.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("★ 히어로 그림 목록 = public/heroes/v2 폴더 — 없는 그림을 부르면 깨진 이미지가 뜬다", () => {
  const files = readdirSync(join(root, "public", "heroes", "v2"))
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.slice(0, -4))
    .sort();
  const src = read("src/components/island/HeroV2.tsx");
  const m = src.match(/HERO_V2_FORMS[^=]*=\s*new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, "HERO_V2_FORMS 목록을 못 찾았다");
  const listed = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(listed, files, "목록과 폴더가 다르다 — 그림을 넣거나 뺐으면 목록도 고쳐라");
});

test("★ 그림이 없는 폼은 도트로 받는다 — 49 폼 전부 자기 스프라이트가 있다(알로 떨어지지 않는다)", () => {
  const src = read("src/components/island/HeroV2.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(src, /if \(!HERO_V2_FORMS\.has\(form\)\)[\s\S]{0,80}<PetPixel/, "그림 없는 폼의 대체 렌더가 없다");
  const egg = JSON.stringify(petSprites("egg")[0].rows);
  for (const k of Object.keys(PET_FORMS)) {
    if (k === "egg") continue;
    assert.notEqual(JSON.stringify(petSprites(k)[0].rows), egg, `${k} 가 알 스프라이트로 떨어진다`);
  }
});

test("★ .tap 의 relative 는 레이어 안 — 'tap absolute/fixed' 가 제자리를 잃지 않게", () => {
  // 레이어 밖 규칙은 명시도와 상관없이 @layer utilities 의 absolute·fixed 를 이긴다.
  // 2026-09-08 ~ 09-24 동안 로그인 비밀번호 보기 버튼·사진 칸 버튼·업데이트 알림·떠다니는 미니 펫이
  // 전부 relative 로 떨어져 있었다.
  const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const layered = /@layer\s+components\s*\{\s*\.tap\s*\{\s*position:\s*relative;?\s*\}\s*\}/;
  assert.match(css, layered, ".tap 의 position 이 components 레이어 안에 없다");
  const outside = css.replace(layered, "");
  assert.doesNotMatch(outside, /(^|\})\s*\.tap\s*\{[^}]*position\s*:/, "레이어 밖에 .tap 의 position 규칙이 또 있다");
});
