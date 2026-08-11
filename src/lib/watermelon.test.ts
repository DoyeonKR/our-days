// 무등산수박 회귀 lock. [사용자 요청 2026-08-04 "제일 만들기 어려운걸로"]
//
// '제일 어렵다'는 숫자 하나가 아니라 **다른 작물과의 관계**다. 값만 박아두면 나중에
// 다른 작물을 올렸을 때 조용히 1위가 바뀐다 → 관계를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cropSprite } from "./pixelcrop.ts";
import {
  CROPS,
  createIsland,
  cropOf,
  farmSkill,
  feedPetWith,
  plant,
  type IslandState,
} from "./island.ts";

const T0 = Date.UTC(2026, 6, 15, 3, 0, 0); // 2026-07-15 12:00 KST → 여름(제철)
const MELON = "watermelon" as const;

function rich(skillXp: number): IslandState {
  const s = createIsland("콩", null, T0);
  s.coins = 99999;
  s.farm.skillXp = skillXp;
  return s;
}

test("무등산수박이 존재하고 여름 작물이다", () => {
  const c = cropOf(MELON);
  assert.equal(c.name, "무등산수박");
  assert.equal(c.season, "summer"); // 수박은 여름
  assert.equal(c.emoji, "🍉");
});

test("★ 가장 오래 걸리고, 가장 비싸고, 가장 비싸게 팔린다 — 다른 작물 대비 1위", () => {
  const others = CROPS.filter((c) => c.key !== MELON);
  const m = cropOf(MELON);
  for (const o of others) {
    assert.ok(m.growDays > o.growDays, `성장기간이 ${o.name} 보다 길어야 한다`);
    assert.ok(m.seed > o.seed, `씨앗값이 ${o.name} 보다 비싸야 한다`);
    assert.ok(m.sell > o.sell, `판매가가 ${o.name} 보다 높아야 한다`);
  }
  // 압도적이어야 '제일 어려운'이 체감된다 — 2위와 최소 1.5배 차이
  const maxOther = Math.max(...others.map((o) => o.growDays));
  assert.ok(m.growDays >= maxOther * 1.5, `성장기간 ${m.growDays}일 vs 2위 ${maxOther}일`);
});

test("★ 스킬 게이트 = 전설 작물군만, 수박이 그중 최고다 [계약 확장 2026-08-11]", () => {
  // 천도복숭아·불로초가 전설군에 합류했다(사용자 요청). 계약이 넓어진다 —
  // 게이트는 전설의 표식이고, **무등산수박이 모든 축(게이트·성장·씨앗·판매가)의 정점**이다.
  assert.ok((cropOf(MELON).minSkill ?? 0) >= 10, "농사 스킬 10 이상 요구");
  for (const c of CROPS.filter((x) => x.key !== MELON)) {
    if (c.unique) {
      assert.ok((c.minSkill ?? 0) >= 12, `${c.name}: 전설인데 게이트가 낮다`);
      assert.ok((c.minSkill ?? 0) < (cropOf(MELON).minSkill ?? 0), `${c.name}: 수박보다 게이트가 높으면 정점이 갈린다`);
    } else {
      assert.ok(!c.minSkill, `${c.name} 에는 스킬 게이트가 없어야 한다(전설만 특별하다)`);
    }
  }
});

test("★ 스킬이 모자라면 코인이 넘쳐도 못 심는다", () => {
  const low = rich(0);
  assert.ok(farmSkill(low.farm.skillXp) < 10, "전제: 스킬이 낮다");
  const after = plant(low, 0, MELON, T0);
  assert.equal(after, low, "no-op 이어야 한다(상태 동일 참조)");
  assert.equal(after.farm.plots[0].crop, null, "심기지 않았다");
  assert.equal(after.coins, low.coins, "코인이 빠지면 안 된다");
});

/** 요구 스킬에 도달하는 최소 XP — 값(10/14…)을 박지 않는다. 난도를 올려도 이 테스트는 산다. */
function xpForRequiredSkill(): number {
  const need = cropOf(MELON).minSkill ?? 0;
  let xp = 0;
  for (let i = 0; i < 1_000_000 && farmSkill(xp) < need; i += 50) xp = i;
  assert.ok(farmSkill(xp) >= need, `농사 스킬 ${need} 에 도달 가능해야 한다(현재 ${farmSkill(xp)})`);
  return xp;
}

test("★ 스킬이 차면 심어진다 — 게이트가 영영 잠기면 안 된다", () => {
  const xp = xpForRequiredSkill();

  const s = rich(xp);
  const after = plant(s, 0, MELON, T0);
  assert.notEqual(after, s, "심기가 적용돼야 한다");
  assert.equal(after.farm.plots[0].crop, MELON);
  assert.equal(after.coins, s.coins - cropOf(MELON).seed, "씨앗값이 빠진다");
});

