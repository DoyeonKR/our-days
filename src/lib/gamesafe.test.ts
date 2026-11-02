import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { IOS_SAFE_FLOOR, headDeficit } from "./gamewindow.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");


test("창이 화면 위로 밀리면 그만큼 머리를 내린다 — 패딩만으로는 창과 함께 올라간다 [사용자: 닫기 버튼이 노치에 걸려 못 누른다]", () => {
  assert.equal(headDeficit(0, 0, 69, IOS_SAFE_FLOOR), 0, "정상 자리");
  assert.equal(headDeficit(-300, 0, 69, IOS_SAFE_FLOOR), 296, "카드를 300px 스크롤한 채 열어 창이 밀린 경우");
  assert.equal(headDeficit(0, 0, 10, IOS_SAFE_FLOOR), 55, "@supports 가 안 먹어 패딩이 없는 경우");
  assert.equal(headDeficit(24, 24, 69, IOS_SAFE_FLOOR), 0, "보이는 영역과 같이 내려앉은 건 밀린 게 아니다");
  assert.equal(headDeficit(0, 0, 10, 0), 0, "노치 없는 기기는 건드리지 않는다");
  assert.equal(headDeficit(-4, 0, 69, IOS_SAFE_FLOOR), 0, "여유 안에서는 흔들지 않는다");
});

test("게임을 열면 지킴이가 함께 뜬다 — 스크롤을 0 으로 · 닫으면 복원 · 모든 게임 창을 잰다", () => {
  const hub = read("../components/GameArcade.tsx");
  assert.ok(hub.includes("{open && <GameWindowGuard />}"));
  const g = read("../components/GameWindowGuard.tsx");
  assert.match(g, /useLayoutEffect/, "스크롤 잠금(MutationObserver)보다 먼저 0 으로");
  assert.ok(g.includes("window.scrollTo({ top: saved"));
  assert.ok(g.includes('removeProperty("--game-safe-top")'), "닫으면 원래 값으로");
  for (const c of [".aqua-shell", ".merge-shell", ".island-shell", ".aqua-head", ".merge-head", ".island-command"]) assert.ok(g.includes(c), c);
  assert.ok(read("../app/globals.css").includes(`max(env(safe-area-inset-top, 0px), ${IOS_SAFE_FLOOR}px)`), "바닥값이 CSS 와 같다");
});

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
