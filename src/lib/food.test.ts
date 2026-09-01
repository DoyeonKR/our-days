// 작물·요리 경제 lock.
// [사용자 리포트 2026-09-01]
//   "지금 농작물의 차이가 없어. 전설급 농작물이면 훨씬 좋은 값어치를 해야하고
//    음식도 만들면 더욱 엄청난 능력치를 갖고"
//
// 셋 다 실제 버그였고 숫자로 확인된다.
//
//  1) 작물 종류가 careXp 식에 **아예 안 들어갔다**. `xp + xpBonus + xpPerStar×★` 라
//     씨앗 10짜리 딸기와 씨앗 30·2.5일짜리 호박이 ★만 같으면 완전히 같은 밥이었다.
//  2) **요리하면 손해였다.** 와인(포도 4 + 3일) 간식 = 20+12×5 = 80 careXp 인데,
//     그 포도 4개를 그냥 먹이면 42×4 = 168 이다. 만들수록 88 을 잃고 3일을 더 썼다
//     → 공방이 코인 전용 창구가 됐다.
//  3) 전설이 일상보다 느렸다. 무등산수박 ★5 = 672 careXp 인데 6일 + unique(한 칸)이라
//     하루 112 다. 그냥 매일 케어만 해도 대략 170/day 이 나온다.
//
// 여기서 잠그는 건 값이 아니라 **관계**다 — 값은 튜닝하다 바뀌지만 관계가 깨지면 버그다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  PRODUCTS,
  TUNING,
  craftPayout,
  createIsland,
  cropNutrition,
  cropOf,
  isLegendProduct,
  productOf,
  rawFeedXp,
  recipeRawXp,
  type IslandState,
} from "./island.ts";

const T = Date.UTC(2026, 8, 1, 3, 0, 0);
const fresh = (): IslandState => createIsland("콩", null, T);

const normalCrops = CROPS.filter((c) => !c.legendXp && !c.legendBond && !c.legendHeal);
const legendCrops = CROPS.filter((c) => c.legendXp || c.legendBond || c.legendHeal);

// ── 1. 작물마다 다른 밥 ─────────────────────────────────────────

test("★★ 작물 종류가 careXp 를 바꾼다 — 예전엔 전부 같았다", () => {
  const straw = rawFeedXp(cropOf("strawberry"), 5);
  const pumpkin = rawFeedXp(cropOf("pumpkin"), 5);
  assert.notEqual(straw, pumpkin, "딸기와 호박이 같은 밥이다 — 작물 키가 식에서 빠졌다");
  assert.ok(pumpkin > straw * 2, `호박(${pumpkin}) 이 딸기(${straw}) 의 2배도 안 된다`);
});

test("★ 비싼 작물이 항상 더 좋은 밥이다 (판매가 순 = 영양 순)", () => {
  const sorted = [...normalCrops].sort((a, b) => a.sell - b.sell);
  for (let i = 1; i < sorted.length; i++) {
    const lo = rawFeedXp(sorted[i - 1], 5), hi = rawFeedXp(sorted[i], 5);
    assert.ok(hi >= lo, `${sorted[i].name}(${hi}) 가 더 싼 ${sorted[i - 1].name}(${lo}) 보다 나쁘다`);
  }
});

test("★ 영양에 상·하한이 있다 — 전설이 코인 축까지 먹으면 다른 전설이 죽는다", () => {
  const f = TUNING.pet.cropFeed;
  for (const c of CROPS) {
    const n = cropNutrition(c);
    assert.ok(n >= f.nutritionMin && n <= f.nutritionMax, `${c.name} 영양 ${n} 이 범위 밖`);
  }
  // 전설은 판매가가 최고지만 영양은 상한에서 잘린다(자기 축으로 갚는다)
  for (const c of legendCrops) {
    assert.equal(cropNutrition(c), f.nutritionMax, `${c.name} 이 상한에서 안 잘렸다`);
  }
});