test("다른 작물은 스킬 0 에서도 그대로 심어진다 — 게이트가 새면 안 된다", () => {
  const s = rich(0);
  const after = plant(s, 0, "strawberry", T0);
  assert.equal(after.farm.plots[0].crop, "strawberry");
});

test("픽셀·일러스트 아트가 둘 다 있다", () => {
  // 아트가 없으면 밭에 물음표가 뜬다. (art.test / pixelcrop.test 가 CROPS 를 순회하므로
  // 여기서는 '수박이 그 목록에 실제로 들어가 있다'만 확인한다.)
  assert.ok(CROPS.some((c) => c.key === MELON), "CROPS 에 있어야 두 아트 테스트가 검사한다");
});

/* ══════════════════════════════════════════════════════════════════
 * 실물 고증 lock — 2026-08-04 사용자 요청 "사진 찾아서 비슷하고 엄청 큼직하게"
 *
 * 첫 판은 **줄무늬 수박**으로 그렸는데 정반대였다:
 *   "무늬가 없이 진초록의 껍질 색을 띠고 있어 '푸랭이'라고도 불린다.
 *    타원형 모양에 크기가 2, 3배 크고 무게도 10~30kg"  — 위키백과/국민일보
 * 줄무늬는 이 품종을 **틀리게** 그리는 것이라, 다시 생기지 않게 구조로 잠근다.
 * ══════════════════════════════════════════════════════════════════ */

/** 열매 톤의 밝기 순서. 낮을수록 밝다(빛은 좌상단). */
const TONE: Record<string, number> = { H: 0, f: 1, F: 2, d: 3, D: 4 };
const isFruit = (c: string) => c === "o" || c in TONE;

/** 스프라이트에서 열매가 그려진 행만 뽑는다(잎 e/g/k·흙 u 는 제외). */
function fruitRows(stage: 2 | 3): { y: number; row: string }[] {
  return cropSprite(MELON, stage)
    .rows.map((row, y) => ({ y, row }))
    .filter(({ row }) => [...row].some((c) => c in TONE));
}

test("★ 무늬가 없다 — 한 행의 톤은 왼→오른쪽으로 단조 증가한다", () => {
  // 줄무늬란 '밝은 면 한가운데 어두운 열이 끼어드는 것'이다. 단조 증가면 그게 불가능하다.
  // 값 하나를 박는 대신 이 성질을 잠가야, 나중에 어떤 모양으로 다시 그려도 무늬가 안 생긴다.
  for (const stage of [2, 3] as const) {
    for (const { y, row } of fruitRows(stage)) {
      const tones = [...row].filter((c) => c in TONE).map((c) => TONE[c]);
      for (let i = 1; i < tones.length; i++) {
        assert.ok(
          tones[i] >= tones[i - 1],
          `stage${stage} y=${y} 에서 톤이 밝아졌다가 어두워진다(=줄무늬) — "${row}"`,
        );
      }
    }
  }
});

test("★ 덩굴 중심(x=12)에 좌우 대칭이다", () => {
  // 행 폭이 짝수/홀수로 섞이면 중심이 반칸씩 흔들려 열매가 덩굴에서 비뚤어져 보인다.
  for (const stage of [2, 3] as const) {
    for (const { y, row } of fruitRows(stage)) {
      const xs = [...row].map((c, i) => (isFruit(c) ? i : -1)).filter((i) => i >= 0);
      const mid = (xs[0] + xs[xs.length - 1]) / 2;
      assert.equal(mid, 12, `stage${stage} y=${y} 중심이 ${mid} (덩굴은 x=11~12)`);
    }
  }
});

test("★ '엄청 큼직' — 다른 어떤 작물보다 압도적으로 크게 그려졌다", () => {
  const area = (key: string) =>
    cropSprite(key, 3)
      .rows.join("")
      .split("")
      .filter(isFruit).length;

  const mine = area(MELON);
  const others = CROPS.filter((c) => c.key !== MELON).map((c) => ({ n: c.name, a: area(c.key) }));
  const top = others.reduce((a, b) => (b.a > a.a ? b : a));
  assert.ok(
    mine >= top.a * 1.5,
    `수박 ${mine}칸 vs 2위 ${top.n} ${top.a}칸 — 실물이 2~3배 큰 품종이라 그림도 압도적이어야 한다`,
  );
});

test("★ 타원형이다 — 폭이 높이보다 확실히 넓다", () => {
  const rows = fruitRows(3);
  const w = Math.max(
    ...rows.map(({ row }) => {
      const xs = [...row].map((c, i) => (isFruit(c) ? i : -1)).filter((i) => i >= 0);
      return xs[xs.length - 1] - xs[0] + 1;
    }),
  );
  assert.ok(w >= 19, `가로 ${w}칸 — 24칸 밭을 꽉 채워야 '큼직'하다`);
  assert.ok(w > rows.length * 1.2, `가로 ${w} vs 세로 ${rows.length} — 구형이 아니라 타원이어야 한다`);
});

