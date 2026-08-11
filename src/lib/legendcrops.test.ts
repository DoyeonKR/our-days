// 전설 작물 확장 회귀 lock. [사용자 요청 2026-08-11 "전설속 식물이나 과일찾아서 전설 등급 더"]
//
// 잠그는 것 셋:
//  1. 전설끼리 **보상 축이 겹치지 않는다** — 수박=히어로XP · 복숭아=유대 · 불로초=치유.
//     같은 축이면 최고 하나만 남는다(장비 퍽 축 규칙과 같은 이유).
//  2. 먹였을 때 실제로 그 축이 움직인다(값이 아니라 방향을 잠근다).
//  3. 새 전설이 **무등산호랑이 게이트(legendFed)를 오염시키지 않는다** — legendFed 는
//     '무등산수박을 먹인 흔적'이다. 복숭아를 먹고 무등산호랑이가 되면 전설이 값싸진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CROPS, createIsland, feedPetWith, type IslandState } from "./island.ts";

const T = Date.UTC(2026, 7, 11, 3, 0, 0);
function withBarn(crop: string): IslandState {
  const s = createIsland("콩", null, T);
  s.farm.barn[crop] = { qty: 1, star: 3 };
  return s;
}

test("전설 작물군 — 셋 다 unique + 스킬 게이트, 보상 축은 서로 다르다", () => {
  const legends = CROPS.filter((c) => c.unique);
  assert.equal(legends.length, 3, `전설은 수박·복숭아·불로초 셋 (${legends.map((c) => c.name)})`);
  for (const c of legends) {
    assert.ok((c.minSkill ?? 0) >= 12, `${c.name}: 게이트 없는 전설은 전설이 아니다`);
    const axes = [c.legendXp && "xp", c.legendBond && "bond", c.legendHeal && "heal"].filter(Boolean);
    assert.equal(axes.length, 1, `${c.name}: 보상 축이 정확히 1개여야 한다 (${axes})`);
  }
  const all = legends.map((c) => (c.legendXp ? "xp" : c.legendBond ? "bond" : "heal"));
  assert.equal(new Set(all).size, 3, `전설끼리 축이 겹친다: ${all}`);
});

test("천도복숭아 — 먹이면 유대가 오르고, 무등산 흔적(legendFed)은 안 남는다", () => {
  const s = withBarn("heavenpeach");
  const bond0 = s.bond.xp + s.bond.level * 100000;
  const after = feedPetWith(s, "heavenpeach", T);
  assert.ok(after.bond.xp + after.bond.level * 100000 > bond0, "유대가 올라야 하늘 복숭아다");
  assert.equal(after.pet.legendFed ?? 0, 0, "복숭아로 무등산호랑이 조건을 채우면 전설이 값싸진다");
});

test("불로초 — 먹이면 완치 + 정성(CQ) 보정, 무등산 흔적은 안 남는다", () => {
  const s = withBarn("yeongji");
  s.pet.sick = true;
  s.pet.stats.health = 30;
  s.pet.cq = 50;
  const after = feedPetWith(s, "yeongji", T);
  assert.equal(after.pet.sick, false, "영약이 병을 못 고치면 영약이 아니다");
  assert.ok(after.pet.stats.health > 30, "건강 회복");
  assert.ok(after.pet.cq > 50, "정성(CQ) 보정 — 신화 진화를 앞둔 영약의 존재 이유");
  assert.equal(after.pet.legendFed ?? 0, 0);
});

test("무등산수박 — 먹인 흔적이 남는다(신화 분기 재료) [회귀 lock]", () => {
  const s = withBarn("watermelon");
  const after = feedPetWith(s, "watermelon", T);
  assert.equal(after.pet.legendFed, 1, "수박 흔적이 안 남으면 무등산호랑이로 가는 길이 없다");
});
