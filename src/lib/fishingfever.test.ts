// 피버타임 lock. [사용자 2026-11-02 "낚는 도중에 피버타임 … 실패하면 무조건 놓치는거고 … 확률 3%" · "등급업 확률은 1~5% … 10초 안에 10문제를 모두 맞히는거야"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BAITS, SPOTS, castBlock, fishingOf, rollCatch, type FishCatch } from "./fishing.ts";
import { FEVER_CHANCE, FEVER_HARD_FROM, FEVER_ROUNDS, FEVER_SECONDS, answerFever, feverPick, feverRound, rollFever, startFever, tickFever, upgradeCatch, upgradeChance } from "./fishingfever.ts";
import { GRADES, familyOf } from "./aquarium.ts";
import { FISH_IMAGE_KEYS } from "./aquaimages.ts";

test("3% — 매 낚시마다 나오지 않는다 · 10초에 10문제", () => {
  assert.equal(FEVER_CHANCE, 0.03);
  assert.equal(rollFever(0.029), true);
  assert.equal(rollFever(0.03), false);
  assert.equal(FEVER_SECONDS, 10);
  assert.equal(FEVER_ROUNDS, 10);
});

test("다 맞히면 성공 · 하나라도 틀리면 바로 실패 · 10초가 지나면 실패 · 끝난 뒤엔 안 받는다", () => {
  let f = startFever();
  for (let i = 0; i < FEVER_ROUNDS - 1; i++) {
    f = answerFever(f, "left", "left");
    assert.equal(f.status, "on");
  }
  assert.equal(answerFever(f, "left", "right").status, "lost", "마지막 문제에서 틀려도 놓친다");
  const won = answerFever(f, "right", "right");
  assert.equal(won.status, "won");
  assert.deepEqual(answerFever(won, "left", "right"), won);
  let t = startFever();
  for (let i = 0; i < 300; i++) t = tickFever(t, 0.05);
  assert.equal(t.status, "lost");
});

