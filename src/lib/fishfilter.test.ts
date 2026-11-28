import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILIES } from "./aquarium.ts";
import { matchDepthFilter, matchFishQuery, matchAquaTrait } from "./fishfilter.ts";

test("수심 필터는 표층(0) · 중층(1) · 바닥(2)을 정확히 거르고 전체는 모두 통과한다", () => {
  const top = FAMILIES.filter((f) => matchDepthFilter(f.key, 0));
  const mid = FAMILIES.filter((f) => matchDepthFilter(f.key, 1));
  const bot = FAMILIES.filter((f) => matchDepthFilter(f.key, 2));
  assert.ok(top.length > 0 && mid.length > 0 && bot.length > 0);
  assert.equal(top.length + mid.length + bot.length, FAMILIES.length);
  assert.equal(FAMILIES.filter((f) => matchDepthFilter(f.key, "all")).length, FAMILIES.length);
});

test("이름 검색은 계열명 · 최종 성체명 · 별명을 공백/대소문자 무시하고 찾는다", () => {
  assert.equal(matchFishQuery("kissing_gourami", "키싱"), true);
  assert.equal(matchFishQuery("kissing_gourami", "구라미"), true);
  assert.equal(matchFishQuery("emperor_penguin", "펭 귄"), true);
  assert.equal(matchFishQuery("goldfish", "별명이름", "우리별명이름"), true);
  assert.equal(matchFishQuery("kissing_gourami", "상어"), false);
});

test("수조/도감 특성 필터(민물 · 바다 · 해변·바위 · 사냥꾼 · 희귀↑)가 정확히 분류된다", () => {
  const fresh = FAMILIES.filter((f) => matchAquaTrait(f.key, "fresh"));
  const sea = FAMILIES.filter((f) => matchAquaTrait(f.key, "sea"));
  assert.ok(fresh.length > 30 && sea.length > 80, `fresh=${fresh.length}, sea=${sea.length}`);
  assert.equal(fresh.length + sea.length, FAMILIES.length);

  assert.equal(matchAquaTrait("kissing_gourami", "fresh"), true);
  assert.equal(matchAquaTrait("kissing_gourami", "sea"), false);
  assert.equal(matchAquaTrait("great_white", "sea"), true);
  assert.equal(matchAquaTrait("great_white", "fresh"), false);
  assert.equal(matchAquaTrait("emperor_penguin", "walk"), true);
  assert.equal(matchAquaTrait("spotted_seal", "walk"), true);
  assert.equal(matchAquaTrait("sea_otter", "walk"), false); // 해달은 수면 부유(float)
  assert.equal(matchAquaTrait("great_white", "predator"), true);
  assert.equal(matchAquaTrait("goldfish", "predator"), false);
  assert.equal(matchAquaTrait("kraken", "rare"), true);
});