test("★ ★가 오르면 밥도 좋아진다 (단조 증가)", () => {
  for (const c of CROPS) {
    for (let s = 2; s <= 5; s++) {
      assert.ok(rawFeedXp(c, s) > rawFeedXp(c, s - 1), `${c.name} ★${s} 가 ★${s - 1} 보다 나쁘다`);
    }
  }
});

// ── 2. 요리는 재료보다 강하다 ───────────────────────────────────

test("★★★ 모든 요리가 재료를 그냥 먹이는 것보다 강하다 — 이게 공방의 존재 이유다", () => {
  // 이 파일에서 제일 중요한 테스트다. 깨지면 '만들수록 손해'가 되고
  // 공방이 코인 전용 창구로 되돌아간다(실제로 그랬다).
  for (const p of PRODUCTS) {
    for (const star of [1, 3, 5]) {
      const cooked = craftPayout({ product: p.key, startAt: 0, star }).careXp;
      const raw = recipeRawXp(p, star);
      assert.ok(
        cooked > raw,
        `${p.name} ★${star}: 요리 ${cooked} ≤ 재료 그냥 먹이기 ${raw} — 만들수록 손해다`,
      );
    }
  }
});

test("★ 비싼 재료로 만든 요리가 더 세다 — 예전엔 제품과 무관한 상수였다", () => {
  const soup = craftPayout({ product: "soup", startAt: 0, star: 5 }).careXp;
  const wine = craftPayout({ product: "wine", startAt: 0, star: 5 }).careXp;
  assert.ok(wine > soup * 2, `와인(${wine}) 이 야채수프(${soup}) 의 2배도 안 된다`);
});

test("★ 선물도 제품을 탄다 — 수프 선물과 와인 선물이 같으면 안 된다", () => {
  const soup = craftPayout({ product: "soup", startAt: 0, star: 5 }).bondXp;
  const wine = craftPayout({ product: "wine", startAt: 0, star: 5 }).bondXp;
  assert.ok(wine > soup, `선물 유대가 제품과 무관하다 (수프 ${soup} / 와인 ${wine})`);
});

// ── 3. 전설의 값어치 ────────────────────────────────────────────

test("★★ 전설 작물이 '그냥 매일 케어'보다 빠르다", () => {
  // 하루 케어로 얻는 careXp 의 보수적 추정치. 전설이 이보다 느리면 기를 이유가 없다
  // (2026-09-01 이전이 정확히 그 상태였다: 수박 ★5 가 하루 112).
  const DAILY_CARE = 170;
  const melon = cropOf("watermelon");
  const perFeed = rawFeedXp(melon, 5) + Math.round(melon.legendXp! * TUNING.farm.starMult[5]);
  const perDay = perFeed / melon.growDays;
  assert.ok(perDay > DAILY_CARE, `무등산수박 하루 환산 ${Math.round(perDay)} ≤ 일상 케어 ${DAILY_CARE}`);
});

test("★ 전설끼리 축이 겹치지 않는다 — 같은 축이면 최고 하나만 남는다", () => {
  const axes = legendCrops.map((c) => (c.legendXp ? "xp" : c.legendBond ? "bond" : "heal"));
  assert.equal(new Set(axes).size, axes.length, `전설 축이 겹친다: ${axes.join(",")}`);
  assert.ok(legendCrops.length >= 3, "전설 작물이 3종 미만");
});

test("★ 전설 작물은 여전히 물량으로 못 민다 (unique · 스킬 게이트)", () => {
  for (const c of legendCrops) {
    assert.equal(c.unique, true, `${c.name} 이 unique 가 아니다 — 밭을 늘려 물량으로 밀 수 있다`);
    assert.ok((c.minSkill ?? 0) >= 12, `${c.name} 스킬 게이트가 ★5 요건(12)보다 낮다`);
  }
});

// ── 4. 전설 요리 ────────────────────────────────────────────────

