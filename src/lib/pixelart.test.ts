// 픽셀 아트 정합성 lock.
// [2026-08-03] 사용자: "픽셀하고 일러스트 차이가 너무 크다" → 두 아트가 **같은 세계**로 보여야 한다.
// 이 테스트가 막는 회귀: (1) 도트 오타(행 길이/미정의 색), (2) 픽셀 팔레트가 SVG 의 PAL 과
// 어긋나는 것(눈으로 맞추면 반드시 어긋난다 → 소스 대조로 강제), (3) 종 실루엣 구분 소실.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSprite } from "./pixel.ts";
import { ALL_SPRITES, PIXEL_PAL, petSprites, sleepSprite } from "./pixelart.ts";

test("모든 스프라이트가 포맷 정합", () => {
  const errs: string[] = [];
  for (const [name, v] of Object.entries(ALL_SPRITES)) {
    const list = Array.isArray(v) ? v : [v];
    list.forEach((s, i) => errs.push(...validateSprite(s, `${name}[${i}]`)));
  }
  assert.deepEqual(errs, [], errs.join("\n"));
});

test("픽셀 팔레트 == SVG 아트의 PAL (두 아트가 같은 색을 쓴다)", () => {
  // parts.tsx 의 PAL 원본을 읽어 값 대조 — 한쪽만 바꾸면 즉시 실패한다.
  const src = readFileSync(
    join(import.meta.dirname, "..", "components", "island", "art", "parts.tsx"),
    "utf8",
  );
  // ⚠ 정규식을 조립하지 않는다 — 이스케이프 사고로 검사가 조용히 죽는다(실제로 겪음).
  //    `  fur: [ ... ],` 한 줄을 문자열로 찾아 그 줄의 hex 만 뽑아 비교한다.
  const lines = src.split("\n");
  const mismatched: string[] = [];
  for (const [key, tri] of Object.entries(PIXEL_PAL)) {
    const line = lines.find((l) => l.trim().startsWith(`${key}: [`));
    if (!line) {
      mismatched.push(`${key}: PAL 에 없음`);
      continue;
    }
    const svg = (line.match(/#[0-9a-f]{6}/gi) ?? []).map((c) => c.toLowerCase());
    const px = (tri as readonly string[]).map((c) => c.toLowerCase());
    if (svg.join(",") !== px.join(",")) mismatched.push(`${key}: SVG[${svg}] ≠ 픽셀[${px}]`);
  }
  assert.deepEqual(mismatched, [], `픽셀/일러스트 색 불일치:\n${mismatched.join("\n")}`);
});

test("종 실루엣 — 귀 모양이 종마다 다르다(색만 바뀐 복붙 금지)", () => {
  const earRow = (form: string) => petSprites(form)[0].rows.slice(0, 2).join("|");
  const fox = earRow("fox");
  const cat = earRow("cat");
  const bear = earRow("bear");
  const owl = earRow("owl");
  const chick = earRow("hatchling");
  const uniq = new Set([fox, cat, bear, owl, chick]);
  assert.equal(uniq.size, 5, "여우/고양이/곰/부엉이/병아리의 귀가 서로 달라야 한다");
  // 늑대는 여우와 같은 삼각귀(계보상 의도된 공유) — 색으로 구분된다
  assert.notEqual(petSprites("wolf")[0].pal.B, petSprites("fox")[0].pal.B, "늑대≠여우 색");
});

test("펫 폼 → 스프라이트 — 전 진화형이 유효, 최종형은 왕관", () => {
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
    assert.deepEqual(validateSprite(sleepSprite(f), `sleep:${f}`), []);
  }
  // 최종형은 1행에 왕관(k) 이 있고 중간형엔 없다
  assert.ok(petSprites("royal_cat")[0].rows[1].includes("k"), "최종형에 왕관");
  assert.ok(!petSprites("cat")[0].rows[1].includes("k"), "중간형엔 왕관 없음");
});

test("애니 프레임 크기 일치(튐 방지)", () => {
  for (const [name, v] of Object.entries(ALL_SPRITES)) {
    if (!Array.isArray(v) || v.length < 2) continue;
    const [a] = v;
    for (const s of v) {
      assert.equal(s.w, a.w, `${name}: 폭 불일치`);
      assert.equal(s.h, a.h, `${name}: 높이 불일치`);
    }
  }
});
