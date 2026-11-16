// 심해 낚시 개편(2026-11-14) [사용자: "심해 낚시 관련해서 개선할거 … 너가 제안한 작업들 모두 진행"]
// 수심 연동 · 드랙(역회전) · 심해 릴 · 대왕오징어 습격 · 가장 깊은 기록 · 천천히 올리기 덤 · 얕은 낚시터 막기 · 수심별 쓰레기 · 수심계 하나로 · 키보드 · 멈춤 반응
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { BAITS, DEEP_MIN_WATER, REELS, SPOTS, buyReel, castBlock, deepestOf, noteDeepest, reelOf, rollCatch, spotDepth } from "./fishing.ts";
import { DEEP_METERS, deepLen, deepSurvivedGrab, deepTune, startDeep, stepDeep, type Deep } from "./fishingmodes.ts";

const EFF = { power: 5, line: 5 };
const DT = 1 / 30;

test("수심 연동 — 예전 기준 120m 가 1배, 얕으면 짧고 깊으면 길다(대수로 늘어 1500m 도 1.5배 안)", () => {
  assert.equal(deepLen(DEEP_METERS), 1);
  assert.ok(deepLen(15) < 1 && deepLen(15) >= 0.75);
  assert.ok(deepLen(1500) > 1.3 && deepLen(1500) <= 1.5);
  const near = deepTune(3, EFF, 0, 20), far = deepTune(3, EFF, 0, 1500);
  assert.ok(far.reel < near.reel, "깊으면 더 오래 감는다");
});

test("드랙 — 파고들 때 반대로 돌리면 멈추기보다 장력이 빨리 내려가고, 대신 깊이를 더 내준다", () => {
  const tune = deepTune(3, EFF);
  const diving: Deep = { ...startDeep(1, tune), depth: 0.6, tension: 0.7, diveLeft: 1, warnLeft: 0 };
  const stop = stepDeep(diving, 0.3, 0, tune, 0), back = stepDeep(diving, 0.3, 0, tune, 1.2);
  assert.ok(back.tension < stop.tension, `풀기 ${back.tension} · 멈추기 ${stop.tension}`);
  assert.ok(back.depth > stop.depth, "푸는 만큼 내려간다");
  const calm: Deep = { ...startDeep(1, tune), depth: 0.6, tension: 0.6, nextDive: 9 };
  const rel = stepDeep(calm, 0.5, 0, tune, 1);
  assert.ok(rel.tension < 0.6 && rel.depth > 0.6 && rel.idle === 0, "평소에 풀어도 장력이 내려가고 · 느슨해서 빠지지는 않는다");
});

test("심해 릴 — 단계가 오르면 더 빨리 감기고 초록 칸이 넓다 · 하트로 한 단계씩", () => {
  const a = deepTune(3, EFF, 0), b = deepTune(3, EFF, REELS.length - 1);
  assert.ok(b.reel > a.reel && b.hi - b.lo > a.hi - a.lo);
  const st = { coins: 2000, fishPlus: {} } as never;
  const r = buyReel(st);
  assert.ok(r.ok && reelOf(r.state) === 1 && r.state.coins === 2000 - REELS[1].price);
  assert.equal(buyReel({ coins: 10, fishPlus: {} } as never).ok, false);
});

test("대왕오징어 습격 — 절반쯤 끌어올렸을 때 긴 예고 뒤 크게 파고들고, 버텨 내면 대물 표시 · 습격 없는 판엔 없다", () => {
  const tune = deepTune(3, EFF, 0, 1200, true);
  let d: Deep = { ...startDeep(5, tune), depth: 0.5, nextDive: 99 };
  d = stepDeep(d, DT, 1.2, tune);
  assert.equal(d.grab, 2, "예고");
  let saw3 = false, guard = 0;
  while (d.status === "on" && guard++ < 3000) {
    const r = d.grab === 2 || d.diveLeft > 0 ? 0 : (tune.lo + tune.hi) / 2;
    const back = d.diveLeft > 0 && d.tension > 0.5 ? 1.2 : 0;
    d = stepDeep(d, DT, r, tune, back);
    if (d.grab === 3) saw3 = true;
  }
  assert.ok(saw3, "크게 파고든다");
  assert.equal(d.status, "landed");
  assert.ok(deepSurvivedGrab(d));
  assert.equal(startDeep(5, deepTune(3, EFF)).grab, 0);
});