test("문제 — 왼쪽과 오른쪽은 항상 다르고 · 정답 쪽 그림이 가운데 그림이다 · 양쪽이 고르게 나온다 · 같은 seed 면 같다 · 그림 파일이 있다", () => {
  for (const spot of SPOTS) {
    let left = 0;
    for (let i = 0; i < 300; i++) {
      const r = feverRound(spot, i * 13 + 5, i % FEVER_ROUNDS);
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

test("앞쪽 문제는 다른 계열끼리 · 뒤쪽 문제는 닮은 품종끼리 · 어린 모습은 안 나온다", () => {
  for (const spot of SPOTS) {
    const fam = (k: string) => spot.pool.map(([f]) => f).find((f) => familyOf(f)?.finals.some((x) => x.key === k));
    for (let i = 0; i < 40; i++) {
      const r = feverRound(spot, i * 7 + 3, i % FEVER_HARD_FROM);
      assert.ok(!r.left.startsWith("fry_") && !r.right.startsWith("fry_"), r.left);
      if (spot.pool.length >= 2) assert.notEqual(fam(r.left), fam(r.right), `${spot.key} ${r.left} ${r.right}`);
    }
  }
  const spot = SPOTS[1];
  const fam = (k: string) => spot.pool.map(([f]) => f).find((f) => familyOf(f)?.finals.some((x) => x.key === k));
  for (let i = 0; i < 40; i++) {
    const r = feverRound(spot, i + 1, FEVER_HARD_FROM);
    assert.equal(fam(r.left), fam(r.right));
  }
});

test("고르는 법 — 민 방향이 먼저 · 안 밀었으면 누른 쪽", () => {
  assert.equal(feverPick(300, 200, 360), "left");
  assert.equal(feverPick(60, 160, 360), "right");
  assert.equal(feverPick(90, 92, 360), "left");
  assert.equal(feverPick(300, 302, 360), "right");
});

test("등급업은 1~5% — 무조건이 아니다 · 빨리 끝낼수록 높다", () => {
  assert.equal(upgradeChance(0), 0.01);
  assert.equal(upgradeChance(5), 0.05);
  assert.equal(upgradeChance(9), 0.05);
  assert.ok(upgradeChance(2) > upgradeChance(1));
  for (let t = 0; t <= 10; t += 0.5) assert.ok(upgradeChance(t) >= 0.01 && upgradeChance(t) <= 0.05);
});

test("등급업하면 한 칸 위로 — 낮아지지 않는다 · 미끼 상한은 못 넘는다 · 쓰레기는 물고기가 된다 · 오를 곳이 없으면 그대로", () => {
  for (const spot of SPOTS) for (let bait = 0; bait < BAITS.length; bait++) for (let i = 0; i < 60; i++) {
    const c = rollCatch(spot, 5, 0.4, i * 17 + 3, { bait });
    const up = upgradeCatch(c, spot, bait, 5, i + 1);
    assert.ok(GRADES.indexOf(up.grade) >= GRADES.indexOf(c.grade), `${c.grade} → ${up.grade}`);
    if (GRADES.indexOf(c.grade) <= BAITS[bait].maxGrade) assert.ok(GRADES.indexOf(up.grade) <= BAITS[bait].maxGrade, `${spot.key} ${bait} ${up.grade}`);
  }
  const g: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 };
  const up = upgradeCatch(g, SPOTS[0], 6, 1, 3);
  assert.equal(up.grade, "보통");
  assert.equal(up.species, "tuxedo_guppy");
  assert.equal(upgradeCatch(g, SPOTS[0], 0, 1, 3).grade, "보통", "지렁이 상한(보통) 안");
  const top: FishCatch = { family: "guppy", stage: 2, species: "tuxedo_guppy", grade: "보통", difficulty: 2 };
  assert.deepEqual(upgradeCatch(top, SPOTS[0], 0, 1, 3), top, "상한이면 그대로");
  assert.equal(upgradeCatch({ ...g, junk: "junk_can" }, SPOTS[0], 0, 1, 5).junk, undefined);
});

test("화면 — 힘겨루기 도중에 끼어들고 실패는 놓침 · 성공은 바로 끌어올림 · 등급업은 확률로 · 게이지 · 별도 보상이 돌아오지 않는다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.ok(src.includes("<FishFever"));
  assert.ok(src.includes("rollFever("));
  assert.ok(src.includes('loseRound("fever")'));
  assert.match(src, /dice\(\) < upgradeChance\(/);
  assert.doesNotMatch(src, /finishFever|feverMeter|피버타임 시작/);
  assert.doesNotMatch(readFileSync(join(process.cwd(), "src/lib/fishing.ts"), "utf8"), /finishFever|feverMeter|feverBest/);
  assert.equal("feverMeter" in fishingOf({ fishing: undefined }), false);
  assert.match(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"), /\.fish-fever \{[^}]*position: fixed/);
});

test("사파리 — 전체 화면으로 body 에 그린다 · 시계는 그림을 받은 뒤 · 피버 전에 누른 손가락은 답이 아니다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishFever.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /createPortal\(/);
  assert.match(src, /document\.body/);
  assert.match(src, /preloadFishArt\(feverRoundArts\(spot, seed\)\)/);
  assert.match(src, /if \(!ready\) return;\s+let last/);
  assert.match(src, /down\.current = ready \? e\.clientX : null/);
  assert.match(src, /if \(from === null\) return/);
  assert.doesNotMatch(src, /down\.current \?\? e\.clientX/);
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  // 웹킷은 aspect-ratio + % 패딩 칸을 세로로 늘렸고, 칸이 낮으면 화살표가 잘렸다
  assert.doesNotMatch(css, /\.fish-fever-(target|side span) \{[^}]*aspect-ratio/);
  assert.match(css, /\.fish-fever-side \{[^}]*grid-template-rows: minmax\(0, 1fr\) auto/);
  const game = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.match(game, /preloadFishArt\(feverArts\(spot\)\)/);
  assert.match(game, /phase === "fever"\) return false/);
});

test("미끼가 떨어졌다는 안내의 조사 — '지렁이이' 가 아니라 '지렁이가'", () => {
  assert.equal(castBlock({ baits: {}, wormDay: "2026-11-02", level: 1 }, SPOTS[0], "float", BAITS[0].key, "2026-11-02"), "지렁이가 다 떨어졌어요");
});
