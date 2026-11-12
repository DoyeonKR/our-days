// 낚싯대 원화의 그려 넣은 줄 지우기 · 물 밑 실루엣(2026-11-11)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RODS_WITH_DRAWN_LINE, stripThinStrokes } from "./rodstrip.ts";

function canvas(w: number, h: number) { return new Uint8ClampedArray(w * h * 4); }
function put(d: Uint8ClampedArray, w: number, x: number, y: number, a = 255) { const i = (y * w + x) * 4; d[i] = 200; d[i + 1] = 150; d[i + 2] = 80; d[i + 3] = a; }

test("굵은 몸통은 남고, 가는 줄 · 떠 있는 작은 조각은 지운다 · 몸통 곁 옅은 테두리는 둔다", () => {
  const w = 120, h = 80, d = canvas(w, h);
  for (let y = 30; y < 44; y++) for (let x = 10; x < 110; x++) put(d, w, x, y); // 몸통(14칸)
  for (let x = 10; x < 110; x++) put(d, w, x, 29, 40); // 위 가장자리의 옅은 테두리
  for (let x = 20; x < 100; x++) put(d, w, x, 60); // 그려 넣은 줄(1칸)
  for (let y = 44; y < 60; y++) put(d, w, 60, y); // 몸통에서 줄로 내려가는 가는 줄
  for (let y = 5; y < 9; y++) for (let x = 5; x < 9; x++) put(d, w, x, y); // 떠 있는 매듭(4×4)
  const cut = stripThinStrokes(d, w, h);
  const a = (x: number, y: number) => d[(y * w + x) * 4 + 3];
  assert.ok(cut > 80);
  assert.equal(a(50, 37), 255, "몸통");
  assert.equal(a(10, 30), 255, "몸통 모서리");
  assert.equal(a(50, 29), 40, "옅은 테두리는 남는다");
  assert.equal(a(50, 60), 0, "줄");
  assert.equal(a(60, 52), 0, "몸통에서 내려가는 줄");
  assert.equal(a(6, 6), 0, "떠 있는 매듭");
});

test("줄이 그려진 낚싯대만 지운다 — 끝이 가는 나머지 낚싯대는 깎으면 끝이 상한다", () => {
  assert.deepEqual([...RODS_WITH_DRAWN_LINE].sort(), ["rod_bamboo", "rod_dragon"]);
  const fx = readFileSync(join(process.cwd(), "src/lib/fishingfx.ts"), "utf8");
  assert.match(fx, /RODS_WITH_DRAWN_LINE\.has\(key\) \? withoutDrawnLine\(img\) : img/);
});

test("물 밑 그림자는 물렸을 물고기의 실루엣 — 꽝도 진짜 물고기 모습이라 공개 전엔 모른다", () => {
  const game = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.match(game, /const sk = fishArtKey\(c\); fx\?\.shape\(sk,/, "catchArt(꽝이면 쓰레기 그림) 가 아니라 fishArtKey");
  const fx = readFileSync(join(process.cwd(), "src/lib/fishingfx.ts"), "utf8");
  assert.match(fx, /globalCompositeOperation = "source-in"/, "그림의 윤곽만 어둡게");
  assert.match(fx, /const sh = this\.shapeArt;\s*if \(sh\)/);
});

test("낚시 화면 다듬기(2026-11-11) — 줄 떨림은 매끈하게 · 결과 카드 동안 낚싯대를 걷는다 · 심해엔 찌가 없다 · 판이 크다", () => {
  const fx = readFileSync(join(process.cwd(), "src/lib/fishingfx.ts"), "utf8");
  assert.doesNotMatch(fx, /Math\.sin\(this\.t \* 74 \+ k \* 30\)/, "짧은 물결 떨림은 22점으로 그려져 지그재그로 보였다");
  assert.match(fx, /const off = amp \* 0\.55 \* \(w \* vib1/);
  assert.match(fx, /hide = ph === "landed" \|\| ph === "scoop" \|\| ph === "result"/);
  assert.match(fx, /if \(v\.method === "deep"\) \{ this\.drawSinker\(c\); return; \}/);
  assert.match(fx, /this\.view\.method === "deep" && !this\.fly\) return \{ x: b\.x, y: b\.y, on: true \}/);
  const css = readFileSync(join(process.cwd(), "src/styles/games.css"), "utf8");
  assert.match(css, /--fish-chrome: calc\(var\(--game-safe-top, 0px\) \+ 172px \+ var\(--game-safe-bottom, 0px\)\)/);
  assert.match(css, /calc\(var\(--fish-w\) \* 2\.05\)/);
  const game = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.match(game, /method === "deep" \? "줄이 크게 당겨질 때까지 기다려요"/);
});
