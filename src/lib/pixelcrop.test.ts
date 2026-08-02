// 작물·가공품 픽셀 아트 lock.
// [2026-08-03] "그래픽이 있는 모든 곳 픽셀로" → 작물 8종×4단계 + 가공품 8종.
// 이 테스트가 막는 회귀: (1) 도트 오타(행 길이/미정의 색), (2) 성장 단계가 구분되지 않는 것,
// (3) 지면선이 단계마다 튀는 것, (4) 엔진의 작물/가공품 키가 아트에 빠지는 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSprite } from "./pixel.ts";
import { ALL_CROP_SPRITES, cropSprite, productSprite } from "./pixelcrop.ts";
import { CROPS, PRODUCTS } from "./island.ts";

test("모든 작물/가공품 스프라이트가 포맷 정합", () => {
  const errs: string[] = [];
  for (const [name, s] of Object.entries(ALL_CROP_SPRITES)) errs.push(...validateSprite(s, name));
  assert.deepEqual(errs, [], errs.join("\n"));
});

test("엔진의 작물·가공품 키가 전부 아트를 가진다(이모지 폴백 금지)", () => {
  // 엔진에 작물을 추가하고 아트를 잊으면 정원에 당근이 대신 뜬다 — 여기서 잡는다.
  const missing: string[] = [];
  for (const c of CROPS) {
    const ripe = cropSprite(c.key, 3);
    const fallback = cropSprite("carrot", 3);
    if (c.key !== "carrot" && ripe.rows.join("") === fallback.rows.join("")) missing.push(`crop:${c.key}`);
  }
  for (const p of PRODUCTS) {
    const s = productSprite(p.key);
    const fallback = productSprite("soup");
    if (p.key !== "soup" && s.rows.join("") === fallback.rows.join("") && s.pal.f === fallback.pal.f) {
      missing.push(`product:${p.key}`);
    }
  }
  assert.deepEqual(missing, [], `아트 없는 키:\n${missing.join("\n")}`);
});

test("성장 단계가 눈에 띄게 다르다(0<1<2<3 로 커진다)", () => {
  for (const c of CROPS) {
    const ink = [0, 1, 2, 3].map((st) => {
      const s = cropSprite(c.key, st);
      return s.rows.join("").split("").filter((ch) => ch !== ".").length;
    });
    for (let i = 1; i < 4; i++) {
      assert.ok(ink[i] > ink[i - 1], `${c.key}: ${i - 1}단계(${ink[i - 1]}) → ${i}단계(${ink[i]}) 가 안 커짐`);
    }
  }
});

test("지면선 고정 — 모든 단계의 맨 아랫줄이 같은 높이(성장 시 흙이 안 튄다)", () => {
  const lastInk = (rows: string[]) => {
    for (let y = rows.length - 1; y >= 0; y--) if (/[^.]/.test(rows[y])) return y;
    return -1;
  };
  for (const c of CROPS) {
    const ys = [0, 1, 2, 3].map((st) => lastInk(cropSprite(c.key, st).rows));
    assert.deepEqual(
      ys,
      [ys[0], ys[0], ys[0], ys[0]],
      `${c.key}: 단계별 바닥이 ${ys.join(",")} — 바닥 정렬이 깨졌다`,
    );
  }
});

test("1단계 봉오리가 작물색을 띤다(뭘 심었는지 구분 가능)", () => {
  // 0·1 단계는 형태가 공용이라, 색 힌트가 없으면 8종이 전부 똑같아 보인다.
  const buds = new Set(CROPS.map((c) => cropSprite(c.key, 1).pal.F));
  assert.ok(buds.size >= 6, `1단계 봉오리 색이 ${buds.size}종뿐 — 작물 구분이 안 된다`);
});
