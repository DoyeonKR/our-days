// 배치판 lock — 힌트(✨ 조합 · ⚡ 생산 2배)가 엔진 결과와 같다 · 풍경과 같은 누르기 함수. [2026-09-24]
// [사용자: "그다음 개선해야할 곳은 꾸미기탭이야"]
//
// 조합·생산 부스트는 '가로·세로로 맞닿았는지'가 전부인데, 원근 풍경에선 그게 안 보였다. 배치판이
// 놓을 자리를 빛내 주는데, 그 빛이 엔진과 한 칸이라도 다르면 거짓말이다 — 무작위 섬으로 전부 맞춰 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DECORS,
  DECOR_COLS,
  activeCombos,
  createIsland,
  decorRowsOf,
  placeDecor,
  produceStatus,
  type IslandState,
} from "./island.ts";
import { placementHint } from "./decorhint.ts";

const T0 = Date.UTC(2026, 8, 25, 3, 0, 0);

function rich(): IslandState {
  const s = createIsland("콩", null, T0);
  return { ...s, level: 30, coins: 10_000_000, bond: { ...s.bond, level: 5 } };
}
/** 결정적 난수 — 실패를 그대로 재현할 수 있게 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}
const boostedCount = (s: IslandState) => produceStatus(s, T0).filter((p) => p.boosted).length;
const liveIds = (s: IslandState) => new Set(activeCombos(s).map((c) => c.id));

test("★ 힌트 = 엔진 — 빛나는 칸에 놓으면 그 조합·2배가 생기고, 안 빛나는 칸엔 아무것도 안 생긴다", () => {
  // 생산 장식 셋 + 그 부스트 이웃 + 조합이 잦은 장식을 섞어 뽑는다(아무거나 뽑으면 조합이 드물다)
  const pool = DECORS.map((d) => d.key);
  let checked = 0;
  let lit = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed);
    let s = rich();
    const n = 5 + Math.floor(r() * 9);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * DECOR_COLS);
      const y = Math.floor(r() * decorRowsOf(s));
      const next = placeDecor(s, pool[Math.floor(r() * pool.length)], x, y, T0);
      s = next;
    }
    const before = liveIds(s);
    const b0 = boostedCount(s);
    for (let k = 0; k < 6; k++) {
      const key = pool[Math.floor(r() * pool.length)];
      for (let y = 0; y < decorRowsOf(s); y++)
        for (let x = 0; x < DECOR_COLS; x++) {
          if (s.decor.some((d) => d.x === x && d.y === y)) continue;
          const hint = placementHint(s, key, x, y);
          const after = placeDecor(s, key, x, y, T0);
          assert.notEqual(after, s, `전제: ${key} 를 (${x},${y}) 에 놓을 수 있어야 한다`);
          const fresh = [...liveIds(after)].filter((id) => !before.has(id)).sort();
          const said = (hint?.combos ?? []).map((c) => c.id).sort();
          assert.deepEqual(said, fresh, `seed ${seed} · ${key}@(${x},${y}) — 힌트 조합 ${said} ≠ 엔진 ${fresh}`);
          assert.equal(hint?.boost ?? false, boostedCount(after) > b0, `seed ${seed} · ${key}@(${x},${y}) — 2배 힌트가 엔진과 다르다`);
          checked++;
          if (hint) lit++;
        }
    }
  }
  assert.ok(checked > 1000, `검사한 칸이 너무 적다(${checked})`);
  assert.ok(lit > 30, `빛난 칸이 거의 없다(${lit}) — 이 테스트가 빈 검사가 됐다`);
});

test("옮기는 중이면 자기 원래 자리는 이웃이 아니다(ignoreId)", () => {
  let s = rich();
  s = placeDecor(s, "henhouse", 2, 2, T0);
  s = placeDecor(s, "haystack", 3, 2, T0);
  const hay = s.decor.find((d) => d.key === "haystack")!;
  // 건초를 옮기려 들고 있으면 — 닭장은 이제 부스트가 아니므로 닭장 옆 칸이 ⚡ 로 빛나야 한다
  const hint = placementHint(s, "haystack", 2, 3, hay.id);
  assert.ok(hint?.boost, "들고 있는 건초가 원래 자리에서 닭장을 계속 부스트한다고 본다");
  // 그리고 닭장 마당(조합)도 '새로' 생기는 것으로 본다
  assert.ok(hint?.combos.some((c) => c.id === "coopyard"));
});

// ── 화면 배선 ────────────────────────────────────────────────────

const strip = (p: string) =>
  readFileSync(join(import.meta.dirname, "..", p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

test("★ 풍경과 배치판은 같은 누르기 함수를 쓴다 — 두 화면의 동작이 갈리지 않게", () => {
  const g = strip("components/IslandGame.tsx");
  assert.match(g, /const onDecorSlot = async/);
  assert.match(g, /<DecorBoard[\s\S]{0,400}onTap=\{\(x, y, p\) => void onDecorSlot\(x, y, p\)\}/);
  assert.match(g, /<IslandScene[\s\S]{0,1400}onSlotTap=\{\(x, y, p\) => void onDecorSlot\(x, y, p\)\}/);
});

test("놓기·옮기기를 시작하면 배치판으로 — 놓을 자리는 이웃이 보이는 곳에서", () => {
  const g = strip("components/IslandGame.tsx");
  const pick = g.slice(g.indexOf("const pickDecor"), g.indexOf("const pickDecor") + 400);
  assert.match(pick, /setDecorStage\("board"\)/, "장식을 고르면 배치판으로 안 넘어간다");
  assert.match(g, /setMoveId\(decorAction\.id\);[\s\S]{0,160}setDecorStage\("board"\)/, "옮기기를 시작하면 배치판으로 안 넘어간다");
});

test("배치판은 엔진 힌트를 읽는다 — 화면이 따로 규칙을 들지 않는다", () => {
  const b = strip("components/island/DecorBoard.tsx");
  assert.match(b, /from "@\/lib\/decorhint"/);
  assert.match(b, /placementHint\(s, placing, x, y, movingId\)/);
  assert.doesNotMatch(b, /boostBy/, "배치판이 부스트 규칙을 직접 계산한다 — decorhint 한 곳에서");
});