test("★★ 전설 요리가 재료(전설 작물)를 그냥 먹이는 것보다 강하다", () => {
  // 전설 작물의 두 번째 쓸모. 요리가 원물보다 약하면 만들 이유가 없다.
  for (const p of PRODUCTS.filter(isLegendProduct)) {
    const [ck, n] = Object.entries(p.recipe)[0] as [string, number];
    const c = cropOf(ck as never);
    const rawWhole = n * (rawFeedXp(c, 5) + Math.round((c.legendXp ?? 0) * TUNING.farm.starMult[5]));
    const pay = craftPayout({ product: p.key, startAt: 0, star: 5 });
    const cooked = pay.careXp + pay.bondXp;
    assert.ok(cooked > rawWhole, `${p.name}: 요리 ${cooked} ≤ 원물 ${rawWhole}`);
  }
});

test("★ 전설 요리가 재료의 **축**을 물려받는다 (표를 둘로 나누지 않았다)", () => {
  const melon = craftPayout({ product: "melonpunch", startAt: 0, star: 5 });
  const peach = craftPayout({ product: "peachwine", startAt: 0, star: 5 });
  const elix = craftPayout({ product: "elixir", startAt: 0, star: 5 });
  assert.ok(melon.careXp > peach.careXp, "수박화채는 히어로XP 축이어야 한다");
  assert.ok(peach.bondXp > melon.bondXp, "천도주는 유대 축이어야 한다");
  assert.equal(elix.heal, true, "불로장생탕은 치유 축이어야 한다");
  assert.equal(melon.heal, false, "수박화채가 치유까지 가지면 축이 겹친다");
});

test("★ 전설 요리 재료는 전설 작물 1개다 — 2개면 unique 때문에 두 배로 기다린다", () => {
  for (const p of PRODUCTS.filter(isLegendProduct)) {
    const counts = Object.values(p.recipe) as number[];
    assert.equal(counts.length, 1, `${p.name} 레시피가 여러 종이다`);
    assert.equal(counts[0], 1, `${p.name} 이 전설 작물 ${counts[0]}개를 요구한다`);
  }
});

// ── 5. 실제 상태에 적용되는가 ───────────────────────────────────

test("★ 불로장생탕 간식 — 완전 회복 + 정성 보정이 실제 상태에 들어간다", async () => {
  const { collectCraft } = await import("./island.ts");
  const s = fresh();
  s.pet.stats = { hunger: 10, happy: 10, energy: 10, clean: 10, health: 10 };
  s.pet.sick = true;
  s.pet.cq = 50;
  s.farm.craft[0] = { product: "elixir", startAt: T - 10 * 86_400_000, star: 5 };
  const a = collectCraft(s, 0, T, "treat");
  assert.equal(a.pet.sick, false, "병이 안 나았다");
  assert.equal(a.pet.stats.health, 100, "완전 회복이 아니다");
  assert.ok(a.pet.cq > 50, "정성 보정이 없다");
  assert.ok(a.pet.careXp > 0, "성장이 없다");
});

test("★ 수박화채를 먹여도 무등산의 흔적이 남는다 (신화 분기 재료)", async () => {
  const { collectCraft } = await import("./island.ts");
  const s = fresh();
  s.farm.craft[0] = { product: "melonpunch", startAt: T - 10 * 86_400_000, star: 5 };
  const a = collectCraft(s, 0, T, "treat");
  assert.equal(a.pet.legendFed ?? 0, 1, "요리로 먹이면 흔적이 안 남는다 — 원물과 계보가 갈린다");
});

test("★ 모든 제품이 만들 수 있는 레시피를 갖는다 (오타·유령 작물 차단)", () => {
  for (const p of PRODUCTS) {
    assert.ok(Object.keys(p.recipe).length > 0, `${p.name} 레시피가 비었다`);
    for (const ck of Object.keys(p.recipe)) {
      assert.ok(CROPS.some((c) => c.key === ck), `${p.name} 이 없는 작물 '${ck}' 을 쓴다`);
    }
    assert.equal(productOf(p.key).key, p.key, `${p.name} 조회 실패`);
  }
});
