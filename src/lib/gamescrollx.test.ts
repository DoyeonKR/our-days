import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 게임 창은 좌우로 스크롤하지 않는다(2026-11-15) — 사용자 캡처: 낚시 화면이 통째로 왼쪽으로 밀리고, 수조의 '잡아먹혔어요' 카드가 오른쪽으로 삐져나왔다
const css = readFileSync(new URL("../styles/games.css", import.meta.url), "utf8");
const guard = readFileSync(new URL("../components/GameWindowGuard.tsx", import.meta.url), "utf8");

test("game shells scroll vertically only", () => {
  assert.match(css, /\.aqua-shell, \.merge-shell, \.island-shell \{ overflow-x: clip; overscroll-behavior-x: none; \}/);
  // 스크립트 · 포커스로 옆으로 밀린 창은 바로 0 으로
  assert.match(guard, /document\.addEventListener\("scroll", onShellScroll, \{ capture: true, passive: true \}\)/);
  assert.match(guard, /t\.scrollLeft !== 0 && t\.matches\(SHELL\)\) t\.scrollLeft = 0/);
  assert.match(guard, /document\.removeEventListener\("scroll", onShellScroll, \{ capture: true \}\)/);
});

test("eaten card pictures fit inside the card", () => {
  // 카드 안 폭 = min(100%, 320px) − 좌우 여백 40 = 280 이하 — 그림 둘(각 116 이하) + 화살표 + 틈 16 이 그 안에 들어온다
  const m = css.match(/\.aqua-eaten-pics \.aqua-grown-pic \{ width: min\((\d+)px, [\d.]+vw\)/);
  assert.ok(m, "eaten pic size");
  assert.ok(Number(m![1]) * 2 + 16 + 16 <= 280, `${m![1]}px x2 fits`);
  assert.match(css, /\.aqua-grown > div \{ max-width: 100%; min-width: 0; \}/);
});

test("one-column grids in the tank screen never grow wider than the screen", () => {
  // 2026-11-15 사용자 캡처(갤럭시 · 삼성 인터넷): 잡아먹힌 물고기 이름이 길면 칸을 안 정한 격자가 그 한 줄 폭(잘리게 해 둔 글자의 원래 폭)만큼 넓어져
  // 포만 · 물 막대 · 상성 주의 · 목록이 오른쪽으로 쏠리며 잘렸다
  for (const sel of [".aqua-meters", ".aqua-list", ".aqua-eaten-log ul"]) {
    assert.ok(css.includes(`${sel} { display: grid; grid-template-columns: minmax(0, 1fr);`), sel);
  }
  assert.match(css, /\.aqua-eaten-log-head \{ display: flex; flex-wrap: wrap;/);
});
