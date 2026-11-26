// 수조에 담을 확률 — 화면의 '성공 확률 N%'와 실제 판정이 같은가(2026-11-15 [사용자: "지금 수조에 담을 확률 ui 에 보이는 거와 같은지 검토해"])
// 화면(FishingGame)은 chance 하나를 계산해 버튼 글자(pct(chance))와 판정(tryStore · tryStoreSwap · tryNet 의 chance 인자)에 똑같이 넘기고,
// 엔진은 roll(0 ~ 1 고른 난수) < chance 면 담는다 — 그래서 실제 성공률은 보이는 숫자와 같다. 여기서 그 셋을 잠그고 실제 함수를 2만 번 돌려 잰다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureChance, tryStore, type FishCatch } from "./fishing.ts";
import { createIsland, type IslandState } from "./island.ts";
import { coopChance } from "./fishcoop.ts";

const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, 0), coins });
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };
const DAY = "2026-11-15";
const pct = (v: number) => Math.round(v * 100);

test("stored rate equals the shown chance (20,000 real tryStore calls each)", () => {
  // 씨앗 있는 난수(같은 결과 · 고른 분포)
  let seed = 12345;
  // mulberry32 — 고른 32비트 난수(값이 앞 값에 기대지 않는다)
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const shown of [0.05, 0.23, 0.5, 0.77, 0.95]) {
    let stored = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const r = tryStore(rich(), guppy, shown, rnd(), 1000, DAY);
      assert.ok(r.ok);
      if (r.ok && r.outcome === "stored") stored++;
    }
    assert.ok(Math.abs(stored / N - shown) < 0.012, `보이는 ${pct(shown)}% · 실제 ${(stored / N * 100).toFixed(1)}%`);
  }
});

test("the shown number is exactly the chance used (no hidden rounding or modifier)", () => {
  // 확률은 백분율 한 자리로 끊어 두므로 버튼의 반올림이 값을 바꾸지 않는다
  for (const q of [0, 0.37, 0.8, 1]) for (const stat of [0, 12, 40]) for (const d of [0, 3, 7]) {
    const c = captureChance(stat, d, q, q > 0.5, "float", 0.03);
    assert.ok(Math.abs(Math.round(c * 100) / 100 - c) < 1e-9, `${c}`);
  }
  // 함께 끌어올리기 — +15%p, 95% 상한, 1(피버 · 주인)은 그대로
  assert.equal(coopChance(0.5, true), 0.65);
  assert.equal(coopChance(0.9, true), 0.95);
  assert.equal(coopChance(1, true), 1);
  assert.equal(coopChance(0.4, false), 0.4);
  // 화면 — 같은 chance 를 글자와 판정에 넘긴다
  const game = readFileSync(new URL("../components/FishingGame.tsx", import.meta.url), "utf8");
  assert.match(game, /const chance = fish \? pinCapture\(fish\.family, coopChance\(soloChance, coopHelpedNow\)\) : 0;/); // 유진만 9% 고정(fishing.FIXED_CAPTURE — eventfish.test)
  assert.match(game, /const roll = dice\(\), c = fish, p = chance, t = clock\(\);/);
  for (const call of ["tryNet(s, c, p, roll,", "tryStore(s, c, p, roll,", "tryStoreSwap(s, c, releaseId, p, roll,"]) assert.ok(game.includes(call), call);
  assert.match(game, /수조에 담기 · 성공 확률 \{pct\(chance\)\}/);
  assert.match(game, /const dice = \(\) => Math\.random\(\);/);
  assert.match(game, /const pct = \(v: number\) => `\$\{Math\.round\(v \* 100\)\}%`;/);
});
