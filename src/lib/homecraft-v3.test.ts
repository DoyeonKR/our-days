import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
test("home uses separated story, landscape and memory sections, not the legacy overlay", () => {
  const home = read("../components/HomeExperience.tsx");
  assert.match(home, /aria-label="함께한 시간"/);
  assert.match(home, /<HomeWorld \{\.\.\.props\} sceneOnly/);
  assert.match(home, /aria-label="최근 사진"/);
  assert.ok(home.indexOf('aria-label="함께한 시간"') < home.indexOf("<HomeWorld"));
  assert.ok(home.indexOf("<HomeWorld") < home.indexOf('aria-label="최근 사진"'));
  assert.match(home, /첫 사진을 남기러 사진첩 열기/);
});
test("home puts actionable shortcuts before daily records and keeps the real pet", () => {
  const page = read("../app/page.tsx");
  assert.match(page, /<HomeExperience/);
  assert.match(page, /<HomePet/);
  assert.ok(page.indexOf('aria-label="빠른 실행"') < page.indexOf("<TodayTogether"));
  assert.match(page, /<HomeCommandCards actions=\{actions\}/);
});
test("workshop expansion displays engine requirements and navigates to their actual destinations", () => {
  const board = read("../components/island/Workshop.tsx");
  const game = read("../components/IslandGame.tsx");
  assert.match(board, /craftExpansionProgress\(s\)/);
  assert.match(board, /조건을 채우면 자동 확장 · 하트 소모 없음/);
  assert.match(board, /needsOrders \? onGoOrders : onGoRecipes/);
  assert.match(game, /<CraftExpansionBoard/);
});
