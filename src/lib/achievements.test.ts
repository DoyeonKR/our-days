// 업적 보드 lock. [2026-09-24 전 영역 UI 개편 — 모아보기의 '???' 53칸 벽]
// 잠그는 것: 모든 업적에 분류가 있는가 · 진화 말고는 '어떻게 하면 되는지'가 있는가 · 진행 숫자가 실제 상태를 읽는가 ·
// 다음 목표가 가까운 순인가 · 진화 비밀이 새지 않는가 · 화면이 보드를 쓰는가.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  DECORS,
  DECOR_COMBOS,
  achievementGroupOf,
  achievementViews,
  createIsland,
  nextAchievements,
  type IslandState,
} from "./island.ts";
import { MEDAL_ICONS, medalIcon } from "./pixelui.ts";

const T = Date.UTC(2026, 8, 24, 3, 0, 0);
const fresh = (): IslandState => createIsland("보리", "2026-01-01", T);

test("모든 업적에 분류가 있고, 분류마다 메달 그림이 있다", () => {
  const groups = new Set(ACHIEVEMENT_GROUPS.map((g) => g.key));
  for (const a of ACHIEVEMENTS) assert.ok(groups.has(achievementGroupOf(a.key)), `${a.key} 분류 없음`);
  for (const g of groups) {
    assert.ok(MEDAL_ICONS[g], `${g} 메달 그림이 없다`);
    const on = medalIcon(g, true)!, off = medalIcon(g, false)!;
    assert.deepEqual(on.rows, off.rows, `${g}: 잠긴 메달은 같은 그림이어야 '아직'으로 읽힌다`);
    assert.notDeepEqual(on.pal, off.pal, `${g}: 잠긴 메달이 딴 메달과 색이 같다`);
  }
});

test("진화 말고는 전부 '어떻게 하면 되는지' 한 줄이 있다 — '???' 로 목표를 숨기지 않는다", () => {
  for (const v of achievementViews(fresh(), T)) {
    if (v.group === "pet") assert.equal(v.hint, null, `${v.key}: 진화 조건은 비밀이다`);
    else assert.ok(v.hint && v.hint.length > 4, `${v.key} 에 방법이 없다`);
  }
});

test("진행 숫자는 실제 상태를 읽는다 — 손님·주문·세트·조합·함께한 날", () => {
  const s = fresh();
  s.guestCount = 6;
  s.orderCount = 12;
  const setKey = DECORS.find((d) => d.set)!.set!;
  const pieces = DECORS.filter((d) => d.set === setKey);
  s.decor = pieces.slice(0, 2).map((d, i) => ({ id: `t${i}`, key: d.key, x: i, y: 0 })) as IslandState["decor"];
  s.catalog = [...s.catalog, `combo_${DECOR_COMBOS[0].id}`];
  const v = Object.fromEntries(achievementViews(s, T).map((x) => [x.key, x]));
  assert.deepEqual(v.guest_10.prog, [6, 10]);
  assert.deepEqual(v.order_10.prog, [10, 10], "목표를 넘으면 목표에서 멈춘다");
  assert.deepEqual(v.order_50.prog, [12, 50]);
  assert.deepEqual(v[`set_${setKey}`].prog, [2, pieces.length]);
  assert.deepEqual(v.combo_first.prog, [1, 1]);
  assert.equal(v.dday_year.prog![1], 365);
  assert.ok(v.dday_year.prog![0] >= 260 && v.dday_year.prog![0] <= 270, `함께한 날 ${v.dday_year.prog![0]}`);
  for (const x of Object.values(v)) if (x.prog) assert.ok(x.prog[0] >= 0 && x.prog[0] <= x.prog[1], `${x.key} 진행 범위`);
});

test("다음 목표 — 못 딴 것 중 가까운 순, 진화·딴 것은 빼고 셋까지", () => {
  const s = fresh();
  s.guestCount = 9; // 9/10 — 가장 가깝다
  s.orderCount = 5; // 5/10
  s.achievements = [...s.achievements, "combo_first"];
  const next = nextAchievements(achievementViews(s, T), 3);
  assert.equal(next.length, 3);
  assert.equal(next[0].key, "guest_10", "가장 가까운 목표가 맨 위가 아니다");
  assert.ok(next.every((x) => !x.done && x.group !== "pet"));
  for (let i = 1; i < next.length; i++) {
    const r = (x: typeof next[number]) => (x.prog ? x.prog[0] / x.prog[1] : 0);
    assert.ok(r(next[i - 1]) >= r(next[i]), "가까운 순이 아니다");
  }
});

test("진화 비밀 — 못 본 폼은 이름을 가리고, 도감에 있거나 딴 폼은 보인다", () => {
  const s = fresh();
  const pets = achievementViews(s, T).filter((v) => v.group === "pet");
  assert.ok(pets.length >= 20 && pets.every((v) => v.secret), "처음부터 진화 이름이 보인다");
  const first = pets[0].key.slice(4);
  s.catalog = [...s.catalog, first];
  const seen = achievementViews(s, T).find((v) => v.key === `pet_${first}`)!;
  assert.equal(seen.secret, false, "도감에서 본 폼인데 가려져 있다");
});

test("화면 — 모아보기가 보드를 쓰고, '???' 칩 벽이 돌아오지 않는다", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "components", "IslandGame.tsx"), "utf8");
  assert.match(src, /<AchievementBoard s=\{s\} now=\{now\} \/>/);
  assert.ok(!/got \? a\.name : "\?\?\?"/.test(src), "업적 '???' 칩 벽이 돌아왔다");
  const board = readFileSync(join(import.meta.dirname, "..", "components", "island", "AchievementBoard.tsx"), "utf8");
  assert.match(board, /size = 48/, "메달은 24칸 도트를 정확히 2배로");
});
