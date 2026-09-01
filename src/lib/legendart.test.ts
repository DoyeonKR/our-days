// 전설 작물·요리 아트 lock. [사용자 요청 2026-09-01 "이미지도 충분히 더 화려해야해"]
//
// 등급을 **빛**으로 보여준다(펫의 mythicAura 와 같은 문법). 색만으로 갈면 창고 격자처럼
// 작게 깔리는 자리에서 구분이 안 된다.
//
// ⚠ 전설 목록이 두 곳에 있다 — island.ts 의 legendXp/legendBond/legendHeal 과
//   pixelcrop.ts 의 LEGEND_ART_KEYS. 한쪽만 고치면 '스탯은 전설인데 그림은 평범한'
//   조용한 어긋남이 생긴다. 여기서 두 표를 대조한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CROPS, PRODUCTS, isLegendProduct } from "./island.ts";
import { LEGEND_ART_KEYS, cropSprite, productSprite } from "./pixelcrop.ts";

/** 스프라이트에 실제로 찍힌 반짝임 칸 수. */
const sparkles = (rows: readonly string[]): number =>
  rows.reduce((n, r) => n + [...r].filter((ch) => ch === "L").length, 0);

const legendCrops = CROPS.filter((c) => c.legendXp || c.legendBond || c.legendHeal);
const legendProducts = PRODUCTS.filter(isLegendProduct);

test("★★ 전설 목록이 엔진과 아트에서 일치한다 (한쪽만 고치는 사고 차단)", () => {
  const fromEngine = [...legendCrops.map((c) => c.key), ...legendProducts.map((p) => p.key)].sort();
  assert.deepEqual([...LEGEND_ART_KEYS].sort(), fromEngine);
});

test("★ 다 자란 전설 작물은 반짝인다", () => {
  for (const c of legendCrops) {
    assert.ok(sparkles(cropSprite(c.key, 3).rows) > 0, `${c.name} 이 안 반짝인다`);
  }
});

test("★ 새싹은 안 반짝인다 — 밭에서 '다 익었다'가 안 읽힌다", () => {
  for (const c of legendCrops) {
    for (const st of [0, 1, 2]) {
      assert.equal(sparkles(cropSprite(c.key, st).rows), 0, `${c.name} 성장 ${st} 이 반짝인다`);
    }
  }
});

test("★ 평범한 작물은 반짝이지 않는다 — 반짝임이 등급 신호로 남아야 한다", () => {
  for (const c of CROPS.filter((x) => !LEGEND_ART_KEYS.has(x.key))) {
    for (const st of [0, 1, 2, 3]) {
      assert.equal(sparkles(cropSprite(c.key, st).rows), 0, `${c.name} 성장 ${st} 이 반짝인다`);
    }
  }
});

test("★ 전설 요리는 반짝이고 평범한 요리는 안 반짝인다", () => {
  for (const p of legendProducts) {
    assert.ok(sparkles(productSprite(p.key).rows) > 0, `${p.name} 이 안 반짝인다`);
  }
  for (const p of PRODUCTS.filter((x) => !isLegendProduct(x))) {
    assert.equal(sparkles(productSprite(p.key).rows), 0, `${p.name} 이 반짝인다`);
  }
});

test("★★ 반짝임이 주제를 덮지 않는다 — 얹기 전후로 그려진 칸이 그대로다", () => {
  // 과일·그릇 위에 흰 점을 얹으면 화려한 게 아니라 때가 탄 것처럼 보인다.
  // 원본(평범 작물)과 비교할 수 없으니, 반짝임 칸을 뺀 나머지가 잉크로 꽉 찬 영역인지 본다:
  // 's' 는 반드시 **투명하던 자리**에만 있어야 하므로, 's' 를 '.' 로 되돌린 그림이
  // 반짝임 없는 같은 실루엣이어야 한다(= 's' 가 다른 문자를 지운 적이 없다).
  for (const key of LEGEND_ART_KEYS) {
    const sp = CROPS.some((c) => c.key === key) ? cropSprite(key, 3) : productSprite(key);
    const stripped = sp.rows.map((r) => r.replaceAll("L", "."));
    const inkAfter = stripped.join("").replace(/\./g, "").length;
    assert.ok(inkAfter > 40, `${key}: 반짝임을 빼니 그림이 ${inkAfter}칸뿐 — 주제를 덮었다`);
  }
});

test("★ 반짝임이 24×24 격자를 안 넘는다", () => {
  for (const key of LEGEND_ART_KEYS) {
    const sp = CROPS.some((c) => c.key === key) ? cropSprite(key, 3) : productSprite(key);
    assert.equal(sp.h, 24);
    for (const row of sp.rows) assert.equal(row.length, sp.w, `${key}: 행 길이가 ${sp.w} 가 아니다`);
  }
});

test("★ 전설 요리 3종이 서로 다른 그림이다 — 색만 다른 같은 그릇이면 구분이 안 된다", () => {
  const seen = new Map<string, string>();
  for (const p of legendProducts) {
    const sig = productSprite(p.key).rows.join("|") + JSON.stringify(productSprite(p.key).pal);
    for (const [k, v] of seen) assert.notEqual(sig, v, `${p.name} 이 ${k} 와 완전히 같다`);
    seen.set(p.name, sig);
  }
  assert.ok(legendProducts.length >= 3, "전설 요리가 3종 미만");
});
