// 무등산수박 회귀 lock. [사용자 요청 2026-08-04 "제일 만들기 어려운걸로"]
//
// '제일 어렵다'는 숫자 하나가 아니라 **다른 작물과의 관계**다. 값만 박아두면 나중에
// 다른 작물을 올렸을 때 조용히 1위가 바뀐다 → 관계를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  createIsland,
  cropOf,
  farmSkill,
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

test("★ 스킬 게이트가 있는 유일한 작물이다", () => {
  assert.ok((cropOf(MELON).minSkill ?? 0) >= 10, "농사 스킬 10 이상 요구");
  for (const c of CROPS.filter((x) => x.key !== MELON)) {
    assert.ok(!c.minSkill, `${c.name} 에는 스킬 게이트가 없어야 한다(수박만 특별하다)`);
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

test("★ 스킬이 차면 심어진다 — 게이트가 영영 잠기면 안 된다", () => {
  // 스킬 10 에 도달할 만큼 XP 를 준 뒤 심어본다(도달 불가능한 게이트면 죽은 콘텐츠다).
  let xp = 0;
  for (let i = 0; i < 100000 && farmSkill(xp) < 10; i += 50) xp = i;
  assert.ok(farmSkill(xp) >= 10, `스킬 10 에 도달 가능해야 한다(현재 ${farmSkill(xp)})`);

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
