// 섬 확장 회귀 lock. [사용자 요청 2026-08-11 "밭 말고 섬을 늘릴 수 있어야해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECOR_ROWS,
  DECOR_ROWS_MAX,
  ISLAND_EXPANSIONS,
  createIsland,
  decorRowsOf,
  expandIsland,
  islandExpandLockReason,
  placeDecor,
  type IslandState,
} from "./island.ts";

const T = Date.UTC(2026, 7, 11, 3, 0, 0);
const fresh = (): IslandState => createIsland("콩", null, T);

test("섬 확장 — 레벨·코인 게이트, 잠긴 이유가 보인다", () => {
  const s = fresh();
  assert.equal(decorRowsOf(s), DECOR_ROWS, "새 섬은 기본 4줄");
  assert.ok(islandExpandLockReason(s), "잠긴 이유가 보여야 한다(골드비료 사고 규약)");
  assert.equal(expandIsland(s, T), s, "게이트 미달이면 no-op");
  // 게이트 충족 → 확장
  s.level = 40;
  s.coins = 999_999;
  const c0 = s.coins;
  const e1 = expandIsland(s, T);
  assert.equal(decorRowsOf(e1), DECOR_ROWS + 1, "첫 확장 = 5줄");
  assert.equal(e1.coins, c0 - ISLAND_EXPANSIONS[0].cost, "비용 차감");
  const e2 = expandIsland(e1, T);
  assert.equal(decorRowsOf(e2), DECOR_ROWS_MAX, "둘째 확장 = 6줄(최대)");
  assert.equal(expandIsland(e2, T), e2, "최대 이후는 no-op");
  assert.match(islandExpandLockReason(e2) ?? "", /최대/);
});

test("섬 확장 — 확장한 줄에만 배치가 열린다 [회귀 lock]", () => {
  const s = fresh();
  s.level = 40;
  s.coins = 999_999;
  // 확장 전: y=4 는 벽
  assert.equal(placeDecor(s, "tulip", 0, DECOR_ROWS, T), s, "확장 전 새 줄 배치는 no-op");
  const e = expandIsland(s, T);
  const placed = placeDecor(e, "tulip", 0, DECOR_ROWS, T);
  assert.notEqual(placed, e, "확장 후 새 줄에 배치된다");
  assert.ok(placed.decor.some((d) => d.y === DECOR_ROWS));
  // 여전히 그 다음 줄은 벽
  assert.equal(placeDecor(placed, "rose", 0, DECOR_ROWS + 1, T), placed);
});

test("섬 확장 — 구버전 저장분(islandExp 없음)이 그대로 돈다 — 무마이그레이션", () => {
  const s = fresh();
  delete (s as { islandExp?: number }).islandExp;
  assert.equal(decorRowsOf(s), DECOR_ROWS);
  assert.ok(placeDecor(s, "tulip", 0, 0, T) !== s, "기존 배치는 그대로");
});

test("섬 확장 — 후반 코인 싱크로 의미가 있다", () => {
  const total = ISLAND_EXPANSIONS.reduce((a, e) => a + e.cost, 0);
  assert.ok(total >= 50_000, `확장 총액 ${total}💗 — 후반 싱크로는 너무 싸다`);
  // 게이트가 뒤로 갈수록 좁다(마지막 확장이 끝판 목표)
  for (let i = 1; i < ISLAND_EXPANSIONS.length; i++) {
    assert.ok(ISLAND_EXPANSIONS[i].cost > ISLAND_EXPANSIONS[i - 1].cost);
    assert.ok(ISLAND_EXPANSIONS[i].minLevel > ISLAND_EXPANSIONS[i - 1].minLevel);
  }
});
