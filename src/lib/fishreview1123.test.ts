// 낚시 · 수조 리뷰(2026-11-23) [사용자: "낚시 수조 리뷰해" → "Fix all"] — 낚시 쪽 고친 것을 잠근다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { BAITS, SPOTS, rollCatch, type FishCatch } from "./fishing.ts";
import { upgradeCatch } from "./fishingfever.ts";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("피버 등급 올리기는 심해 표시(값 1.4배)를 잃지 않는다", () => {
  let checked = 0;
  for (const spot of SPOTS) for (let i = 0; i < 40; i++) {
    const c: FishCatch = { ...rollCatch(spot, 5, 0.4, i * 31 + 7, { bait: BAITS.length - 1 }), deep: true };
    const up = upgradeCatch(c, spot, BAITS.length - 1, 5, i + 1);
    if (up === c || c.junk) continue;
    assert.equal(up.deep, true, `${spot.key} ${c.family} → ${up.family}`);
    checked++;
  }
  assert.ok(checked > 20, `오른 판 ${checked}`);
  // 심해가 아닌 판엔 붙이지 않는다
  const g: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };
  assert.equal(upgradeCatch(g, SPOTS.find((x) => x.key === "brook")!, 6, 1, 3).deep, undefined);
});

test("화면 — 레이드 토벌 저장이 결과 없이 끝나면 한 번 더 저장하고, 그래도 없으면 왕관 물고기를 끌어올리지 않는다", () => {
  const src = read("src/components/FishingGame.tsx");
  assert.ok(src.includes("if (r.end === \"kill\" && saved && !saved.res && raidRetry.current) saved = await raidRetry.current()"), "같은 저장을 한 번 더");
  assert.ok(src.includes("if (!saved?.res) { setMsg(`${b.name} 토벌을 저장하지 못했어요"), "저장 없으면 끌어올리지 않는다");
  assert.ok(src.indexOf("if (!saved?.res) { setMsg(") < src.indexOf("const c = bossCatch(b);"), "끌어올리기 전에 막는다");
});

test("화면 — 늦게 끝난 판매 저장은 다음 판 결과 카드를 건드리지 않는다 · 심해 판이 피버로 끝나도 깊이 기록 · 대물 · 숨은 동안 판이 멈춘다", () => {
  const src = read("src/components/FishingGame.tsx"), tick = read("src/components/fishing/roundTick.ts");
  const sell = src.slice(src.indexOf("async function sell()"), src.indexOf("async function sell()") + 1500);
  assert.ok(sell.indexOf("if (fishRef.current !== c) return;") < sell.indexOf("setResult(r);"), "성공 길도 지금 물고기인지 본다");
  assert.ok(tick.includes("if (next.status === \"on\" && feverNow(next.depth, deepQuality(next))) { k.deepPend.current = finish; return; }"));
  assert.ok(src.includes("pend?.(); // 심해 판"), "피버를 이기면 남긴 일을 한다");
  assert.match(src, /if \(pausedRef\.current \|\| document\.hidden\) return;/);
});

test("수조 → 낚시 숙련은 수조에서 자란 몫이 있을 때만(다 큰 채로 잡아 바로 보내면 팔 때와 같다)", () => {
  assert.match(read("src/lib/fishing.ts"), /f\.stage === 2 && raisedShare\(f\) > 0 \? releaseSpot\(f, synced\.life\)/);
});