test("얕은 낚시터에선 심해 낚시를 못 한다 · 깊은 곳은 된다", () => {
  const f = { level: 20, baits: { [BAITS[1].key]: 9 }, wormDay: "2026-11-14" };
  for (const s of SPOTS) {
    const why = castBlock(f, s, "deep", BAITS[1].key, "2026-11-14") ?? "";
    if (spotDepth(s) < DEEP_MIN_WATER) assert.match(why, /심해 낚시를 못 해요/, s.key);
    else assert.doesNotMatch(why, /심해 낚시를 못 해요/, s.key);
  }
});

test("수심별 쓰레기 — 심해 탐사선 부품은 1000m 아래에서만", () => {
  const abyss = SPOTS.find((s) => s.key === "abyss")!;
  const probe = (m: number) => Array.from({ length: 6000 }, (_, i) => rollCatch(abyss, 5, 0.5, i * 131 + 7, { bait: 5, method: "deep", junk: true, depthM: m })).filter((c) => c.junk === "junk_probe").length;
  assert.equal(probe(300), 0);
  assert.ok(probe(1400) > 0);
});

test("가장 깊은 기록 — 더 깊어야 바뀐다", () => {
  const st = { fishPlus: {} } as never;
  const a = noteDeepest(st, { m: 300, family: "octopus", key: "octopus", at: 1 });
  assert.ok(a.record && deepestOf(a.state)?.m === 300);
  const b = noteDeepest(a.state, { m: 200, family: "squid", key: "squid", at: 2 });
  assert.ok(!b.record && deepestOf(b.state)?.m === 300);
});

test("화면 — 멈춘 깊이로 힘겨루기 · 반대로 돌리면 드랙 · 다이얼이 감는 쪽 · 푸는 중을 보인다 · 멈추면 곧바로 · 수심계 하나 · 천천히 올리면 덤", () => {
  const g = readFileSync("src/components/FishingGame.tsx", "utf8");
  assert.match(g, /deepTune\(fightLevel\(fish\), eff, reelOf\(st\), meters,/);
  assert.match(g, /Math\.sign\(d\) === -reelDir\.current\) backAcc\.current \+= Math\.abs\(d\)/);
  // 폰이 먼저(2026-11-14 [사용자: "키보드에 맞추지말고 모바일에 맞춰"]) — 다이얼이 감는 쪽 · 푸는 중 · 파고들 때 할 일을 손가락 위에 보인다
  assert.match(g, /reelDir=\{reelDirS\} release=\{releasing\}/);
  const dial = readFileSync("src/components/DeepDial.tsx", "utf8");
  assert.match(dial, /release \? "줄 푸는 중" : dive \? "멈추거나 반대로 풀기"/);
  assert.match(dial, /className="fish-dial-dir"/);
  assert.match(g, /raw < spinNow\.current \? 18 : 7/);
  assert.match(g, /stepDeep\(cur, dt, rps, tune, back\)/);
  assert.match(g, /sinking: phase === "sink"/);
  assert.match(g, /\.capture \+ \(gentle \? DEEP_GENTLE_BONUS : 0\)/);
  const fx = readFileSync("src/lib/fishingfx.ts", "utf8");
  assert.match(fx, /if \(v\.sinking\) return;/);
  assert.match(fx, /\(v\.deepM \?\? 0\) > 0 \? \(v\.deepM \?\? 0\) : 120/);
  assert.match(fx, /meters >= 1000 \? 2 : meters >= 200 \? 1 : 0/);
});
