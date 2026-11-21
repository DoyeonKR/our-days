// 낚시 리뷰 2 · 3 · 4 — 2026-11-20 [사용자: 리뷰 중 "게임 밸런스 · 사용성 · 코드 구조" → "이렇게만 진행해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BAITS, METHODS, fishingOf } from "./fishing.ts";
import { fishTodayItems, fishTodayLabel } from "./fishtoday.ts";
import type { IslandState } from "./island.ts";

const read = (p: string) => readFileSync(p, "utf8");

test("the three loss-making baits are marked for the collection, and both bait lists show it", () => {
  assert.deepEqual(BAITS.filter((b) => b.collect).map((b) => b.key), ["bait_glow", "bait_pearl", "bait_star"]);
  assert.ok(read("src/components/fishing/PrepSheet.tsx").includes("b.collect &&"), "준비 시트(2026-11-21 PrepSheet 로 옮김)");
  assert.ok(read("src/components/FishingPanels.tsx").includes("BAIT_COLLECT_NOTE"));
});

test("every method has a one-line control tip, shown under the ready hint", () => {
  for (const m of METHODS) assert.ok(m.tip && m.tip.length <= 30, m.key);
  assert.match(read("src/components/FishingGame.tsx"), /phase === "ready" && !blocked && !activeBoss && <small className="fish-hint-tip">\{how\.name\} · \{how\.tip\}/);
});

test("today's to-do lists open requests and bosses in priority order, and the chip opens the goals tab", () => {
  const st = { seed: 42, fishing: { level: 40, bosses: { dolsoe: { hp: 0.6, at: "2026-11-19", tries: {}, caught: 0, until: "" } } } } as unknown as IslandState;
  const fs = fishingOf(st);
  const items = fishTodayItems(st, fs, "2026-11-20", "me");
  const keys = items.map((x) => x.key);
  assert.ok(keys.includes("request"), "새 날엔 의뢰 셋이 남는다");
  assert.ok(keys.includes("boss"), "싸우던 주인은 오늘 도전할 수 있다");
  assert.ok(keys.indexOf("request") < keys.indexOf("boss"));
  assert.ok(!fishTodayItems({ seed: 42, fishing: { level: 40 } } as unknown as IslandState, fishingOf({ fishing: { level: 40 } } as unknown as IslandState), "2026-11-20", "me").some((x) => x.key === "boss"), "안 싸워 본 주인은 할 일이 아니다");
  assert.match(fishTodayLabel(items) ?? "", /외 \d/);
  assert.equal(fishTodayLabel([]), null);
  assert.match(read("src/components/FishingGame.tsx"), /fish-chip is-today[^\n]*onClick=\{\(\) => setTab\("stat"\)\}/);
});

test("per-method round ticks live in fishing/roundTick, one function per method, and the screen only dispatches", () => {
  const tick = read("src/components/fishing/roundTick.ts");
  for (const fn of ["tickCharge", "tickLureBeat", "tickLantern", "tickHerd", "tickLureFight", "tickDeep", "tickFight"]) assert.match(tick, new RegExp(`export function ${fn}\\(`), fn);
  const game = read("src/components/FishingGame.tsx");
  assert.match(game, /tickRound\(tick, phase, dt, elapsed, now\);/);
  for (const step of ["stepDeep(", "stepHerd(", "stepLight(", "stepSway(", "stepFight("]) assert.ok(!game.includes(step), `${step} 은 화면에 남지 않는다`);
});
