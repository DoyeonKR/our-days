import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { shellShift } from "./gamewindow.ts";
import { appCss } from "./cssfiles.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");


test("창이 밀렸을 때만 고친다 — 순간값은 믿지 않는다 [사용자 캡처: 머리 칸이 판을 덮고 닫기 버튼이 화면 아래로 내려갔다]", () => {
  assert.equal(shellShift(null, -650), 0, "처음 한 번 읽은 값은 믿지 않는다");
  assert.equal(shellShift(0, -650), 0, "갑자기 튄 값도");
  assert.equal(shellShift(-120, -120), 120, "두 번 연속 같으면 그만큼 내린다");
  assert.equal(shellShift(-1, -1), 0, "오차는 건드리지 않는다");
  assert.equal(shellShift(30, 30), -30, "아래로 밀린 것도 되돌린다");
});

test("지킴이는 패딩을 올리지 않는다 — 올리기만 하는 패딩이 판을 덮었다 · 열 때 스크롤 0 · 닫으면 복원", () => {
  const hub = read("../components/GameArcade.tsx");
  assert.ok(hub.includes("{open && <GameWindowGuard />}"));
  const g = read("../components/GameWindowGuard.tsx");
  assert.doesNotMatch(g, /setProperty|--game-safe-top/);
  assert.match(g, /useLayoutEffect/, "스크롤 잠금(MutationObserver)보다 먼저 0 으로");
  assert.ok(g.includes("pageScrollTo(saved)"));
  for (const c of [".aqua-shell", ".merge-shell", ".island-shell"]) assert.ok(g.includes(c), c);
});

test("게임 창 닫기 버튼은 상태 표시줄 밑에 있다 — 아이폰 사파리에서 가려져 안 눌리던 것", () => {
  const css = appCss();
  assert.match(css, /--game-safe-top: max\(env\(safe-area-inset-top, 0px\), 59px\)/);
  assert.match(css, /\.aqua-head, \.merge-head \{ padding-top: calc\(var\(--game-safe-top\)/);
  assert.match(css, /\.island-command \{ padding-top: calc\(var\(--game-safe-top\)/);
  assert.match(css, /\.app-close \{[^}]*min-height: 44px/);
  assert.ok(read("../components/GameHead.tsx").includes("sticky top-0"));
  for (const f of ["FishingGame", "AquariumGame", "MergeGame"]) assert.ok(read(`../components/${f}.tsx`).includes("<GameHead"), f);
  const merge = read("../components/MergeGame.tsx");
  assert.ok(merge.includes('className="merge-head"'), "머리글 틀을 쓴다");
  const island = read("../components/IslandGame.tsx");
  assert.ok(island.includes('className="island-command px-4"') && island.includes("<CloseButton onClose={onClose} />"), "섬도 같은 닫기");
});

test("게임 머리글의 위 여백을 덮어쓰는 규칙도 노치 여백을 더한다 [사용자 캡처 2026-11-12: 낚시 · 수조 닫기가 시계 · 노치에 붙었다]", () => {
  const css = appCss().replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/([^{}]*\.game-head[^{}]*)\{([^}]*)\}/g)) {
    const pt = /padding-top:\s*([^;]+)/.exec(m[2]);
    if (pt) assert.match(pt[1], /--game-safe-top/, `${m[1].trim()} 의 padding-top 이 노치 여백을 잃는다`);
  }
  assert.match(css, /html:has\(\.aqua-shell\)/, "사파리 아래 도구 막대 자리에 흰 바탕이 비치지 않게");
});

test("게임 창 아래 — 삼성 아래 주소창(--vv-bottom) · 제스처 줄과 띄운다 [사용자: 낚시 아래 버튼이 하단 네비바와 붙어 누르기 힘들다]", () => {
  const css = appCss().replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /--game-safe-bottom:\s*calc\(var\(--vv-bottom, 0px\) \+ max\(env\(safe-area-inset-bottom, 0px\), 18px\)\)/);
  assert.match(css, /\.fish-shell > div \{ padding-bottom: calc\(var\(--game-safe-bottom/);
  assert.match(css, /--fish-chrome: calc\([^;]*var\(--game-safe-bottom/, "장면 높이가 아래 여백을 빼고 잡혀 낚시 준비 줄이 첫 화면에 남는다");
  // 낚시 · 수조 · 피버 · 레이드의 아래 여백은 안전 인셋만 쓰지 않는다(안드로이드 브라우저는 0 이라 네비바에 붙는다)
  for (const m of css.matchAll(/(\.(?:fish|aqua|boss-raid)[^{}]*)\{([^}]*)\}/g))
    assert.doesNotMatch(m[2], /calc\(env\(safe-area-inset-bottom/, `${m[1].trim()} 은 --game-safe-bottom 을 쓴다`);
  const h = /\.fish-loadout \{[^}]*min-height: (\d+)px/.exec(css);
  assert.ok(h && Number(h[1]) >= 52, "낚시 준비 줄은 넉넉한 높이");
});
