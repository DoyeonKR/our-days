// 피버타임 lock. [사용자 2026-11-02 "피버타임을 가지고 서로 다른 그림을 오른쪽 왼쪽에 배치하고 뭐 10초 안에 같은 방향으로 맞추기"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DAILY_FISH_COINS, SPOTS, finishFever, fishingOf, sellCatch, type FishCatch } from "./fishing.ts";
import { FEVER_HARD_FROM, FEVER_NEED, FEVER_SECONDS, answerFever, feverCoins, feverPick, feverRound, startFever, tickFever } from "./fishingfever.ts";
import { familyOf } from "./aquarium.ts";
import { FISH_IMAGE_KEYS } from "./aquaimages.ts";
import { createIsland } from "./island.ts";

const DAY = "2026-11-02";
const guppy: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };

test("문제 — 왼쪽과 오른쪽은 항상 다르고 · 정답 쪽 그림이 가운데 그림이다 · 양쪽이 고르게 나온다 · 같은 seed 면 같다 · 모든 그림이 파일로 있다", () => {
  for (const spot of SPOTS) {
    let left = 0;
    for (let i = 0; i < 300; i++) {
      const r = feverRound(spot, i * 13 + 5, i % 30);
      assert.notEqual(r.left, r.right, spot.key);
      assert.equal(r[r.answer], r.target);
      assert.ok(FISH_IMAGE_KEYS.has(r.left) && FISH_IMAGE_KEYS.has(r.right), `${r.left} ${r.right}`);
      assert.ok(existsSync(join(process.cwd(), "public/aqua/fish", `${r.left}.webp`)));
      if (r.answer === "left") left++;
    }
    assert.ok(left > 90 && left < 210, `${spot.key} ${left}`);
    assert.deepEqual(feverRound(spot, 7, 3), feverRound(spot, 7, 3));
  }
});

test("처음엔 다른 계열끼리 — 한 종뿐인 계열의 어린 모습 · 다 큰 모습처럼 거의 같은 그림은 안 나온다", () => {
  for (const spot of SPOTS) for (let i = 0; i < FEVER_HARD_FROM; i++) {
    const r = feverRound(spot, i * 7 + 3, i);
    assert.ok(!r.left.startsWith("fry_") && !r.right.startsWith("juv_"), r.left);
    const fam = (k: string) => spot.pool.map(([f]) => f).find((f) => familyOf(f)?.finals.some((x) => x.key === k));
    assert.notEqual(fam(r.left), fam(r.right), `${spot.key} ${r.left} ${r.right}`);
  }
});

test("조금 지나면 닮은 물고기끼리 — 눈으로 봐야 한다", () => {
  const spot = SPOTS[1];
  const familyOfArt = (k: string) => spot.pool.map(([f]) => f).find((f) => k.endsWith(f) || familyOf(f)?.finals.some((x) => x.key === k));
  for (let i = 0; i < 40; i++) {
    const r = feverRound(spot, i + 1, FEVER_HARD_FROM + i);
    assert.equal(familyOfArt(r.left), familyOfArt(r.right), `${r.left} ${r.right}`);
  }
});

test("10초가 지나면 끝난다 · 맞히면 콤보 · 틀리면 콤보가 끊기고 1초를 잃는다 · 끝난 뒤엔 안 받는다", () => {
  let f = startFever();
  assert.equal(f.left, FEVER_SECONDS);
  f = answerFever(f, "left", "left");
  f = answerFever(f, "right", "right");
  assert.deepEqual([f.hits, f.combo, f.best, f.round], [2, 2, 2, 2]);
  const wrong = answerFever(f, "left", "right");
  assert.deepEqual([wrong.hits, wrong.combo, wrong.best, wrong.misses], [2, 0, 2, 1]);
  assert.equal(wrong.left, FEVER_SECONDS - 1);
  let t = f;
  for (let i = 0; i < 300; i++) t = tickFever(t, 0.05);
  assert.ok(t.done);
  assert.deepEqual(answerFever(t, "left", "left"), t);
  assert.ok(answerFever({ ...f, left: 0.5 }, "left", "right").done, "시간이 다 깎이면 끝");
});

test("고르는 법 — 민 방향이 먼저 · 안 밀었으면 누른 쪽", () => {
  assert.equal(feverPick(300, 200, 360), "left", "오른쪽에서 왼쪽으로 밀기");
  assert.equal(feverPick(60, 160, 360), "right");
  assert.equal(feverPick(90, 92, 360), "left");
  assert.equal(feverPick(300, 302, 360), "right");
});

test("게이지 — 끌어올릴 때마다 찬다 · 놓친 판은 안 찬다 · 끝나면 비고 보상을 받는다 · 하루 하트 상한을 넘지 않는다 · 안 찼으면 못 받는다", () => {
  let st = createIsland("콩", null, 0);
  st = { ...st, coins: 0 };
  assert.equal(fishingOf(st).feverMeter, 0, "옛 저장분은 0");
  assert.equal(finishFever(st, 10, 5, DAY).ok, false);
  for (let i = 0; i < FEVER_NEED + 2; i++) {
    const r = sellCatch(st, guppy, DAY);
    assert.ok(r.ok);
    if (r.ok) st = r.state;
  }
  assert.equal(fishingOf(st).feverMeter, FEVER_NEED, "천장에서 멈춘다");
  const before = st.coins;
  const r = finishFever(st, 12, 8, DAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.coins - before, feverCoins(12, 8));
  assert.equal(fishingOf(r.state).feverMeter, 0);
  assert.equal(fishingOf(r.state).feverBest, 12);
  const full: typeof st = { ...st, fishing: { ...fishingOf(st), day: DAY, dayCoins: DAILY_FISH_COINS - 3, feverMeter: FEVER_NEED } };
  const capped = finishFever(full, 30, 30, DAY);
  assert.ok(capped.ok && capped.coins === 3);
  assert.equal(feverCoins(100, 100), 150, "천장");
});

test("화면 — 게이지가 차면 시작할 수 있다 · 판 중엔 안 뜬다 · 장면 위에 펼친다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.ok(src.includes("<FishFever"));
  assert.ok(src.includes("finishFever("));
  assert.ok(src.includes("피버타임 시작"));
  assert.match(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"), /\.fish-fever \{[^}]*position: absolute/);
});