test("★ 일러스트에도 줄무늬 부품이 없다", () => {
  // 픽셀만 고치고 SVG 를 두면 같은 작물이 화면에 따라 다르게 생긴다.
  const art = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../components/island/art/crops.tsx"), "utf8");
  assert.ok(art.includes("MelonRind"), "수박 껍질 부품이 있어야 한다");
  assert.ok(!art.includes("MelonStripes"), "줄무늬 부품이 되살아났다 — 푸랭이는 무늬가 없다");
});

/* ══════════════════════════════════════════════════════════════════
 * 전설 재설계 lock — 2026-08-05 "전설급인데 효과가 미미함.
 *   더욱 비싸고 더욱 만들기 힘들게 … 그만큼의 효과를 히어로 경험치로"
 *
 * 판매가만 최고면 결국 '비싼 호박'이다(코인이라는 같은 축). 전설이 되려면
 * (a) 다른 축의 보상 = 히어로 경험치, (b) 돈으로 못 미는 희소성 이 있어야 한다.
 * ══════════════════════════════════════════════════════════════════ */

test("★ 먹이면 히어로 경험치가 대량으로 들어온다 — 판매만이 답이 아니게", () => {
  const xp = xpForRequiredSkill();
  const s = rich(xp);
  // 창고에 ★5 수박을 넣고 먹인다
  s.farm.barn[MELON] = { qty: 1, star: 5 };
  const before = s.pet.careXp;
  const after = feedPetWith(s, MELON, T0);
  assert.notEqual(after, s, "먹이기가 적용돼야 한다");
  const gain = after.pet.careXp - before;

  // 같은 조건에서 평범한 작물을 먹였을 때와 비교 — 값이 아니라 **비율**을 잠근다
  const s2 = rich(xp);
  s2.farm.barn.pumpkin = { qty: 1, star: 5 };
  const plain = feedPetWith(s2, "pumpkin", T0).pet.careXp - s2.pet.careXp;
  assert.ok(gain >= plain * 8, `전설 ★5 ${gain} vs 일반 ★5 ${plain} — 8배는 넘어야 '전설급 효과'다`);
});

test("★ 히어로 경험치가 ★등급에 비례한다 — 대충 키운 전설은 전설이 아니다", () => {
  const xp = xpForRequiredSkill();
  const gainAt = (star: number) => {
    const s = rich(xp);
    s.farm.barn[MELON] = { qty: 1, star };
    return feedPetWith(s, MELON, T0).pet.careXp - s.pet.careXp;
  };
  const g1 = gainAt(1);
  const g5 = gainAt(5);
  assert.ok(g5 > g1 * 3, `★1 ${g1} → ★5 ${g5} — 별을 올릴 이유가 있어야 한다`);
});

test("★ 한 번에 한 포기만 — 밭을 넓혀 물량으로 밀 수 없다", () => {
  const xp = xpForRequiredSkill();
  const s = rich(xp);
  const one = plant(s, 0, MELON, T0);
  assert.equal(one.farm.plots[0].crop, MELON, "전제: 한 포기는 심긴다");
  const two = plant(one, 1, MELON, T0);
  assert.equal(two, one, "두 번째 포기는 no-op 이어야 한다");
  assert.equal(two.farm.plots[1].crop, null, "두 번째 밭은 비어 있어야 한다");
  assert.equal(two.coins, one.coins, "코인이 빠지면 안 된다");
});

test("전설 제약이 다른 작물로 새지 않는다 — 호박은 여러 칸에 심어진다", () => {
  const s = rich(0);
  const a = plant(s, 0, "pumpkin", T0);
  const b = plant(a, 1, "pumpkin", T0);
  assert.equal(b.farm.plots[0].crop, "pumpkin");
  assert.equal(b.farm.plots[1].crop, "pumpkin");
});

test("★ 난도가 실제로 올라갔다 — 이전 판(스킬10·4일·150) 으로 되돌아가지 않는다", () => {
  const m = cropOf(MELON);
  assert.ok((m.minSkill ?? 0) >= 14, `스킬 요구 ${m.minSkill} — ★5 요건(12)보다 높아야 전설이다`);
  assert.ok(m.growDays >= 6, `성장 ${m.growDays}일`);
  assert.ok(m.seed >= 400, `씨앗 ${m.seed}💗`);
  assert.equal(m.unique, true, "희소 제약이 있어야 한다");
  assert.ok((m.legendXp ?? 0) > 0, "히어로 경험치 보상이 있어야 한다");
});
