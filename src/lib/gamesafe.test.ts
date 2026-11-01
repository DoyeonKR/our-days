import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("게임 창 닫기 버튼은 상태 표시줄 밑에 있다 — 아이폰 사파리에서 가려져 안 눌리던 것", () => {
  const css = read("../app/globals.css");
  assert.match(css, /--game-safe-top: max\(env\(safe-area-inset-top, 0px\), 59px\)/);
  assert.match(css, /\.aqua-head, \.merge-head \{ padding-top: calc\(var\(--game-safe-top\)/);
  assert.match(css, /\.island-command \{ padding-top: calc\(var\(--game-safe-top\)/);
  assert.match(css, /\.aqua-close, \.merge-close \{[^}]*min-height: 44px/);
  for (const f of ["FishingGame", "AquariumGame"]) assert.ok(read(`../components/${f}.tsx`).includes("aqua-head sticky"), f);
  const merge = read("../components/MergeGame.tsx");
  assert.ok(merge.includes("merge-head sticky top-0 z-[500]"), "판의 칸보다 위에 있어야 눌린다");
  const island = read("../components/IslandGame.tsx");
  assert.ok(island.includes('className="island-command px-4"') && island.includes("island-close grid h-11 w-11"), "섬 X 도 같은 규칙");
});
