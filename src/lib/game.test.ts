// 게임 아케이드 순수 로직 회귀 lock. [2026-07-06]
// 특히 승패 방향(서버 resolve_challenge RPC 와 동일 계약) + 결정적 PRNG(두 사람 같은 배치).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideWinner,
  gameRecord,
  memoryDeck,
  memoryScore,
  mulberry32,
  orderLayout,
  orderScore,
  reactionScore,
  tapScore,
  timingScore,
  MEMORY_PAIRS,
  ORDER_N,
  WIN_POINTS,
  DRAW_POINTS,
} from "./game.ts";

test("reactionScore: 낮을수록 좋음, 하한 미만은 부정(9999)", () => {
  assert.equal(reactionScore(230), 230);
  assert.equal(reactionScore(79), 9999); // 폴스스타트/봇
  assert.equal(reactionScore(80), 80); // 경계 통과
  assert.equal(reactionScore(NaN), 9999);
  assert.equal(reactionScore(-5), 9999);
});

test("memoryScore: 빠르고 실수 적을수록 높음(0 하한, 단조)", () => {
  const fast = memoryScore(4000, 0);
  const slow = memoryScore(20000, 0);
  const sloppy = memoryScore(4000, 5);
  assert.ok(fast > slow, "빠르면 높아야");
  assert.ok(fast > sloppy, "실수 적으면 높아야");
  assert.equal(memoryScore(999999, 999), 0); // 0 하한
});

test("decideWinner reaction: 낮은 ms 승, 15ms 이내 무승부 [서버 계약]", () => {
  assert.equal(decideWinner("reaction", 200, 260), "a"); // 챌린저가 빠름
  assert.equal(decideWinner("reaction", 300, 240), "b"); // 상대가 빠름
  assert.equal(decideWinner("reaction", 210, 220), "draw"); // 10ms 차 → 무
  assert.equal(decideWinner("reaction", 226, 210), "b"); // 챌린저 느림(16ms 차) → 상대 승
});

test("decideWinner memory: 높은 점수 승, 동점 무승부 [서버 계약]", () => {
  assert.equal(decideWinner("memory", 900, 800), "a");
  assert.equal(decideWinner("memory", 700, 950), "b");
  assert.equal(decideWinner("memory", 850, 850), "draw");
});

test("신규 게임 채점 방향 [서버 계약과 동일]", () => {
  // 연타: 많을수록 승(higher)
  assert.equal(tapScore(37), 37);
  assert.equal(decideWinner("tap", 40, 30), "a");
  assert.equal(decideWinner("tap", 20, 55), "b");
  assert.equal(decideWinner("tap", 30, 30), "draw");
  // 숫자 순서: 시간+실수 낮을수록 승(lower). 오탭 2000 페널티.
  assert.equal(orderScore(8000, 0), 8000);
  assert.equal(orderScore(8000, 2), 12000);
  assert.equal(decideWinner("order", 8000, 12000), "a"); // 빠른 쪽 승
  assert.equal(decideWinner("order", 15000, 9000), "b");
  // 타이밍: 목표 거리 낮을수록 승(lower). 0~1000.
  assert.equal(timingScore(0.5, 0.5), 0); // 정확
  assert.equal(timingScore(0.7, 0.5), 200);
  assert.equal(decideWinner("timing", 40, 120), "a"); // 더 가까운 쪽 승
});

test("orderLayout: 같은 seed = 같은 배치 + 1..N 각 1번", () => {
  const l1 = orderLayout(2024);
  assert.deepEqual(orderLayout(2024), l1);
  assert.equal(l1.length, ORDER_N);
  const sorted = [...l1].sort((a, b) => a - b);
  assert.deepEqual(sorted, Array.from({ length: ORDER_N }, (_, i) => i + 1));
  assert.notDeepEqual(orderLayout(2025), l1);
});

test("mulberry32: 같은 seed = 같은 수열(결정적)", () => {
  const r1 = mulberry32(12345);
  const r2 = mulberry32(12345);
  const seq1 = [r1(), r1(), r1()];
  const seq2 = [r2(), r2(), r2()];
  assert.deepEqual(seq1, seq2);
  // 다른 seed 는 다른 수열
  const r3 = mulberry32(999);
  assert.notEqual(r3(), seq1[0]);
});

test("memoryDeck: 같은 seed = 같은 배치(두 사람 공정) + 각 쌍 2장", () => {
  const d1 = memoryDeck(42);
  const d2 = memoryDeck(42);
  assert.deepEqual(d1, d2, "같은 seed 는 같은 배치");
  assert.equal(d1.length, MEMORY_PAIRS * 2);
  // 각 값이 정확히 2번씩
  const counts = new Map<number, number>();
  for (const v of d1) counts.set(v, (counts.get(v) ?? 0) + 1);
  for (let i = 0; i < MEMORY_PAIRS; i++) assert.equal(counts.get(i), 2);
  // 다른 seed 는 (거의 항상) 다른 배치
  assert.notDeepEqual(memoryDeck(43), d1);
});

test("gameRecord: 승/패/무 + 포인트 집계", () => {
  const me = "u-me";
  const ch = [
    { status: "resolved", winner: me, result: "a" }, // 승
    { status: "resolved", winner: "u-partner", result: "b" }, // 패
    { status: "resolved", winner: null, result: "draw" }, // 무
    { status: "resolved", winner: me, result: "a" }, // 승
    { status: "open", winner: null, result: null }, // 진행중 — 미집계
  ] as const;
  const r = gameRecord([...ch], me);
  assert.deepEqual(
    { wins: r.wins, losses: r.losses, draws: r.draws },
    { wins: 2, losses: 1, draws: 1 },
  );
  assert.equal(r.points, 2 * WIN_POINTS + 1 * DRAW_POINTS);
});

test("gameRecord: uid null 이면 전부 0(로딩 전 오집계 방지)", () => {
  const r = gameRecord(
    [{ status: "resolved", winner: "x", result: "a" }],
    null,
  );
  assert.deepEqual(r, { wins: 0, losses: 0, draws: 0, points: 0 });
});
